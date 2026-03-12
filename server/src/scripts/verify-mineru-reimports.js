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

const PAGE_SIZE = 100;

function parseArgs(argv) {
  const options = {
    resultPaths: [],
    outputDir: path.resolve(serverRoot, "../tmp/mineru-verify"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current.startsWith("--result=")) {
      options.resultPaths.push(path.resolve(current.slice("--result=".length)));
      continue;
    }
    if (current === "--result") {
      options.resultPaths.push(path.resolve(argv[index + 1] || ""));
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

async function fetchCollectionDetail({ baseUrl, apiKey, collectionId }) {
  try {
    const response = await axios.get(
      `${baseUrl}/core/dataset/collection/detail`,
      {
        params: { id: collectionId },
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 30000,
      },
    );
    return {
      exists: true,
      data: response.data?.data || null,
      statusText: response.data?.statusText || "",
    };
  } catch (error) {
    return {
      exists: false,
      status: error.response?.status || 0,
      statusText:
        error.response?.data?.statusText ||
        error.response?.data?.message ||
        error.message,
    };
  }
}

async function fetchChunks({ baseUrl, apiKey, collectionId }) {
  const response = await axios.post(
    `${baseUrl}/core/dataset/data/v2/list`,
    {
      collectionId,
      offset: 0,
      pageSize: 1000,
      searchText: "",
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      timeout: 60000,
    },
  );

  return response.data?.data?.list || [];
}

async function fetchAllCollections({ baseUrl, apiKey, datasetId }) {
  const items = [];
  let pageNum = 1;

  while (true) {
    const response = await axios.post(
      `${baseUrl}/core/dataset/collection/list`,
      {
        datasetId,
        pageNum,
        pageSize: PAGE_SIZE,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      },
    );

    const page = response.data?.data?.data || [];
    items.push(...page);
    if (page.length < PAGE_SIZE) {
      break;
    }
    pageNum += 1;
  }

  return items;
}

function findImageUrl(chunks = []) {
  const patterns = [
    /https?:\/\/kb-server\.local:3001\/images\/[^\s)]+/i,
    /\/images\/[^\s)]+/i,
  ];

  for (const chunk of chunks) {
    const text = String(chunk?.q || "");
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].startsWith("http")
          ? match[0]
          : `http://kb-server.local:3001${match[0]}`;
      }
    }
  }

  return "";
}

async function fetchUrlStatus(url) {
  if (!url) {
    return 0;
  }
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      responseType: "arraybuffer",
      validateStatus: () => true,
    });
    return response.status;
  } catch {
    return 0;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.resultPaths.length === 0) {
    throw new Error(
      "Usage: node src/scripts/verify-mineru-reimports.js --result=<result.json> [--result=<result.json>] [--output=<dir>]",
    );
  }

  const baseUrl = requireEnv("FASTGPT_BASE_URL");
  const apiKey = requireEnv("FASTGPT_API_KEY");
  const verificationRows = [];

  for (const resultPath of options.resultPaths) {
    const raw = await fs.readFile(resultPath, "utf8");
    const payload = JSON.parse(raw);
    const sourceLabel = path.basename(resultPath);

    for (const row of payload.results || []) {
      if (!["imported", "reimported"].includes(row.status)) {
        verificationRows.push({
          source: sourceLabel,
          fileName: row.fileName,
          status: row.status,
          datasetId: row.datasetId,
          collectionId: row.collectionId,
          replacedCollectionId: row.replacedCollectionId || "",
          rawTextLength: 0,
          indexAmount: 0,
          chunkCount: 0,
          hasImageUrl: false,
          imageUrlStatus: 0,
          oldDeleted: row.replacedCollectionId ? false : null,
          ok: false,
          note: "Skipped: non-imported status",
        });
        continue;
      }

      const detail = await fetchCollectionDetail({
        baseUrl,
        apiKey,
        collectionId: row.collectionId,
      });
      const chunks = detail.exists
        ? await fetchChunks({
            baseUrl,
            apiKey,
            collectionId: row.collectionId,
          })
        : [];
      const imageUrl = findImageUrl(chunks);
      const imageUrlStatus = imageUrl ? await fetchUrlStatus(imageUrl) : 0;
      const oldDetail = row.replacedCollectionId
        ? await fetchCollectionDetail({
            baseUrl,
            apiKey,
            collectionId: row.replacedCollectionId,
          })
        : null;

      const rawTextLength = detail.data?.rawTextLength || 0;
      const indexAmount = detail.data?.indexAmount || 0;
      const oldDeleted = oldDetail
        ? oldDetail.exists === false &&
          String(oldDetail.statusText || "").includes("unExistCollection")
        : null;
      const hasImageUrl = Boolean(imageUrl);
      const ok =
        detail.exists &&
        rawTextLength > 0 &&
        indexAmount > 0 &&
        (!row.replacedCollectionId || oldDeleted === true) &&
        (row.imageCount <= 0 || (hasImageUrl && imageUrlStatus === 200));

      verificationRows.push({
        source: sourceLabel,
        fileName: row.fileName,
        status: row.status,
        datasetId: row.datasetId,
        collectionId: row.collectionId,
        replacedCollectionId: row.replacedCollectionId || "",
        rawTextLength,
        indexAmount,
        chunkCount: chunks.length,
        hasImageUrl,
        sampleImageUrl: imageUrl,
        imageUrlStatus,
        oldDeleted,
        ok,
        note: ok ? "" : "See detailed fields",
      });
    }
  }

  const datasetCounts = {};
  for (const datasetId of [...new Set(verificationRows.map((row) => row.datasetId).filter(Boolean))]) {
    const collections = await fetchAllCollections({ baseUrl, apiKey, datasetId });
    datasetCounts[datasetId] = collections.filter((item) => item?.type === "file").length;
  }

  const summary = {
    total: verificationRows.length,
    passed: verificationRows.filter((row) => row.ok).length,
    failed: verificationRows.filter((row) => !row.ok).length,
    withImageUrls: verificationRows.filter((row) => row.hasImageUrl).length,
    oldDeletedVerified: verificationRows.filter((row) => row.oldDeleted === true).length,
  };

  await fs.mkdir(options.outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(
    options.outputDir,
    `mineru-reimport-verify-${timestamp}.json`,
  );
  const body = {
    generatedAt: new Date().toISOString(),
    summary,
    datasetCounts,
    rows: verificationRows,
  };
  await fs.writeFile(outputPath, JSON.stringify(body, null, 2), "utf8");

  console.log(`Output: ${outputPath}`);
  console.log(`Summary: ${JSON.stringify(summary)}`);
  console.log(`DatasetCounts: ${JSON.stringify(datasetCounts)}`);
}

main().catch((error) => {
  console.error(`[VerifyMinerU] ${error.stack || error.message}`);
  process.exitCode = 1;
});
