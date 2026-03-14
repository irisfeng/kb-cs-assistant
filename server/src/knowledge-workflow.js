import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const xlsx = require("xlsx");

const SENSITIVE_PATTERNS = [
  { pattern: /\b(?:admin|administrator)\b/i, reason: "admin_account_reference" },
  { pattern: /\b(?:ssh|shell)\b/i, reason: "ssh_reference" },
  { pattern: /\b(?:password|passwd|pwd)\b/i, reason: "password_reference_en" },
  { pattern: /(?:默认账密|初始账密|默认密码|初始密码)/, reason: "default_credentials" },
  {
    pattern:
      /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})\b/,
    reason: "private_ip_address",
  },
  {
    pattern: /https?:\/\/(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/i,
    reason: "private_url",
  },
  { pattern: /\b(?:ictuser|root|task_test)\b/i, reason: "default_user_candidate" },
];

const INTERNAL_SUPPORT_PATTERNS = [
  /操作指引/i,
  /部署/i,
  /接入平台/i,
  /管理平台/i,
  /任务创建/i,
  /任务删除/i,
  /任务查看/i,
  /任务监测/i,
  /平台登录信息/i,
  /登录信息/i,
  /页面地址及默认账密如下/i,
  /仅内部使用|内部使用|不对外提供/i,
  /设备状态/i,
];

const PUBLIC_CS_PATTERNS = [
  /客服文档/i,
  /产品介绍/i,
  /资费/i,
  /订购/i,
  /退订/i,
  /退费/i,
  /常见问题/i,
  /FAQ/i,
  /F&Q/i,
];

function ensureValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function parseVersion(name) {
  const match = name.match(/V(\d+(?:\.\d+)?)/i);
  if (!match) {
    return { version: "", versionRank: -1 };
  }

  return {
    version: `V${match[1]}`,
    versionRank: Number.parseFloat(match[1]),
  };
}

function parseEffectiveDate(name) {
  const match = name.match(/(20\d{6})/);
  if (!match) {
    return "";
  }

  const raw = match[1];
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function inferDocumentType(fileName) {
  if (/F&Q|FAQ/i.test(fileName)) {
    return "FAQ_INDEX";
  }
  if (/客服文档/i.test(fileName)) {
    return "CS_DOC";
  }
  if (/操作手册|使用手册/i.test(fileName)) {
    return "MANUAL";
  }
  return "GENERAL";
}

function inferProductLine(fileName) {
  if (fileName.includes("翼智企") || fileName.includes("ICT")) {
    return "ICT";
  }
  if (fileName.includes("商城")) {
    return "MARKETPLACE";
  }
  if (fileName.includes("天翼看家")) {
    return "HOME_AI";
  }
  if (fileName.includes("视联百川")) {
    return "CLIENT";
  }
  return "GENERAL";
}

function inferProductName(fileName) {
  const stem = fileName.replace(/\.[^.]+$/, "");
  const cleaned = stem
    .replace(/-全国-?20\d{6}V\d+(?:\.\d+)?/i, "")
    .replace(/-全国20\d{6}V\d+(?:\.\d+)?/i, "")
    .replace(/-20\d{6}V\d+(?:\.\d+)?/i, "")
    .replace(/客服文档/gi, "")
    .replace(/^-+|-+$/g, "");
  const segments = cleaned.split("-").map((item) => item.trim()).filter(Boolean);

  if (segments.length === 0) {
    return cleaned;
  }
  if (segments.length === 1) {
    return segments[0];
  }
  return segments.slice(1).join(" - ");
}

function detectSensitiveSignals(text) {
  const signals = [];
  for (const item of SENSITIVE_PATTERNS) {
    if (item.pattern.test(text)) {
      signals.push(item.reason);
    }
  }
  return [...new Set(signals)];
}

function inferSecurityLevel(text, fileName) {
  const merged = `${fileName}\n${text}`;
  const sensitiveSignals = detectSensitiveSignals(merged);

  if (sensitiveSignals.length > 0) {
    return {
      securityLevel: "RESTRICTED",
      sensitiveSignals,
    };
  }

  if (/F&Q|FAQ/i.test(fileName)) {
    return {
      securityLevel: "PUBLIC_CS",
      sensitiveSignals,
    };
  }

  const internalHits = INTERNAL_SUPPORT_PATTERNS.filter((pattern) =>
    pattern.test(merged),
  ).length;

  if (/客服文档/i.test(fileName) && internalHits < 3) {
    return {
      securityLevel: "PUBLIC_CS",
      sensitiveSignals,
    };
  }

  if (internalHits >= 3) {
    return {
      securityLevel: "INTERNAL_SUPPORT",
      sensitiveSignals,
    };
  }

  if (PUBLIC_CS_PATTERNS.some((pattern) => pattern.test(merged))) {
    return {
      securityLevel: "PUBLIC_CS",
      sensitiveSignals,
    };
  }

  return {
    securityLevel: "CANDIDATE",
    sensitiveSignals,
  };
}

function inferImportScope(documentType, productLine, securityLevel) {
  if (securityLevel === "RESTRICTED" || securityLevel === "INTERNAL_SUPPORT") {
    return "INTERNAL";
  }
  if (securityLevel === "SCAN_ERROR") {
    return "REVIEW";
  }
  if (documentType === "FAQ_INDEX") {
    return "GLOBAL";
  }
  if (productLine === "MARKETPLACE") {
    return "DEVICE";
  }
  return "PRODUCT";
}

function inferAudienceScope(securityLevel) {
  if (securityLevel === "SCAN_ERROR") {
    return "REVIEW";
  }
  if (securityLevel === "RESTRICTED") {
    return "RESTRICTED";
  }
  if (securityLevel === "INTERNAL_SUPPORT") {
    return "INTERNAL_SUPPORT";
  }
  return "CS_AGENT";
}

function determineRecommendedAction({ extension, securityLevel, extractError }) {
  if (extractError) {
    return "REVIEW_SOURCE_FILE";
  }
  if (securityLevel === "RESTRICTED") {
    return "SPLIT_OR_REDACT";
  }
  if (extension === ".xlsx" || extension === ".xls") {
    return "EXTRACT_THEN_IMPORT";
  }
  if (securityLevel === "INTERNAL_SUPPORT") {
    return "IMPORT_INTERNAL_ONLY";
  }
  return "IMPORT";
}

async function extractTextForGovernance(filePath, extension) {
  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return ensureValue(result.value);
  }

  if (extension === ".xlsx" || extension === ".xls") {
    const workbook = xlsx.readFile(filePath);
    return workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      return xlsx.utils.sheet_to_csv(sheet);
    }).join("\n");
  }

  if ([".txt", ".md", ".csv", ".html"].includes(extension)) {
    return await fs.readFile(filePath, "utf8");
  }

  return "";
}

function createSubmissionId() {
  return `submission_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createKnowledgeSubmissionRecord({
  title,
  description,
  originalName,
  storedFilePath,
  originalFilePath,
  submittedByRole = "agent",
}) {
  const extension = path.extname(originalName).toLowerCase();
  const { version, versionRank } = parseVersion(originalName);
  const documentType = inferDocumentType(originalName);
  const productLine = inferProductLine(originalName);
  const productName = inferProductName(originalName);

  let extractedText = "";
  let extractError = "";
  let securityLevel = "CANDIDATE";
  let sensitiveSignals = [];

  try {
    extractedText = await extractTextForGovernance(storedFilePath, extension);
    ({ securityLevel, sensitiveSignals } = inferSecurityLevel(extractedText, originalName));
  } catch (error) {
    extractError = error instanceof Error ? error.message : String(error);
    securityLevel = "SCAN_ERROR";
  }

  const preview = extractedText.replace(/\s+/g, " ").slice(0, 260);
  const audienceScope = inferAudienceScope(securityLevel);
  const importScope = inferImportScope(documentType, productLine, securityLevel);
  const recommendedAction = determineRecommendedAction({
    extension,
    securityLevel,
    extractError,
  });

  return {
    id: createSubmissionId(),
    title,
    description,
    fileName: originalName,
    extension,
    originalFilePath,
    storedFilePath,
    productLine,
    productName,
    documentType,
    effectiveDate: parseEffectiveDate(originalName),
    version,
    versionRank,
    securityLevel,
    audienceScope,
    importScope,
    recommendedAction,
    sensitiveSignals,
    extractError,
    preview,
    submittedByRole,
    status: "PENDING_REVIEW",
    reviewNote: "",
    submittedAt: new Date().toISOString(),
    reviewedAt: "",
    publishedAt: "",
    publishedSolutionId: "",
  };
}

export function sanitizeKnowledgeSubmission(submission) {
  const { storedFilePath, ...rest } = submission;
  return rest;
}

export function resolveDatasetIdForSubmission(submission, env = process.env) {
  if (submission.audienceScope === "INTERNAL_SUPPORT") {
    return (
      env.FASTGPT_INTERNAL_DATASET_ID ||
      env.FASTGPT_DATASET_B2B_ICT ||
      env.FASTGPT_DATASET_ID ||
      ""
    );
  }

  const fileName = ensureValue(submission.fileName);
  const productLine = ensureValue(submission.productLine).toUpperCase();

  if (productLine === "HOME_AI") {
    return (
      env.FASTGPT_DATASET_HOME_AI ||
      env.FASTGPT_PUBLIC_DATASET_ID ||
      env.FASTGPT_DATASET_ID ||
      ""
    );
  }

  if (productLine === "CLIENT") {
    return (
      env.FASTGPT_DATASET_BAICHUAN ||
      env.FASTGPT_PUBLIC_DATASET_ID ||
      env.FASTGPT_DATASET_ID ||
      ""
    );
  }

  if (productLine === "ICT" || productLine === "GENERAL") {
    return (
      env.FASTGPT_DATASET_B2B_ICT ||
      env.FASTGPT_PUBLIC_DATASET_ID ||
      env.FASTGPT_DATASET_ID ||
      ""
    );
  }

  if (productLine === "MARKETPLACE") {
    const isEbo = /EBO-SE/i.test(fileName);
    if (isEbo) {
      return (
        env.FASTGPT_DATASET_EBO ||
        env.FASTGPT_DATASET_DEVICE_SHOP ||
        env.FASTGPT_PUBLIC_DATASET_ID ||
        env.FASTGPT_DATASET_ID ||
        ""
      );
    }
    return (
      env.FASTGPT_DATASET_DEVICE_SHOP ||
      env.FASTGPT_PUBLIC_DATASET_ID ||
      env.FASTGPT_DATASET_ID ||
      ""
    );
  }

  return env.FASTGPT_PUBLIC_DATASET_ID || env.FASTGPT_DATASET_ID || "";
}
