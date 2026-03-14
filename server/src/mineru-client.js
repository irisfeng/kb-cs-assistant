import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readPositiveIntEnv(name, fallback) {
  const raw = Number.parseInt(String(process.env[name] || "").trim(), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function readPositiveNumber(value, fallback) {
  const raw = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanMarkdown(markdown) {
  if (!markdown) return "";

  let cleaned = markdown;

  cleaned = cleaned.replace(
    /<table[^>]*>([\s\S]*?)<\/table>/gi,
    (_match, content) => {
      const cells = content.match(/<td[^>]*>(.*?)<\/td>/gi) || [];
      const cellTexts = cells.map((cell) =>
        cell
          .replace(/<td[^>]*>/gi, "")
          .replace(/<\/td>/gi, "")
          .trim(),
      );
      return cellTexts.join(" | ");
    },
  );

  cleaned = cleaned.replace(/\$[^$]+\$/g, (match) =>
    match
      .replace(/\\[a-zA-Z]+/g, "")
      .replace(/[{}^_]/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );

  cleaned = cleaned
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/》/g, "")
    .replace(/《/g, "");

  cleaned = cleaned
    .replace(/\n-{3,}\n\n-{3,}\n/g, "\n\n")
    .replace(/\n-{3,}\n/g, "\n\n")
    .replace(/^---\n\n/gm, "");

  cleaned = cleaned.replace(/\n{4,}/g, "\n\n\n");

  cleaned = cleaned
    .replace(/\\*Page \d+\\*\n?/gi, "")
    .replace(/\\*第\s*\d+\s*页\\*\n?/gi, "");

  cleaned = cleaned
    .replace(/\n+(!\[)/g, "\n\n$1")
    .replace(/(\)\])\n+/g, "$1\n\n");

  cleaned = cleaned.replace(/\n+^(#{1,6}\s)/gm, "\n\n$1");

  return cleaned.trim();
}

function getMinerUConfig(overrides = {}) {
  return {
    baseUrl: String(process.env.MINERU_BASE_URL || "").trim(),
    apiToken: String(process.env.MINERU_API_TOKEN || "").trim(),
    requestTimeoutMs: readPositiveIntEnv("MINERU_REQUEST_TIMEOUT_MS", 30000),
    uploadTimeoutMs: readPositiveIntEnv("MINERU_UPLOAD_TIMEOUT_MS", 180000),
    resultDownloadTimeoutMs: readPositiveIntEnv(
      "MINERU_RESULT_DOWNLOAD_TIMEOUT_MS",
      120000,
    ),
    pollMaxAttempts: readPositiveIntEnv("MINERU_POLL_MAX_ATTEMPTS", 120),
    pollIntervalMs: readPositiveIntEnv("MINERU_POLL_INTERVAL_MS", 5000),
    maxRetries: readPositiveIntEnv("MINERU_MAX_RETRIES", 3),
    retryBaseDelayMs: readPositiveIntEnv("MINERU_RETRY_BASE_DELAY_MS", 3000),
    baseUrlForImages:
      String(process.env.BASE_URL || "").trim() || "http://localhost:3001",
    ...overrides,
  };
}

function emitProgress(onProgress, message, extra = {}) {
  if (typeof onProgress === "function") {
    onProgress({ message, ...extra });
    return;
  }
  if (Object.keys(extra).length > 0) {
    console.log(`[MinerU] ${message}`, extra);
    return;
  }
  console.log(`[MinerU] ${message}`);
}

function isRetriableMinerUError(error) {
  const status = error?.response?.status;
  if ([408, 409, 423, 425, 429].includes(status)) {
    return true;
  }
  if (typeof status === "number" && status >= 500) {
    return true;
  }

  const code = String(error?.code || "").toUpperCase();
  if (
    [
      "ECONNABORTED",
      "ECONNRESET",
      "ETIMEDOUT",
      "EAI_AGAIN",
      "ENOTFOUND",
      "ECONNREFUSED",
      "EPIPE",
    ].includes(code)
  ) {
    return true;
  }

  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("socket hang up") ||
    message.includes("network error") ||
    message.includes("temporarily unavailable") ||
    message.includes("too many requests")
  );
}

async function withRetry(task, options = {}) {
  const {
    maxRetries = 3,
    retryBaseDelayMs = 3000,
    shouldRetry = isRetriableMinerUError,
    onProgress,
    label = "task",
  } = options;

  let attempt = 0;
  while (attempt < maxRetries) {
    attempt += 1;
    try {
      return await task(attempt);
    } catch (error) {
      const retriable = attempt < maxRetries && shouldRetry(error);
      emitProgress(onProgress, `${label} failed`, {
        stage: "retry",
        attempt,
        retriable,
        error: error instanceof Error ? error.message : String(error),
      });
      if (!retriable) {
        throw error;
      }
      const delayMs = retryBaseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delayMs);
    }
  }
}

async function applyMinerUUploadUrl(fileName, dataId, config, onProgress) {
  emitProgress(onProgress, "Applying MinerU upload URL", {
    stage: "apply_upload_url",
    fileName,
    dataId,
  });

  const response = await axios.post(
    `${config.baseUrl}/file-urls/batch`,
    {
      files: [{ name: fileName, data_id: dataId }],
      model_version: "pipeline",
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiToken}`,
      },
      timeout: config.requestTimeoutMs,
    },
  );

  if (response.data?.code !== 0) {
    throw new Error(`MinerU upload URL failed: ${response.data?.msg || "unknown"}`);
  }

  return {
    batchId: response.data.data.batch_id,
    uploadUrl: response.data.data.file_urls[0],
  };
}

async function uploadFileToMinerU(filePath, uploadUrl, config, onProgress) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;
  const https = await import("https");
  const url = new URL(uploadUrl);

  emitProgress(onProgress, "Uploading file to MinerU", {
    stage: "upload_file",
    filePath,
    sizeBytes: fileSize,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: "PUT",
      headers: {
        "Content-Length": fileSize,
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve(true);
        return;
      }

      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        reject(
          new Error(`MinerU file upload failed: ${res.statusCode} - ${body}`),
        );
      });
    });

    req.setTimeout(config.uploadTimeoutMs, () => {
      req.destroy(new Error(`MinerU file upload timeout after ${config.uploadTimeoutMs}ms`));
    });

    req.on("error", (error) => {
      reject(new Error(`MinerU file upload error: ${error.message}`));
    });

    req.write(fileBuffer);
    req.end();
  });
}

async function extractMinerUZip(batchId, zipBuffer, config, onProgress) {
  const tempZipPath = path.join(__dirname, `../uploads/temp_${batchId}.zip`);
  fs.writeFileSync(tempZipPath, zipBuffer);

  try {
    const zip = new AdmZip(tempZipPath);
    const zipEntries = zip.getEntries();
    const imagesDir = path.join(__dirname, `../public/images/${batchId}`);
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const savedImages = [];
    for (const entry of zipEntries) {
      if (
        entry.entryName.startsWith("images/") ||
        /\.(png|jpg|jpeg|gif|webp)$/i.test(entry.entryName)
      ) {
        const imageName = path.basename(entry.entryName);
        const imagePath = path.join(imagesDir, imageName);
        zip.extractEntryTo(entry, path.dirname(imagePath), false);
        savedImages.push({ originalPath: entry.entryName, imageName });
      }
    }

    let markdownContent = "";
    for (const entry of zipEntries) {
      if (entry.entryName.endsWith(".md")) {
        markdownContent = entry.getData().toString("utf-8");
        break;
      }
    }

    if (!markdownContent) {
      throw new Error("No markdown file found in ZIP");
    }

    const cleanedMarkdown = cleanMarkdown(markdownContent);
    const localMarkdown = cleanedMarkdown.replace(
      /!\[([^\]]*)\]\((images\/[^)]+|[^)]+\.(png|jpg|jpeg|gif|webp))\)/gi,
      (_match, alt, imagePath) => {
        const imageName = path.basename(imagePath);
        return `![${alt}](/images/${batchId}/${imageName})`;
      },
    );

    const fastGptMarkdown = cleanedMarkdown.replace(
      /!\[([^\]]*)\]\((images\/[^)]+|[^)]+\.(png|jpg|jpeg|gif|webp))\)/gi,
      (_match, alt, imagePath) => {
        const imageName = path.basename(imagePath);
        const imageUrl = `${config.baseUrlForImages}/images/${batchId}/${imageName}`;
        return `![${alt}](${imageUrl})`;
      },
    );

    emitProgress(onProgress, "MinerU ZIP extracted", {
      stage: "extract_zip",
      batchId,
      imageCount: savedImages.length,
      markdownLength: localMarkdown.length,
    });

    return {
      markdown: localMarkdown,
      base64Markdown: fastGptMarkdown,
      localMarkdown,
      fastGptMarkdown,
      cleanedMarkdown,
      batchId,
      imageCount: savedImages.length,
      markdownUrl: "",
      imagesDir,
    };
  } finally {
    if (fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    }
  }
}

async function pollMinerUResult(batchId, config, onProgress) {
  for (let attempt = 0; attempt < config.pollMaxAttempts; attempt += 1) {
    const response = await axios.get(
      `${config.baseUrl}/extract-results/batch/${batchId}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiToken}`,
        },
        timeout: config.requestTimeoutMs,
      },
    );

    if (response.data?.code !== 0) {
      throw new Error(`MinerU result query failed: ${response.data?.msg || "unknown"}`);
    }

    const result = response.data?.data?.extract_result?.[0];
    const extractedPages = result?.extract_progress?.extracted_pages || 0;
    const totalPages = result?.extract_progress?.total_pages || 0;

    emitProgress(onProgress, "MinerU parsing progress", {
      stage: "poll_result",
      batchId,
      state: result?.state || "unknown",
      extractedPages,
      totalPages,
      pollAttempt: attempt + 1,
      pollMaxAttempts: config.pollMaxAttempts,
    });

    if (result?.state === "done") {
      const zipUrl = result.full_zip_url;
      const zipResponse = await axios.get(zipUrl, {
        responseType: "arraybuffer",
        timeout: config.resultDownloadTimeoutMs,
      });

      const extracted = await extractMinerUZip(
        batchId,
        zipResponse.data,
        config,
        onProgress,
      );
      return {
        ...extracted,
        markdownUrl: zipUrl,
      };
    }

    if (result?.state === "failed") {
      throw new Error(`MinerU parsing failed: ${result?.err_msg || "unknown error"}`);
    }

    await sleep(config.pollIntervalMs);
  }

  throw new Error("MinerU parsing timeout");
}

export async function parseWithMinerU(filePath, fileName, options = {}) {
  const config = getMinerUConfig(options);
  if (!config.baseUrl) {
    throw new Error("MinerU base URL is not configured");
  }
  if (!config.apiToken || config.apiToken === "your_mineru_token_here") {
    throw new Error(
      "MinerU API Token not configured. Please add MINERU_API_TOKEN to .env file.",
    );
  }

  const dataId = options.dataId || `file_${Date.now()}`;
  let lastBatchId = "";

  const result = await withRetry(
    async (attempt) => {
      emitProgress(options.onProgress, "Starting MinerU parse", {
        stage: "start",
        attempt,
        fileName,
        filePath,
      });

      const { batchId, uploadUrl } = await applyMinerUUploadUrl(
        fileName,
        `${dataId}_a${attempt}`,
        config,
        options.onProgress,
      );
      lastBatchId = batchId;

      emitProgress(options.onProgress, "MinerU batch created", {
        stage: "batch_created",
        attempt,
        batchId,
      });

      await uploadFileToMinerU(filePath, uploadUrl, config, options.onProgress);
      return await pollMinerUResult(batchId, config, options.onProgress);
    },
    {
      maxRetries: readPositiveNumber(options.maxRetries, config.maxRetries),
      retryBaseDelayMs: readPositiveNumber(
        options.retryBaseDelayMs,
        config.retryBaseDelayMs,
      ),
      onProgress: options.onProgress,
      label: `MinerU parse ${fileName}`,
    },
  );

  return {
    text: result.fastGptMarkdown || result.markdown,
    localMarkdown: result.markdown,
    base64Markdown: result.base64Markdown,
    fastGPTMarkdown: result.fastGptMarkdown,
    batchId: result.batchId || lastBatchId,
    imageCount: result.imageCount,
    source: "mineru-api",
  };
}

export function countDocxImages(filePath) {
  const zip = new AdmZip(filePath);
  return zip
    .getEntries()
    .filter(
      (entry) =>
        entry.entryName.startsWith("word/media/") && !entry.entryName.endsWith("/"),
    ).length;
}
