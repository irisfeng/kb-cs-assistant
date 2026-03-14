#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";

const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), "import-manifest-output");

function parseArgs(argv) {
  let inventoryPath = "";
  let outputDir = DEFAULT_OUTPUT_DIR;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current.startsWith("--inventory=")) {
      inventoryPath = path.resolve(current.slice("--inventory=".length));
      continue;
    }
    if (current.startsWith("--output=")) {
      outputDir = path.resolve(current.slice("--output=".length));
      continue;
    }
    if (current === "--inventory") {
      inventoryPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (current === "--output") {
      outputDir = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return { inventoryPath, outputDir };
}

function csvEscape(value) {
  const normalized = String(value ?? "");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }
  return normalized;
}

function normalizeDatasetLabel(record) {
  if (record.securityLevel === "SCAN_ERROR") {
    return "待人工复核-源文件异常";
  }
  if (record.extension === ".xlsx") {
    return "派生-按工作表拆分";
  }
  const baseName = (record.productName || record.fileName || "")
    .replace(/\s+/g, " ")
    .replace(/\.[^.]+$/, "")
    .trim();

  if (record.securityLevel === "RESTRICTED") {
    return `内部待拆分-${baseName}`;
  }
  if (record.securityLevel === "INTERNAL_SUPPORT") {
    return `内部支持-${baseName}`;
  }
  if (record.documentType === "FAQ_INDEX") {
    return "全局-FAQ";
  }
  if (record.importScope === "DEVICE") {
    return `设备-${baseName}`;
  }
  return `产品-${baseName}`;
}

function buildNotes(record) {
  const notes = [];

  if (record.securityLevel === "SCAN_ERROR") {
    notes.push(`scan failed: ${record.extractError || "unknown error"}`);
  }
  if (record.securityLevel === "RESTRICTED") {
    notes.push(`contains sensitive signals: ${record.sensitiveSignals.join("|")}`);
  }
  if (record.securityLevel === "INTERNAL_SUPPORT") {
    notes.push("internal support only; exclude from public CS app");
  }
  if (record.extension === ".xlsx") {
    notes.push("spreadsheet source; derive markdown/json with extract-xlsx-knowledge.js before import");
  }
  if (record.importScope === "DEVICE") {
    notes.push("keep separate from product policy datasets");
  }
  if (!record.isLatest) {
    notes.push("older version; archive outside default retrieval path");
  }
  if (record.versionGroupSize > 1) {
    notes.push(`version group size=${record.versionGroupSize}`);
  }

  return notes.join("; ");
}

function buildAction(record) {
  if (record.securityLevel === "SCAN_ERROR") {
    return "REVIEW_SOURCE_FILE";
  }
  if (record.securityLevel === "RESTRICTED") {
    return "SPLIT_OR_REDACT";
  }
  if (record.extension === ".xlsx") {
    return "EXTRACT_THEN_IMPORT";
  }
  if (!record.isLatest) {
    return "ARCHIVE_ONLY";
  }
  if (record.securityLevel === "INTERNAL_SUPPORT") {
    return "IMPORT_INTERNAL_ONLY";
  }
  return "IMPORT";
}

function summarize(records) {
  return records.reduce((accumulator, record) => {
    accumulator[record.recommendedAction] = (accumulator[record.recommendedAction] || 0) + 1;
    return accumulator;
  }, {});
}

async function main() {
  const { inventoryPath, outputDir } = parseArgs(process.argv.slice(2));

  if (!inventoryPath) {
    console.error("Usage: node src/scripts/generate-import-manifest.js --inventory=<inventory-json> [--output=<dir>]");
    process.exitCode = 1;
    return;
  }

  const raw = await fs.readFile(inventoryPath, "utf8");
  const inventory = JSON.parse(raw);

  const manifest = inventory.map((record) => ({
    sourceDir: record.sourceDir,
    fileName: record.fileName,
    productLine: record.productLine,
    productName: record.productName,
    documentType: record.documentType,
    effectiveDate: record.effectiveDate,
    version: record.version,
    isLatest: Boolean(record.isLatest),
    securityLevel: record.securityLevel,
    importScope: record.importScope,
    recommendedAction: buildAction(record),
    targetDataset: normalizeDatasetLabel(record),
    audienceScope: record.audienceScope,
    notes: buildNotes(record)
  }));

  const datasetPlan = [...new Map(
    manifest.map((record) => [
      record.targetDataset,
      {
        datasetName: record.targetDataset,
        importScope: record.importScope,
        audienceScope: record.audienceScope
      }
    ])
  ).values()];

  await fs.mkdir(outputDir, { recursive: true });

  const manifestJsonPath = path.join(outputDir, "import-manifest.json");
  const manifestCsvPath = path.join(outputDir, "import-manifest.csv");
  const datasetPlanPath = path.join(outputDir, "dataset-plan.json");
  const summaryPath = path.join(outputDir, "import-summary.json");

  await fs.writeFile(manifestJsonPath, JSON.stringify(manifest, null, 2), "utf8");
  await fs.writeFile(datasetPlanPath, JSON.stringify(datasetPlan, null, 2), "utf8");
  await fs.writeFile(summaryPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalFiles: manifest.length,
    actionCounts: summarize(manifest)
  }, null, 2), "utf8");

  const headers = [
    "fileName",
    "productLine",
    "productName",
    "documentType",
    "effectiveDate",
    "version",
    "isLatest",
    "securityLevel",
    "importScope",
    "recommendedAction",
    "targetDataset",
    "audienceScope",
    "notes"
  ];
  const rows = [
    headers.join(","),
    ...manifest.map((record) =>
      headers.map((header) => csvEscape(record[header])).join(",")
    )
  ];
  await fs.writeFile(manifestCsvPath, rows.join("\n"), "utf8");

  console.log(`[Manifest] Inventory: ${inventoryPath}`);
  console.log(`[Manifest] Output JSON: ${manifestJsonPath}`);
  console.log(`[Manifest] Output CSV: ${manifestCsvPath}`);
  console.log(`[Manifest] Dataset plan: ${datasetPlanPath}`);
  console.log(`[Manifest] Summary: ${summaryPath}`);
  console.log(`[Manifest] Actions: ${JSON.stringify(summarize(manifest))}`);
}

main().catch((error) => {
  console.error("[Manifest] Failed:", error);
  process.exitCode = 1;
});
