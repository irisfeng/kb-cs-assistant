#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function parseArgs(argv) {
  const args = {
    datasetId: "",
    name: "",
    file: "",
    chunkSize: 8000,
    trainingType: "chunk"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current.startsWith("--dataset-id=")) {
      args.datasetId = current.slice("--dataset-id=".length);
      continue;
    }
    if (current === "--dataset-id") {
      args.datasetId = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (current.startsWith("--name=")) {
      args.name = current.slice("--name=".length);
      continue;
    }
    if (current === "--name") {
      args.name = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (current.startsWith("--file=")) {
      args.file = path.resolve(current.slice("--file=".length));
      continue;
    }
    if (current === "--file") {
      args.file = path.resolve(argv[i + 1] || "");
      i += 1;
      continue;
    }
    if (current.startsWith("--chunk-size=")) {
      args.chunkSize = Number.parseInt(current.slice("--chunk-size=".length), 10);
      continue;
    }
  }

  return args;
}

function requireValue(value, label) {
  if (!value) {
    throw new Error(`${label} is required`);
  }
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = requireValue(process.env.FASTGPT_BASE_URL, "FASTGPT_BASE_URL");
  const apiKey = requireValue(process.env.FASTGPT_API_KEY, "FASTGPT_API_KEY");
  const datasetId = requireValue(args.datasetId, "datasetId");
  const filePath = requireValue(args.file, "file");
  const text = await fs.readFile(filePath, "utf8");
  const normalizedName = (args.name || path.basename(filePath))
    .replace(/\.(md|txt|markdown)$/i, "")
    .trim();
  const name = normalizedName || path.basename(filePath).replace(/\.(md|txt|markdown)$/i, "");

  const response = await axios.post(
    `${baseUrl}/core/dataset/collection/create/text`,
    {
      datasetId,
      name,
      text,
      trainingType: args.trainingType,
      chunkSize: args.chunkSize,
      chunkSplitter: "",
      qaPrompt: ""
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  const responseData = response.data?.data;
  const collectionId =
    typeof responseData === "string" ? responseData : responseData?.collectionId;

  if (!collectionId) {
    throw new Error("FastGPT response missing collectionId");
  }

  console.log(
    JSON.stringify(
      {
        datasetId,
        name,
        collectionId,
        file: filePath
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
