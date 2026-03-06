const fs = require('fs');

const filePath = 'server/src/index.js';
let content = fs.readFileSync(filePath, 'utf8');

// 查找并替换旧的 FastGPT Markdown 生成逻辑 - 使用行级替换
const lines = content.split('\n');
let modified = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // 查找 const imagePlaceholderCount 行
  if (line.includes('const imagePlaceholderCount') && line.includes('cleanedMarkdown.match')) {
    // 获取缩进
    const indent = line.match(/^(\s*)/)[1];

    // 替换这行及其后续代码块
    lines[i] = `${indent}const baseUrl = process.env.BASE_URL || 'http://localhost:3001';`;
    lines[i+1] = `${indent}const fastGptMarkdown = cleanedMarkdown.replace(`;
    lines[i+2] = `${indent}  /!\\[([^\\]]*)\\]\\((images\\\\/[^)]+|[^)]+\\.(png|jpg|jpeg|gif|webp))\\)/gi,`;
    lines[i+3] = `${indent}  (match, alt, imagePath) => {`;
    lines[i+4] = `${indent}    const imageName = path.basename(imagePath);`;
    lines[i+5] = `${indent}    // 使用绝对 URL，FastGPT 可以访问图片`;
    lines[i+6] = `${indent}    const imageUrl = \\`\\${baseUrl}/images/\\${batchId}/\\${imageName}\\`;`;
    lines[i+7] = `${indent}    return \\`![\\${alt}](\\${imageUrl})\\`;`;
    lines[i+8] = `${indent}  },`;
    lines[i+9] = `${indent});`;

    modified = true;
    console.log('✅ 替换成功: fastGptMarkdown 逻辑 (行', i+1, ')');
    break;
  }
}

if (!modified) {
  console.log('❌ 未找到 imagePlaceholderCount');
  process.exit(1);
}

// 替换 console.log 输出
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('[MinerU] FastGPT markdown:') && line.includes('images removed')) {
    const indent = line.match(/^(\s*)/)[1];
    lines[i] = `${indent}\`[MinerU] FastGPT markdown: \${imageCount} images with absolute URLs\`,`;
    console.log('✅ 替换成功: console.log (行', i+1, ')');
    break;
  }
}

// 添加 imageCount 变量定义
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('const base64Markdown = fastGptMarkdown;')) {
    const indent = line.match(/^(\s*)/)[1];
    // 在这行之前添加 imageCount 定义
    lines.splice(i, 0, `${indent}const imageCount = (cleanedMarkdown.match(/!\\[.*?\\]\\(.*?\\.(?:png|jpg|jpeg|gif|webp).*?\\)/gi) || []).length;`);
    console.log('✅ 添加成功: imageCount 定义 (行', i+1, ')');
    break;
  }
}

// 替换注释
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('// base64Markdown 现在只包含文字（测试用）')) {
    lines[i] = line.replace('// base64Markdown 现在只包含文字（测试用）', '// base64Markdown 使用带 URL 的版本');
    console.log('✅ 替换成功: 注释 (行', i+1, ')');
    break;
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('\n✅ 修复完成！');
