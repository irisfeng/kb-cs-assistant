#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import XLSX from "xlsx";

const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), "inventory-output");

const SENSITIVE_PATTERNS = [
  { pattern: /\b(?:admin|administrator)\b/i, reason: "admin_account_reference" },
  { pattern: /\b(?:ssh|shell)\b/i, reason: "ssh_reference" },
  { pattern: /\b(?:password|passwd|pwd|账密|密码|默认密码|初始密码)\b/i, reason: "password_reference" },
  { pattern: /\b(?:默认账密|初始账密)\b/i, reason: "default_credentials" },
  { pattern: /\b(?:仅内部使用|内部使用|不对外提供)\b/i, reason: "internal_only_phrase" },
  { pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})\b/, reason: "private_ip_address" },
  { pattern: /https?:\/\/(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/i, reason: "private_url" },
  { pattern: /\b(?:ictuser|root|task_test)\b/i, reason: "default_user_candidate" }
];

const INTERNAL_SUPPORT_PATTERNS = [
  /操作指引/i,
  /部署/i,
  /接入平台/i,
  /管理平台/i,
  /任务创建/i,
  /任务监测/i,
  /登录信息/i,
  /设备状态/i
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
  /F&Q/i
];

function parseArgs(argv) {
  const dirs = [];
  let outputDir = DEFAULT_OUTPUT_DIR;
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current.startsWith("--dir=")) {
      dirs.push(current.slice("--dir=".length));
      continue;
    }
    if (current.startsWith("--output=")) {
      outputDir = path.resolve(current.slice("--output=".length));
      continue;
    }
    if (current === "--dir") {
      dirs.push(argv[index + 1]);
      index += 1;
      continue;
    }
    if (current === "--output") {
      outputDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (!current.startsWith("--")) {
      positional.push(current);
    }
  }

  return {
    dirs: [...dirs, ...positional].filter(Boolean),
    outputDir
  };
}

function ensureValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeProductKey(fileName) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/-?20\d{6}/g, "")
    .replace(/-?V\d+(?:\.\d+)?/gi, "")
    .replace(/客服文档/gi, "")
    .replace(/[（）()]/g, "")
    .replace(/\s+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseVersion(name) {
  const match = name.match(/V(\d+(?:\.\d+)?)/i);
  if (!match) {
    return { version: "", versionRank: -1 };
  }
  return { version: `V${match[1]}`, versionRank: Number.parseFloat(match[1]) };
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

function inferChannel(fileName) {
  const candidates = [
    "天翼视联商城",
    "翼支付商城",
    "小翼管家",
    "美好家旗舰店",
    "CRM",
    "营业厅"
  ];
  const matched = candidates.find((item) => fileName.includes(item));
  return matched || "";
}

function inferRegion(fileName) {
  const match = fileName.match(/(全国|[^\-]+省|[^\-]+市)/);
  return match ? match[1] : "";
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

function inferImportScope(documentType, productLine, securityLevel) {
  if (securityLevel === "RESTRICTED") {
    return "INTERNAL";
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
  if (securityLevel === "RESTRICTED") {
    return "RESTRICTED";
  }
  if (securityLevel === "INTERNAL_SUPPORT") {
    return "INTERNAL_SUPPORT";
  }
  return "CS_AGENT";
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
      sensitiveSignals
    };
  }
  if (/F&Q|FAQ/i.test(fileName)) {
    return {
      securityLevel: "PUBLIC_CS",
      sensitiveSignals
    };
  }
  const internalHits = INTERNAL_SUPPORT_PATTERNS.filter((pattern) => pattern.test(merged)).length;
  if (/客服文档/i.test(fileName) && internalHits < 3) {
    return {
      securityLevel: "PUBLIC_CS",
      sensitiveSignals
    };
  }
  if (internalHits >= 3) {
    return {
      securityLevel: "INTERNAL_SUPPORT",
      sensitiveSignals
    };
  }
  if (PUBLIC_CS_PATTERNS.some((pattern) => pattern.test(merged))) {
    return {
      securityLevel: "PUBLIC_CS",
      sensitiveSignals
    };
  }
  return {
    securityLevel: "CANDIDATE",
    sensitiveSignals
  };
}

async function extractDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return ensureValue(result.value);
}

function extractXlsxText(filePath) {
  const workbook = XLSX.readFile(filePath);
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_csv(sheet);
  }).join("\n");
}

async function extractText(filePath, extension) {
  if (extension === ".docx") {
    return extractDocxText(filePath);
  }
  if (extension === ".xlsx") {
    return extractXlsxText(filePath);
  }
  return "";
}

function csvEscape(value) {
  const normalized = String(value ?? "");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }
  return normalized;
}

async function scanDirectory(directoryPath) {
  const directoryEntries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = directoryEntries.filter((entry) => entry.isFile());
  const records = [];

  for (const entry of files) {
    const filePath = path.join(directoryPath, entry.name);
    const extension = path.extname(entry.name).toLowerCase();
    const stats = await fs.stat(filePath);
    const rawText = await extractText(filePath, extension);
    const preview = rawText.replace(/\s+/g, " ").slice(0, 300);
    const { version, versionRank } = parseVersion(entry.name);
    const { securityLevel, sensitiveSignals } = inferSecurityLevel(rawText, entry.name);
    const documentType = inferDocumentType(entry.name);
    const productLine = inferProductLine(entry.name);

    records.push({
      sourceDir: directoryPath,
      fileName: entry.name,
      filePath,
      extension,
      fileSizeBytes: stats.size,
      lastModifiedAt: stats.mtime.toISOString(),
      productLine,
      productName: inferProductName(entry.name),
      productKey: normalizeProductKey(entry.name),
      documentType,
      channel: inferChannel(entry.name),
      region: inferRegion(entry.name),
      effectiveDate: parseEffectiveDate(entry.name),
      version,
      versionRank,
      securityLevel,
      audienceScope: inferAudienceScope(securityLevel),
      importScope: inferImportScope(documentType, productLine, securityLevel),
      status: "CANDIDATE",
      sensitiveSignals,
      preview
    });
  }

  return records;
}

function markLatestVersions(records) {
  const groups = new Map();

  for (const record of records) {
    const key = record.productKey;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(record);
  }

  for (const group of groups.values()) {
    group.sort((left, right) => {
      if (left.versionRank !== right.versionRank) {
        return right.versionRank - left.versionRank;
      }
      return right.effectiveDate.localeCompare(left.effectiveDate);
    });
    group.forEach((record, index) => {
      record.isLatest = index === 0;
      record.versionGroupSize = group.length;
    });
  }

  return groups;
}

async function writeOutputs(records, groups, outputDir) {
  await fs.mkdir(outputDir, { recursive: true });

  const summary = {
    generatedAt: new Date().toISOString(),
    totalFiles: records.length,
    bySecurityLevel: countBy(records, "securityLevel"),
    byImportScope: countBy(records, "importScope"),
    byProductLine: countBy(records, "productLine"),
    versionGroups: [...groups.entries()]
      .filter(([, items]) => items.length > 1)
      .map(([productKey, items]) => ({
        productKey,
        fileNames: items.map((item) => item.fileName)
      })),
    restrictedFiles: records
      .filter((record) => record.securityLevel === "RESTRICTED")
      .map((record) => ({
        fileName: record.fileName,
        sensitiveSignals: record.sensitiveSignals
      }))
  };

  const jsonPath = path.join(outputDir, "knowledge-inventory.json");
  const csvPath = path.join(outputDir, "knowledge-inventory.csv");
  const summaryPath = path.join(outputDir, "knowledge-summary.json");

  await fs.writeFile(jsonPath, JSON.stringify(records, null, 2), "utf8");
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  const headers = [
    "sourceDir",
    "fileName",
    "extension",
    "fileSizeBytes",
    "productLine",
    "productName",
    "documentType",
    "channel",
    "region",
    "effectiveDate",
    "version",
    "isLatest",
    "securityLevel",
    "audienceScope",
    "importScope",
    "status",
    "sensitiveSignals",
    "filePath"
  ];
  const rows = [
    headers.join(","),
    ...records.map((record) =>
      headers.map((header) => {
        const value = header === "sensitiveSignals"
          ? record.sensitiveSignals.join("|")
          : record[header];
        return csvEscape(value);
      }).join(",")
    )
  ];
  await fs.writeFile(csvPath, rows.join("\n"), "utf8");

  return { jsonPath, csvPath, summaryPath };
}

function countBy(records, key) {
  return records.reduce((accumulator, record) => {
    const value = record[key] || "";
    accumulator[value] = (accumulator[value] || 0) + 1;
    return accumulator;
  }, {});
}

async function main() {
  const { dirs, outputDir } = parseArgs(process.argv.slice(2));

  if (dirs.length === 0) {
    console.error("Usage: node src/scripts/generate-knowledge-inventory.js --dir <path> [--dir <path>] [--output <path>]");
    process.exitCode = 1;
    return;
  }

  const allRecords = [];
  for (const directoryPath of dirs) {
    const absoluteDirectory = path.resolve(directoryPath);
    const records = await scanDirectory(absoluteDirectory);
    allRecords.push(...records);
  }

  const groups = markLatestVersions(allRecords);
  const outputPaths = await writeOutputs(allRecords, groups, outputDir);

  console.log(`[Inventory] Scanned ${allRecords.length} files`);
  console.log(`[Inventory] Output JSON: ${outputPaths.jsonPath}`);
  console.log(`[Inventory] Output CSV: ${outputPaths.csvPath}`);
  console.log(`[Inventory] Output summary: ${outputPaths.summaryPath}`);
  console.log(`[Inventory] Security levels: ${JSON.stringify(countBy(allRecords, "securityLevel"))}`);
}

main().catch((error) => {
  console.error("[Inventory] Failed:", error);
  process.exitCode = 1;
});
