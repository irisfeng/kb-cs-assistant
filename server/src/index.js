import express from "express";
import cors from "cors";
import multer from "multer";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { JSONFilePreset } from "lowdb/node";
import "dotenv/config";

import mammoth from "mammoth";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");
const xlsx = require("xlsx");
const {
  parseMarkdownToSlides,
  generatePPT,
  generatePPTFromImages,
  generatePPTFromTemplate,
  generateStyledPPT,
  generateHybridPPT,
  generateBackgroundPrompt,
  shouldGenerateImageSmart,
  IMAGE_CONFIG_PRESETS,
  SLIDE_STYLES,
} = require("./ppt-generator.js");
import {
  getIndustryConfig,
  getIndustryKeywords,
  getIndustryStyle,
  getIndustryVisualElements,
  getIndustryPainPoints,
  getIndustryMetrics,
} from "./industry-config.js";

// Note: generatePPTFromImages is not fully implemented, generatePPT is used as fallback

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ dest: "uploads/" });

/**
 * Upload image to FastGPT file system and get fileId
 * Returns the fileId that can be used in markdown as dataset/{fileId}
 */
async function uploadImageToFastGPT(imageBuffer, fileName) {
  try {
    console.log(
      `[FastGPT] Uploading image: ${fileName} (${imageBuffer.length} bytes)`,
    );

    // 使用 form-data 库创建 multipart/form-data 请求
    const FormData = require("form-data");
    const formData = new FormData();
    formData.append("file", imageBuffer, fileName);

    const url = `${process.env.FASTGPT_BASE_URL}/core/dataset/collection/create/localFile`;
    console.log(`[FastGPT] POST ${url}`);

    const response = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.FASTGPT_API_KEY}`,
      },
    });

    console.log(`[FastGPT] Response status: ${response.status}`);
    console.log(
      `[FastGPT] Response data:`,
      JSON.stringify(response.data, null, 2),
    );

    // FastGPT returns { code: 200, data: { fileId: 'xxx' } }
    const fileId = response.data?.data?.fileId;
    if (fileId) {
      console.log(`[FastGPT] Image uploaded: ${fileName} -> fileId: ${fileId}`);
      return fileId;
    }
    console.warn(
      "[FastGPT] Image upload response missing fileId:",
      response.data,
    );
    return null;
  } catch (error) {
    console.warn("[FastGPT] Image upload failed:", error.message);
    if (error.response) {
      console.warn("[FastGPT] Error status:", error.response.status);
      console.warn("[FastGPT] Error response:", error.response.data);
    } else {
      console.warn("[FastGPT] Error details:", error);
    }
    return null;
  }
}

/**
 * 批量处理图片为 Base64 格式并替换 Markdown 中的图片路径
 * @param {string} markdown - 原始 Markdown 内容
 * @param {string} imagesDir - 图片所在目录
 * @returns {Promise<string>} - 替换后的 Markdown
 */
async function processImagesToBase64(markdown, imagesDir) {
  // 匹配所有图片引用
  const imageRegex =
    /!\[([^\]]*)\]\((images\/[^)]+|[^)]+\.(png|jpg|jpeg|gif|webp))\)/gi;
  const matches = [...markdown.matchAll(imageRegex)];

  if (matches.length === 0) {
    return markdown;
  }

  console.log(`[FastGPT] Processing ${matches.length} images to base64...`);

  let processedMarkdown = markdown;
  const processResults = [];

  for (const match of matches) {
    const fullMatch = match[0];
    const alt = match[1];
    const imagePath = match[2];
    const imageName = path.basename(imagePath);
    const localImagePath = path.join(imagesDir, imageName);

    try {
      if (fs.existsSync(localImagePath)) {
        const imageBuffer = fs.readFileSync(localImagePath);
        const ext = path.extname(imageName).toLowerCase();
        const mimeType =
          ext === ".png"
            ? "image/png"
            : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : ext === ".gif"
                ? "image/gif"
                : ext === ".webp"
                  ? "image/webp"
                  : "image/jpeg";
        const base64Data = imageBuffer.toString("base64");
        const base64Url = `data:${mimeType};base64,${base64Data}`;

        processedMarkdown = processedMarkdown.replace(
          fullMatch,
          `![${alt}](${base64Url})`,
        );
        processResults.push({
          original: imageName,
          size: imageBuffer.length,
          success: true,
        });
        console.log(
          `[FastGPT] Embedded base64 image: ${imageName} (${Math.round(base64Data.length / 1024)}KB)`,
        );
      } else {
        console.warn(`[FastGPT] Image not found: ${localImagePath}`);
        processedMarkdown = processedMarkdown.replace(
          fullMatch,
          `![${alt}]([图片])`,
        );
        processResults.push({
          original: imageName,
          success: false,
          reason: "not_found",
        });
      }
    } catch (err) {
      console.error(
        `[FastGPT] Failed to process image ${imageName}:`,
        err.message,
      );
      processedMarkdown = processedMarkdown.replace(
        fullMatch,
        `![${alt}]([图片])`,
      );
      processResults.push({
        original: imageName,
        success: false,
        reason: err.message,
      });
    }
  }

  const successCount = processResults.filter((r) => r.success).length;
  console.log(
    `[FastGPT] Base64 image processing complete: ${successCount}/${matches.length} succeeded`,
  );

  return processedMarkdown;
}

/**
 * 修复中文文件名乱码问题
 * 当文件名被错误地用 Latin-1 解码时，需要重新用 UTF-8 解码
 */
function fixFileNameEncoding(fileName) {
  // 方法1: 检测是否包含中文 UTF-8 被错误解析为 Latin-1 的特征字符
  // UTF-8 中文字符被误解析为 Latin-1 后，会出现类似 æ¹°è¹₂ 这样的模式
  const hasGarbledChars =
    /[æçè][°²³´µ¶·¸¹º»¼½¾¿]/.test(fileName) ||
    fileName.includes("æ") ||
    fileName.includes("ç") ||
    fileName.includes("è");

  if (hasGarbledChars) {
    try {
      // 将错误解析的 Latin-1 字符串转换回 bytes，然后用 UTF-8 解码
      const buffer = Buffer.from(fileName, "latin1");
      const decoded = buffer.toString("utf8");
      console.log(`[FileName Encoding Fix] "${fileName}" -> "${decoded}"`);
      return decoded;
    } catch (e) {
      console.log(`[FileName Encoding Fix] Failed: ${e.message}`);
    }
  }

  // 方法2: 检测是否包含正常中文，如果没有中文但文件名看起来不像英文，可能是乱码
  const hasChinese = /[\u4e00-\u9fa5]/.test(fileName);
  const hasControlChars = /[\x00-\x1F\x7F-\x9F]/.test(fileName);

  if (!hasChinese && fileName.length > 3 && hasControlChars) {
    // 可能是其他编码问题，尝试修复
    try {
      const buffer = Buffer.from(fileName, "latin1");
      const decoded = buffer.toString("utf8");
      if (/[\u4e00-\u9fa5]/.test(decoded)) {
        console.log(`[FileName Encoding Fix 2] "${fileName}" -> "${decoded}"`);
        return decoded;
      }
    } catch (e) {
      // ignore
    }
  }

  return fileName;
}

const app = express();
app.use(cors());
app.use(express.json());

const GLOBAL_CUSTOMER_SERVICE_PROMPT = `你是“客服智能知识助手”，服务对象是一线客服、售后支持和客服主管。

回答规则：
1. 优先基于知识库引用内容回答，不要编造政策、时效、补偿或流程。
2. 如果知识库证据不足，明确说明“当前知识库未提供足够依据”，并建议人工核实。
3. 回答尽量面向客服执行，优先给出：
   - 建议回复口径
   - 处理步骤
   - 需要核验的信息
   - 是否需要升级或转人工
4. 涉及退款、补偿、投诉、账号安全、隐私合规等高风险事项时，要提醒按公司规则复核。
5. 输出保持简洁、专业、可直接给客服使用，避免泛泛而谈。
6. 如果用户的问题明显不属于客服知识场景，也可以正常回答，但要优先保持知识助手语气。`;

// Static files serving (for images and original files)
app.use("/images", express.static(path.join(__dirname, "../public/images")));
app.use("/files", express.static(path.join(__dirname, "../public/files")));

// Database setup
const defaultData = { solutions: [] };
const db = await JSONFilePreset(path.join(__dirname, "db.json"), defaultData);

// Capabilities database setup
const defaultCapabilities = { capabilities: [] };
const capabilitiesDb = await JSONFilePreset(
  path.join(__dirname, "../data/capabilities.json"),
  defaultCapabilities,
);

// Draft solutions database setup
const defaultDrafts = { drafts: [] };
const draftsDb = await JSONFilePreset(
  path.join(__dirname, "../data/drafts.json"),
  defaultDrafts,
);

// ==================== Markdown Cleaning Utility ====================

/**
 * 清理 MinerU 解析的 Markdown
 * 移除解析痕迹，优化阅读体验
 */
function cleanMarkdown(markdown) {
  if (!markdown) return "";

  let cleaned = markdown;

  // 1. 清理 HTML 表格 - 简单转换为文本（复杂表格保持 HTML，前端需要支持）
  // 移除 table 标签，保留单元格内容
  cleaned = cleaned.replace(
    /<table[^>]*>([\s\S]*?)<\/table>/gi,
    (match, content) => {
      // 提取所有单元格内容
      const cells = content.match(/<td[^>]*>(.*?)<\/td>/gi) || [];
      const cellTexts = cells.map((cell) =>
        cell
          .replace(/<td[^>]*>/gi, "")
          .replace(/<\/td>/gi, "")
          .trim(),
      );
      // 用空格连接，简单处理
      return cellTexts.join(" | ");
    },
  );

  // 2. 清理 LaTeX 数学公式（简化显示）
  cleaned = cleaned.replace(/\$[^$]+\$/g, (match) => {
    // 提取公式中的文本内容，移除 LaTeX 命令
    return match
      .replace(/\\[a-zA-Z]+/g, "") // 移除 LaTeX 命令
      .replace(/[{}^_]/g, "") // 移除特殊字符
      .replace(/\s+/g, " ") // 合并空格
      .trim();
  });

  // 3. 清理 HTML 实体和特殊符号
  cleaned = cleaned
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/》/g, "")
    .replace(/《/g, "");

  // 4. 移除多余的 --- 分隔符
  cleaned = cleaned
    .replace(/\n-{3,}\n\n-{3,}\n/g, "\n\n")
    .replace(/\n-{3,}\n/g, "\n\n")
    .replace(/^---\n\n/gm, "");

  // 5. 限制空行数量（最多保留 2 个连续空行）
  cleaned = cleaned.replace(/\n{4,}/g, "\n\n\n");

  // 6. 移除 MinerU 特定标记
  cleaned = cleaned
    .replace(/\\*Page \d+\\*\n?/gi, "")
    .replace(/\\*第\s*\d+\s*页\\*\n?/gi, "");

  // 7. 清理图片引用前后的多余空行
  cleaned = cleaned
    .replace(/\n+(!\[)/g, "\n\n$1")
    .replace(/(\)\])\n+/g, "$1\n\n");

  // 8. 移除标题前后的多余空行
  cleaned = cleaned.replace(/\n+^(#{1,6}\s)/gm, "\n\n$1");

  // 9. 移除首尾空白
  cleaned = cleaned.trim();

  return cleaned;
}

// ==================== Similarity Calculation Utility ====================

/**
 * 计算 Jaccard 相似度
 * 用于比较两个功能列表的相似程度
 *
 * @param {string[]} features1 - 第一个功能列表
 * @param {string[]} features2 - 第二个功能列表
 * @returns {number} 相似度 (0-1)，1 表示完全相同，0 表示完全不同
 */
function calculateJaccardSimilarity(features1, features2) {
  if (
    !features1 ||
    !features2 ||
    features1.length === 0 ||
    features2.length === 0
  ) {
    return 0;
  }

  // 转换为小写集合，避免大小写影响
  const set1 = new Set(features1.map((f) => f.toLowerCase().trim()));
  const set2 = new Set(features2.map((f) => f.toLowerCase().trim()));

  // 计算交集
  const intersection = [...set1].filter((x) => set2.has(x));

  // 计算并集
  const union = new Set([...set1, ...set2]);

  // Jaccard 相似度 = 交集大小 / 并集大小
  return intersection.length / union.size;
}

/**
 * 检查待审核能力与现有能力的相似度
 *
 * @param {Object} pendingCapability - 待审核的能力对象
 * @param {Object[]} existingCapabilities - 现有能力列表
 * @param {number} threshold - 相似度阈值（默认 0.7）
 * @returns {Object} { isDuplicate: boolean, similarCapabilities: Array, maxSimilarity: number }
 */
function checkCapabilitySimilarity(
  pendingCapability,
  existingCapabilities,
  threshold = 0.7,
) {
  const similarCapabilities = [];
  let maxSimilarity = 0;

  for (const existing of existingCapabilities) {
    const similarity = calculateJaccardSimilarity(
      pendingCapability.features || [],
      existing.features || [],
    );

    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
    }

    if (similarity >= threshold) {
      similarCapabilities.push({
        id: existing.id,
        name: existing.name,
        similarity: similarity,
      });
    }
  }

  // 按相似度降序排序
  similarCapabilities.sort((a, b) => b.similarity - a.similarity);

  return {
    isDuplicate: similarCapabilities.length > 0,
    similarCapabilities: similarCapabilities,
    maxSimilarity: maxSimilarity,
  };
}

// ==================== MinerU Online API Functions ====================

/**
 * 申请 MinerU 文件上传链接
 */
async function applyMinerUUploadUrl(fileName, dataId) {
  const response = await axios.post(
    `${process.env.MINERU_BASE_URL}/file-urls/batch`,
    {
      files: [{ name: fileName, data_id: dataId }],
      model_version: "pipeline",
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MINERU_API_TOKEN}`,
      },
    },
  );

  if (response.data.code !== 0) {
    throw new Error(`MinerU upload URL failed: ${response.data.msg}`);
  }

  return {
    batchId: response.data.data.batch_id,
    uploadUrl: response.data.data.file_urls[0],
  };
}

/**
 * 上传文件到 MinerU
 * 注意：不要设置 Content-Type 请求头（根据官方文档）
 */
async function uploadFileToMinerU(filePath, uploadUrl) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;

  // 使用原生 https 模块
  const https = await import("https");
  const url = new URL(uploadUrl);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: "PUT",
      headers: {
        // 官方文档明确说明：上传文件时，无须设置 Content-Type 请求头
        "Content-Length": fileSize,
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          reject(
            new Error(`MinerU file upload failed: ${res.statusCode} - ${body}`),
          );
        });
      }
    });

    req.on("error", (error) => {
      reject(new Error(`MinerU file upload error: ${error.message}`));
    });

    req.write(fileBuffer);
    req.end();
  });
}

/**
 * 轮询查询 MinerU 解析结果
 */
async function pollMinerUResult(batchId, maxAttempts = 60, interval = 3000) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await axios.get(
      `${process.env.MINERU_BASE_URL}/extract-results/batch/${batchId}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MINERU_API_TOKEN}`,
        },
      },
    );

    if (response.data.code !== 0) {
      throw new Error(`MinerU result query failed: ${response.data.msg}`);
    }

    const result = response.data.data.extract_result[0];
    console.log(
      `MinerU parsing progress: ${result.state}${result.extract_progress ? ` (${result.extract_progress.extracted_pages || 0}/${result.extract_progress.total_pages || 0} pages)` : ""}`,
    );

    if (result.state === "done") {
      // 下载解析结果 ZIP
      const zipUrl = result.full_zip_url;
      const zipResponse = await axios.get(zipUrl, {
        responseType: "arraybuffer",
      });

      // 保存到临时文件
      const tempZipPath = path.join(
        __dirname,
        `../uploads/temp_${batchId}.zip`,
      );
      fs.writeFileSync(tempZipPath, zipResponse.data);

      // 解压 ZIP 并读取 Markdown 内容
      const zip = new AdmZip(tempZipPath);
      const zipEntries = zip.getEntries();

      // 创建图片存储目录（使用 batchId 作为唯一标识）
      const imagesDir = path.join(__dirname, `../public/images/${batchId}`);
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      // 提取并保存图片
      const savedImages = [];
      for (const entry of zipEntries) {
        // 保存图片文件
        if (
          entry.entryName.startsWith("images/") ||
          /\.(png|jpg|jpeg|gif|webp)$/i.test(entry.entryName)
        ) {
          const imageName = path.basename(entry.entryName);
          const imagePath = path.join(imagesDir, imageName);
          zip.extractEntryTo(entry, path.dirname(imagePath), false);
          savedImages.push({ originalPath: entry.entryName, imageName });
          console.log(`[MinerU] Saved image: ${imageName}`);
        }
      }

      // 查找 markdown 文件（通常叫 auto.md 或同名 .md）
      let markdownContent = "";
      for (const entry of zipEntries) {
        if (entry.entryName.endsWith(".md")) {
          // 使用 readAsBuffer 并指定 UTF-8 编码，避免中文乱码
          const buffer = entry.getData();
          markdownContent = buffer.toString("utf-8");

          // 调试：检查原始内容的前 200 个字符
          console.log("[MinerU] Raw markdown preview (first 200 chars):");
          console.log(markdownContent.substring(0, 200));
          console.log("[MinerU] Buffer length:", buffer.length);
          console.log("[MinerU] String length:", markdownContent.length);
          break;
        }
      }

      // 删除临时 ZIP 文件
      fs.unlinkSync(tempZipPath);

      if (!markdownContent) {
        throw new Error("No markdown file found in ZIP");
      }

      // ✅ 清理 markdown - 移除解析痕迹，优化阅读体验
      const cleanedMarkdown = cleanMarkdown(markdownContent);
      console.log(
        `[MinerU] Cleaned markdown: ${markdownContent.length} → ${cleanedMarkdown.length} chars`,
      );

      // 创建带本地路径的 Markdown（用于前端显示）- 使用清理后的内容
      const localMarkdown = cleanedMarkdown.replace(
        /!\[([^\]]*)\]\((images\/[^)]+|[^)]+\.(png|jpg|jpeg|gif|webp))\)/gi,
        (match, alt, imagePath) => {
          const imageName = path.basename(imagePath);
          // 使用 /images/{batchId}/{imageName} 格式
          return `![${alt}](/images/${batchId}/${imageName})`;
        },
      );

      // 创建发送给 FastGPT 的 Markdown
      // 方案1: 使用 HTTP URL 引用图片（兼容性好，文字不乱码）
      // 方案2: 使用 Base64 嵌入图片（FastGPT 可显示图片，但可能导致文字乱码）
      const useBase64Images = false; // 设置为 true 启用 base64 嵌入

      let fastGptMarkdown;
      if (useBase64Images) {
        // 方案2: Base64 嵌入
        fastGptMarkdown = cleanedMarkdown;
        const imageMatches =
          cleanedMarkdown.match(
            /!\[([^\]]*)\]\((images\/[^)]+|[^)]+\.(png|jpg|jpeg|gif|webp))\)/gi,
          ) || [];

        for (const match of imageMatches) {
          const altMatch = match.match(/!\[([^\]]*)\]\(([^)]+)\)/i);
          if (altMatch) {
            const alt = altMatch[1];
            const imagePath = altMatch[2];
            const imageName = path.basename(imagePath);
            const localImagePath = path.join(imagesDir, imageName);

            try {
              if (fs.existsSync(localImagePath)) {
                const imageBuffer = fs.readFileSync(localImagePath);
                const ext = path.extname(imageName).toLowerCase();
                const mimeType =
                  ext === ".png"
                    ? "image/png"
                    : ext === ".jpg" || ext === ".jpeg"
                      ? "image/jpeg"
                      : ext === ".gif"
                        ? "image/gif"
                        : ext === ".webp"
                          ? "image/webp"
                          : "image/jpeg";
                const base64Data = imageBuffer.toString("base64");
                const base64Url = `data:${mimeType};base64,${base64Data}`;
                fastGptMarkdown = fastGptMarkdown.replace(
                  match,
                  `![${alt}](${base64Url})`,
                );
                console.log(
                  `[MinerU] Embedded base64 image: ${imageName} (${Math.round(base64Data.length / 1024)}KB)`,
                );
              } else {
                console.warn(
                  `[MinerU] Image not found for base64: ${localImagePath}`,
                );
              }
            } catch (err) {
              console.error(
                `[MinerU] Failed to embed image ${imageName}:`,
                err.message,
              );
            }
          }
        }

        const imageCount = imageMatches.length;
        console.log(
          `[MinerU] FastGPT markdown: ${imageCount} images embedded as base64`,
        );
      } else {
        // 方案1: 使用 HTTP URL
        const baseUrl = process.env.BASE_URL || "http://localhost:3001";
        fastGptMarkdown = cleanedMarkdown.replace(
          /!\[([^\]]*)\]\((images\/[^)]+|[^)]+\.(png|jpg|jpeg|gif|webp))\)/gi,
          (match, alt, imagePath) => {
            const imageName = path.basename(imagePath);
            const imageUrl = baseUrl + "/images/" + batchId + "/" + imageName;
            return `![${alt}](${imageUrl})`;
          },
        );
        const imageCount = (
          cleanedMarkdown.match(
            /!\[.*?\]\(.*?\.(?:png|jpg|jpeg|gif|webp).*?\)/gi,
          ) || []
        ).length;
        console.log(
          `[MinerU] FastGPT markdown: ${imageCount} images with HTTP URLs`,
        );
      }
      const base64Markdown = fastGptMarkdown;

      console.log(
        `MinerU parsing completed! Markdown length: ${localMarkdown.length}, Images saved: ${savedImages.length}`,
      );
      return {
        markdown: localMarkdown, // 前端显示（本地路径）
        base64Markdown: fastGptMarkdown, // FastGPT（HTTP URL）- 保留兼容
        localMarkdown: localMarkdown,
        fastGptMarkdown: fastGptMarkdown,
        cleanedMarkdown: cleanedMarkdown, // 清理后的原始 Markdown（用于 FastGPT 图片上传处理）
        batchId: batchId,
        imageCount: savedImages.length,
        markdownUrl: zipUrl,
        imagesDir: imagesDir, // 图片目录路径（用于上传图片到 FastGPT）
      };
    } else if (result.state === "failed") {
      throw new Error(`MinerU parsing failed: ${result.err_msg}`);
    }

    // 等待后重试
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error("MinerU parsing timeout");
}

/**
 * 使用 MinerU 在线 API 解析文件
 * 支持: PDF, DOC, DOCX, PPT, PPTX, PNG, JPG, JPEG, HTML
 */
async function parseWithMinerU(filePath, fileName) {
  const dataId = `file_${Date.now()}`;

  // 1. 申请上传链接
  console.log("Applying MinerU upload URL...");
  const { batchId, uploadUrl } = await applyMinerUUploadUrl(fileName, dataId);

  // 2. 上传文件
  console.log("Uploading file to MinerU...");
  await uploadFileToMinerU(filePath, uploadUrl);

  // 3. 轮询查询结果
  console.log("Polling MinerU result...");
  const result = await pollMinerUResult(batchId);

  // 4. 返回完整结果（使用 HTTP URL 版本，因为 hosts 已修复）
  console.log("[FastGPT] Using HTTP URL version for FastGPT (hosts fixed)");

  // 5. 返回完整结果
  return {
    text: result.fastGptMarkdown || result.markdown, // 发送给 FastGPT 的内容（使用 HTTP URL 版本）
    localMarkdown: result.markdown, // 本地路径版本的 markdown（用于预览）
    base64Markdown: result.base64Markdown, // base64 版本的 markdown（兼容）
    fastGPTMarkdown: result.fastGptMarkdown, // FastGPT 专用版本（HTTP URL）
    batchId: result.batchId,
    imageCount: result.imageCount,
    source: "mineru-api",
  };
}

// ==================== Routes ====================

// Get all solutions
app.get("/api/solutions", async (req, res) => {
  await db.read();
  res.json(db.data.solutions);
});

// Get solution detail with FastGPT data
app.get("/api/solutions/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.read();
    const solution = db.data.solutions.find((s) => s.id === id);

    if (!solution) {
      return res.status(404).json({ error: "Solution not found" });
    }

    // Get collection detail from FastGPT
    let fastgptDetail = null;
    if (solution.collectionId) {
      try {
        const detailRes = await axios.get(
          `${process.env.FASTGPT_BASE_URL}/core/dataset/collection/detail?id=${solution.collectionId}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.FASTGPT_API_KEY}`,
            },
          },
        );
        fastgptDetail = detailRes.data.data;
      } catch (fastgptError) {
        // More detailed error logging
        if (fastgptError.response) {
          console.warn(
            `[FastGPT] Collection detail failed (${fastgptError.response.status}):`,
            fastgptError.response.data?.message || fastgptError.message,
          );
        } else {
          console.warn(
            "[FastGPT] Collection detail failed:",
            fastgptError.message,
          );
        }
        // Don't fail the entire request - just return solution without fastgptDetail
      }
    }

    res.json({
      ...solution,
      fastgptDetail,
    });
  } catch (error) {
    console.error("Get solution detail error:", error.message);
    res.status(500).json({ error: "Failed to fetch solution detail" });
  }
});

// Get solution preview (raw text from FastGPT)
app.get("/api/solutions/:id/preview", async (req, res) => {
  const { id } = req.params;

  try {
    await db.read();
    const solution = db.data.solutions.find((s) => s.id === id);

    if (!solution) {
      return res.status(404).json({ error: "Solution not found" });
    }

    // 优先使用本地保存的 markdown（包含图片）
    if (solution.localMarkdown) {
      console.log("[Preview] Using local markdown with images");
      return res.json({
        text: solution.localMarkdown,
        chunks: [],
        chunkCount: 0,
        source: "local",
        hasImages: true,
        imageCount: solution.imageCount || 0,
      });
    }

    if (!solution.collectionId) {
      return res.json({ text: "", chunks: [] });
    }

    // Get data chunks from FastGPT
    console.log(
      "[Preview] Fetching chunks for collectionId:",
      solution.collectionId,
    );
    const dataList = await axios.post(
      `${process.env.FASTGPT_BASE_URL}/core/dataset/data/v2/list`,
      {
        collectionId: solution.collectionId,
        offset: 0,
        pageSize: 1000,
        searchText: "",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FASTGPT_API_KEY}`,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );

    console.log("[Preview] FastGPT response status:", dataList.status);
    const chunks = dataList.data.data?.list || [];
    console.log("[Preview] Chunks count:", chunks.length);
    // 打印第一个知识块的内容（用于调试）
    if (chunks.length > 0) {
      console.log(
        "[Preview] First chunk preview:",
        chunks[0].q?.substring(0, 200),
      );
      console.log(
        "[Preview] First chunk has image?",
        chunks[0].q?.includes("data:image") ||
          chunks[0].q?.includes("/images/"),
      );
    }
    const fullText = chunks.map((chunk) => chunk.q).join("\n\n---\n\n");

    res.json({
      text: fullText,
      chunks: chunks,
      chunkCount: chunks.length,
    });
  } catch (error) {
    console.error("Preview error:", error.message);
    res.status(500).json({ error: "Failed to fetch preview" });
  }
});

// Solution-specific chat - Streaming support
app.post("/api/solutions/:id/chat", async (req, res) => {
  const { id } = req.params;
  const { messages } = req.body;

  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    await db.read();
    const solution = db.data.solutions.find((s) => s.id === id);

    if (!solution) {
      res.write(`data: ${JSON.stringify({ error: "Solution not found" })}\n\n`);
      return res.end();
    }

    // Use system prompt to limit scope to current solution
    // FastGPT 社区版不支持按 collectionId/tags 限定搜索范围，只能通过 Prompt 引导 AI
    const systemPrompt = `你是《${solution.title}》的专业助手。

【当前方案 - 严格限定】
- 方案标题：${solution.title}
- 方案描述：${solution.description || "无"}
- 文件名：${solution.fileName}
- Collection ID: ${solution.collectionId}

【核心约束 - 必须遵守】
你只能使用来自"文件名：${solution.fileName}"的内容回答问题。

【识别与过滤规则】
知识库会返回多个来源的引用，你必须：
1. 严格检查每个引用的来源文件名（sourceName 字段）
2. 只使用 sourceName 为 "${solution.fileName}" 的引用
3. 完全忽略所有其他来源的引用，无论它们多么相关
4. 如果没有来自 "${solution.fileName}" 的引用，明确告知："《${solution.title}》方案中没有找到相关内容"

【回答格式】
- 基于匹配的引用内容回答
- 如果知识库中有来自其他文件的引用，不要提及它们
- 如果用户问题与当前方案无关，直接说明范围限制

【禁止行为】
- ❌ 不要使用其他方案的内容
- ❌ 不要说"根据其他方案..."或"从相关资料中..."
- ❌ 不要编造或推测信息

请严格遵守这些约束。`;

    console.log(
      "[SolutionChat] Using prompt-based filtering for solution:",
      solution.title,
    );
    console.log("[SolutionChat] Collection ID:", solution.collectionId);
    console.log(
      "[SolutionChat] Sending variables:",
      JSON.stringify({ collectionId: solution.collectionId }),
    );

    // Track the last sent textOutput to avoid sending partial/incomplete content
    let lastSentTextOutputLength = 0;

    const requestBody = {
      model: "solution-kb-chat",
      stream: true,
      detail: true,
      // Pass collectionId as variable to workflow (if configured)
      variables: {
        collectionId: solution.collectionId,
      },
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    };
    console.log(
      "[SolutionChat] Request body keys:",
      Object.keys(requestBody).join(", "),
    );
    console.log(
      "[SolutionChat] Request variables:",
      JSON.stringify(requestBody.variables),
    );

    const response = await axios.post(
      `${process.env.FASTGPT_BASE_URL}/v1/chat/completions`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${process.env.FASTGPT_WORKFLOW_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "stream",
      },
    );

    // Handle streaming response
    let buffer = ""; // Buffer for incomplete JSON
    let allNodeResponses = []; // Collect all node responses for citations

    response.data.on("data", async (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);

          if (data === "[DONE]") {
            res.write("data: [DONE]\n\n");
            return;
          }

          try {
            const parsed = JSON.parse(data);
            let content = parsed.choices?.[0]?.delta?.content || "";

            // Debug: log all data
            console.log(
              "[Debug SolutionChat] Parsed data keys:",
              Object.keys(parsed),
            );

            // Extract content from workflow AI chat node (responseData)
            if (parsed.responseData && Array.isArray(parsed.responseData)) {
              console.log(
                "[Debug SolutionChat] responseData array length:",
                parsed.responseData.length,
              );
              for (const nodeData of parsed.responseData) {
                console.log(
                  "[Debug SolutionChat] Node - moduleType:",
                  nodeData.moduleType,
                  "keys:",
                  Object.keys(nodeData).join(","),
                );
                // AI chat node response - extract textOutput
                if (nodeData.moduleType === "chatNode") {
                  if (nodeData.textOutput) {
                    console.log(
                      "[Debug SolutionChat] Found AI chat textOutput, length:",
                      nodeData.textOutput.length,
                      "lastSent:",
                      lastSentTextOutputLength,
                    );
                    // Only send content if textOutput has grown (avoid sending partial content)
                    if (nodeData.textOutput.length > lastSentTextOutputLength) {
                      // Send only the new portion
                      const newContent = nodeData.textOutput.substring(
                        lastSentTextOutputLength,
                      );
                      console.log(
                        "[Debug SolutionChat] Sending new content, length:",
                        newContent.length,
                      );
                      content = newContent;
                      lastSentTextOutputLength = nodeData.textOutput.length;
                    } else {
                      content = ""; // No new content to send
                      console.log(
                        "[Debug SolutionChat] No new content, textOutput not grown yet",
                      );
                    }
                  } else {
                    console.log(
                      "[Debug SolutionChat] Chat node found but NO textOutput. Available keys:",
                      Object.keys(nodeData),
                    );
                  }
                }
                // Collect all node responses for citation extraction later
                allNodeResponses.push(nodeData);
              }
            }

            // Check for flowNodeResponse event (another FastGPT format)
            if (parsed.nodeResponse) {
              console.log(
                "[Debug SolutionChat] flowNodeResponse found, moduleType:",
                parsed.nodeResponse.moduleType,
              );
              allNodeResponses.push(parsed.nodeResponse);
            }

            // Check if the response itself is an array (workflow responses format)
            if (Array.isArray(parsed)) {
              console.log(
                "[Debug SolutionChat] Received array format data, length:",
                parsed.length,
              );
              allNodeResponses.push(...parsed);
            }

            // Process image paths in content if batchId exists
            if (solution.batchId && content) {
              // Match ![](xxx) patterns and convert to /images/{batchId}/xxx.jpg
              content = content.replace(
                /!\[\]\(([^)]+)\)/g,
                (match, imagePath) => {
                  // If already a full path, don't modify
                  if (
                    imagePath.startsWith("/images/") ||
                    imagePath.startsWith("http")
                  ) {
                    return match;
                  }
                  // Otherwise, convert to local image path
                  return `![](/images/${solution.batchId}/${imagePath}.jpg)`;
                },
              );
            }

            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            console.log(
              "[Debug SolutionChat] JSON parse error:",
              e.message,
              "data:",
              data.substring(0, 100),
            );
          }
        }
      }
    });

    response.data.on("end", () => {
      // Extract citations from collected node responses
      const citations = [];

      console.log(
        "[Debug SolutionChat] solution.collectionId:",
        solution.collectionId,
      );

      for (const nodeResponse of allNodeResponses) {
        // Handle different node response formats
        if (nodeResponse.quoteList && Array.isArray(nodeResponse.quoteList)) {
          // Knowledge base search node format
          console.log(
            "[Debug SolutionChat] Found quoteList with",
            nodeResponse.quoteList.length,
            "items",
          );
          for (const quote of nodeResponse.quoteList) {
            console.log(
              "[Debug SolutionChat] Quote collectionId:",
              quote.collectionId,
              "| Match:",
              quote.collectionId === solution.collectionId,
            );
            if (quote.collectionId === solution.collectionId) {
              citations.push({
                id: quote.id,
                q: quote.q,
                a: quote.a,
                score: quote.score,
              });
            }
          }
        }
      }

      console.log(
        "[Debug SolutionChat] Total citations found:",
        citations.length,
        "out of",
        allNodeResponses
          .filter((r) => r.quoteList)
          .reduce((sum, r) => sum + r.quoteList?.length || 0, 0),
      );

      if (citations.length > 0) {
        const citationData = {
          citations,
          isComplete: true,
        };
        console.log(
          "[Debug SolutionChat] Sending citation data, citations count:",
          citations.length,
        );
        res.write(`data: ${JSON.stringify(citationData)}\n\n`);
        // Flush to ensure data is sent immediately
        if (res.flush) res.flush();
      }

      res.write("data: [DONE]\n\n");
      if (res.flush) res.flush();
      res.end();
    });

    response.data.on("error", (err) => {
      console.error("Stream error:", err);
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    });
  } catch (error) {
    console.error("Solution chat error:", error.message);
    res.write(`data: ${JSON.stringify({ error: "Chat failed" })}\n\n`);
    res.end();
  }
});

// Delete a solution
app.delete("/api/solutions/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.read();
    const solution = db.data.solutions.find((s) => s.id === id);

    if (!solution) {
      return res.status(404).json({ error: "Solution not found" });
    }

    // Delete from FastGPT if collectionId exists
    if (solution.collectionId && solution.collectionId !== "local-parsed") {
      let deleted = false;
      const errors = [];

      // Try Method 1: /api/core/dataset/collection/deleteById
      try {
        console.log(
          `[Delete] Method 1: POST /api/core/dataset/collection/deleteById`,
        );
        const res1 = await axios.post(
          `${process.env.FASTGPT_BASE_URL}/api/core/dataset/collection/deleteById`,
          {
            collectionId: solution.collectionId,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.FASTGPT_API_KEY}`,
              "Content-Type": "application/json",
            },
          },
        );
        console.log(`[Delete] Method 1 succeeded:`, res1.status);
        deleted = true;
      } catch (err) {
        errors.push(`Method 1 (/api/...): ${err.message}`);
        if (err.response) {
          errors.push(`  Status: ${err.response.status}`);
          if (err.response.data) {
            errors.push(
              `  Data: ${JSON.stringify(err.response.data).substring(0, 300)}`,
            );
          }
        }
      }

      // Try Method 2: /v1/dataset/collection/delete
      if (!deleted) {
        try {
          console.log(`[Delete] Method 2: POST /v1/dataset/collection/delete`);
          const res2 = await axios.post(
            `${process.env.FASTGPT_BASE_URL}/v1/dataset/collection/delete`,
            {
              collectionId: solution.collectionId,
              datasetId: process.env.FASTGPT_DATASET_ID,
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.FASTGPT_API_KEY}`,
                "Content-Type": "application/json",
              },
            },
          );
          console.log(`[Delete] Method 2 succeeded:`, res2.status);
          deleted = true;
        } catch (err) {
          errors.push(`Method 2 (/v1/dataset/...): ${err.message}`);
          if (err.response) {
            errors.push(`  Status: ${err.response.status}`);
            if (err.response.data) {
              errors.push(
                `  Data: ${JSON.stringify(err.response.data).substring(0, 300)}`,
              );
            }
          }
        }
      }

      // Try Method 3: Get collection detail first, then delete
      if (!deleted) {
        try {
          console.log(
            `[Delete] Method 3: GET /api/core/dataset/collection/detail`,
          );
          const detailRes = await axios.get(
            `${process.env.FASTGPT_BASE_URL}/api/core/dataset/collection/detail`,
            {
              params: {
                collectionId: solution.collectionId,
                datasetId: process.env.FASTGPT_DATASET_ID,
              },
              headers: {
                Authorization: `Bearer ${process.env.FASTGPT_API_KEY}`,
              },
            },
          );

          console.log(
            `[Delete] Got collection detail:`,
            detailRes.data?.data?.name,
          );

          // Now try to delete it using same API
          const deleteRes = await axios.post(
            `${process.env.FASTGPT_BASE_URL}/api/core/dataset/collection/deleteById`,
            {
              collectionId: solution.collectionId,
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.FASTGPT_API_KEY}`,
                "Content-Type": "application/json",
              },
            },
          );
          console.log(`[Delete] Method 3 succeeded:`, deleteRes.status);
          deleted = true;
        } catch (err) {
          errors.push(`Method 3 (detail then delete): ${err.message}`);
          if (err.response) {
            errors.push(`  Status: ${err.response.status}`);
          }
        }
      }

      if (deleted) {
        console.log(
          `[Delete] Successfully deleted collection ${solution.collectionId} from FastGPT`,
        );
      } else {
        console.warn(
          `[Delete] All methods failed for collection ${solution.collectionId}:`,
        );
        errors.forEach((e) => console.warn(`  - ${e}`));
      }
    }

    // Delete from local DB
    await db.update(({ solutions }) => {
      const index = solutions.findIndex((s) => s.id === id);
      if (index !== -1) {
        solutions.splice(index, 1);
      }
    });

    res.json({ success: true, id });
  } catch (error) {
    console.error("Delete error:", error.message);
    res.status(500).json({ error: "Failed to delete solution" });
  }
});

// Upload and Process Solution
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const { title, description } = req.body;
  const filePath = req.file.path;

  // 修复文件名编码
  const originalName = fixFileNameEncoding(req.file.originalname);
  const fileExt = path.extname(originalName).toLowerCase();

  // 生成唯一文件 ID
  const fileId = `file_${Date.now()}`;

  try {
    let textContent = "";
    let mineruResult = null; // 在外层声明，确保作用域正确

    console.log(`Processing file: ${originalName} (${fileExt})`);

    // ✅ 保存原始文件到 static/files 目录
    const filesDir = path.join(__dirname, "../public/files");
    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir, { recursive: true });
    }
    const originalFileName = `${fileId}${fileExt}`;
    const originalFilePath = path.join(filesDir, originalFileName);
    fs.copyFileSync(filePath, originalFilePath);
    console.log(`[Upload] Original file saved to: /files/${originalFileName}`);

    // 检查 MinerU Token
    const isMinerUEnabled =
      process.env.MINERU_API_TOKEN &&
      process.env.MINERU_API_TOKEN !== "your_mineru_token_here";

    // Parse file content
    if (
      fileExt === ".pdf" ||
      fileExt === ".doc" ||
      fileExt === ".docx" ||
      fileExt === ".ppt" ||
      fileExt === ".pptx" ||
      fileExt === ".png" ||
      fileExt === ".jpg" ||
      fileExt === ".jpeg"
    ) {
      // 使用 MinerU Online API 解析文档（高质量图文分离）
      if (!isMinerUEnabled) {
        return res.status(400).json({
          error:
            "MinerU API Token not configured. Please add MINERU_API_TOKEN to .env file.",
        });
      }
      mineruResult = await parseWithMinerU(filePath, originalName);
      console.log(
        "[Debug] mineruResult keys:",
        Object.keys(mineruResult || {}),
      );
      console.log(
        "[Debug] base64Markdown length:",
        mineruResult?.base64Markdown?.length || 0,
      );
      console.log(
        "[Debug] markdown length:",
        mineruResult?.markdown?.length || 0,
      );
      // 使用 Base64 版本发送给 FastGPT（图片嵌入为 Base64）
      textContent =
        mineruResult?.text ||
        mineruResult?.base64Markdown ||
        mineruResult?.markdown ||
        "";
      console.log("[Debug] textContent length:", textContent.length);
    } else if (fileExt === ".xlsx" || fileExt === ".xls") {
      const workbook = xlsx.readFile(filePath);
      const sheetNames = workbook.SheetNames;
      const sheets = sheetNames.map((name) =>
        xlsx.utils.sheet_to_csv(workbook.Sheets[name]),
      );
      textContent = sheets.join("\n\n--- Sheet Separator ---\n\n");
    } else if (
      fileExt === ".txt" ||
      fileExt === ".md" ||
      fileExt === ".csv" ||
      fileExt === ".html"
    ) {
      textContent = fs.readFileSync(filePath, "utf-8");
    } else {
      throw new Error(`Unsupported file type: ${fileExt}`);
    }

    console.log(`Extracted text length: ${textContent.length}`);

    // Use the processed text for FastGPT (with dataset/{fileId} image paths)
    // mineruResult.text contains the new format with uploaded image fileIds
    const fastGPTTextContent = mineruResult?.text || textContent;

    console.log(
      "[Upload] Using FastGPT markdown (with dataset paths), length:",
      fastGPTTextContent.length,
    );
    console.log(
      "[Upload] Sample content preview:",
      fastGPTTextContent.substring(0, 200) + "...",
    );

    // Debug: Check for different image path formats in content
    const base64ImageMatches = fastGPTTextContent.match(
      /!\[.*?\]\(data:image\/[^)]+\)/gi,
    );
    const relativeImageMatches = fastGPTTextContent.match(
      /!\[.*?\]\(\/images\/[^)]+\)/gi,
    );
    const httpImageMatches = fastGPTTextContent.match(
      /!\[.*?\]\(https?:\/\/[^\)]+\.(png|jpg|jpeg|gif|webp)\)/gi,
    );
    const datasetImageMatches = fastGPTTextContent.match(
      /!\[.*?\]\(dataset\/[^)]+\)/gi,
    );

    console.log("[Upload Debug] Image format analysis:");
    console.log("  - Base64 images:", base64ImageMatches?.length || 0);
    console.log(
      "  - Relative path (/images/):",
      relativeImageMatches?.length || 0,
    );
    console.log("  - HTTP URL images:", httpImageMatches?.length || 0);
    console.log(
      "  - Dataset path (FastGPT):",
      datasetImageMatches?.length || 0,
    );
    console.log(
      "  - BASE_URL:",
      process.env.BASE_URL || "http://localhost:3001",
    );

    if (datasetImageMatches && datasetImageMatches.length > 0) {
      console.log("  - First dataset image:", datasetImageMatches[0]);
    }
    if (httpImageMatches && httpImageMatches.length > 0) {
      console.log("  - First HTTP image:", httpImageMatches[0]);
    }

    // Import to Dataset as Text
    // FastGPT will automatically append .txt to the document name (e.g., 123.pdf -> 123.pdf.txt)
    // Note: chunkSize increased to 4096 to accommodate base64 embedded images
    const importRes = await axios.post(
      `${process.env.FASTGPT_BASE_URL}/core/dataset/collection/create/text`,
      {
        datasetId: process.env.FASTGPT_DATASET_ID,
        name: originalName, // Use original name, FastGPT adds .txt automatically
        text: fastGPTTextContent,
        trainingType: "chunk",
        chunkSize: 8000,
        chunkSplitter: "",
        qaPrompt: "",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FASTGPT_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    // FastGPT returns { collectionId: 'xxx', results: {...} }
    const responseData = importRes.data.data;
    // Handle different response formats from FastGPT
    let collectionId;
    if (typeof responseData === "string") {
      collectionId = responseData;
    } else if (responseData?.collectionId) {
      collectionId = responseData.collectionId;
    } else {
      console.warn(
        "[Upload] Unexpected FastGPT response format:",
        JSON.stringify(responseData).substring(0, 200),
      );
      throw new Error("Invalid FastGPT response: missing collectionId");
    }
    console.log("[Upload] Collection ID:", collectionId);

    // 3. Save to local DB
    const newSolution = {
      id: Date.now().toString(),
      title,
      description,
      fileName: originalName,
      fileId: fileId,
      originalFilePath: `/files/${originalFileName}`, // 原始文件路径
      collectionId: collectionId,
      // 保存本地 markdown 信息用于预览
      localMarkdown: mineruResult?.localMarkdown || "",
      batchId: mineruResult?.batchId || "",
      imageCount: mineruResult?.imageCount || 0,
      createdAt: new Date().toISOString(),
    };

    await db.update(({ solutions }) => solutions.push(newSolution));

    // Cleanup local file
    fs.unlinkSync(filePath);

    res.json(newSolution);
  } catch (error) {
    console.error("Error processing solution:", error.message);
    console.error("Error stack:", error.stack);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error(
        "Headers:",
        JSON.stringify(error.response.headers, null, 2),
      );
    }
    // Cleanup local file on error
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: "Failed to process solution" });
  }
});

// Helper function: Find solution by collectionId
async function findSolutionByCollectionId(collectionId) {
  await db.read();
  return db.data.solutions.find((s) => s.collectionId === collectionId);
}

// Chat Interface - Streaming support
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;

  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    console.log(
      "[Debug GlobalChat] Using FASTGPT_WORKFLOW_KEY:",
      process.env.FASTGPT_WORKFLOW_KEY?.substring(0, 20) + "...",
    );

    // Track the last sent textOutput to avoid sending partial/incomplete content
    let lastSentTextOutputLength = 0;

    // Store batchId -> solutionId mapping for image path conversion
    const batchIdMap = new Map();
    await db.read();
    for (const solution of db.data.solutions) {
      if (solution.batchId) {
        batchIdMap.set(solution.batchId, solution.id);
      }
    }

    const response = await axios.post(
      `${process.env.FASTGPT_BASE_URL}/v1/chat/completions`,
      {
        model: "solution-kb-chat",
        stream: true, // Enable streaming
        detail: true,
        messages: [{ role: "system", content: GLOBAL_CUSTOMER_SERVICE_PROMPT }, ...messages],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FASTGPT_WORKFLOW_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "stream",
      },
    );

    // Handle streaming response
    let buffer = ""; // Buffer for incomplete JSON
    let allNodeResponses = []; // Collect all node responses for citations

    response.data.on("data", async (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);

          if (data === "[DONE]") {
            res.write("data: [DONE]\n\n");
            return;
          }

          try {
            const parsed = JSON.parse(data);
            let content = parsed.choices?.[0]?.delta?.content || "";

            // Debug: log all parsed data
            console.log(
              "[Debug GlobalChat] Parsed SSE data keys:",
              Object.keys(parsed).join(", "),
            );

            // Extract content from workflow AI chat node (responseData)
            if (parsed.responseData && Array.isArray(parsed.responseData)) {
              console.log(
                "[Debug GlobalChat] responseData array length:",
                parsed.responseData.length,
              );
              for (const nodeData of parsed.responseData) {
                console.log(
                  "[Debug GlobalChat] Node - moduleType:",
                  nodeData.moduleType,
                  "keys:",
                  Object.keys(nodeData).join(","),
                );
                // AI chat node response - extract textOutput
                if (nodeData.moduleType === "chatNode" && nodeData.textOutput) {
                  console.log(
                    "[Debug GlobalChat] Found AI chat textOutput, length:",
                    nodeData.textOutput.length,
                    "lastSent:",
                    lastSentTextOutputLength,
                  );
                  // Only send content if textOutput has grown (avoid sending partial content)
                  if (nodeData.textOutput.length > lastSentTextOutputLength) {
                    // Send only the new portion
                    const newContent = nodeData.textOutput.substring(
                      lastSentTextOutputLength,
                    );
                    console.log(
                      "[Debug GlobalChat] Sending new content, length:",
                      newContent.length,
                    );
                    content = newContent;
                    lastSentTextOutputLength = nodeData.textOutput.length;
                  } else {
                    content = ""; // No new content to send
                  }
                }
                // Check if this node has quoteList (knowledge base search node)
                if (nodeData.quoteList && Array.isArray(nodeData.quoteList)) {
                  console.log(
                    "[Debug GlobalChat] Found quoteList in responseData node, count:",
                    nodeData.quoteList.length,
                  );
                }
                // Collect all node responses for citation extraction later
                allNodeResponses.push(nodeData);
              }
            }

            // Check for flowNodeResponse event (FastGPT workflow format)
            if (parsed.nodeResponse) {
              console.log(
                "[Debug GlobalChat] flowNodeResponse found, moduleType:",
                parsed.nodeResponse.moduleType,
              );
              allNodeResponses.push(parsed.nodeResponse);
            }

            // Check if the response itself is an array (workflow responses format)
            if (Array.isArray(parsed)) {
              console.log(
                "[Debug GlobalChat] Received array format data, length:",
                parsed.length,
              );
              allNodeResponses.push(...parsed);
            }

            // Note: Image paths are already processed by FastGPT knowledge base
            // No need to process here as FastGPT returns the content as-is

            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            console.log("[Debug GlobalChat] JSON parse error:", e.message);
          }
        }
      }
    });

    response.data.on("end", async () => {
      // Extract citations from collected node responses
      const citations = [];
      const solutionIds = new Set();

      for (const nodeResponse of allNodeResponses) {
        // Handle different node response formats
        if (nodeResponse.quoteList && Array.isArray(nodeResponse.quoteList)) {
          // Knowledge base search node format
          console.log("[Debug GlobalChat] Found quoteList in nodeResponse");
          for (const quote of nodeResponse.quoteList) {
            const solution = await findSolutionByCollectionId(
              quote.collectionId,
            );
            if (solution) {
              citations.push({
                id: quote.id,
                q: quote.q,
                a: quote.a,
                score: quote.score,
                solutionId: solution.id,
                solutionTitle: solution.title,
              });
              solutionIds.add(solution.id);
            }
          }
        }
      }

      console.log(
        "[Debug GlobalChat] Total citations found:",
        citations.length,
      );

      if (citations.length > 0) {
        const citationData = {
          citations,
          relatedSolutions: Array.from(solutionIds),
          isComplete: true,
        };
        console.log(
          "[Debug GlobalChat] Sending citation data, citations count:",
          citations.length,
        );
        const citationJson = JSON.stringify(citationData);
        console.log(
          "[Debug GlobalChat] Citation JSON length:",
          citationJson.length,
        );
        res.write(`data: ${citationJson}\n\n`);
        // Flush to ensure data is sent immediately
        if (res.flush) res.flush();
      }

      res.write("data: [DONE]\n\n");
      if (res.flush) res.flush();
      res.end();
    });

    response.data.on("error", (err) => {
      console.error("Stream error:", err);
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    });
  } catch (error) {
    console.error(
      "Chat error:",
      error.response ? error.response.data : error.message,
    );
    res.write(`data: ${JSON.stringify({ error: "Chat failed" })}\n\n`);
    res.end();
  }
});

// ==================== Product Capabilities CRUD API ====================

// Helper: Generate unique ID
const generateId = () =>
  `cap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// GET /api/capabilities - Get all capabilities
app.get("/api/capabilities", async (req, res) => {
  try {
    await capabilitiesDb.read();
    res.json(capabilitiesDb.data.capabilities);
  } catch (error) {
    console.error("Get capabilities error:", error.message);
    res.status(500).json({ error: "Failed to get capabilities" });
  }
});

// GET /api/capabilities/:id - Get single capability
app.get("/api/capabilities/:id", async (req, res) => {
  try {
    await capabilitiesDb.read();
    const capability = capabilitiesDb.data.capabilities.find(
      (c) => c.id === req.params.id,
    );

    if (!capability) {
      return res.status(404).json({ error: "Capability not found" });
    }

    res.json(capability);
  } catch (error) {
    console.error("Get capability error:", error.message);
    res.status(500).json({ error: "Failed to get capability" });
  }
});

// POST /api/capabilities - Create capability
app.post("/api/capabilities", async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      features,
      useCases,
      benefits,
      specs,
      performance,
    } = req.body;

    // Validation
    if (!name || !category || !description) {
      return res.status(400).json({
        error: "Missing required fields: name, category, description",
      });
    }

    // Check for duplicates (case-insensitive name match)
    await capabilitiesDb.read();
    const existingCapability = capabilitiesDb.data.capabilities.find(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );
    if (existingCapability) {
      return res.status(409).json({
        error: "Capability with this name already exists",
        existingId: existingCapability.id,
      });
    }

    const now = new Date().toISOString();
    const newCapability = {
      id: generateId(),
      name,
      category,
      description,
      features: features || [],
      useCases: useCases || [],
      benefits: benefits || [],
      specs: specs || [],
      performance: performance || {},
      createdAt: now,
      updatedAt: now,
      version: "1.0.0",
    };

    await capabilitiesDb.update((data) => {
      data.capabilities.push(newCapability);
    });

    // Import to FastGPT if enabled
    if (process.env.FASTGPT_DATASET_ID) {
      try {
        const capabilityText = formatCapabilityForFastGPT(newCapability);
        const fastgptResponse = await axios.post(
          `${process.env.FASTGPT_BASE_URL}/core/dataset/collection/create/text`,
          {
            datasetId: process.env.FASTGPT_DATASET_ID,
            name: newCapability.name,
            text: capabilityText,
            trainingType: "chunk",
            chunkSize: 8000,
            parentId: null, // Top-level collection
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.FASTGPT_API_KEY}`,
              "Content-Type": "application/json",
            },
          },
        );

        // Update capability with collectionId (response structure: {code, data: {collectionId}})
        const responseData = fastgptResponse.data.data;
        newCapability.collectionId = responseData?.collectionId || responseData;
        await capabilitiesDb.write();

        console.log(
          `[Capability] Imported to FastGPT: ${newCapability.name} (collectionId: ${newCapability.collectionId})`,
        );
      } catch (fastgptError) {
        console.warn(
          "[Capability] Failed to import to FastGPT:",
          fastgptError.message,
        );
        // Continue without FastGPT integration
      }
    }

    res.status(201).json(newCapability);
  } catch (error) {
    console.error("Create capability error:", error.message);
    res.status(500).json({ error: "Failed to create capability" });
  }
});

// PUT /api/capabilities/:id - Update capability
app.put("/api/capabilities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await capabilitiesDb.read();
    const index = capabilitiesDb.data.capabilities.findIndex(
      (c) => c.id === id,
    );

    if (index === -1) {
      return res.status(404).json({ error: "Capability not found" });
    }

    const existing = capabilitiesDb.data.capabilities[index];

    // Check for duplicates if name is being updated (case-insensitive, exclude self)
    if (
      req.body.name &&
      req.body.name.toLowerCase() !== existing.name.toLowerCase()
    ) {
      const duplicateCapability = capabilitiesDb.data.capabilities.find(
        (c) =>
          c.id !== id && c.name.toLowerCase() === req.body.name.toLowerCase(),
      );
      if (duplicateCapability) {
        return res.status(409).json({
          error: "Capability with this name already exists",
          existingId: duplicateCapability.id,
        });
      }
    }

    const updates = {
      ...req.body,
      updatedAt: new Date().toISOString(),
      version: incrementVersion(existing.version),
    };

    await capabilitiesDb.update((data) => {
      data.capabilities[index] = { ...existing, ...updates };
    });

    res.json({ ...existing, ...updates });
  } catch (error) {
    console.error("Update capability error:", error.message);
    res.status(500).json({ error: "Failed to update capability" });
  }
});

// DELETE /api/capabilities/:id - Delete capability
app.delete("/api/capabilities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await capabilitiesDb.read();
    const capability = capabilitiesDb.data.capabilities.find(
      (c) => c.id === id,
    );

    if (!capability) {
      return res.status(404).json({ error: "Capability not found" });
    }

    // Delete from FastGPT if collectionId exists
    if (capability.collectionId) {
      try {
        await axios.post(
          `${process.env.FASTGPT_BASE_URL}/core/dataset/collection/delete`,
          {
            datasetId: process.env.FASTGPT_DATASET_ID,
            collectionId: capability.collectionId,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.FASTGPT_API_KEY}`,
              "Content-Type": "application/json",
            },
          },
        );
        console.log(`[Capability] Deleted from FastGPT: ${capability.name}`);
      } catch (fastgptError) {
        console.warn(
          "[Capability] Failed to delete from FastGPT:",
          fastgptError.message,
        );
      }
    }

    await capabilitiesDb.update((data) => {
      data.capabilities = data.capabilities.filter((c) => c.id !== id);
    });

    res.json({ success: true, id });
  } catch (error) {
    console.error("Delete capability error:", error.message);
    res.status(500).json({ error: "Failed to delete capability" });
  }
});

// Helper: Format capability for FastGPT import
function formatCapabilityForFastGPT(capability) {
  const parts = [
    `# ${capability.name}`,
    `**类别**: ${capability.category}`,
    ``,
    `## 产品概述`,
    capability.description,
    ``,
    `## 核心功能`,
    ...(capability.features || []).map((f) => `- ${f}`),
    ``,
    `## 应用场景`,
    ...(capability.useCases || []).map((u) => `- ${u}`),
    ``,
    `## 产品优势`,
    ...(capability.benefits || []).map((b) => `- ${b}`),
  ];

  if (capability.specs && capability.specs.length > 0) {
    parts.push(``, `## 技术规格`);
    capability.specs.forEach((spec) => {
      parts.push(
        `- **${spec.name}**: ${spec.value}${spec.unit ? ` ${spec.unit}` : ""}${spec.description ? ` (${spec.description})` : ""}`,
      );
    });
  }

  if (capability.performance) {
    parts.push(``, `## 性能指标`);
    if (capability.performance.concurrency)
      parts.push(`- 并发数: ${capability.performance.concurrency}`);
    if (capability.performance.responseTime)
      parts.push(`- 响应时间: ${capability.performance.responseTime}`);
    if (capability.performance.accuracy)
      parts.push(`- 准确率: ${capability.performance.accuracy}`);
    if (capability.performance.availability)
      parts.push(`- 可用性: ${capability.performance.availability}`);
    if (capability.performance.other) {
      Object.entries(capability.performance.other).forEach(([key, value]) => {
        parts.push(`- ${key}: ${value}`);
      });
    }
  }

  return parts.join("\n");
}

// Helper: Increment version (e.g., 1.0.0 -> 1.0.1)
function incrementVersion(version) {
  const parts = version.split(".");
  parts[2] = String(parseInt(parts[2]) + 1);
  return parts.join(".");
}

// ==================== Draft Solutions API ====================

// Helper: Generate draft solution ID
const generateDraftId = () =>
  `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Helper: Filter use cases by industry
function filterByIndustry(useCases, industry) {
  if (!useCases || useCases.length === 0 || !industry) {
    return useCases || [];
  }

  const industryLower = industry.toLowerCase();
  const industryConfig = getIndustryConfig(industry);
  const industryKeywords = industryConfig.keywords.map((k) => k.toLowerCase());

  return useCases.filter((uc) => {
    const ucLower = uc.toLowerCase();
    // 直接包含行业名称
    if (ucLower.includes(industryLower)) return true;
    // 包含行业关键词
    if (industryKeywords.some((keyword) => ucLower.includes(keyword)))
      return true;
    return false;
  });
}

// Helper: Get reference solutions based on industry and customer type
// Now uses capabilities database as reference
async function getReferenceSolutions(industry, customerType) {
  try {
    await capabilitiesDb.read();
    const capabilities = capabilitiesDb.data.capabilities || [];

    // If no capabilities available, return empty
    if (capabilities.length === 0) {
      console.log("[Draft] No capabilities in database");
      return [];
    }

    console.log(
      `[Draft] Found ${capabilities.length} capabilities to search through`,
    );

    // If no filters provided, return most recent capabilities
    if (!industry && !customerType) {
      console.log(
        "[Draft] No filters provided, returning most recent capabilities",
      );
      return capabilities.slice(0, 3).map((c) => ({
        title: c.name,
        description: c.description || "",
        category: c.category,
        features: c.features || [],
        benefits: c.benefits || [],
        useCases: c.useCases || [],
        industryRelevance: 0,
        relevantUseCases: c.useCases || [],
        source: c.source,
        isExactMatch: false,
      }));
    }

    // Filter similar capabilities based on industry, customer type, and category
    const matches = capabilities
      .map((c) => {
        let matchScore = 0;

        // Category matching (highest weight)
        if (c.category && industry) {
          if (
            c.category.toLowerCase().includes(industry.toLowerCase()) ||
            industry.toLowerCase().includes(c.category.toLowerCase())
          ) {
            matchScore += 3;
          }
        }

        // Industry matching in description
        if (industry) {
          if (
            c.description &&
            c.description.toLowerCase().includes(industry.toLowerCase())
          ) {
            matchScore += 2;
          }
        }

        // Industries array matching
        if (c.industries && industry) {
          if (
            c.industries.some((i) =>
              i.toLowerCase().includes(industry.toLowerCase()),
            )
          ) {
            matchScore += 2;
          }
        }

        // Target clients matching
        if (c.targetClients && customerType) {
          if (
            c.targetClients.some((tc) =>
              tc.toLowerCase().includes(customerType.toLowerCase()),
            )
          ) {
            matchScore += 1;
          }
        }

        return {
          title: c.name,
          description: c.description || "",
          category: c.category,
          features: c.features || [],
          benefits: c.benefits || [],
          useCases: filterByIndustry(c.useCases, industry) || [],
          industryRelevance: matchScore,
          relevantUseCases: filterByIndustry(c.useCases, industry) || [],
          source: c.source,
          isExactMatch: matchScore >= 3,
        };
      })
      .filter((ref) => ref.industryRelevance > 0 || !industry);

    // Sort by relevance and return top matches
    matches.sort((a, b) => b.industryRelevance - a.industryRelevance);

    return matches.slice(0, 5);
  } catch (error) {
    console.error("[Draft] Error getting reference solutions:", error.message);
    return [];
  }
}

// POST /api/drafts/generate - Generate solution using FastGPT Workflow
app.post("/api/drafts/generate", async (req, res) => {
  try {
    const {
      requirements,
      industry,
      customerType,
      expectedFeatures,
      additionalNotes,
    } = req.body;

    // === 输入验证 ===
    // 1. 验证 requirements 必填且长度限制
    if (!requirements || typeof requirements !== "string") {
      return res
        .status(400)
        .json({ error: "需求描述不能为空", code: "MISSING_REQUIREMENTS" });
    }

    const trimmedRequirements = requirements.trim();
    if (trimmedRequirements.length === 0) {
      return res
        .status(400)
        .json({ error: "需求描述不能为空", code: "EMPTY_REQUIREMENTS" });
    }
    if (trimmedRequirements.length > 5000) {
      return res.status(400).json({
        error: "需求描述不能超过5000字",
        code: "REQUIREMENTS_TOO_LONG",
      });
    }

    // 2. 验证可选字段长度
    if (industry && typeof industry === "string" && industry.length > 100) {
      return res
        .status(400)
        .json({ error: "行业字段不能超过100字", code: "INDUSTRY_TOO_LONG" });
    }
    if (
      customerType &&
      typeof customerType === "string" &&
      customerType.length > 100
    ) {
      return res.status(400).json({
        error: "客户类型不能超过100字",
        code: "CUSTOMER_TYPE_TOO_LONG",
      });
    }
    if (
      expectedFeatures &&
      typeof expectedFeatures === "string" &&
      expectedFeatures.length > 2000
    ) {
      return res
        .status(400)
        .json({ error: "期望功能不能超过2000字", code: "FEATURES_TOO_LONG" });
    }
    if (
      additionalNotes &&
      typeof additionalNotes === "string" &&
      additionalNotes.length > 2000
    ) {
      return res
        .status(400)
        .json({ error: "补充说明不能超过2000字", code: "NOTES_TOO_LONG" });
    }

    // Get reference solutions based on industry and customer type
    console.log(
      `[Draft] Looking for reference solutions - industry: ${industry}, customerType: ${customerType}`,
    );
    const referenceSolutions = await getReferenceSolutions(
      industry,
      customerType,
    );
    // Check if we have exact matches or general reference
    const hasExactMatches = referenceSolutions.some((ref) => ref.isExactMatch);
    console.log(
      `[Draft] Found ${referenceSolutions.length} reference solutions (${hasExactMatches ? "exact matches" : "general reference"})`,
    );

    // Build system prompt - Generate Outline for Slide Generation
    // Determine recommended style based on industry
    let recommendedStyle = "minimal";
    const styleMapping = {
      医院: "scientific",
      医疗: "scientific",
      金融: "corporate",
      银行: "corporate",
      保险: "corporate",
      政务: "minimal",
      教育: "editorial",
      制造: "blueprint",
      通信: "notion",
    };
    for (const [key, value] of Object.entries(styleMapping)) {
      if (industry?.includes(key)) {
        recommendedStyle = value;
        break;
      }
    }

    // Debug logging
    console.log(`[Outline Gen] Input industry: "${industry}"`);
    console.log(`[Outline Gen] Recommended style: "${recommendedStyle}"`);
    console.log(`[Outline Gen] Style mapping applied:`, styleMapping);

    // === 智能页数分析（增强版：AI语义分析） ===
    // 根据用户输入内容动态决定合适的页数范围

    /**
     * 从 Markdown 代码块中提取 JSON
     * FastGPT 有时返回 ```json ... ``` 格式
     */
    function extractJSONFromMarkdown(content) {
      // 去除 markdown 代码块标记
      let jsonStr = content.trim();

      // 匹配 ```json 或 ``` 开头，``` 结尾的代码块
      const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
      const match = jsonStr.match(codeBlockRegex);

      if (match && match[1]) {
        jsonStr = match[1].trim();
      }

      return jsonStr;
    }

    /**
     * AI 语义分析复杂度评估
     * 使用 FastGPT 复杂度评估 Agent
     * @param {string} content - 用户需求文本
     * @returns {Promise<Object>} - { score, breakdown, reasoning }
     */
    async function analyzeAIComplexity(content) {
      try {
        const response = await axios.post(
          `${process.env.FASTGPT_BASE_URL}/v1/chat/completions`,
          {
            chatId: process.env.FASTGPT_COMPLEXITY_ANALYZER_CHAT_ID,
            stream: false,
            detail: false,
            messages: [{ role: "user", content: content }],
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.FASTGPT_COMPLEXITY_ANALYZER_APP_KEY}`,
              "Content-Type": "application/json",
            },
            timeout: 30000,
          },
        );

        // FastGPT 返回格式: { choices: [{ message: { content: "JSON字符串" } }] }
        const aiContent = response.data.choices[0].message.content;

        // 去除可能的 markdown 代码块标记
        const jsonStr = extractJSONFromMarkdown(aiContent);

        console.log(
          `[Complexity Analysis] AI原始响应:`,
          aiContent.substring(0, 200),
        );

        // 解析 JSON
        const aiResult = JSON.parse(jsonStr);

        console.log(`[Complexity Analysis] AI评分:`, aiResult);
        console.log(
          `[Complexity Analysis] 评分详情:`,
          `技术=${aiResult.technicalScore}, 业务=${aiResult.businessScore}, 规模=${aiResult.scaleScore}, 理由=${aiResult.reasoning}`,
        );

        return aiResult;
      } catch (error) {
        console.warn(
          `[Complexity Analysis] AI评估失败，使用降级方案:`,
          error.message,
        );
        if (error.response) {
          console.warn(
            `[Complexity Analysis] API响应:`,
            error.response.status,
            error.response.data,
          );
        }
        return null; // 返回 null 表示使用降级方案
      }
    }

    /**
     * 增强的复杂度分析（纯 AI 语义理解）
     * @param {string} content - 用户需求文本
     * @returns {Promise<string>} - 页数范围 (如 "4-6")
     */
    async function analyzeSlideCount(content) {
      // === 使用 AI 语义分析（理解业务语言背后的技术复杂度） ===
      const aiAnalysis = await analyzeAIComplexity(content);

      let finalScore, slideRange, analysisMethod;

      if (aiAnalysis && aiAnalysis.totalScore) {
        // AI 评估成功，使用 AI 评分
        finalScore = aiAnalysis.totalScore;
        analysisMethod = "AI语义分析";
        console.log(`[Slide Count Analysis] 使用AI评估:`, aiAnalysis.reasoning);
        console.log(
          `[Slide Count Analysis] 技术难度: ${aiAnalysis.technicalScore}/10, 业务复杂度: ${aiAnalysis.businessScore}/10, 内容规模: ${aiAnalysis.scaleScore}/10`,
        );
      } else {
        // AI 评估失败，使用增强的长度降级方案
        const textLength = content.length;
        const lineCount = content.split("\n").length;
        const wordCount = content
          .split(/[\s\n\r]+/)
          .filter((w) => w.length > 0).length;

        // 增强长度估算：考虑字符数、行数、词数
        // 基础分：每 50 字符 1 分，每 5 行 1 分，每 20 词 1 分
        const lengthScore = Math.min(Math.floor(textLength / 40), 25);
        const lineScore = Math.min(Math.floor(lineCount / 4), 20);
        const wordScore = Math.min(Math.floor(wordCount / 15), 25);

        // 加权平均（字符 50%，行数 30%，词数 20%）
        finalScore = Math.min(
          Math.floor(lengthScore * 0.5 + lineScore * 0.3 + wordScore * 0.2),
          30,
        );
        analysisMethod = "增强长度估算（降级）";

        console.log(`[Slide Count Analysis] AI评估失败，使用增强降级方案`);
        console.log(
          `[Slide Count Analysis] Length: ${textLength}, Lines: ${lineCount}, Words: ${wordCount}`,
        );
        console.log(
          `[Slide Count Analysis] Scores - Length:${lengthScore}, Line:${lineScore}, Word:${wordScore}`,
        );
      }

      // 根据复杂度决定页数
      if (finalScore <= 8) {
        // 简单需求：4-6页
        slideRange = "4-6";
      } else if (finalScore <= 15) {
        // 中等需求：6-10页
        slideRange = "6-10";
      } else if (finalScore <= 22) {
        // 复杂需求：10-15页
        slideRange = "10-15";
      } else {
        // 高度复杂需求：15-25页
        slideRange = "15-25";
      }

      console.log(
        `[Slide Count Analysis] ${analysisMethod} → Score: ${finalScore}/30, Pages: ${slideRange}`,
      );
      return slideRange;
    }

    const dynamicSlideCount = await analyzeSlideCount(requirements);

    const availableStyles = [
      "minimal（简约）",
      "corporate（商务）",
      "blueprint（蓝图）",
      "sketch（手绘）",
      "editorial（杂志）",
      "chalkboard（黑板）",
      "notion（Notion）",
      "darkAtmospheric（暗色）",
      "editorialInfographic（信息图）",
      "fantasyAnimation（奇幻）",
      "intuitionMachine（直觉机器）",
      "pixelArt（像素）",
      "scientific（科学）",
      "vectorIllustration（矢量）",
      "vintage（复古）",
      "watercolor（水彩）",
      "boldEditorial（粗体杂志）",
    ];

    let systemPrompt = `你是一位专业的解决方案架构师和演示文稿设计师。

【任务】
根据用户需求生成一份详细的演示文稿大纲（Outline），用于后续生成幻灯片。
这是给客户看的正式方案PPT，不是演讲提词卡——每页内容必须充实、有数据、有论据。

【必须输出 JSON 格式】
请严格按照以下 JSON 格式输出，不要有任何其他文字：

{
  "topic": "方案主题（2-4个词）",
  "style": "${recommendedStyle}",
  "audience": "executives",
  "language": "zh",
  "slideCount": "${dynamicSlideCount}（必须严格遵守此页数范围！生成指定数量的幻灯片）",

  "styleInstructions": {
    "designAesthetic": "设计美学描述（2-3句话）",
    "background": "背景颜色和纹理",
    "typography": "字体描述",
    "colorPalette": "配色方案",
    "visualElements": "视觉元素列表",
    "styleRules": "设计规则"
  },

  "slides": [
    {
      "number": 1,
      "type": "cover",
      "filename": "01-slide-cover",
      "narrativeGoal": "这页要达成的目标",
      "keyContent": {
        "headline": "主标题（简练有力，≤15字）",
        "subHeadline": "概述段落（1-2句话，说明核心观点，30-60字）",
        "body": [
          "要点标题 — 展开说明，包含具体数据或场景描述（50-80字/条）",
          "要点标题 — 展开说明，包含具体数据或场景描述（50-80字/条）",
          "要点标题 — 展开说明，包含具体数据或场景描述（50-80字/条）"
        ]
      },
      "speakerNotes": "演讲备注：补充说明、话术建议、数据来源等（不显示在PPT正文）",
      "visual": "简明的插图内容描述（图标、元素、场景），用于生成插图，而非整页布局"
    }
  ]
}

【重要：风格选择】
- style 字段必须从以下 16 种风格中选择其一：${availableStyles.join("、")}
- 根据行业特点选择最合适的风格（${industry ? `当前行业：${industry}，推荐风格：${recommendedStyle}` : "无行业信息，推荐使用 minimal"}）
- 不要创造新的风格名称，必须严格从上述列表中选择

【幻灯片类型】
- cover: 封面页（不需要插图）
- content: 内容页（需要插图）
- back-cover: 结束页（不需要插图）

【内容页格式（CRITICAL — 这是方案PPT，不是演讲提词卡）】
- headline: 标题，简练有力（≤15字）
- subHeadline: 概述段落，用1-2句话说明这页的核心观点（30-60字）
- body: 3-5个要点，每个要点格式为"要点标题 — 展开说明"（50-80字/条）
  - 展开说明必须包含：具体数据/百分比、应用场景、或客户价值
  - 禁止只写关键词（如"多方言支持"），必须展开说明
- speakerNotes: 演讲备注（补充说明、话术建议，不显示在PPT上）

【内容质量要求】
- 每个要点必须是完整的陈述句，不是关键词罗列
- 必须包含具体数据（如"准确率98.5%""处理时间缩短40%"）
- 必须关联客户价值（如"帮助医院每年节省XX万元人力成本"）
- 封面页和章节过渡页可以简洁，但内容页必须充实

【反面示例 vs 正面示例】
❌ body: ["多方言支持", "医疗术语识别", "自然语言处理", "高准确率"]
✅ body: [
  "多方言支持 — 覆盖普通话及20+主要方言，确保老年患者和外地患者也能顺畅沟通，方言识别准确率>92%",
  "医疗术语识别 — 内置10万+医学专业词库，科室名称、药品名称、病症描述的识别准确率>95%",
  "自然语言处理 — 理解患者口语化表达，如'我头疼想看医生'自动关联神经内科，减少人工转接60%",
  "高准确率保障 — 综合语音识别准确率达98.5%，支持持续自学习优化，每月自动更新模型"
]

【visual 字段说明（CRITICAL - 仔细阅读）】
- visual 描述用于生成 AI 插图，不是整页布局
- 核心原则：描述"解决方案类型"在"行业场景"中的应用，而不仅仅是行业场景
- 描述内容应包括：解决方案的核心视觉元素 + 行业场景特征
- 不要描述文字位置、背景颜色等布局信息

错误示例："现代化医院外景全景，玻璃幕墙反射晨光，主楼前有救护车通道"（只有行业，没有解决方案）
正确示例："智能总机客服界面与电话图标，现代化客服中心场景，专业蓝色调"（解决方案+行业场景）

【页数要求 - CRITICAL】
- 用户指定的 slideCount 是硬性要求，必须严格遵守！
- 例如 slideCount 为 "15-25" 时，你必须生成 15 到 25 页幻灯片
- 生成的 slides 数组长度必须在指定范围内
- 不得少于范围下限，不得多于范围上限

【输出要求】
只输出 JSON，不要有其他文字。`;

    // 获取行业配置
    const industryConfig = getIndustryConfig(industry);

    // 新增：行业定制指令
    if (industry && industryConfig) {
      systemPrompt += `

【行业定制要求】
当前行业：${industry}
行业风格：${industryConfig.style}
专业术语库：${industryConfig.keywords.join("、")}
行业痛点：${industryConfig.painPoints.join("、")}
关键指标：${industryConfig.metrics.join("、")}

内容要求：
1. 使用该行业的专业术语和表述方式
2. 参考能力库中的相关能力和用例
3. 数据和指标要符合该行业常规范围
4. 强调该行业最关注的痛点（${industryConfig.painPoints.slice(0, 2).join("、")}）`;
    }

    // Add reference solutions to system prompt if available
    if (referenceSolutions.length > 0) {
      if (hasExactMatches) {
        systemPrompt += `

【行业相关能力库】
以下是从能力库中筛选出的与该行业高度相关的产品能力，请重点参考这些内容：

${referenceSolutions
  .map(
    (ref, i) => `
${i + 1}. ${ref.title}（${ref.category}）
   - 核心能力：${ref.features.join("、")}
   - 行业用例：${ref.relevantUseCases && ref.relevantUseCases.length > 0 ? ref.relevantUseCases.join("、") : ref.useCases?.join("、") || "暂无"}
   - 客户价值：${ref.benefits?.join("、") || "暂无"}
   - 匹配度：${ref.industryRelevance > 0 ? "高相关" : "通用参考"}
`,
  )
  .join("")}

请参考这些能力的专业表述，并将其融入方案内容中，特别是在"核心功能/优势"页面。`;
      } else {
        systemPrompt += `

【通用参考方案】
以下是公司历史方案示例，用于参考结构和表述风格：

${referenceSolutions
  .map(
    (ref, i) => `
${i + 1}. ${ref.title}（${ref.category}）
   - 核心能力：${ref.features.join("、")}
   - 客户价值：${ref.benefits?.join("、") || "暂无"}
`,
  )
  .join("")}

请参考这些方案的专业表述风格，但根据当前用户需求的行业特点生成针对性的内容。`;
      }
    }

    // Build the user prompt for FastGPT
    // CRITICAL: FastGPT 对话应用忽略 API 的 system message，所以必须把关键指令放到 user prompt 里
    const industryText = industry ? `${industry}行业` : "";
    const customerTypeText = customerType || "";
    const prompt = `${industryText}${industryText && customerTypeText ? "， " : ""}${customerTypeText}${industryText || customerTypeText ? "， " : ""}${requirements}

【CRITICAL — 内容丰富度要求（这是给客户看的方案PPT，不是演讲提词卡）】

1. body 每条要点格式为"要点标题 — 展开说明"，每条 50-80 字
   ❌ 错误示例: ["多方言支持", "医疗术语识别", "高准确率"]
   ✅ 正确示例: ["多方言支持 — 覆盖普通话及20+主要方言，确保老年患者也能顺畅沟通，方言识别准确率>92%", "医疗术语识别 — 内置10万+医学专业词库，识别准确率>95%"]

2. subHeadline 必须是 30-60 字的概述段落，说明该页核心观点

3. 每个要点必须包含：具体数据/百分比 + 应用场景 + 客户价值

4. speakerNotes 字段：补充说明和话术建议（不显示在PPT上）

5. 内容页 body 必须有 3-5 条，每条都是完整句子，禁止只写关键词

【style 风格选择】
- 医疗/医院行业用：scientific
- 金融/银行行业用：corporate
- 其他行业用：minimal
请严格从 16 种风格中选择，不要创造新风格名称。`;

    // Call FastGPT Workflow API
    // CRITICAL: FastGPT 对话应用忽略 API 发送的 system message，
    // 所以把 systemPrompt 和 user prompt 合并为一条 user message
    const fullPrompt = `${systemPrompt}\n\n---\n\n【用户需求】\n${prompt}`;
    console.log("[Outline Gen] Full prompt length:", fullPrompt.length, "chars");
    console.log("[Outline Gen] User prompt:", prompt.substring(0, 300));

    const fastgptResponse = await axios.post(
      `${process.env.FASTGPT_BASE_URL}/v1/chat/completions`,
      {
        model:
          process.env.FASTGPT_SOLUTION_GENERATOR_CHAT_ID ||
          "solution-generator-chat",
        messages: [
          {
            role: "user",
            content: fullPrompt,
          },
        ],
        stream: false,
        detail: true,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FASTGPT_SOLUTION_GENERATOR_APP_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 120000, // 2 minutes timeout for generation
      },
    );

    // Extract the generated content
    let generatedContent = "";
    if (
      fastgptResponse.data &&
      fastgptResponse.data.choices &&
      fastgptResponse.data.choices.length > 0
    ) {
      const choice = fastgptResponse.data.choices[0];
      if (choice.message && choice.message.content) {
        generatedContent = choice.message.content;
      }
    }

    if (!generatedContent) {
      return res
        .status(500)
        .json({ error: "Failed to generate solution content" });
    }

    // Parse JSON response (Outline format)
    let outline;
    let title = "未命名方案";

    try {
      // Try to extract JSON from the response (might be wrapped in markdown code blocks)
      let jsonStr = generatedContent.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith("```")) {
        const lines = jsonStr.split("\n");
        const startIdx = lines.findIndex(
          (l) => l.startsWith("```json") || l.startsWith("```"),
        );
        const endIdx = lines.findIndex(
          (l, i) => i > startIdx && l.startsWith("```"),
        );
        if (startIdx !== -1 && endIdx !== -1) {
          jsonStr = lines
            .slice(startIdx + 1, endIdx)
            .join("\n")
            .trim();
        }
      }

      outline = JSON.parse(jsonStr);
      title = outline.topic || "未命名方案";

      console.log("[Draft] Parsed outline successfully:", {
        topic: outline.topic,
        style: outline.style,
        slideCount: outline.slideCount,
        slides: outline.slides?.length,
      });
      console.log(
        "[Draft] Style check - Expected:",
        recommendedStyle,
        "Got:",
        outline.style,
      );
      console.log(
        "[Draft] Is style valid?",
        availableStyles.some((s) => s.includes(outline.style)),
      );
    } catch (parseError) {
      console.error(
        "[Draft] Failed to parse JSON, falling back to markdown mode",
      );
      console.error("[Draft] Parse error:", parseError.message);
      console.error(
        "[Draft] Raw FastGPT response:",
        generatedContent.substring(0, 500),
      );
      // If JSON parsing fails, treat as markdown and create basic outline
      const titleMatch = generatedContent.match(/^#\s+(.+)$/m);
      title = titleMatch ? titleMatch[1].trim() : "未命名方案";

      outline = {
        topic: title,
        style: "corporate",
        audience: "executives",
        language: "zh",
        slideCount: 1,
        styleInstructions: {},
        slides: [
          {
            number: 1,
            type: "cover",
            filename: "01-slide-cover",
            narrativeGoal: "封面",
            keyContent: { headline: title },
            visual: "专业商务风格",
            layout: "居中",
          },
        ],
      };
    }

    const now = new Date().toISOString();
    const newDraft = {
      id: generateDraftId(),
      title,
      requirements,
      industry: industry || null,
      scenario: customerType || null,
      matchedCapabilities: [],
      content: generatedContent, // Keep raw content for reference
      outline: outline, // New: structured outline for slide generation
      status: "outline", // Changed from 'draft' to 'outline'
      currentStyle: null, // Will be set when user first exports PPT
      generationProgress: {
        total: outline.slideCount || 1,
        completed: 0,
        failed: 0,
        slides: {},
      },
      slideImages: [], // New: will store generated slide URLs
      createdAt: now,
      updatedAt: now,
      version: "1.0.0",
    };

    await draftsDb.update((data) => {
      data.drafts.push(newDraft);
    });

    console.log(
      `[Draft] Generated outline: ${newDraft.id} - ${newDraft.title}`,
    );

    res.status(201).json(newDraft);
  } catch (error) {
    console.error("Generate draft error:", error.message);
    console.error("Error stack:", error.stack);
    if (error.response) {
      console.error(
        "FastGPT API error:",
        error.response.status,
        JSON.stringify(error.response.data),
      );
    } else if (error.request) {
      console.error("FastGPT API request error (no response):", error.request);
    } else {
      console.error("FastGPT API setup error:", error);
    }
    res
      .status(500)
      .json({ error: "Failed to generate solution", details: error.message });
  }
});

// GET /api/drafts - Get all draft solutions
app.get("/api/drafts", async (req, res) => {
  try {
    await draftsDb.read();
    res.json(draftsDb.data.drafts);
  } catch (error) {
    console.error("Get drafts error:", error.message);
    res.status(500).json({ error: "Failed to get drafts" });
  }
});

// GET /api/drafts/:id - Get single draft solution
app.get("/api/drafts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await draftsDb.read();
    const draft = draftsDb.data.drafts.find((d) => d.id === id);

    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }

    res.json(draft);
  } catch (error) {
    console.error("Get draft error:", error.message);
    res.status(500).json({ error: "Failed to get draft" });
  }
});

// PUT /api/drafts/:id - Update draft solution
app.put("/api/drafts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await draftsDb.read();
    const index = draftsDb.data.drafts.findIndex((d) => d.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const existing = draftsDb.data.drafts[index];
    const updates = {
      ...req.body,
      updatedAt: new Date().toISOString(),
      version: incrementVersion(existing.version),
    };

    await draftsDb.update((data) => {
      data.drafts[index] = { ...existing, ...updates };
    });

    res.json(draftsDb.data.drafts[index]);
  } catch (error) {
    console.error("Update draft error:", error.message);
    res.status(500).json({ error: "Failed to update draft" });
  }
});

// GET /api/drafts/:id/optimize-preview - Get optimization preview (without applying)
app.get("/api/drafts/:id/optimize-preview", async (req, res) => {
  try {
    const { id } = req.params;
    await draftsDb.read();
    const index = draftsDb.data.drafts.findIndex((d) => d.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const draft = draftsDb.data.drafts[index];

    if (!draft.outline || !draft.outline.slides) {
      return res.status(400).json({ error: "No outline to optimize" });
    }

    // Get evaluation first
    const evalResponse = await evaluateOutline(draft);

    // Optimize each slide and track changes
    const changes = [];
    const optimizedSlides = draft.outline.slides.map((slide, idx) => {
      const originalSlide = { ...slide };
      const optimized = { ...slide };
      let slideChanges = [];

      // 1. Fix section slides: ensure body is empty
      if (slide.type === "section" || slide.type === "section-divider") {
        if (slide.keyContent?.body && slide.keyContent.body.length > 0) {
          optimized.keyContent = {
            ...optimized.keyContent,
            body: [],
          };
          slideChanges.push({
            field: "keyContent.body",
            original: JSON.stringify(slide.keyContent.body),
            optimized: "[]",
          });
        }
      }

      // 2. Fix visual description: ensure single subject
      if (optimized.visual) {
        let visual = optimized.visual;
        const originalVisual = visual;

        // Remove multi-element patterns
        const multiElementPatterns = [
          /与.*对比|和.*对比|及.*对比/g,
          /与.*和.*|和.*与.*/g,
          /图表与图标|图标与图表/g,
          /符号与文字/g,
          /数据与图表/g,
        ];

        multiElementPatterns.forEach((pattern) => {
          visual = visual.replace(pattern, "");
        });

        // For content pages, ensure simple single-subject description
        if (slide.type === "content" || slide.type === "two-columns") {
          // Extract first meaningful element if multi-element description exists
          if (visual.includes("、") || visual.includes("，")) {
            const parts = visual.split(/[、，]/);
            visual = parts[0].trim();
          }

          // Ensure visual focuses on single icon/element
          if (
            !visual.includes("单个") &&
            !visual.includes("图标") &&
            !visual.includes("图")
          ) {
            // Add focus if missing
            visual = `单个${visual}`;
          }
        }

        visual = visual.trim();

        if (visual !== originalVisual) {
          slideChanges.push({
            field: "visual",
            original: originalVisual,
            optimized: visual,
          });
        }

        optimized.visual = visual;
      }

      // 3. Fix page type: change "closing" to "back-cover"
      if (slide.type === "closing") {
        optimized.type = "back-cover";
        slideChanges.push({
          field: "type",
          original: "closing",
          optimized: "back-cover",
        });
      }

      if (slideChanges.length > 0) {
        changes.push({
          slideNumber: idx + 1,
          slideType: originalSlide.type,
          changes: slideChanges,
        });
      }

      return optimized;
    });

    res.json({
      evaluation: evalResponse,
      changes,
      optimizedOutline: {
        ...draft.outline,
        slides: optimizedSlides,
      },
      changeCount: changes.length,
      slideCount: optimizedSlides.length,
    });
  } catch (error) {
    console.error("Optimize preview error:", error.message);
    res.status(500).json({ error: "Failed to generate optimization preview" });
  }
});

// POST /api/drafts/:id/apply-optimization - Apply the optimized outline
app.post("/api/drafts/:id/apply-optimization", async (req, res) => {
  try {
    const { id } = req.params;
    await draftsDb.read();
    const index = draftsDb.data.drafts.findIndex((d) => d.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const draft = draftsDb.data.drafts[index];

    if (!draft.outline || !draft.outline.slides) {
      return res.status(400).json({ error: "No outline to optimize" });
    }

    // Optimize each slide
    const optimizedSlides = draft.outline.slides.map((slide) => {
      const optimized = { ...slide };

      // 1. Fix section slides: ensure body is empty
      if (slide.type === "section" || slide.type === "section-divider") {
        optimized.keyContent = {
          ...optimized.keyContent,
          body: [],
        };
      }

      // 2. Fix visual description: ensure single subject
      if (optimized.visual) {
        let visual = optimized.visual;

        // Remove multi-element patterns
        const multiElementPatterns = [
          /与.*对比|和.*对比|及.*对比/g,
          /与.*和.*|和.*与.*/g,
          /图表与图标|图标与图表/g,
          /符号与文字/g,
          /数据与图表/g,
        ];

        multiElementPatterns.forEach((pattern) => {
          visual = visual.replace(pattern, "");
        });

        // For content pages, ensure simple single-subject description
        if (slide.type === "content" || slide.type === "two-columns") {
          // Extract first meaningful element if multi-element description exists
          if (visual.includes("、") || visual.includes("，")) {
            const parts = visual.split(/[、，]/);
            visual = parts[0].trim();
          }

          // Ensure visual focuses on single icon/element
          if (
            !visual.includes("单个") &&
            !visual.includes("图标") &&
            !visual.includes("图")
          ) {
            // Add focus if missing
            visual = `单个${visual}`;
          }
        }

        optimized.visual = visual.trim();
      }

      // 3. Fix page type: change "closing" to "back-cover"
      if (slide.type === "closing") {
        optimized.type = "back-cover";
      }

      return optimized;
    });

    // Create updated draft with optimized outline
    const updatedDraft = {
      ...draft,
      outline: {
        ...draft.outline,
        slides: optimizedSlides,
      },
      // Clear existing images to force regeneration
      slideImages: [],
      // Reset generation progress
      generationProgress: {
        total: optimizedSlides.length,
        completed: 0,
        failed: 0,
        current: null,
        status: "pending",
        slides: {},
      },
      // Reset status to outline to indicate ready for image generation
      status: "outline",
      // Update timestamp
      updatedAt: new Date().toISOString(),
      version: incrementVersion(draft.version),
    };

    await draftsDb.update((data) => {
      data.drafts[index] = updatedDraft;
    });

    console.log(
      `[Outline Optimize] Draft ${id} outline optimized, ${optimizedSlides.length} slides processed`,
    );

    res.json(updatedDraft);
  } catch (error) {
    console.error("Apply optimization error:", error.message);
    res.status(500).json({ error: "Failed to apply optimization" });
  }
});

// Helper function to evaluate outline
async function evaluateOutline(draft) {
  const slides = draft.outline.slides;
  const issues = [];
  let visualQualityScore = 40;
  let pageTypeScore = 25;
  let contentLogicScore = 20;
  let styleMatchingScore = 15;

  const validStyles = [
    "minimal",
    "corporate",
    "blueprint",
    "sketch",
    "editorial",
    "chalkboard",
    "notion",
    "darkAtmospheric",
    "editorialInfographic",
    "fantasyAnimation",
    "intuitionMachine",
    "pixelArt",
    "scientific",
    "vectorIllustration",
    "vintage",
    "watercolor",
    "boldEditorial",
  ];

  // Check style matching
  if (!validStyles.includes(draft.outline.style)) {
    styleMatchingScore = 0;
    issues.push({
      slideNumber: 0,
      type: "invalid_style",
      severity: "high",
      description: `风格 "${draft.outline.style}" 不是有效风格`,
      suggestion: `请从以下风格中选择：${validStyles.join(", ")}`,
    });
  }

  // Evaluate each slide
  slides.forEach((slide, idx) => {
    const slideNum = idx + 1;

    if (slide.visual) {
      const visual = slide.visual;
      const multiElementPatterns = [
        /与.*对比|和.*对比|及.*对比/,
        /与.*和.*|和.*与.*/,
        /图表与图标|图标与图表/,
        /符号与文字/,
        /数据与图表/,
      ];

      multiElementPatterns.forEach((pattern) => {
        if (pattern.test(visual)) {
          visualQualityScore -= 10;
          issues.push({
            slideNumber: slideNum,
            type: "visual_multi_element",
            severity: "high",
            description: `visual 描述包含多个元素："${visual}"`,
            suggestion: "改为单一主体描述，去掉'与'、'和'、'及'连接的元素",
          });
        }
      });

      if (
        (slide.type === "content" || slide.type === "two-columns") &&
        visual.length > 50
      ) {
        visualQualityScore -= 5;
        issues.push({
          slideNumber: slideNum,
          type: "visual_too_complex",
          severity: "medium",
          description: `内容页 visual 描述过长：${visual.length} 字符`,
          suggestion: "简化为单一图标描述，如'单个放大镜图标，白色背景'",
        });
      }
    }

    if (slide.type === "section" || slide.type === "section-divider") {
      if (slide.keyContent?.body && slide.keyContent.body.length > 0) {
        pageTypeScore -= 10;
        issues.push({
          slideNumber: slideNum,
          type: "section_has_body",
          severity: "high",
          description: `章节页 (type: ${slide.type}) 不应有 body 内容`,
          suggestion: "清空 body 数组为 []",
        });
      }
    }

    if (slideNum === slides.length && slide.type === "closing") {
      pageTypeScore -= 10;
      issues.push({
        slideNumber: slideNum,
        type: "wrong_end_page_type",
        severity: "high",
        description: "最后一页类型是 closing，应该是 back-cover",
        suggestion: "将 type 改为 back-cover",
      });
    }
  });

  const contentCount = slides.filter((s) => s.type === "content").length;
  const twoColumnCount = slides.filter((s) => s.type === "two-columns").length;

  if (contentCount > 8 && twoColumnCount === 0) {
    contentLogicScore -= 5;
    issues.push({
      slideNumber: 0,
      type: "monotonous_layout",
      severity: "medium",
      description: `有 ${contentCount} 个 content 页面，布局可能单调`,
      suggestion: "将部分 content 页改为 twoColumns 类型增加视觉变化",
    });
  }

  const totalScore =
    Math.max(0, visualQualityScore) +
    Math.max(0, pageTypeScore) +
    Math.max(0, contentLogicScore) +
    Math.max(0, styleMatchingScore);

  let summary = `总分 ${totalScore}/100。`;
  if (totalScore >= 90) {
    summary += " outline 质量优秀，可以直接生成。";
  } else if (totalScore >= 70) {
    summary += " outline 质量良好，有少量可优化项。";
  } else if (totalScore >= 50) {
    summary += " outline 存在一些问题，建议优化。";
  } else {
    summary += " outline 质量较差，强烈建议优化。";
  }

  return {
    totalScore,
    scores: {
      visualQuality: Math.max(0, visualQualityScore),
      pageTypeDistribution: Math.max(0, pageTypeScore),
      contentLogic: Math.max(0, contentLogicScore),
      styleMatching: Math.max(0, styleMatchingScore),
    },
    issues: issues.sort((a, b) => a.slideNumber - b.slideNumber),
    summary,
    recommendation:
      totalScore < 80
        ? "建议优化后重新生成图片，以获得更好的视觉效果。"
        : "outline 质量良好，可以直接生成图片。",
  };
}

// GET /api/drafts/:id/evaluate-outline - Evaluate outline quality
app.get("/api/drafts/:id/evaluate-outline", async (req, res) => {
  try {
    const { id } = req.params;
    await draftsDb.read();
    const index = draftsDb.data.drafts.findIndex((d) => d.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const draft = draftsDb.data.drafts[index];

    if (!draft.outline || !draft.outline.slides) {
      return res.status(400).json({ error: "No outline to evaluate" });
    }

    const slides = draft.outline.slides;
    const issues = [];
    let visualQualityScore = 40;
    let pageTypeScore = 25;
    let contentLogicScore = 20;
    let styleMatchingScore = 15;

    // Valid styles
    const validStyles = [
      "minimal",
      "corporate",
      "blueprint",
      "sketch",
      "editorial",
      "chalkboard",
      "notion",
      "darkAtmospheric",
      "editorialInfographic",
      "fantasyAnimation",
      "intuitionMachine",
      "pixelArt",
      "scientific",
      "vectorIllustration",
      "vintage",
      "watercolor",
      "boldEditorial",
    ];

    // 1. Check style matching
    if (!validStyles.includes(draft.outline.style)) {
      styleMatchingScore = 0;
      issues.push({
        slideNumber: 0,
        type: "invalid_style",
        severity: "high",
        description: `风格 "${draft.outline.style}" 不是有效风格`,
        suggestion: `请从以下风格中选择：${validStyles.join(", ")}`,
      });
    }

    // 2. Evaluate each slide
    slides.forEach((slide, idx) => {
      const slideNum = idx + 1;

      // Check visual quality
      if (slide.visual) {
        const visual = slide.visual;

        // Check for multi-element patterns
        const multiElementPatterns = [
          /与.*对比|和.*对比|及.*对比/,
          /与.*和.*|和.*与.*/,
          /图表与图标|图标与图表/,
          /符号与文字/,
          /数据与图表/,
        ];

        multiElementPatterns.forEach((pattern) => {
          if (pattern.test(visual)) {
            visualQualityScore -= 10;
            issues.push({
              slideNumber: slideNum,
              type: "visual_multi_element",
              severity: "high",
              description: `visual 描述包含多个元素："${visual}"`,
              suggestion: "改为单一主体描述，去掉'与'、'和'、'及'连接的元素",
            });
          }
        });

        // Check if content page has complex description
        if (
          (slide.type === "content" || slide.type === "two-columns") &&
          visual.length > 50
        ) {
          visualQualityScore -= 5;
          issues.push({
            slideNumber: slideNum,
            type: "visual_too_complex",
            severity: "medium",
            description: `内容页 visual 描述过长：${visual.length} 字符`,
            suggestion: "简化为单一图标描述，如'单个放大镜图标，白色背景'",
          });
        }
      }

      // Check page type issues
      if (slide.type === "section" || slide.type === "section-divider") {
        if (slide.keyContent?.body && slide.keyContent.body.length > 0) {
          pageTypeScore -= 10;
          issues.push({
            slideNumber: slideNum,
            type: "section_has_body",
            severity: "high",
            description: `章节页 (type: ${slide.type}) 不应有 body 内容`,
            suggestion: "清空 body 数组为 []",
          });
        }
      }

      // Check last page type
      if (slideNum === slides.length && slide.type === "closing") {
        pageTypeScore -= 10;
        issues.push({
          slideNumber: slideNum,
          type: "wrong_end_page_type",
          severity: "high",
          description: "最后一页类型是 closing，应该是 back-cover",
          suggestion: "将 type 改为 back-cover",
        });
      }
    });

    // 3. Check content distribution
    const contentCount = slides.filter((s) => s.type === "content").length;
    const twoColumnCount = slides.filter(
      (s) => s.type === "two-columns",
    ).length;
    const totalContent = contentCount + twoColumnCount;

    if (totalContent > 8 && twoColumnCount === 0) {
      contentLogicScore -= 5;
      issues.push({
        slideNumber: 0,
        type: "monotonous_layout",
        severity: "medium",
        description: `有 ${contentCount} 个 content 页面，布局可能单调`,
        suggestion: "将部分 content 页改为 twoColumns 类型增加视觉变化",
      });
    }

    // 4. Check section distribution
    const sectionCount = slides.filter(
      (s) => s.type === "section" || s.type === "section-divider",
    ).length;
    if (slides.length > 10 && sectionCount < 2) {
      contentLogicScore -= 5;
      issues.push({
        slideNumber: 0,
        type: "insufficient_sections",
        severity: "low",
        description: "缺少章节分隔页",
        suggestion: "在不同主题之间添加 section 页面",
      });
    }

    // Calculate total score
    const totalScore =
      Math.max(0, visualQualityScore) +
      Math.max(0, pageTypeScore) +
      Math.max(0, contentLogicScore) +
      Math.max(0, styleMatchingScore);

    // Generate summary
    let summary = `总分 ${totalScore}/100。`;
    if (totalScore >= 90) {
      summary += " outline 质量优秀，可以直接生成。";
    } else if (totalScore >= 70) {
      summary += " outline 质量良好，有少量可优化项。";
    } else if (totalScore >= 50) {
      summary += " outline 存在一些问题，建议优化。";
    } else {
      summary += " outline 质量较差，强烈建议优化。";
    }

    const highSeverityCount = issues.filter(
      (i) => i.severity === "high",
    ).length;
    if (highSeverityCount > 0) {
      summary += ` 发现 ${highSeverityCount} 个高优先级问题。`;
    }

    res.json({
      totalScore,
      scores: {
        visualQuality: Math.max(0, visualQualityScore),
        pageTypeDistribution: Math.max(0, pageTypeScore),
        contentLogic: Math.max(0, contentLogicScore),
        styleMatching: Math.max(0, styleMatchingScore),
      },
      issues: issues.sort((a, b) => a.slideNumber - b.slideNumber),
      summary,
      recommendation:
        totalScore < 80
          ? "建议优化后重新生成图片，以获得更好的视觉效果。"
          : "outline 质量良好，可以直接生成图片。",
    });
  } catch (error) {
    console.error("Evaluate outline error:", error.message);
    res.status(500).json({ error: "Failed to evaluate outline" });
  }
});

// DELETE /api/drafts/:id - Delete draft solution
app.delete("/api/drafts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await draftsDb.read();
    const index = draftsDb.data.drafts.findIndex((d) => d.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Draft not found" });
    }

    await draftsDb.update((data) => {
      data.drafts.splice(index, 1);
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Delete draft error:", error.message);
    res.status(500).json({ error: "Failed to delete draft" });
  }
});

/**
 * 检测幻灯片的解决方案类型
 * 从幻灯片内容中提取核心解决方案类型，确保图片生成与解决方案主题一致
 * 而不仅仅是行业场景
 */
function detectSolutionType(slide, industry = "") {
  const headline = (slide.keyContent?.headline || "").toLowerCase();
  const body = (slide.keyContent?.body || []).join(" ").toLowerCase();
  const title = (slide.title || "").toLowerCase();
  const allText = `${headline} ${body} ${title}`;

  // 通讯服务类
  if (
    allText.includes("总机") ||
    allText.includes("呼叫中心") ||
    allText.includes("热线")
  ) {
    return {
      type: "Intelligent Switchboard & Call Center",
      visualElements: [
        "professional headset",
        "call interface",
        "customer service representative",
        "phone system",
        "communication dashboard",
      ],
      scene: "modern call center or customer service environment",
    };
  }
  if (allText.includes("客服") || allText.includes("客户服务")) {
    return {
      type: "Customer Service Platform",
      visualElements: [
        "customer support desk",
        "service dashboard",
        "communication interface",
        "help desk",
      ],
      scene: "customer service operation center",
    };
  }
  if (allText.includes("通讯") || allText.includes("通信")) {
    return {
      type: "Communication System",
      visualElements: [
        "network nodes",
        "communication lines",
        "data flow",
        "connection points",
      ],
      scene: "telecommunication infrastructure",
    };
  }

  // 数据分析类
  if (
    allText.includes("数据") ||
    allText.includes("分析") ||
    allText.includes("bi") ||
    allText.includes("报表")
  ) {
    return {
      type: "Data Analytics Solution",
      visualElements: [
        "data charts",
        "analytics dashboard",
        "graphs",
        "KPI displays",
      ],
      scene: "data analytics command center",
    };
  }

  // AI/智能类
  if (
    allText.includes("智能") ||
    allText.includes("ai") ||
    allText.includes("人工智能") ||
    allText.includes("自动化")
  ) {
    return {
      type: "AI-Powered Solution",
      visualElements: [
        "AI brain icon",
        "neural network",
        "automation workflow",
        "intelligent interface",
      ],
      scene: "futuristic AI technology environment",
    };
  }

  // 云服务/平台类
  if (
    allText.includes("云") ||
    allText.includes("平台") ||
    allText.includes("saas")
  ) {
    return {
      type: "Cloud Platform Solution",
      visualElements: [
        "cloud infrastructure",
        "server racks",
        "platform dashboard",
        "connected services",
      ],
      scene: "modern cloud data center",
    };
  }

  // 安全类
  if (
    allText.includes("安全") ||
    allText.includes("防护") ||
    allText.includes("风控")
  ) {
    return {
      type: "Security Solution",
      visualElements: [
        "shield icon",
        "security network",
        "protection layers",
        "monitoring system",
      ],
      scene: "cybersecurity operations center",
    };
  }

  // 默认：通用商务解决方案
  return {
    type: "Business Solution",
    visualElements: [
      "business professionals",
      "workflow diagram",
      "process optimization",
      "value chain",
    ],
    scene: "modern business environment",
  };
}

// Helper function: Generate illustration image for a slide
// Now generates illustrations (not full-screen backgrounds) to be placed on template
// Uses Volcengine API (primary) with AIHubMix as fallback
// Now supports industry-specific visual customization
async function generateSlideImage(
  slide,
  styleInstructions,
  styleKey = "minimal",
  industry = "",
) {
  const visualDesc = slide.visual || "";
  const layout = slide.layout || "";
  const keyContent = slide.keyContent || {};
  const slideType = slide.type || "content";

  // 检测解决方案类型 - 确保图片主题与解决方案一致
  const solutionType = detectSolutionType(slide, industry);

  // Get style configuration
  const styleConfig = SLIDE_STYLES[styleKey] || SLIDE_STYLES.minimal;

  // Get industry configuration for visual customization
  const industryConfig = getIndustryConfig(industry);

  // Build ILLUSTRATION prompt (not background)
  // Use illustrationInstructions for inset illustrations, not visualInstructions (which is for backgrounds)
  const contentTheme = keyContent.headline || slideType || "Business concept";

  // Get illustration-specific style instructions
  const illustrationStyle =
    styleConfig.illustrationInstructions || styleConfig.visualInstructions;

  // === THE ARCHITECT APPROACH (inspired by baoyu-skills) ===
  // Core Philosophy: Create memorable visual stories, NOT icon collections
  // Each illustration should convey ONE clear message through ONE dominant subject

  // === FIX: 正确的主题应该是"解决方案类型+行业场景"，而不仅仅是行业场景 ===
  // 修复前：只使用 visualDesc（如"现代化医院外景"），导致生成医院建筑图片
  // 修复后：结合 solutionType.type（如"智能总机系统"）+ 行业场景
  const primarySubject = solutionType.type;
  const sceneContext = industry
    ? `in ${industry} environment`
    : solutionType.scene;
  const enhancedVisualDesc = visualDesc
    ? `${primarySubject} - ${sceneContext}. Visual focus: ${solutionType.visualElements.slice(0, 2).join(", ")}`
    : `${primarySubject} in ${sceneContext}`;

  let prompt = `# Professional Business Presentation Illustration

## Subject (CRITICAL - Read Carefully)
SOLUTION TYPE: ${primarySubject}
SCENE CONTEXT: ${sceneContext}
VISUAL FOCUS: ${solutionType.visualElements.slice(0, 3).join(", ")}

IMPORTANT: This is a ${primarySubject} presentation, NOT just ${industry || "generic"} industry imagery.
${visualDesc ? `Original scene description: ${visualDesc}` : ""}

## Style Requirements
${illustrationStyle}

## Solution Type Visual Elements (PRIORITY - Use These)
Primary Elements: ${solutionType.visualElements.slice(0, 4).join(", ")}
Scene Setting: ${solutionType.scene}

${
  industry
    ? `## Industry Context (Secondary - Enhances Solution Type)
Industry: ${industry}
Industry Style: ${industryConfig.style}
Color Accent: ${industryConfig.colorTones}`
    : ""
}

## Technical Constraints (CRITICAL)
- **Resolution**: 1024x768 pixels (4:3 aspect ratio)
- **Style**: Clean flat design with solid colors
- **Contrast**: Minimum 4.5:1 contrast ratio for projection on large screens
- **Background**: Simple solid color or subtle gradient
- **Quality**: Professional commercial illustration standard

## Negative Constraints (DO NOT INCLUDE)
- NO text, numbers, letters, or words in any language
- NO logos, watermarks, trademarks, or brand identifiers
- NO realistic photographs or photorealistic renders
- NO cluttered layouts with multiple equal-sized elements
- NO icon grids (2x2, 3x3, 4x4) or checkerboard patterns
- NO scattered small icons across the frame
- NO low contrast or washed-out colors
- CRITICAL: NO generic industry imagery that doesn't show the solution type

## Composition Guidelines
- Create ONE main focal point that occupies 60-80% of the canvas
- Use rule-of-thirds for dynamic, professional composition
- Include adequate breathing room (margins) around the main subject
- Build complete scenes with context, NOT isolated icons
- Maintain clear visual hierarchy (main subject > details > background)
- Use supporting visual elements that enhance the narrative

## Additional Context
${keyContent.subHeadline ? `Subtitle: ${keyContent.subHeadline}` : ""}
${keyContent.body && keyContent.body.length > 0 ? `Key Points: ${keyContent.body.slice(0, 2).join(" | ")}` : ""}

## Output
Generate ONE high-quality business presentation illustration that:
- Clearly communicates the SOLUTION TYPE: "${primarySubject}"
- Shows the solution in action: ${sceneContext}
- Uses solution-specific visual elements: ${solutionType.visualElements.slice(0, 3).join(", ")}
- Matches the ${styleConfig.name} aesthetic exactly
- Is suitable for projection on large screens
- Has no text, numbers, logos, or watermarks
- Has minimum 4.5:1 contrast ratio for readability`;

  // Try primary channel (Volcengine) first
  const apiProviders = [
    {
      name: "Volcengine (字节火山)",
      url: `${process.env.VOLCENGINE_BASE_URL}/images/generations`,
      model: process.env.VOLCENGINE_MODEL,
      apiKey: process.env.VOLCENGINE_API_KEY,
      size: "2K", // Volcengine 要求至少 3686400 像素，2K 满足要求
    },
    {
      name: "AIHubMix (备用)",
      url: `${process.env.AIHUBMIX_BASE_URL}/v1/models/${process.env.AIHUBMIX_MODEL}/predictions`,
      model: null, // AIHubMix uses different format
      apiKey: process.env.AIHUBMIX_API_KEY,
      size: "1024x1024", // AIHubMix 可能不支持 2K，保持原尺寸
    },
  ];

  let lastError = null;

  for (const provider of apiProviders) {
    try {
      console.log(
        `[Slide Gen] Trying ${provider.name} for slide ${slide.number}: ${slide.filename}`,
      );

      let response;
      if (provider.name === "Volcengine (字节火山)") {
        // Volcengine API format (按照官方文档)
        response = await axios.post(
          provider.url,
          {
            model: provider.model,
            prompt: prompt,
            size: provider.size,
            watermark: false, // 不添加水印
          },
          {
            headers: {
              Authorization: `Bearer ${provider.apiKey}`,
              "Content-Type": "application/json",
            },
            timeout: 60000,
          },
        );
      } else {
        // AIHubMix API format
        response = await axios.post(
          provider.url,
          {
            input: {
              prompt: prompt,
              size: provider.size,
              sequential_image_generation: "disabled",
              stream: false,
              response_format: "url",
              watermark: false,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${provider.apiKey}`,
              "Content-Type": "application/json",
            },
            timeout: 60000,
          },
        );
      }

      // Extract URL from response
      let imageUrl = null;

      // Volcengine response format: { data: [{ url: "..." }] }
      if (response.data?.data && response.data.data[0]?.url) {
        imageUrl = response.data.data[0].url;
      }
      // AIHubMix response format: { output: [{ url: "..." }] }
      else if (response.data?.output && response.data.output[0]?.url) {
        imageUrl = response.data.output[0].url;
      }

      if (imageUrl) {
        console.log(
          `[Slide Gen] Success with ${provider.name}: ${slide.filename} -> ${imageUrl}`,
        );
        return imageUrl;
      } else {
        console.error(
          `[Slide Gen] Unexpected response format from ${provider.name}:`,
          JSON.stringify(response.data),
        );
        throw new Error(`Invalid response from ${provider.name}`);
      }
    } catch (error) {
      lastError = error;
      console.error(
        `[Slide Gen] ${provider.name} failed for ${slide.filename}:`,
        error.message,
      );
      if (error.response) {
        console.error(
          `[Slide Gen] API Response (${provider.name}): ${error.response.status}`,
          JSON.stringify(error.response.data),
        );
      }
      // Try next provider
      continue;
    }
  }

  // All providers failed
  console.error(`[Slide Gen] All providers failed for ${slide.filename}`);
  throw lastError || new Error("All image generation providers failed");
}

// POST /api/drafts/:id/generate-samples - Generate sample slide images for preview
app.post("/api/drafts/:id/generate-samples", async (req, res) => {
  try {
    const { id } = req.params;
    const { style = "minimal", count = 3 } = req.body;

    await draftsDb.read();
    const draftIndex = draftsDb.data.drafts.findIndex((d) => d.id === id);

    if (draftIndex === -1) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const draft = draftsDb.data.drafts[draftIndex];

    if (
      !draft.outline ||
      !draft.outline.slides ||
      draft.outline.slides.length === 0
    ) {
      return res.status(400).json({ error: "Draft has no outline" });
    }

    const slides = draft.outline.slides;

    // Select representative slides for samples
    const sampleIndices = [];

    // Always include first slide (cover)
    if (slides[0]?.type === "cover") {
      sampleIndices.push(0);
    }

    // Include a content/two-column slide from the middle
    const firstContentIndex = slides.findIndex(
      (s) => s.type === "content" || s.type === "two-columns",
    );
    if (firstContentIndex !== -1 && firstContentIndex !== 0) {
      sampleIndices.push(firstContentIndex);
    }

    // Include last slide if it's back-cover/closing
    if (slides.length > 1) {
      const lastIndex = slides.length - 1;
      const lastSlide = slides[lastIndex];
      if (lastSlide?.type === "back-cover" || lastSlide?.type === "closing") {
        sampleIndices.push(lastIndex);
      }
    }

    // If we still don't have enough samples, add more from the middle
    if (sampleIndices.length < count) {
      const middleIndex = Math.floor(slides.length / 2);
      if (!sampleIndices.includes(middleIndex)) {
        sampleIndices.push(middleIndex);
      }
    }

    // Remove duplicates and sort
    const uniqueIndices = [...new Set(sampleIndices)]
      .sort((a, b) => a - b)
      .slice(0, count);

    console.log(
      `[Sample Gen] Generating ${uniqueIndices.length} sample slides for draft ${id}: indices [${uniqueIndices.join(", ")}]`,
    );

    // Initialize sampleImages array if not exists
    if (!draft.sampleImages) {
      draft.sampleImages = [];
    }

    // Generate images for selected slides
    const results = [];
    for (const index of uniqueIndices) {
      const slide = slides[index];
      try {
        console.log(
          `[Sample Gen] Generating sample for slide ${index + 1}: ${slide.filename}`,
        );

        const imageUrl = await generateSlideImage(
          slide,
          draft.outline.styleInstructions || "",
          style,
          draft.industry || "",
        );

        const result = {
          slideNumber: slide.number,
          filename: `${slide.filename}.png`,
          index: index,
          url: imageUrl,
          type: slide.type,
          visual: slide.visual,
        };

        draft.sampleImages[index] = result;
        results.push(result);

        console.log(
          `[Sample Gen] Sample generated for slide ${index + 1}: ${imageUrl}`,
        );
      } catch (error) {
        console.error(
          `[Sample Gen] Failed to generate sample for slide ${index + 1}:`,
          error.message,
        );
        results.push({
          slideNumber: slide.number,
          filename: `${slide.filename}.png`,
          index: index,
          url: null,
          error: error.message,
          type: slide.type,
          visual: slide.visual,
        });
      }
    }

    // Save to database
    draft.updatedAt = new Date().toISOString();
    await draftsDb.update((data) => {
      data.drafts[draftIndex] = draft;
    });

    res.json({
      message: "Sample generation completed",
      draftId: id,
      samples: results,
      totalSlides: slides.length,
      style: style,
    });
  } catch (error) {
    console.error("Generate samples error:", error.message);
    res.status(500).json({ error: "Failed to generate samples" });
  }
});

// POST /api/drafts/:id/generate-slides - Generate all slide images
app.post("/api/drafts/:id/generate-slides", async (req, res) => {
  try {
    const { id } = req.params;
    const { style = "minimal" } = req.body; // Get style from request body

    await draftsDb.read();
    const draftIndex = draftsDb.data.drafts.findIndex((d) => d.id === id);

    if (draftIndex === -1) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const draft = draftsDb.data.drafts[draftIndex];

    if (!draft.outline || !draft.outline.slides) {
      return res.status(400).json({ error: "Draft has no outline" });
    }

    if (draft.status === "generating" || draft.status === "completed") {
      return res.json({
        message: "Already generating or completed",
        status: draft.status,
        progress: draft.generationProgress,
      });
    }

    // Update status to generating
    draft.status = "generating";
    await draftsDb.update((data) => {
      data.drafts[draftIndex] = draft;
    });

    console.log(
      `[Slide Gen] Starting generation for draft ${id}: ${draft.outline.slideCount} slides, style: ${style}`,
    );

    // Start background generation with style
    generateSlidesInBackground(draft, draftIndex, style).catch((error) => {
      console.error(`[Slide Gen] Background task failed:`, error);
    });

    res.json({
      message: "Generation started",
      draftId: id,
      totalSlides: draft.outline.slideCount,
      style: style,
    });
  } catch (error) {
    console.error("Generate slides error:", error.message);
    res.status(500).json({ error: "Failed to start generation" });
  }
});

// Background function to generate slides with concurrency control
async function generateSlidesInBackground(
  draft,
  draftIndex,
  styleKey = "minimal",
) {
  const { outline } = draft;
  const concurrency = 3; // Generate 3 slides at a time
  const slides = outline.slides || [];

  // Initialize generationProgress if missing or has wrong structure
  if (
    !draft.generationProgress ||
    typeof draft.generationProgress !== "object"
  ) {
    draft.generationProgress = {};
  }
  if (
    !draft.generationProgress.slides ||
    typeof draft.generationProgress.slides !== "object"
  ) {
    draft.generationProgress.slides = {};
  }
  if (typeof draft.generationProgress.completed !== "number") {
    draft.generationProgress.completed = 0;
  }
  if (typeof draft.generationProgress.failed !== "number") {
    draft.generationProgress.failed = 0;
  }
  if (typeof draft.generationProgress.total !== "number") {
    draft.generationProgress.total = slides.length;
  }

  console.log(
    `[Slide Gen] Processing ${slides.length} slides with concurrency ${concurrency}, style: ${styleKey}`,
  );

  // === 智能过滤：只生成需要图片的幻灯片 ===
  const slidesToGenerate = [];
  const skippedSlides = [];

  for (const slide of slides) {
    const decision = shouldGenerateImageSmart(slide, slide.number);
    if (decision.shouldGenerate) {
      slidesToGenerate.push(slide);
      console.log(
        `[Slide Gen] Slide ${slide.number} (${slide.type}): 需要生成图片 - ${decision.reason}`,
      );
    } else {
      skippedSlides.push(slide);
      console.log(
        `[Slide Gen] Slide ${slide.number} (${slide.type}): 跳过 - ${decision.reason}`,
      );
      // 标记为跳过（不需要图片）
      draft.generationProgress.slides[slide.filename] = {
        status: "skipped",
        url: null,
        error: null,
      };
    }
  }

  console.log(
    `[Slide Gen] Smart filtering: ${slidesToGenerate.length} slides to generate, ${skippedSlides.length} skipped (cost saving)`,
  );

  for (let i = 0; i < slidesToGenerate.length; i += concurrency) {
    const batch = slidesToGenerate.slice(i, i + concurrency);

    await Promise.all(
      batch.map(async (slide) => {
        try {
          // Update progress to generating
          draft.generationProgress.slides[slide.filename] = {
            status: "generating",
            url: null,
            error: null,
          };

          await draftsDb.update((data) => {
            data.drafts[draftIndex] = draft;
          });

          // Generate image with style and industry context
          const imageUrl = await generateSlideImage(
            slide,
            outline.styleInstructions,
            styleKey,
            draft.industry || "",
          );

          // Update progress to completed
          draft.generationProgress.slides[slide.filename] = {
            status: "completed",
            url: imageUrl,
            error: null,
          };
          draft.generationProgress.completed++;
          draft.slideImages.push({
            number: slide.number,
            filename: `${slide.filename}.png`,
            url: imageUrl,
          });
          draft.updatedAt = new Date().toISOString();

          await draftsDb.update((data) => {
            data.drafts[draftIndex] = draft;
          });

          console.log(
            `[Slide Gen] Progress: ${draft.generationProgress.completed}/${draft.generationProgress.total}`,
          );
        } catch (error) {
          // Update progress to failed
          draft.generationProgress.slides[slide.filename] = {
            status: "failed",
            url: null,
            error: error.message,
          };
          draft.generationProgress.failed++;
          draft.updatedAt = new Date().toISOString();

          await draftsDb.update((data) => {
            data.drafts[draftIndex] = draft;
          });

          console.error(
            `[Slide Gen] Failed: ${slide.filename} - ${error.message}`,
          );
        }
      }),
    );
  }

  // Mark as completed
  draft.status = "completed";
  draft.currentStyle = styleKey; // Store the style that was used to generate these images
  draft.updatedAt = new Date().toISOString();

  await draftsDb.update((data) => {
    data.drafts[draftIndex] = draft;
  });

  console.log(
    `[Slide Gen] All slides generated for draft ${draft.id}, style: ${styleKey}`,
  );
}

// GET /api/drafts/:id/progress - Get generation progress
app.get("/api/drafts/:id/progress", async (req, res) => {
  try {
    const { id } = req.params;

    await draftsDb.read();
    const draft = draftsDb.data.drafts.find((d) => d.id === id);

    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }

    res.json({
      status: draft.status,
      progress: draft.generationProgress,
      slideImages: draft.slideImages,
    });
  } catch (error) {
    console.error("Get progress error:", error.message);
    res.status(500).json({ error: "Failed to get progress" });
  }
});

const SUPPORTED_PREFERRED_LAYOUTS = new Set([
  "left-circle",
  "right-rounded",
  "top-banner",
  "left-float",
  "text-only",
  "right-circle",
]);

function parseSlideNumberParam(value) {
  const slideNumber = Number.parseInt(value, 10);
  return Number.isFinite(slideNumber) && slideNumber > 0 ? slideNumber : null;
}

function ensureDraftVisualState(draft) {
  if (!Array.isArray(draft.slideImages)) {
    draft.slideImages = [];
  }
  if (!draft.generationProgress || typeof draft.generationProgress !== "object") {
    draft.generationProgress = {
      total: draft.outline?.slides?.length || 0,
      completed: 0,
      failed: 0,
      slides: {},
    };
  }
  if (
    !draft.generationProgress.slides ||
    typeof draft.generationProgress.slides !== "object"
  ) {
    draft.generationProgress.slides = {};
  }
}

function findDraftSlide(draft, slideNumber) {
  const slides = Array.isArray(draft?.outline?.slides) ? draft.outline.slides : [];
  const slideIndex = slides.findIndex(
    (slide, index) => (slide?.number || index + 1) === slideNumber,
  );

  return {
    slides,
    slideIndex,
    slide: slideIndex >= 0 ? slides[slideIndex] : null,
  };
}

// POST /api/drafts/:id/slides/:slideNumber/layout - Override a single slide layout
app.post("/api/drafts/:id/slides/:slideNumber/layout", async (req, res) => {
  try {
    const { id, slideNumber: slideNumberParam } = req.params;
    const slideNumber = parseSlideNumberParam(slideNumberParam);
    const preferredLayout =
      typeof req.body?.preferredLayout === "string" &&
      req.body.preferredLayout.trim()
        ? req.body.preferredLayout.trim()
        : null;

    if (!slideNumber) {
      return res.status(400).json({ error: "Invalid slide number" });
    }

    if (preferredLayout && !SUPPORTED_PREFERRED_LAYOUTS.has(preferredLayout)) {
      return res.status(400).json({ error: "Unsupported preferred layout" });
    }

    await draftsDb.read();
    const draftIndex = draftsDb.data.drafts.findIndex((d) => d.id === id);
    if (draftIndex === -1) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const draft = draftsDb.data.drafts[draftIndex];
    const { slide } = findDraftSlide(draft, slideNumber);

    if (!slide) {
      return res.status(404).json({ error: "Slide not found" });
    }

    ensureDraftVisualState(draft);

    if (preferredLayout) {
      slide.preferredLayout = preferredLayout;
    } else {
      delete slide.preferredLayout;
    }

    if (preferredLayout === "text-only") {
      draft.slideImages = draft.slideImages.filter((image) => image.number !== slideNumber);
      draft.generationProgress.slides[slide.filename] = {
        status: "skipped",
        url: null,
        error: null,
      };
    }

    draft.sampleImages = [];
    draft.updatedAt = new Date().toISOString();

    await draftsDb.update((data) => {
      data.drafts[draftIndex] = draft;
    });

    res.json({
      draft,
      slide,
      slideNumber,
      preferredLayout: slide.preferredLayout || null,
    });
  } catch (error) {
    console.error("Update slide layout error:", error.message);
    res.status(500).json({ error: "Failed to update slide layout" });
  }
});

// POST /api/drafts/:id/slides/:slideNumber/regenerate-image - Regenerate one slide image
app.post(
  "/api/drafts/:id/slides/:slideNumber/regenerate-image",
  async (req, res) => {
    try {
      const { id, slideNumber: slideNumberParam } = req.params;
      const slideNumber = parseSlideNumberParam(slideNumberParam);
      const style =
        typeof req.body?.style === "string" && req.body.style.trim()
          ? req.body.style.trim()
          : null;

      if (!slideNumber) {
        return res.status(400).json({ error: "Invalid slide number" });
      }

      await draftsDb.read();
      const draftIndex = draftsDb.data.drafts.findIndex((d) => d.id === id);
      if (draftIndex === -1) {
        return res.status(404).json({ error: "Draft not found" });
      }

      const draft = draftsDb.data.drafts[draftIndex];
      const { slide } = findDraftSlide(draft, slideNumber);

      if (!slide) {
        return res.status(404).json({ error: "Slide not found" });
      }

      ensureDraftVisualState(draft);

      const imageDecision = shouldGenerateImageSmart(slide, slideNumber);
      const existingImageIndex = draft.slideImages.findIndex(
        (image) => image.number === slideNumber,
      );
      const hasExistingImage = existingImageIndex !== -1;

      if (!imageDecision.shouldGenerate && !hasExistingImage) {
        return res.status(400).json({
          error: "Current slide strategy does not require an image",
          reason: imageDecision.reason,
        });
      }

      const styleKey = style || draft.currentStyle || "minimal";
      draft.generationProgress.slides[slide.filename] = {
        status: "generating",
        url: null,
        error: null,
      };

      await draftsDb.update((data) => {
        data.drafts[draftIndex] = draft;
      });

      try {
        const imageUrl = await generateSlideImage(
          slide,
          draft.outline?.styleInstructions || "",
          styleKey,
          draft.industry || "",
        );

        const slideImage = {
          number: slideNumber,
          filename: `${slide.filename}.png`,
          url: imageUrl,
        };

        if (existingImageIndex === -1) {
          draft.slideImages.push(slideImage);
          draft.generationProgress.completed++;
        } else {
          draft.slideImages[existingImageIndex] = slideImage;
        }

        draft.generationProgress.slides[slide.filename] = {
          status: "completed",
          url: imageUrl,
          error: null,
        };
        draft.currentStyle = styleKey;
        draft.updatedAt = new Date().toISOString();

        await draftsDb.update((data) => {
          data.drafts[draftIndex] = draft;
        });

        return res.json({
          draft,
          slideImage,
          slideNumber,
        });
      } catch (error) {
        draft.generationProgress.slides[slide.filename] = {
          status: "failed",
          url: null,
          error: error.message,
        };
        draft.generationProgress.failed++;
        draft.updatedAt = new Date().toISOString();

        await draftsDb.update((data) => {
          data.drafts[draftIndex] = draft;
        });

        console.error("Regenerate slide image error:", error.message);
        return res.status(500).json({ error: "Failed to regenerate slide image" });
      }
    } catch (error) {
      console.error("Regenerate slide image error:", error.message);
      res.status(500).json({ error: "Failed to regenerate slide image" });
    }
  },
);

// POST /api/drafts/:id/retry-failed - Retry failed slide generation
app.post("/api/drafts/:id/retry-failed", async (req, res) => {
  try {
    const { id } = req.params;

    await draftsDb.read();
    const draftIndex = draftsDb.data.drafts.findIndex((d) => d.id === id);

    if (draftIndex === -1) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const draft = draftsDb.data.drafts[draftIndex];

    if (!draft.outline || !draft.outline.slides) {
      return res.status(400).json({ error: "Draft has no outline" });
    }

    // Find failed slides
    const failedSlides = draft.outline.slides.filter(
      (slide) =>
        draft.generationProgress.slides[slide.filename]?.status === "failed",
    );

    if (failedSlides.length === 0) {
      return res.json({
        message: "No failed slides to retry",
        failedSlides: [],
      });
    }

    console.log(
      `[Retry] Retrying ${failedSlides.length} failed slides for draft ${id}`,
    );

    // Reset failed slides to pending
    for (const slide of failedSlides) {
      draft.generationProgress.slides[slide.filename] = {
        status: "pending",
        url: null,
        error: null,
      };
    }
    draft.generationProgress.failed = 0;
    await draftsDb.update((data) => {
      data.drafts[draftIndex] = draft;
    });

    // Start background retry
    retryFailedSlides(draft, draftIndex, failedSlides).catch((error) => {
      console.error(`[Retry] Background task failed:`, error);
    });

    res.json({
      message: "Retry started",
      draftId: id,
      retryCount: failedSlides.length,
      slides: failedSlides.map((s) => s.filename),
    });
  } catch (error) {
    console.error("Retry failed slides error:", error.message);
    res.status(500).json({ error: "Failed to start retry" });
  }
});

// Background function to retry failed slides
async function retryFailedSlides(draft, draftIndex, failedSlides) {
  const { outline } = draft;
  const concurrency = 2; // Fewer concurrent requests for retry

  console.log(
    `[Retry] Processing ${failedSlides.length} failed slides with concurrency ${concurrency}`,
  );

  for (let i = 0; i < failedSlides.length; i += concurrency) {
    const batch = failedSlides.slice(i, i + concurrency);

    await Promise.all(
      batch.map(async (slide) => {
        try {
          // Update progress to generating
          draft.generationProgress.slides[slide.filename] = {
            status: "generating",
            url: null,
            error: null,
          };

          await draftsDb.update((data) => {
            data.drafts[draftIndex] = draft;
          });

          // Generate image with industry context
          const imageUrl = await generateSlideImage(
            slide,
            outline.styleInstructions,
            "minimal",
            draft.industry || "",
          );

          // Update progress to completed
          draft.generationProgress.slides[slide.filename] = {
            status: "completed",
            url: imageUrl,
            error: null,
          };
          draft.generationProgress.completed++;
          draft.slideImages.push({
            number: slide.number,
            filename: `${slide.filename}.png`,
            url: imageUrl,
          });
          draft.updatedAt = new Date().toISOString();

          await draftsDb.update((data) => {
            data.drafts[draftIndex] = draft;
          });

          console.log(`[Retry] Success: ${slide.filename}`);
        } catch (error) {
          // Update progress to failed
          draft.generationProgress.slides[slide.filename] = {
            status: "failed",
            url: null,
            error: error.message,
          };
          draft.generationProgress.failed++;
          draft.updatedAt = new Date().toISOString();

          await draftsDb.update((data) => {
            data.drafts[draftIndex] = draft;
          });

          console.error(`[Retry] Failed: ${slide.filename} - ${error.message}`);
        }
      }),
    );
  }

  console.log(`[Retry] Retry completed for draft ${draft.id}`);
}

// GET /api/drafts/:id/export-ppt - Export draft as PowerPoint
app.get("/api/drafts/:id/export-ppt", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      template = "business",
      useTemplateFile = "false",
      style = "minimal",
      useStyled = "false",
    } = req.query;

    await draftsDb.read();
    const draftIndex = draftsDb.data.drafts.findIndex((d) => d.id === id);
    const draft = draftsDb.data.drafts[draftIndex];

    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }

    console.log(
      `[PPT Export] Exporting draft: ${draft.title}, style: ${style} (for illustrations)`,
    );

    // Check if image generation is needed
    // 1. No images yet
    // 2. Style has changed
    const currentStyle = draft.currentStyle || "minimal"; // Default to minimal if not set
    const styleChanged = style && style !== currentStyle;
    const needImageGeneration =
      draft.outline &&
      (!draft.slideImages || draft.slideImages.length === 0 || styleChanged);

    if (needImageGeneration) {
      if (styleChanged) {
        console.log(
          `[PPT Export] Style changed from ${currentStyle} to ${style}, clearing old images and regenerating...`,
        );
        // Clear existing images and progress for regeneration
        draft.slideImages = [];
        draft.generationProgress = null; // Will be re-initialized
        draft.status = "outline"; // Reset status to allow regeneration
      } else {
        console.log(
          `[PPT Export] No slide images found, starting image generation...`,
        );
      }

      // Initialize generation progress if not exists or was cleared
      if (!draft.generationProgress) {
        const slidesCount = draft.outline.slides?.length || 0;
        draft.generationProgress = {
          total: slidesCount,
          completed: 0,
          failed: 0,
          slides: {},
        };
      }

      // Store the current style
      draft.currentStyle = style;

      await draftsDb.update((data) => {
        data.drafts[draftIndex] = draft;
      });

      // Return JSON response indicating generation is needed
      return res.json({
        status: "generating",
        message: styleChanged
          ? `风格已更换为 ${style}，正在重新生成图片...`
          : "正在生成幻灯片图片，请稍候...",
        draftId: draft.id,
        totalSlides: draft.generationProgress.total,
        style: style,
      });
    }

    // Store the style for future reference
    if (!draft.currentStyle) {
      draft.currentStyle = style;
      await draftsDb.update((data) => {
        data.drafts[draftIndex] = draft;
      });
    }

    let pptBuffer;

    // Always use template as the base for consistent styling
    if (draft.outline) {
      console.log(
        `[PPT Export] Using template as master design with style: ${style}`,
      );
      const templatePath =
        process.env.PPT_TEMPLATE_PATH || "./public/template.pptx";
      const outlineWithImages = {
        ...draft.outline,
        slideImages: draft.slideImages || [],
      };
      // 使用混合生成方式：封面用AI背景，内容页用模板布局
      pptBuffer = await generateHybridPPT(
        outlineWithImages,
        templatePath,
        draft.title,
        style,
      );
    } else {
      // Fallback: No outline, use markdown-based generation
      console.log(
        `[PPT Export] No outline found, using markdown-based generation`,
      );
      const presentation = parseMarkdownToSlides(draft.content, draft.title);
      console.log(`[PPT Export] Parsed ${presentation.slides.length} slides`);
      pptBuffer = await generatePPT(presentation, template);
    }

    console.log(`[PPT Export] Generated PPT, size: ${pptBuffer.length} bytes`);

    // Set headers for download
    const fileName = `${draft.title.replace(/[\/\\?%*:|"<>]/g, "_")}.pptx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileName)}"`,
    );

    // Send the buffer
    res.send(pptBuffer);
  } catch (error) {
    console.error("Export PPT error:", error.message);
    res.status(500).json({ error: "Failed to export PPT" });
  }
});

// GET /api/ppt/templates - Get available PPT templates
app.get("/api/ppt/templates", (req, res) => {
  try {
    const templates = getTemplates();
    res.json(templates);
  } catch (error) {
    console.error("Get templates error:", error.message);
    res.status(500).json({ error: "Failed to get templates" });
  }
});

// GET /api/ppt/styles - Get available PPT styles for styled generation
app.get("/api/ppt/styles", (req, res) => {
  try {
    const styles = Object.entries(SLIDE_STYLES).map(([key, config]) => ({
      key,
      name: config.name,
      description: config.visualInstructions.split(".")[0],
      colors: config.colors,
      fontFamily: config.fontFamily,
    }));
    res.json(styles);
  } catch (error) {
    console.error("Get styles error:", error.message);
    res.status(500).json({ error: "Failed to get styles" });
  }
});

// POST /api/test/image-generation - Test AIHubMix image generation
app.post("/api/test/image-generation", async (req, res) => {
  try {
    const {
      prompt = 'A professional business presentation slide with title "Welcome" and clean layout',
    } = req.body;

    console.log("[Test Image Gen] Calling AIHubMix API...");

    const response = await axios.post(
      `${process.env.AIHUBMIX_BASE_URL}/v1/images/generations`,
      {
        model: process.env.AIHUBMIX_MODEL,
        prompt: `Create a professional presentation slide (16:9 aspect ratio) with the following content:\n\n${prompt}\n\nStyle: Corporate business style with blue and gold colors. Clean, modern layout with professional typography. No slide numbers or footers.`,
        size: "2K",
        n: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.AIHUBMIX_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      },
    );

    if (
      response.data &&
      response.data.data &&
      response.data.data[0] &&
      response.data.data[0].url
    ) {
      const imageUrl = response.data.data[0].url;
      console.log("[Test Image Gen] Success! Image URL:", imageUrl);
      res.json({
        success: true,
        imageUrl: imageUrl,
        message: "Image generated successfully",
      });
    } else {
      console.error(
        "[Test Image Gen] Unexpected response format:",
        JSON.stringify(response.data),
      );
      throw new Error("Invalid response format from AIHubMix");
    }
  } catch (error) {
    console.error("[Test Image Gen] Error:", error.message);
    if (error.response) {
      console.error(
        "[Test Image Gen] API Response:",
        error.response.status,
        JSON.stringify(error.response.data),
      );
    }
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data,
    });
  }
});

const PORT = process.env.PORT || 3001;
const HOST = "0.0.0.0"; // 允许内网访问

// 获取本机 IP 地址
function getLocalIP() {
  const interfaces = require("os").networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

app.listen(PORT, HOST, () => {
  const localIP = getLocalIP();
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`内网访问地址: http://${localIP}:${PORT}`);
});
