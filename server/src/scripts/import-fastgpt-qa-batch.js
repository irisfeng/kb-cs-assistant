#!/usr/bin/env node

import axios from "axios";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), "../tmp/qa-import-run");
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_PAGE_SIZE = 100;

function stripBom(raw) {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

function parseArgs(argv) {
  const options = {
    manifest: "",
    outputDir: DEFAULT_OUTPUT_DIR,
    replaceExisting: false,
    batchSize: DEFAULT_BATCH_SIZE,
    datasetFilter: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current.startsWith("--manifest=")) {
      options.manifest = path.resolve(current.slice("--manifest=".length));
      continue;
    }
    if (current === "--manifest" && argv[index + 1]) {
      options.manifest = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (current.startsWith("--output=")) {
      options.outputDir = path.resolve(current.slice("--output=".length));
      continue;
    }
    if (current === "--output" && argv[index + 1]) {
      options.outputDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (current === "--replace-existing") {
      options.replaceExisting = true;
      continue;
    }
    if (current.startsWith("--batch-size=")) {
      options.batchSize = Number.parseInt(current.slice("--batch-size=".length), 10) || DEFAULT_BATCH_SIZE;
      continue;
    }
    if (current === "--batch-size" && argv[index + 1]) {
      options.batchSize = Number.parseInt(argv[index + 1], 10) || DEFAULT_BATCH_SIZE;
      index += 1;
      continue;
    }
    if (current.startsWith("--dataset-filter=")) {
      options.datasetFilter = current.slice("--dataset-filter=".length).trim();
      continue;
    }
    if (current === "--dataset-filter" && argv[index + 1]) {
      options.datasetFilter = String(argv[index + 1] || "").trim();
      index += 1;
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

async function readJson(filePath) {
  return JSON.parse(stripBom(await fs.readFile(filePath, "utf8")));
}

async function fetchAllCollections({ baseUrl, apiKey, datasetId }) {
  const all = [];
  let pageNum = 1;

  while (true) {
    const response = await axios.post(
      `${baseUrl}/core/dataset/collection/list`,
      { datasetId, pageNum, pageSize: DEFAULT_PAGE_SIZE },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    const page = response.data?.data?.data || [];
    all.push(...page);
    if (page.length < DEFAULT_PAGE_SIZE) {
      break;
    }
    pageNum += 1;
  }

  return all;
}

async function waitForCollectionDataAmount({
  baseUrl,
  apiKey,
  datasetId,
  collectionId,
  expectedMinimum,
  attempts = 10,
  delayMs = 800,
}) {
  let lastDataAmount = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const collections = await fetchAllCollections({ baseUrl, apiKey, datasetId });
    const matched = collections.find((item) => String(item._id) === String(collectionId));
    lastDataAmount = Number(matched?.dataAmount || 0);

    if (lastDataAmount >= expectedMinimum) {
      return lastDataAmount;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return lastDataAmount;
}

async function deleteCollections({ baseUrl, apiKey, collectionIds }) {
  if (collectionIds.length === 0) {
    return;
  }
  await axios.post(
    `${baseUrl}/core/dataset/collection/delete`,
    { collectionIds },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );
}

async function createQaShellCollection({ baseUrl, apiKey, datasetId, name }) {
  const response = await axios.post(
    `${baseUrl}/core/dataset/collection/create/text`,
    {
      datasetId,
      name,
      text: " ",
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
  const collectionId =
    typeof data === "string" ? data : data?.collectionId;
  if (!collectionId) {
    throw new Error("FastGPT response missing qa shell collectionId");
  }
  return collectionId;
}

function toIndexObjects(indexes) {
  return (Array.isArray(indexes) ? indexes : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((item) => ({ text: item, type: "custom" }));
}

async function pushQaData({ baseUrl, apiKey, collectionId, rows }) {
  const response = await axios.post(
    `${baseUrl}/core/dataset/data/pushData`,
    {
      collectionId,
      data: rows.map((row) => ({
        q: String(row.q || "").trim(),
        a: String(row.a || "").trim(),
        indexes: toIndexObjects(row.indexes),
      })),
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  return response.data?.data?.insertLen || 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.manifest) {
    throw new Error(
      "Usage: node src/scripts/import-fastgpt-qa-batch.js --manifest=<split-manifest.json> [--output=<dir>] [--replace-existing] [--dataset-filter=FASTGPT_DATASET_HOME_AI]",
    );
  }

  const baseUrl = requireEnv("FASTGPT_BASE_URL");
  const apiKey = requireEnv("FASTGPT_API_KEY");
  const manifest = await readJson(options.manifest);

  const tasks = manifest.filter((item) =>
    options.datasetFilter ? item.datasetKey === options.datasetFilter : true,
  );

  await fs.mkdir(options.outputDir, { recursive: true });
  const results = [];

  for (const task of tasks) {
    const datasetId = String(process.env[task.datasetKey] || task.datasetId || "").trim();
    if (!datasetId) {
      results.push({
        status: "skipped_missing_dataset",
        datasetKey: task.datasetKey,
        collectionName: task.collectionName,
      });
      continue;
    }

    const records = await readJson(task.outputJson);
    const existingCollections = await fetchAllCollections({ baseUrl, apiKey, datasetId });
    const matchedExisting = existingCollections.filter(
      (item) => normalizeName(item.name) === normalizeName(task.collectionName),
    );

    if (matchedExisting.length > 0 && options.replaceExisting) {
      await deleteCollections({
        baseUrl,
        apiKey,
        collectionIds: matchedExisting.map((item) => item._id),
      });
    } else if (matchedExisting.length > 0) {
      results.push({
        status: "skipped_existing",
        datasetKey: task.datasetKey,
        datasetId,
        collectionName: task.collectionName,
        existingCollectionIds: matchedExisting.map((item) => item._id),
      });
      continue;
    }

    const collectionId = await createQaShellCollection({
      baseUrl,
      apiKey,
      datasetId,
      name: task.collectionName,
    });

    let inserted = 0;
    for (let start = 0; start < records.length; start += options.batchSize) {
      const batch = records.slice(start, start + options.batchSize);
      inserted += await pushQaData({
        baseUrl,
        apiKey,
        collectionId,
        rows: batch,
      });
    }

    const dataAmount = await waitForCollectionDataAmount({
      baseUrl,
      apiKey,
      datasetId,
      collectionId,
      expectedMinimum: records.length,
    });

    results.push({
      status: "imported",
      datasetKey: task.datasetKey,
      datasetId,
      collectionName: task.collectionName,
      collectionId,
      totalQaPairs: records.length,
      inserted,
      dataAmount,
    });
  }

  const reportPath = path.join(
    options.outputDir,
    `qa-import-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  await fs.writeFile(reportPath, `\uFEFF${JSON.stringify(results, null, 2)}`, "utf8");

  console.log(
    JSON.stringify(
      {
        outputDir: options.outputDir,
        reportPath,
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
