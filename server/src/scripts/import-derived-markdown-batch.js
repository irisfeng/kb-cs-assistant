#!/usr/bin/env node

import axios from "axios";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(serverRoot, ".env") });

const DEFAULT_PAGE_SIZE = 100;

function parseArgs(argv) {
  const options = {
    files: [],
    outputDir: path.resolve(serverRoot, "../tmp/import-run-derived"),
    datasetFilter: "",
    limit: 0,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current.startsWith("--derived=")) {
      options.files.push(path.resolve(current.slice("--derived=".length)));
      continue;
    }
    if (current === "--derived") {
      options.files.push(path.resolve(argv[index + 1] || ""));
      index += 1;
      continue;
    }
    if (current.startsWith("--output=")) {
      options.outputDir = path.resolve(current.slice("--output=".length));
      continue;
    }
    if (current === "--output") {
      options.outputDir = path.resolve(argv[index + 1] || "");
      index += 1;
      continue;
    }
    if (current.startsWith("--dataset-filter=")) {
      options.datasetFilter = current.slice("--dataset-filter=".length).trim();
      continue;
    }
    if (current === "--dataset-filter") {
      options.datasetFilter = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (current.startsWith("--limit=")) {
      options.limit = Number.parseInt(current.slice("--limit=".length), 10) || 0;
      continue;
    }
    if (current === "--limit") {
      options.limit = Number.parseInt(argv[index + 1] || "0", 10) || 0;
      index += 1;
      continue;
    }
    if (current === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\.txt$/i, "")
    .replace(/\.(docx|doc|pptx|ppt|pdf|md|xlsx|xls|csv|html)$/i, "")
    .replace(/\.[a-z]{1,4}$/i, "")
    .replace(/\s+/g, " ");
}

function inferDatasetKeyFromDocument(item) {
  const outputFile = String(item?.outputFile || "");
  const title = String(item?.title || "");
  const groupName = String(item?.groupName || "");
  const merged = `${outputFile}\n${title}\n${groupName}`;

  if (/视频AI算法舱|翼智企标准/i.test(merged)) {
    return "INTERNAL_HOLD";
  }
  if (/视联百川/i.test(merged)) {
    return "FASTGPT_DATASET_BAICHUAN";
  }
  if (/EBO-SE/i.test(merged)) {
    return "FASTGPT_DATASET_EBO";
  }
  if (/赛达网络摄像头|翼支付商城|H681|xk001-A10/i.test(merged)) {
    return "FASTGPT_DATASET_DEVICE_SHOP";
  }
  if (/中国电信行业版AI产品政企版/i.test(merged)) {
    return "FASTGPT_DATASET_B2B_ICT";
  }
  if (/天翼看家/i.test(merged)) {
    return "FASTGPT_DATASET_HOME_AI";
  }
  return "UNKNOWN";
}

function resolveDatasetId(datasetKey) {
  if (datasetKey === "INTERNAL_HOLD" || datasetKey === "UNKNOWN") {
    return "";
  }
  return String(process.env[datasetKey] || "").trim();
}

async function fetchAllCollections({ baseUrl, apiKey, datasetId }) {
  const collections = [];
  let pageNum = 1;

  while (true) {
    const response = await axios.post(
      `${baseUrl}/core/dataset/collection/list`,
      {
        datasetId,
        pageNum,
        pageSize: DEFAULT_PAGE_SIZE,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    const page = response.data?.data?.data || [];
    collections.push(...page);

    if (page.length < DEFAULT_PAGE_SIZE) {
      break;
    }

    pageNum += 1;
  }

  return collections;
}

async function createTextCollection({ baseUrl, apiKey, datasetId, name, text }) {
  const response = await axios.post(
    `${baseUrl}/core/dataset/collection/create/text`,
    {
      datasetId,
      name,
      text,
      trainingType: "chunk",
      chunkSize: 8000,
      chunkSplitter: "",
      qaPrompt: "",
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  const data = response.data?.data;
  if (typeof data === "string" && data) {
    return data;
  }
  if (data?.collectionId) {
    return data.collectionId;
  }

  throw new Error("FastGPT response missing collectionId");
}

async function fetchCollectionDetail({ baseUrl, apiKey, collectionId }) {
  const response = await axios.get(
    `${baseUrl}/core/dataset/collection/detail`,
    {
      params: { id: collectionId },
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  return response.data?.data || null;
}

async function loadDerivedDocuments(paths) {
  const documents = [];
  for (const filePath of paths) {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    for (const item of parsed) {
      documents.push({
        ...item,
        __derivedFile: filePath,
      });
    }
  }
  return documents;
}

function buildName(item) {
  return String(item.title || path.basename(item.outputFile, path.extname(item.outputFile))).trim();
}

function buildCsv(rows) {
  const headers = [
    "status",
    "datasetKey",
    "datasetId",
    "name",
    "collectionId",
    "charCount",
    "detailStatus",
    "error",
  ];

  const escape = (value) => {
    const normalized = String(value ?? "");
    if (/[",\n]/.test(normalized)) {
      return `"${normalized.replace(/"/g, "\"\"")}"`;
    }
    return normalized;
  };

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.files.length === 0) {
    throw new Error(
      "Usage: node src/scripts/import-derived-markdown-batch.js --derived=<derived-documents.json> [--derived=<derived-documents.json>] [--output=<dir>] [--dataset-filter=FASTGPT_DATASET_HOME_AI] [--limit=1] [--dry-run]",
    );
  }

  const baseUrl = requireEnv("FASTGPT_BASE_URL");
  const apiKey = requireEnv("FASTGPT_API_KEY");
  const documents = await loadDerivedDocuments(options.files);

  const candidates = documents.filter((item) => {
    const datasetKey = inferDatasetKeyFromDocument(item);
    if (datasetKey === "INTERNAL_HOLD" || datasetKey === "UNKNOWN") {
      return false;
    }
    if (!options.datasetFilter) {
      return true;
    }
    return datasetKey === options.datasetFilter;
  });
  const targets = options.limit > 0 ? candidates.slice(0, options.limit) : candidates;

  const datasetIds = new Map();
  for (const item of targets) {
    const datasetKey = inferDatasetKeyFromDocument(item);
    const datasetId = resolveDatasetId(datasetKey);
    if (!datasetId) {
      throw new Error(`No dataset configured for ${item.outputFile} (${datasetKey})`);
    }
    datasetIds.set(datasetKey, datasetId);
  }

  const existingByDataset = new Map();
  for (const [datasetKey, datasetId] of datasetIds.entries()) {
    const collections = await fetchAllCollections({ baseUrl, apiKey, datasetId });
    const fileCollections = collections.filter((item) => item?.type === "file" && item?._id);
    existingByDataset.set(
      datasetKey,
      new Map(fileCollections.map((item) => [normalizeName(item.name), item])),
    );
  }

  const startedAt = new Date().toISOString();
  const results = [];

  for (const item of targets) {
    const datasetKey = inferDatasetKeyFromDocument(item);
    const datasetId = datasetIds.get(datasetKey);
    const name = buildName(item);
    const existingMap = existingByDataset.get(datasetKey) || new Map();
    const existing = existingMap.get(normalizeName(name));

    if (existing) {
      results.push({
        status: "skipped_existing",
        datasetKey,
        datasetId,
        name,
        collectionId: existing._id || "",
        charCount: 0,
        detailStatus: existing.trainingStatus || existing.status || "",
        error: "",
      });
      continue;
    }

    if (options.dryRun) {
      results.push({
        status: "dry_run",
        datasetKey,
        datasetId,
        name,
        collectionId: "",
        charCount: 0,
        detailStatus: "",
        error: "",
      });
      continue;
    }

    try {
      const text = String(await fs.readFile(item.outputFile, "utf8")).trim();
      if (!text) {
        throw new Error("Markdown content is empty");
      }

      const collectionId = await createTextCollection({
        baseUrl,
        apiKey,
        datasetId,
        name,
        text,
      });
      const detail = await fetchCollectionDetail({ baseUrl, apiKey, collectionId });

      results.push({
        status: "imported",
        datasetKey,
        datasetId,
        name,
        collectionId,
        charCount: text.length,
        detailStatus:
          detail?.trainingType ||
          detail?.trainingStatus ||
          detail?.status ||
          "",
        error: "",
      });

      existingMap.set(normalizeName(name), { _id: collectionId, name });
      existingByDataset.set(datasetKey, existingMap);
    } catch (error) {
      results.push({
        status: "failed",
        datasetKey,
        datasetId,
        name,
        collectionId: "",
        charCount: 0,
        detailStatus: "",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = results.reduce(
    (accumulator, row) => {
      accumulator[row.status] = (accumulator[row.status] || 0) + 1;
      return accumulator;
    },
    {
      imported: 0,
      skipped_existing: 0,
      failed: 0,
      dry_run: 0,
    },
  );

  await fs.mkdir(options.outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(options.outputDir, `derived-markdown-import-${timestamp}.json`);
  const csvPath = path.join(options.outputDir, `derived-markdown-import-${timestamp}.csv`);

  await fs.writeFile(
    jsonPath,
    JSON.stringify(
      {
        startedAt,
        finishedAt: new Date().toISOString(),
        derivedFiles: options.files,
        datasetFilter: options.datasetFilter || "",
        limit: options.limit || 0,
        dryRun: options.dryRun,
        summary,
        results,
      },
      null,
      2,
    ),
    "utf8",
  );
  await fs.writeFile(csvPath, buildCsv(results), "utf8");

  console.log(`[DerivedMarkdownImport] Derived files: ${options.files.join(", ")}`);
  console.log(`[DerivedMarkdownImport] Output JSON: ${jsonPath}`);
  console.log(`[DerivedMarkdownImport] Output CSV: ${csvPath}`);
  console.log(`[DerivedMarkdownImport] Summary: ${JSON.stringify(summary)}`);
}

main().catch((error) => {
  console.error("[DerivedMarkdownImport] Failed:", error.message);
  process.exitCode = 1;
});
