#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import XLSX from "xlsx";

const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), "xlsx-fastgpt-qa-output");

const QUESTION_HEADER_HINTS = [
  "问题",
  "问答问题",
  "question",
  "提问",
  "faq",
];

const ANSWER_HEADER_HINTS = [
  "答案",
  "口径",
  "回复",
  "answer",
  "解答",
  "处理建议",
];

const TAG_HEADER_HINTS = [
  "标签",
  "分类",
  "产品",
  "场景",
  "业务",
  "模块",
  "类型",
];

function ensureText(value) {
  return String(value ?? "").replace(/\r/g, "").trim();
}

function normalizeForMatch(value) {
  return ensureText(value).toLowerCase().replace(/\s+/g, "");
}

function csvEscape(value) {
  const text = ensureText(value);
  if (text.includes("\"") || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function parseArgs(argv) {
  const files = [];
  let outputDir = DEFAULT_OUTPUT_DIR;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current.startsWith("--file=")) {
      files.push(path.resolve(current.slice("--file=".length)));
      continue;
    }
    if (current === "--file" && argv[index + 1]) {
      files.push(path.resolve(argv[index + 1]));
      index += 1;
      continue;
    }
    if (current.startsWith("--files=")) {
      const raw = current.slice("--files=".length);
      raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => files.push(path.resolve(item)));
      continue;
    }
    if (current === "--files" && argv[index + 1]) {
      argv[index + 1]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => files.push(path.resolve(item)));
      index += 1;
      continue;
    }
    if (current.startsWith("--output=")) {
      outputDir = path.resolve(current.slice("--output=".length));
      continue;
    }
    if (current === "--output" && argv[index + 1]) {
      outputDir = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return {
    files: [...new Set(files)],
    outputDir,
  };
}

function includesAny(value, keywords) {
  return keywords.some((keyword) => value.includes(keyword));
}

function splitTags(raw) {
  return ensureText(raw)
    .split(/[，,、;；|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function detectHeaderInfo(rows) {
  const maxProbeRows = Math.min(rows.length, 20);

  for (let rowIndex = 0; rowIndex < maxProbeRows; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const questionCols = [];
    const answerCols = [];
    const tagCols = [];

    row.forEach((cell, colIndex) => {
      const normalized = normalizeForMatch(cell);
      if (!normalized) {
        return;
      }
      if (includesAny(normalized, QUESTION_HEADER_HINTS)) {
        questionCols.push(colIndex);
      }
      if (includesAny(normalized, ANSWER_HEADER_HINTS)) {
        answerCols.push(colIndex);
      }
      if (includesAny(normalized, TAG_HEADER_HINTS)) {
        tagCols.push(colIndex);
      }
    });

    if (questionCols.length > 0 && answerCols.length > 0) {
      const questionCol = questionCols[0];
      const answerCol = answerCols.find((col) => col !== questionCol) ?? answerCols[0];
      return {
        headerRowIndex: rowIndex,
        questionCol,
        answerCol,
        tagCols: tagCols.filter((col) => col !== questionCol && col !== answerCol),
      };
    }
  }

  return null;
}

function buildIndexes({ sourceFile, sheetName, tagValues }) {
  const indexes = [
    `source:${path.basename(sourceFile)}`,
    `sheet:${sheetName}`,
  ];

  for (const value of tagValues) {
    splitTags(value).forEach((tag) => indexes.push(`tag:${tag}`));
  }

  return [...new Set(indexes)];
}

function extractQaFromSheet({ sourceFile, sheetName, rows }) {
  const headerInfo = detectHeaderInfo(rows);
  if (!headerInfo) {
    return [];
  }

  const records = [];
  for (let rowIndex = headerInfo.headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const question = ensureText(row[headerInfo.questionCol]);
    const answer = ensureText(row[headerInfo.answerCol]);

    if (!question || !answer) {
      continue;
    }

    const tagValues = headerInfo.tagCols.map((col) => ensureText(row[col])).filter(Boolean);
    const indexes = buildIndexes({ sourceFile, sheetName, tagValues });

    records.push({
      sourceFile,
      sheetName,
      rowIndex: rowIndex + 1,
      q: question,
      a: answer,
      indexes,
    });
  }

  return records;
}

function extractQaRecordsFromFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const all = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    });

    const records = extractQaFromSheet({
      sourceFile: filePath,
      sheetName,
      rows,
    });
    all.push(...records);
  }

  return all;
}

async function writeOutputs(outputDir, records) {
  await fs.mkdir(outputDir, { recursive: true });

  const csvPath = path.join(outputDir, "fastgpt-qa-template.csv");
  const jsonPath = path.join(outputDir, "fastgpt-qa-records.json");
  const summaryPath = path.join(outputDir, "summary.json");

  const csvRows = ["q,a,indexes"];
  records.forEach((record) => {
    csvRows.push(
      [
        csvEscape(record.q),
        csvEscape(record.a),
        csvEscape(JSON.stringify(record.indexes)),
      ].join(","),
    );
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    totalQaPairs: records.length,
    totalSourceFiles: [...new Set(records.map((record) => record.sourceFile))].length,
    totalSheets: [...new Set(records.map((record) => `${record.sourceFile}#${record.sheetName}`))]
      .length,
    bySourceFile: records.reduce((accumulator, record) => {
      accumulator[record.sourceFile] = (accumulator[record.sourceFile] || 0) + 1;
      return accumulator;
    }, {}),
  };

  // Add UTF-8 BOM + CRLF for better compatibility when opening in Excel on Windows.
  const csvContent = `\uFEFF${csvRows.join("\r\n")}`;
  await fs.writeFile(csvPath, csvContent, "utf8");
  const jsonContent = `\uFEFF${JSON.stringify(records, null, 2)}`;
  const summaryContent = `\uFEFF${JSON.stringify(summary, null, 2)}`;
  await fs.writeFile(jsonPath, jsonContent, "utf8");
  await fs.writeFile(summaryPath, summaryContent, "utf8");

  return { csvPath, jsonPath, summaryPath, summary };
}

async function main() {
  const { files, outputDir } = parseArgs(process.argv.slice(2));

  if (files.length === 0) {
    console.error(
      "Usage: node src/scripts/export-xlsx-fastgpt-qa.js --file=<xlsx> [--file=<xlsx2>] [--output=<dir>]",
    );
    process.exitCode = 1;
    return;
  }

  const records = [];
  for (const filePath of files) {
    const fileRecords = extractQaRecordsFromFile(filePath);
    records.push(...fileRecords);
  }

  const output = await writeOutputs(outputDir, records);
  console.log(`[QACSV] Output CSV: ${output.csvPath}`);
  console.log(`[QACSV] Output JSON: ${output.jsonPath}`);
  console.log(`[QACSV] Output summary: ${output.summaryPath}`);
  console.log(`[QACSV] QA pairs: ${output.summary.totalQaPairs}`);
}

main().catch((error) => {
  console.error("[QACSV] Failed:", error);
  process.exitCode = 1;
});
