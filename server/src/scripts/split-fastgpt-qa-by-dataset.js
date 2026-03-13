#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), "../tmp/qa-split-by-dataset");

function stripBom(raw) {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

function parseArgs(argv) {
  const options = {
    records: [],
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current.startsWith("--records=")) {
      options.records.push(path.resolve(current.slice("--records=".length)));
      continue;
    }
    if (current === "--records" && argv[index + 1]) {
      options.records.push(path.resolve(argv[index + 1]));
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

  options.records = [...new Set(options.records)];
  return options;
}

function requireRecords(records) {
  if (records.length === 0) {
    throw new Error(
      "Usage: node src/scripts/split-fastgpt-qa-by-dataset.js --records=<fastgpt-qa-records.json> [--records=<fastgpt-qa-records.json>] [--output=<dir>]",
    );
  }
}

function ensureArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeText(value) {
  return String(value || "").trim();
}

function csvEscape(value) {
  const text = normalizeText(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function getTagValues(record) {
  return ensureArray(record.indexes)
    .filter((item) => String(item).startsWith("tag:"))
    .map((item) => String(item).slice(4));
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function inferDatasetKey(record) {
  const sourceFile = path.basename(record.sourceFile || "");
  const sheetName = normalizeText(record.sheetName);
  const tagValues = getTagValues(record);
  const joined = [sheetName, ...tagValues, record.q, record.a].join("\n");

  if (/天翼视联产品F&Q\.xlsx/i.test(sourceFile)) {
    if (/视频AI算法舱/.test(joined)) {
      return "SKIP_INTERNAL_SENSITIVE";
    }
    if (/视联百川/.test(joined)) {
      return "FASTGPT_DATASET_BAICHUAN";
    }
    if (/EBO-SE|EBO/i.test(joined)) {
      return "FASTGPT_DATASET_EBO";
    }
    if (
      includesAny(joined, [
        /赛达/i,
        /H681/i,
        /H683/i,
        /H680/i,
        /xk001-A10/i,
        /翼支付商城/i,
        /天翼视联商城/i,
      ])
    ) {
      return "FASTGPT_DATASET_DEVICE_SHOP";
    }
  }

  if (/视联网知识库-AI产品\.xlsx/i.test(sourceFile)) {
    if (includesAny(joined, [/中国电信行业版AI产品政企版/i, /政企版/i])) {
      return "FASTGPT_DATASET_B2B_ICT";
    }
    if (includesAny(joined, [/天翼看家/i])) {
      return "FASTGPT_DATASET_HOME_AI";
    }
  }

  return "SKIP_UNMAPPED";
}

function buildCollectionName(datasetKey) {
  switch (datasetKey) {
    case "FASTGPT_DATASET_BAICHUAN":
      return "天翼视联产品F&Q-视联百川问答库";
    case "FASTGPT_DATASET_EBO":
      return "天翼视联产品F&Q-EBO问答库";
    case "FASTGPT_DATASET_DEVICE_SHOP":
      return "天翼视联产品F&Q-设备商城问答库";
    case "FASTGPT_DATASET_HOME_AI":
      return "视联网知识库-AI产品-天翼看家问答库";
    case "FASTGPT_DATASET_B2B_ICT":
      return "视联网知识库-AI产品-政企版问答库";
    default:
      return "";
  }
}

function buildSlug(datasetKey) {
  switch (datasetKey) {
    case "FASTGPT_DATASET_BAICHUAN":
      return "baichuan";
    case "FASTGPT_DATASET_EBO":
      return "ebo";
    case "FASTGPT_DATASET_DEVICE_SHOP":
      return "device-shop";
    case "FASTGPT_DATASET_HOME_AI":
      return "home-ai";
    case "FASTGPT_DATASET_B2B_ICT":
      return "b2b-ict";
    case "SKIP_INTERNAL_SENSITIVE":
      return "skip-internal-sensitive";
    default:
      return "skip-unmapped";
  }
}

async function loadRecords(filePath) {
  const raw = stripBom(await fs.readFile(filePath, "utf8"));
  const parsed = JSON.parse(raw);
  return parsed.map((item) => ({
    ...item,
    indexes: ensureArray(item.indexes),
    __sourceRecordsFile: filePath,
  }));
}

function buildCsvContent(records) {
  const rows = ["q,a,indexes"];
  for (const record of records) {
    rows.push(
      [
        csvEscape(record.q),
        csvEscape(record.a),
        csvEscape(JSON.stringify(record.indexes)),
      ].join(","),
    );
  }
  return `\uFEFF${rows.join("\r\n")}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  requireRecords(options.records);

  const grouped = new Map();
  const skipped = [];

  for (const recordsPath of options.records) {
    const records = await loadRecords(recordsPath);
    for (const record of records) {
      const datasetKey = inferDatasetKey(record);
      if (datasetKey.startsWith("SKIP_")) {
        skipped.push({
          reason: datasetKey,
          sourceRecordsFile: recordsPath,
          sourceFile: record.sourceFile,
          sheetName: record.sheetName,
          q: record.q,
        });
        continue;
      }

      const list = grouped.get(datasetKey) || [];
      list.push(record);
      grouped.set(datasetKey, list);
    }
  }

  await fs.mkdir(options.outputDir, { recursive: true });
  const manifest = [];

  for (const [datasetKey, records] of grouped.entries()) {
    const slug = buildSlug(datasetKey);
    const dir = path.join(options.outputDir, slug);
    await fs.mkdir(dir, { recursive: true });

    const collectionName = buildCollectionName(datasetKey);
    const csvPath = path.join(dir, "fastgpt-qa-template.csv");
    const jsonPath = path.join(dir, "fastgpt-qa-records.json");
    const summaryPath = path.join(dir, "summary.json");

    await fs.writeFile(csvPath, buildCsvContent(records), "utf8");
    await fs.writeFile(jsonPath, `\uFEFF${JSON.stringify(records, null, 2)}`, "utf8");

    const summary = {
      datasetKey,
      datasetId: String(process.env[datasetKey] || "").trim(),
      collectionName,
      totalQaPairs: records.length,
      sourceFiles: [...new Set(records.map((item) => item.sourceFile))],
      sheetNames: [...new Set(records.map((item) => item.sheetName))],
      outputCsv: csvPath,
      outputJson: jsonPath,
    };

    await fs.writeFile(summaryPath, `\uFEFF${JSON.stringify(summary, null, 2)}`, "utf8");
    manifest.push(summary);
  }

  const skippedPath = path.join(options.outputDir, "skipped-records.json");
  const manifestPath = path.join(options.outputDir, "split-manifest.json");
  const summaryPath = path.join(options.outputDir, "split-summary.json");

  await fs.writeFile(skippedPath, `\uFEFF${JSON.stringify(skipped, null, 2)}`, "utf8");
  await fs.writeFile(manifestPath, `\uFEFF${JSON.stringify(manifest, null, 2)}`, "utf8");
  await fs.writeFile(
    summaryPath,
    `\uFEFF${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        outputDir: options.outputDir,
        totalTargetDatasets: manifest.length,
        totalImportedQaPairs: manifest.reduce((sum, item) => sum + item.totalQaPairs, 0),
        skippedRecords: skipped.length,
        byDataset: manifest.reduce((acc, item) => {
          acc[item.datasetKey] = item.totalQaPairs;
          return acc;
        }, {}),
      },
      null,
      2,
    )}`,
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        outputDir: options.outputDir,
        manifestPath,
        skippedPath,
        datasets: manifest.map((item) => ({
          datasetKey: item.datasetKey,
          totalQaPairs: item.totalQaPairs,
          collectionName: item.collectionName,
        })),
        skippedRecords: skipped.length,
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
