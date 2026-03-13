#!/usr/bin/env node

import axios from "axios";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), "../tmp/qa-verify-run");

function stripBom(raw) {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

function parseArgs(argv) {
  const options = {
    manifest: "",
    outputDir: DEFAULT_OUTPUT_DIR,
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.manifest) {
    throw new Error(
      "Usage: node src/scripts/verify-fastgpt-qa-imports.js --manifest=<split-manifest.json> [--output=<dir>]",
    );
  }

  const baseUrl = requireEnv("FASTGPT_BASE_URL");
  const apiKey = requireEnv("FASTGPT_API_KEY");
  const manifest = await readJson(options.manifest);

  await fs.mkdir(options.outputDir, { recursive: true });
  const results = [];

  for (const task of manifest) {
    const datasetId = String(process.env[task.datasetKey] || task.datasetId || "").trim();
    if (!datasetId) {
      results.push({
        status: "missing_dataset",
        datasetKey: task.datasetKey,
        collectionName: task.collectionName,
      });
      continue;
    }

    const collections = await fetchAllCollections({ baseUrl, apiKey, datasetId });
    const matched = collections.filter(
      (item) => normalizeName(item.name) === normalizeName(task.collectionName),
    );

    if (matched.length === 0) {
      results.push({
        status: "missing_collection",
        datasetKey: task.datasetKey,
        datasetId,
        collectionName: task.collectionName,
        expectedQaPairs: task.totalQaPairs,
      });
      continue;
    }

    results.push({
      status: matched.some((item) => Number(item.dataAmount || 0) >= Number(task.totalQaPairs || 0))
        ? "passed"
        : "count_mismatch",
      datasetKey: task.datasetKey,
      datasetId,
      collectionName: task.collectionName,
      expectedQaPairs: task.totalQaPairs,
      matchedCollections: matched.map((item) => ({
        collectionId: item._id,
        name: item.name,
        dataAmount: Number(item.dataAmount || 0),
        trainingType: item.trainingType,
      })),
    });
  }

  const summary = {
    total: results.length,
    passed: results.filter((item) => item.status === "passed").length,
    failed: results.filter((item) => item.status !== "passed").length,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(options.outputDir, `qa-verify-${timestamp}.json`);
  await fs.writeFile(
    reportPath,
    `\uFEFF${JSON.stringify({ summary, results }, null, 2)}`,
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        outputDir: options.outputDir,
        reportPath,
        summary,
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
