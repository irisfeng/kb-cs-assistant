#!/usr/bin/env node

import axios from "axios";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "../..");
const dbPath = path.resolve(__dirname, "../db.json");

dotenv.config({ path: path.join(serverRoot, ".env") });

const PAGE_SIZE = 100;

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function stripTrailingTxt(fileName) {
  return String(fileName || "").replace(/\.txt$/i, "");
}

function deriveTitle(fileName, fallbackId) {
  const normalized = stripTrailingTxt(fileName)
    .replace(/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|csv|md|txt|html)$/i, "")
    .trim();

  return normalized || stripTrailingTxt(fileName) || fallbackId;
}

function buildRecoveredSolution(collection, datasetId) {
  const fileName = stripTrailingTxt(collection?.name || "");
  const collectionId = String(collection?._id || "");

  return {
    id: `sync-${collectionId}`,
    title: deriveTitle(fileName, collectionId),
    description: fileName,
    collectionId,
    fileName: fileName || collectionId,
    fileId: collection?.fileId || undefined,
    datasetId,
    createdAt:
      collection?.createTime ||
      collection?.updateTime ||
      new Date().toISOString(),
  };
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
        pageSize: PAGE_SIZE,
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

    if (page.length < PAGE_SIZE) {
      break;
    }

    pageNum += 1;
  }

  return collections;
}

async function readKnowledgeDb() {
  try {
    const raw = await fs.readFile(dbPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      solutions: Array.isArray(parsed?.solutions) ? parsed.solutions : [],
      knowledgeSubmissions: Array.isArray(parsed?.knowledgeSubmissions)
        ? parsed.knowledgeSubmissions
        : [],
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        solutions: [],
        knowledgeSubmissions: [],
      };
    }
    throw error;
  }
}

async function main() {
  const baseUrl = requireEnv("FASTGPT_BASE_URL");
  const apiKey = requireEnv("FASTGPT_API_KEY");
  const datasetId = requireEnv("FASTGPT_DATASET_ID");

  const db = await readKnowledgeDb();
  const existingSolutions = db.solutions;
  const existingByCollectionId = new Map(
    existingSolutions
      .filter((solution) => solution?.collectionId)
      .map((solution) => [String(solution.collectionId), solution]),
  );

  const collections = await fetchAllCollections({
    baseUrl,
    apiKey,
    datasetId,
  });

  const fileCollections = collections.filter(
    (collection) => collection?.type === "file" && collection?._id,
  );

  const mergedSolutions = fileCollections.map((collection) => {
    const recovered = buildRecoveredSolution(collection, datasetId);
    const existing = existingByCollectionId.get(recovered.collectionId);

    if (!existing) {
      return recovered;
    }

    return {
      ...recovered,
      ...existing,
      collectionId: existing.collectionId || recovered.collectionId,
      datasetId: existing.datasetId || recovered.datasetId,
      fileName: existing.fileName || recovered.fileName,
      description: existing.description || recovered.description,
      title: existing.title || recovered.title,
      fileId: existing.fileId || recovered.fileId,
      createdAt: existing.createdAt || recovered.createdAt,
    };
  });

  const retainedLocalOnlySolutions = existingSolutions.filter(
    (solution) =>
      !solution?.collectionId ||
      !fileCollections.some(
        (collection) => String(collection._id) === String(solution.collectionId),
      ),
  );

  const nextSolutions = [...mergedSolutions, ...retainedLocalOnlySolutions].sort(
    (left, right) => {
      const leftDate = String(left?.createdAt || "");
      const rightDate = String(right?.createdAt || "");
      return rightDate.localeCompare(leftDate);
    },
  );

  await fs.writeFile(
    dbPath,
    JSON.stringify(
      {
        solutions: nextSolutions,
        knowledgeSubmissions: db.knowledgeSubmissions,
      },
      null,
      2,
    ),
    "utf8",
  );

  const addedCount = mergedSolutions.filter(
    (solution) => !existingByCollectionId.has(String(solution.collectionId)),
  ).length;

  console.log(`[Recover] Dataset ID: ${datasetId}`);
  console.log(`[Recover] FastGPT collections fetched: ${collections.length}`);
  console.log(`[Recover] File collections merged: ${mergedSolutions.length}`);
  console.log(`[Recover] Existing local solutions retained: ${retainedLocalOnlySolutions.length}`);
  console.log(`[Recover] Added missing solutions: ${addedCount}`);
  console.log(`[Recover] Output: ${dbPath}`);
}

main().catch((error) => {
  console.error("[Recover] Failed:", error.message);
  process.exitCode = 1;
});
