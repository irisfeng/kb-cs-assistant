const fs = require('fs');

const filePath = 'server/src/index.js';
let content = fs.readFileSync(filePath, 'utf8');

// 查找并替换旧的 FastGPT Markdown 生成逻辑
const searchStr = `const imagePlaceholderCount = (cleanedMarkdown.match(/!\\[.*?\\]\\(.*?\\.(?:png|jpg|jpeg|gif|webp).*?\\)/gi) || []).length;
      const fastGptMarkdown = cleanedMarkdown.replace(
        /!\\[([^\\]]*)\\]\\((images\\\\/[^)]+|[^)]+\\.(png|jpg|jpeg|gif|webp))\\)/gi,
        (match, alt) => {
          // 用占位符替换图片
          return alt ? \`[图片: \${alt}]\` : '[图片]';
        },
      );`;

const replaceStr = `const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
      const fastGptMarkdown = cleanedMarkdown.replace(
        /!\\[([^\\]]*)\\]\\((images\\\\/[^)]+|[^)]+\\.(png|jpg|jpeg|gif|webp))\\)/gi,
        (match, alt, imagePath) => {
          const imageName = path.basename(imagePath);
          // 使用绝对 URL，FastGPT 可以访问图片
          const imageUrl = \`\${baseUrl}/images/\${batchId}/\${imageName}\`;
          return \`![\${alt}](\${imageUrl})\`;
        },
      );`;

if (content.includes(searchStr)) {
  content = content.replace(searchStr, replaceStr);
  console.log('✅ 替换成功: fastGptMarkdown 逻辑');
} else {
  console.log('❌ 未找到匹配的旧代码');
  process.exit(1);
}

// 替换 console.log 输出
const logSearch = `console.log(
        \`[MinerU] FastGPT markdown: \${imagePlaceholderCount} images removed (text only for testing)\`,
      );`;

const logReplace = `const imageCount = (cleanedMarkdown.match(/!\\[.*?\\]\\(.*?\\.(?:png|jpg|jpeg|gif|webp).*?\\)/gi) || []).length;
      console.log(
        \`[MinerU] FastGPT markdown: \${imageCount} images with absolute URLs\`,
      );`;

if (content.includes(logSearch)) {
  content = content.replace(logSearch, logReplace);
  console.log('✅ 替换成功: console.log 输出');
} else {
  console.log('❌ 未找到 console.log 语句');
}

// 替换 base64Markdown 注释
const commentSearch = `// base64Markdown 现在只包含文字（测试用）
      const base64Markdown = fastGptMarkdown;`;

const commentReplace = `// base64Markdown 使用带 URL 的版本
      const base64Markdown = fastGptMarkdown;`;

if (content.includes(commentSearch)) {
  content = content.replace(commentSearch, commentReplace);
  console.log('✅ 替换成功: 注释');
} else {
  console.log('❌ 未找到注释');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('\n✅ 修复完成！');
