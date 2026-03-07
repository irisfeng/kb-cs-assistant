#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import XLSX from "xlsx";

const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), "xlsx-knowledge-output");

function parseArgs(argv) {
  let filePath = "";
  let outputDir = DEFAULT_OUTPUT_DIR;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current.startsWith("--file=")) {
      filePath = path.resolve(current.slice("--file=".length));
      continue;
    }
    if (current.startsWith("--output=")) {
      outputDir = path.resolve(current.slice("--output=".length));
      continue;
    }
    if (current === "--file") {
      filePath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (current === "--output") {
      outputDir = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return { filePath, outputDir };
}

function ensureText(value) {
  return String(value ?? "").replace(/\r/g, "").trim();
}

function sanitizeFileName(value) {
  return ensureText(value)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "_");
}

function normalizeDatasetName(value) {
  const text = ensureText(value)
    .replace(/已支持的设备及版本条件/g, "")
    .replace(/设备支持清单/g, "")
    .replace(/支持终端清单/g, "")
    .replace(/[-—–－]\s*业务咨询类/g, "")
    .replace(/[-—–－]\s*客户报障类/g, "")
    .replace(/[-—–－]\s*通用类问题/g, "")
    .replace(/[-—–－]\s*分产品问题/g, "")
    .replace(/客服文档/g, "")
    .replace(/产品$/, "")
    .replace(/--+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-$/, "")
    .trim();

  if (!text) {
    return "全局-FAQ";
  }
  return `产品-${text}`;
}

function findHeaderKey(row, candidates) {
  const keys = Object.keys(row);
  return keys.find((key) => candidates.some((candidate) => key.includes(candidate))) || "";
}

function extractQaDocs(workbook, sourceFile) {
  const docs = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
    if (rows.length === 0) {
      continue;
    }

    const sample = rows[0];
    const questionKey = findHeaderKey(sample, ["问题"]);
    const answerKey = findHeaderKey(sample, ["答案", "口径"]);

    if (!questionKey || !answerKey) {
      continue;
    }

    const tagKey = findHeaderKey(sample, ["标签", "分类", "产品"]);
    const grouped = new Map();

    for (const row of rows) {
      const question = ensureText(row[questionKey]);
      const answer = ensureText(row[answerKey]);
      if (!question || !answer) {
        continue;
      }
      const groupName = ensureText(tagKey ? row[tagKey] : "") || "全局FAQ";
      if (!grouped.has(groupName)) {
        grouped.set(groupName, []);
      }
      grouped.get(groupName).push({
        question,
        answer
      });
    }

    for (const [groupName, items] of grouped.entries()) {
      const lines = [
        `# ${groupName} 问答库`,
        "",
        `来源文件：${path.basename(sourceFile)}`,
        `来源工作表：${sheetName}`,
        ""
      ];

      items.forEach((item, index) => {
        lines.push(`## 问答 ${index + 1}`);
        lines.push("");
        lines.push(`问题：${item.question}`);
        lines.push("");
        lines.push(`答案：${item.answer}`);
        lines.push("");
      });

      docs.push({
        type: "FAQ",
        sourceSheet: sheetName,
        title: `${groupName} 问答库`,
        groupName,
        targetDataset: normalizeDatasetName(groupName === "全局FAQ" ? "" : groupName),
        fileName: `${sanitizeFileName(groupName)}_faq.md`,
        content: lines.join("\n"),
        itemCount: items.length
      });
    }
  }

  return docs;
}

function extractCompatibilityProductName(title) {
  return ensureText(title)
    .replace(/-?已支持的设备及版本条件/g, "")
    .replace(/-?设备支持清单/g, "")
    .replace(/-?支持终端清单/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCompatibilityDocs(workbook, sourceFile) {
  const docs = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
    if (rows.length === 0) {
      continue;
    }

    let currentProduct = "";
    let currentItems = [];
    let lastVendor = "";

    const flushCurrent = () => {
      if (!currentProduct || currentItems.length === 0) {
        return;
      }

      const lines = [
        `# ${currentProduct} 支持设备清单`,
        "",
        `来源文件：${path.basename(sourceFile)}`,
        `来源工作表：${sheetName}`,
        ""
      ];

      currentItems.forEach((item, index) => {
        const parts = [
          `厂商：${item.vendor}`,
          `设备型号：${item.model}`
        ];
        if (item.type) {
          parts.push(`类型：${item.type}`);
        }
        if (item.extra) {
          parts.push(`补充说明：${item.extra}`);
        }
        lines.push(`${index + 1}. ${parts.join("；")}`);
      });
      lines.push("");

      docs.push({
        type: "COMPATIBILITY",
        sourceSheet: sheetName,
        title: `${currentProduct} 支持设备清单`,
        groupName: currentProduct,
        targetDataset: normalizeDatasetName(currentProduct),
        fileName: `${sanitizeFileName(currentProduct)}_compatibility.md`,
        content: lines.join("\n"),
        itemCount: currentItems.length
      });
    };

    for (const row of rows) {
      const cells = row.map((cell) => ensureText(cell));
      if (cells.every((cell) => !cell)) {
        continue;
      }

      const first = cells[0];
      const second = cells[1];

      if (/(已支持的设备及版本条件|设备支持清单|支持终端清单)/.test(first)) {
        flushCurrent();
        currentProduct = extractCompatibilityProductName(first);
        currentItems = [];
        lastVendor = "";
        continue;
      }

      if (first === "厂商" && second === "设备型号") {
        continue;
      }

      if (!currentProduct || !second) {
        continue;
      }

      const vendor = first || lastVendor;
      if (!vendor) {
        continue;
      }
      lastVendor = vendor;

      currentItems.push({
        vendor,
        model: second,
        type: cells[2] || "",
        extra: cells.slice(3).filter(Boolean).join("；")
      });
    }

    flushCurrent();
  }

  return docs;
}

async function writeDocs(outputDir, docs) {
  const markdownDir = path.join(outputDir, "markdown");
  await fs.mkdir(markdownDir, { recursive: true });

  const manifest = [];

  for (const doc of docs) {
    const targetPath = path.join(markdownDir, doc.fileName);
    await fs.writeFile(targetPath, doc.content, "utf8");
    manifest.push({
      type: doc.type,
      title: doc.title,
      groupName: doc.groupName,
      targetDataset: doc.targetDataset,
      outputFile: targetPath,
      itemCount: doc.itemCount,
      sourceSheet: doc.sourceSheet
    });
  }

  await fs.writeFile(path.join(outputDir, "derived-documents.json"), JSON.stringify(manifest, null, 2), "utf8");
  await fs.writeFile(path.join(outputDir, "summary.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalDerivedDocuments: manifest.length,
    byType: manifest.reduce((accumulator, item) => {
      accumulator[item.type] = (accumulator[item.type] || 0) + 1;
      return accumulator;
    }, {})
  }, null, 2), "utf8");

  return manifest;
}

async function main() {
  const { filePath, outputDir } = parseArgs(process.argv.slice(2));

  if (!filePath) {
    console.error("Usage: node src/scripts/extract-xlsx-knowledge.js --file=<xlsx-path> [--output=<dir>]");
    process.exitCode = 1;
    return;
  }

  const workbook = XLSX.readFile(filePath);
  const docs = [
    ...extractQaDocs(workbook, filePath),
    ...extractCompatibilityDocs(workbook, filePath)
  ];

  await fs.mkdir(outputDir, { recursive: true });
  const manifest = await writeDocs(outputDir, docs);

  console.log(`[XLSX] Source: ${filePath}`);
  console.log(`[XLSX] Output: ${outputDir}`);
  console.log(`[XLSX] Derived docs: ${manifest.length}`);
}

main().catch((error) => {
  console.error("[XLSX] Failed:", error);
  process.exitCode = 1;
});
