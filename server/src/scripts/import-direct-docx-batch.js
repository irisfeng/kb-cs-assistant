#!/usr/bin/env node

import axios from "axios";
import dotenv from "dotenv";
import fs from "fs/promises";
import mammoth from "mammoth";
import path from "path";
import { fileURLToPath } from "url";
import { resolveDatasetIdForSubmission } from "../knowledge-workflow.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(serverRoot, ".env") });

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_CHUNK_SIZE = 8000;

function parseArgs(argv) {
  const options = {
    inventoryPath: "",
    outputDir: path.resolve(serverRoot, "../tmp/import-run-docx"),
    datasetFilter: "",
    limit: 0,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current.startsWith("--inventory=")) {
      options.inventoryPath = path.resolve(current.slice("--inventory=".length));
      continue;
    }
    if (current === "--inventory") {
      options.inventoryPath = path.resolve(argv[index + 1] || "");
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

function inferDatasetKey(record) {
  const fileName = String(record?.fileName || "");
  const productLine = String(record?.productLine || "").toUpperCase();
  const audienceScope = String(record?.audienceScope || "").toUpperCase();

  if (audienceScope === "INTERNAL_SUPPORT" || audienceScope === "RESTRICTED") {
    return "FASTGPT_INTERNAL_DATASET_ID";
  }
  if (productLine === "CLIENT") {
    return "FASTGPT_DATASET_BAICHUAN";
  }
  if (productLine === "HOME_AI") {
    return "FASTGPT_DATASET_HOME_AI";
  }
  if (productLine === "ICT" || productLine === "GENERAL") {
    return "FASTGPT_DATASET_B2B_ICT";
  }
  if (productLine === "MARKETPLACE") {
    return /EBO-SE/i.test(fileName)
      ? "FASTGPT_DATASET_EBO"
      : "FASTGPT_DATASET_DEVICE_SHOP";
  }
  return "FASTGPT_DATASET_ID";
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
      chunkSize: DEFAULT_CHUNK_SIZE,
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

function buildSubmissionLikeRecord(record) {
  return {
    fileName: record.fileName,
    productLine: record.productLine,
    audienceScope: record.audienceScope,
  };
}

function filterInventory(records, datasetFilter) {
  return records.filter((record) => {
    if (!record.isLatest) {
      return false;
    }
    if (record.extension !== ".docx") {
      return false;
    }
    if (record.securityLevel !== "PUBLIC_CS") {
      return false;
    }
    if (!datasetFilter) {
      return true;
    }
    return inferDatasetKey(record) === datasetFilter;
  });
}

function buildCsv(rows) {
  const headers = [
    "status",
    "datasetKey",
    "datasetId",
    "fileName",
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
  if (!options.inventoryPath) {
    throw new Error(
      "Usage: node src/scripts/import-direct-docx-batch.js --inventory=<knowledge-inventory.json> [--output=<dir>] [--dataset-filter=FASTGPT_DATASET_BAICHUAN] [--limit=1] [--dry-run]",
    );
  }

  const baseUrl = requireEnv("FASTGPT_BASE_URL");
  const apiKey = requireEnv("FASTGPT_API_KEY");
  const rawInventory = await fs.readFile(options.inventoryPath, "utf8");
  const inventory = JSON.parse(rawInventory);
  const candidates = filterInventory(inventory, options.datasetFilter);
  const targets = options.limit > 0 ? candidates.slice(0, options.limit) : candidates;

  const datasetIds = new Map();
  for (const record of targets) {
    const datasetKey = inferDatasetKey(record);
    const datasetId = resolveDatasetIdForSubmission(buildSubmissionLikeRecord(record));
    if (!datasetId) {
      throw new Error(`No dataset configured for ${record.fileName} (${datasetKey})`);
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

  for (const record of targets) {
    const datasetKey = inferDatasetKey(record);
    const datasetId = datasetIds.get(datasetKey);
    const filePath = path.join(record.sourceDir, record.fileName);
    const existingMap = existingByDataset.get(datasetKey) || new Map();
    const existing = existingMap.get(normalizeName(record.fileName));

    if (existing) {
      results.push({
        status: "skipped_existing",
        datasetKey,
        datasetId,
        fileName: record.fileName,
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
        fileName: record.fileName,
        collectionId: "",
        charCount: 0,
        detailStatus: "",
        error: "",
      });
      continue;
    }

    try {
      const extractResult = await mammoth.extractRawText({ path: filePath });
      const text = String(extractResult.value || "").trim();
      if (!text) {
        throw new Error("Extracted text is empty");
      }

      const collectionId = await createTextCollection({
        baseUrl,
        apiKey,
        datasetId,
        name: record.fileName,
        text,
      });
      const detail = await fetchCollectionDetail({ baseUrl, apiKey, collectionId });

      results.push({
        status: "imported",
        datasetKey,
        datasetId,
        fileName: record.fileName,
        collectionId,
        charCount: text.length,
        detailStatus:
          detail?.trainingType ||
          detail?.trainingStatus ||
          detail?.status ||
          "",
        error: "",
      });

      existingMap.set(normalizeName(record.fileName), { _id: collectionId, name: record.fileName });
      existingByDataset.set(datasetKey, existingMap);
    } catch (error) {
      results.push({
        status: "failed",
        datasetKey,
        datasetId,
        fileName: record.fileName,
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

  const outputDir = options.outputDir;
  await fs.mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outputDir, `direct-docx-import-${timestamp}.json`);
  const csvPath = path.join(outputDir, `direct-docx-import-${timestamp}.csv`);

  await fs.writeFile(
    jsonPath,
    JSON.stringify(
      {
        startedAt,
        finishedAt: new Date().toISOString(),
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

  console.log(`[DirectDocxImport] Inventory: ${options.inventoryPath}`);
  console.log(`[DirectDocxImport] Output JSON: ${jsonPath}`);
  console.log(`[DirectDocxImport] Output CSV: ${csvPath}`);
  console.log(`[DirectDocxImport] Summary: ${JSON.stringify(summary)}`);
}

main().catch((error) => {
  console.error("[DirectDocxImport] Failed:", error.message);
  process.exitCode = 1;
});
