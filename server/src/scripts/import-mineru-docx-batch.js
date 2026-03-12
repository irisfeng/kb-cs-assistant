#!/usr/bin/env node

import axios from "axios";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { resolveDatasetIdForSubmission } from "../knowledge-workflow.js";
import { countDocxImages, parseWithMinerU } from "../mineru-client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(serverRoot, ".env") });

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_CHUNK_SIZE = 8000;

function parseArgs(argv) {
  const options = {
    inventoryPath: "",
    outputDir: path.resolve(serverRoot, "../tmp/import-run-mineru"),
    datasetFilter: "",
    limit: 0,
    minImages: 10,
    dryRun: false,
    replaceExisting: false,
    delayMs: 5000,
    fileMatch: "",
    maxRetries: 3,
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
    if (current.startsWith("--min-images=")) {
      options.minImages = Number.parseInt(current.slice("--min-images=".length), 10) || 0;
      continue;
    }
    if (current === "--min-images") {
      options.minImages = Number.parseInt(argv[index + 1] || "0", 10) || 0;
      index += 1;
      continue;
    }
    if (current.startsWith("--delay-ms=")) {
      options.delayMs = Number.parseInt(current.slice("--delay-ms=".length), 10) || 0;
      continue;
    }
    if (current === "--delay-ms") {
      options.delayMs = Number.parseInt(argv[index + 1] || "0", 10) || 0;
      index += 1;
      continue;
    }
    if (current.startsWith("--max-retries=")) {
      options.maxRetries = Number.parseInt(current.slice("--max-retries=".length), 10) || 0;
      continue;
    }
    if (current === "--max-retries") {
      options.maxRetries = Number.parseInt(argv[index + 1] || "0", 10) || 0;
      index += 1;
      continue;
    }
    if (current.startsWith("--file-match=")) {
      options.fileMatch = current.slice("--file-match=".length).trim();
      continue;
    }
    if (current === "--file-match") {
      options.fileMatch = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (current === "--replace-existing") {
      options.replaceExisting = true;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function buildSubmissionLikeRecord(record) {
  return {
    fileName: record.fileName,
    productLine: record.productLine,
    audienceScope: record.audienceScope,
  };
}

function buildCsv(rows) {
  const headers = [
    "status",
    "datasetKey",
    "datasetId",
    "fileName",
    "imageCount",
    "replacedCollectionId",
    "collectionId",
    "batchId",
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

async function deleteCollections({ baseUrl, apiKey, collectionIds }) {
  const ids = [...new Set(collectionIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (ids.length === 0) {
    return;
  }
  await axios.post(
    `${baseUrl}/core/dataset/collection/delete`,
    { collectionIds: ids },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );
}

async function loadState(statePath) {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      startedAt: new Date().toISOString(),
      items: {},
    };
  }
}

async function saveState(statePath, state) {
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

function buildItemKey(record) {
  return `${record.sourceDir}::${record.fileName}`;
}

function filterInventory(records, options) {
  const matcher = options.fileMatch ? new RegExp(options.fileMatch, "i") : null;
  const filtered = records.filter((record) => {
    if (!record.isLatest) {
      return false;
    }
    if (record.extension !== ".docx") {
      return false;
    }
    if (record.securityLevel !== "PUBLIC_CS") {
      return false;
    }
    if (options.datasetFilter && inferDatasetKey(record) !== options.datasetFilter) {
      return false;
    }
    if (matcher && !matcher.test(record.fileName)) {
      return false;
    }
    return true;
  });

  return filtered;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.inventoryPath) {
    throw new Error(
      "Usage: node src/scripts/import-mineru-docx-batch.js --inventory=<knowledge-inventory.json> [--dataset-filter=FASTGPT_DATASET_HOME_AI] [--min-images=10] [--replace-existing] [--delay-ms=5000] [--max-retries=3] [--file-match=AI守护] [--limit=1] [--dry-run]",
    );
  }

  const baseUrl = requireEnv("FASTGPT_BASE_URL");
  const apiKey = requireEnv("FASTGPT_API_KEY");
  const rawInventory = await fs.readFile(options.inventoryPath, "utf8");
  const inventory = JSON.parse(rawInventory);
  const outputDir = options.outputDir;
  const statePath = path.join(outputDir, "mineru-reimport-state.json");
  const state = await loadState(statePath);

  let candidates = filterInventory(inventory, options).map((record) => {
    const filePath = path.join(record.sourceDir, record.fileName);
    return {
      ...record,
      filePath,
      imageCount: countDocxImages(filePath),
      datasetKey: inferDatasetKey(record),
    };
  });

  candidates = candidates.filter((record) => record.imageCount >= options.minImages);
  candidates.sort((left, right) => right.imageCount - left.imageCount);
  if (options.limit > 0) {
    candidates = candidates.slice(0, options.limit);
  }

  const datasetIds = new Map();
  for (const record of candidates) {
    const datasetId = resolveDatasetIdForSubmission(buildSubmissionLikeRecord(record));
    if (!datasetId) {
      throw new Error(`No dataset configured for ${record.fileName} (${record.datasetKey})`);
    }
    datasetIds.set(record.datasetKey, datasetId);
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

  await fs.mkdir(outputDir, { recursive: true });
  const results = [];

  for (const record of candidates) {
    const datasetId = datasetIds.get(record.datasetKey);
    const existingMap = existingByDataset.get(record.datasetKey) || new Map();
    const existing = existingMap.get(normalizeName(record.fileName));
    const itemKey = buildItemKey(record);
    const previous = state.items[itemKey];

    if (previous?.status === "imported" || previous?.status === "reimported") {
      results.push(previous);
      continue;
    }

    if (existing && !options.replaceExisting) {
      const row = {
        status: "skipped_existing",
        datasetKey: record.datasetKey,
        datasetId,
        fileName: record.fileName,
        imageCount: record.imageCount,
        replacedCollectionId: existing._id || "",
        collectionId: existing._id || "",
        batchId: "",
        charCount: 0,
        detailStatus: existing.trainingStatus || existing.status || "",
        error: "",
      };
      state.items[itemKey] = row;
      results.push(row);
      await saveState(statePath, state);
      continue;
    }

    if (options.dryRun) {
      const row = {
        status: existing ? "dry_run_replace" : "dry_run",
        datasetKey: record.datasetKey,
        datasetId,
        fileName: record.fileName,
        imageCount: record.imageCount,
        replacedCollectionId: existing?._id || "",
        collectionId: "",
        batchId: "",
        charCount: 0,
        detailStatus: "",
        error: "",
      };
      state.items[itemKey] = row;
      results.push(row);
      await saveState(statePath, state);
      continue;
    }

    const row = {
      status: existing ? "processing_replace" : "processing",
      datasetKey: record.datasetKey,
      datasetId,
      fileName: record.fileName,
      imageCount: record.imageCount,
      replacedCollectionId: existing?._id || "",
      collectionId: "",
      batchId: "",
      charCount: 0,
      detailStatus: "",
      error: "",
    };
    state.items[itemKey] = row;
    await saveState(statePath, state);

    try {
      const mineruResult = await parseWithMinerU(record.filePath, record.fileName, {
        maxRetries: options.maxRetries,
        onProgress: ({ message, batchId, stage, state: batchState, extractedPages, totalPages }) => {
          row.batchId = batchId || row.batchId;
          row.detailStatus = [stage, batchState, extractedPages, totalPages]
            .filter((value) => value !== undefined && value !== "")
            .join(":");
          state.items[itemKey] = { ...row };
          console.log(
            `[MinerUReimport] ${record.fileName} -> ${message}${
              batchId ? ` (batch ${batchId})` : ""
            }`,
          );
        },
      });

      const text = String(
        mineruResult?.text ||
          mineruResult?.fastGPTMarkdown ||
          mineruResult?.localMarkdown ||
          "",
      ).trim();
      if (!text) {
        throw new Error("MinerU extracted empty text");
      }

      const collectionId = await createTextCollection({
        baseUrl,
        apiKey,
        datasetId,
        name: record.fileName,
        text,
      });
      const detail = await fetchCollectionDetail({ baseUrl, apiKey, collectionId });

      if (existing?._id) {
        await deleteCollections({
          baseUrl,
          apiKey,
          collectionIds: [existing._id],
        });
      }

      row.status = existing ? "reimported" : "imported";
      row.collectionId = collectionId;
      row.batchId = mineruResult.batchId || row.batchId;
      row.charCount = text.length;
      row.detailStatus =
        detail?.trainingType ||
        detail?.trainingStatus ||
        detail?.status ||
        "";
      row.error = "";

      existingMap.set(normalizeName(record.fileName), {
        _id: collectionId,
        name: record.fileName,
      });
      existingByDataset.set(record.datasetKey, existingMap);
    } catch (error) {
      row.status = "failed";
      row.error = error instanceof Error ? error.message : String(error);
    }

    state.items[itemKey] = { ...row };
    results.push({ ...row });
    await saveState(statePath, state);

    if (options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  const summary = results.reduce(
    (accumulator, row) => {
      accumulator[row.status] = (accumulator[row.status] || 0) + 1;
      return accumulator;
    },
    {
      imported: 0,
      reimported: 0,
      skipped_existing: 0,
      failed: 0,
      dry_run: 0,
      dry_run_replace: 0,
    },
  );

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outputDir, `mineru-docx-import-${timestamp}.json`);
  const csvPath = path.join(outputDir, `mineru-docx-import-${timestamp}.csv`);

  await fs.writeFile(
    jsonPath,
    JSON.stringify(
      {
        startedAt: state.startedAt,
        finishedAt: new Date().toISOString(),
        datasetFilter: options.datasetFilter || "",
        minImages: options.minImages,
        limit: options.limit || 0,
        replaceExisting: options.replaceExisting,
        delayMs: options.delayMs,
        dryRun: options.dryRun,
        fileMatch: options.fileMatch || "",
        summary,
        results,
      },
      null,
      2,
    ),
    "utf8",
  );
  await fs.writeFile(csvPath, buildCsv(results), "utf8");

  console.log(`[MinerUReimport] Inventory: ${options.inventoryPath}`);
  console.log(`[MinerUReimport] State: ${statePath}`);
  console.log(`[MinerUReimport] Output JSON: ${jsonPath}`);
  console.log(`[MinerUReimport] Output CSV: ${csvPath}`);
  console.log(`[MinerUReimport] Summary: ${JSON.stringify(summary)}`);
}

main().catch((error) => {
  console.error("[MinerUReimport] Failed:", error.message);
  process.exitCode = 1;
});
