#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re

with open('server/src/index.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 定义要查找和替换的代码
old_pattern = r'''const imagePlaceholderCount = \(cleanedMarkdown\.match\(/!\\\[.*?\\\]\\\(.*?\\\.(?:png|jpg|jpeg|gif|webp).*?\\\)/gi\) \|\| \[\]\)\.length;
      const fastGptMarkdown = cleanedMarkdown\.replace\(
        /!\\\[\(\[\^\\\]\]\*\)\\\]\\\(\(images\\\\/\[\^\)\]\+\|\[\^\)\]\+\\\.\(png|jpg|jpeg|gif|webp\)\)\\\)/gi,
        \(match, alt\) => \{
          // 用占位符替换图片
          return alt \? `\[图片: \$\{alt\}\]` : '\[图片\]';
        \},
      \);
      console\.log\(
        `\[MinerU\] FastGPT markdown: \$\{imagePlaceholderCount\} images removed \(text only for testing\)`,
      \);

      // base64Markdown 现在只包含文字（测试用）
      const base64Markdown = fastGptMarkdown;'''

# 更简单的方法：直接查找和替换
start_marker = 'const imagePlaceholderCount = (cleanedMarkdown.match'
end_marker = 'const base64Markdown = fastGptMarkdown;'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker) + len(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"❌ 未找到标记: start={start_idx}, end={end_idx}")
    exit(1)

print(f"✅ 找到代码块: 位置 {start_idx} 到 {end_idx}")

old_code = content[start_idx:end_idx]

new_code = '''const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
      const fastGptMarkdown = cleanedMarkdown.replace(
        /!\\[([^\\]]*)\\]\\((images\\\\/[^)]+|[^)]+\\.(png|jpg|jpeg|gif|webp))\\)/gi,
        (match, alt, imagePath) => {
          const imageName = path.basename(imagePath);
          // 使用绝对 URL，FastGPT 可以访问图片
          const imageUrl = baseUrl + '/images/' + batchId + '/' + imageName;
          return '![' + alt + '](' + imageUrl + ')';
        },
      );
      const imageCount = (cleanedMarkdown.match(/!\\[.*?\\]\\(.*?\\.(?:png|jpg|jpeg|gif|webp).*?\\)/gi) || []).length;
      console.log(
        `[MinerU] FastGPT markdown: ${imageCount} images with absolute URLs`,
      );

      // base64Markdown 使用带 URL 的版本
      const base64Markdown = fastGptMarkdown;'''

# 替换
new_content = content[:start_idx] + new_code + content[end_idx:]

with open('server/src/index.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("✅ 修复成功！")
print("\n修改内容:")
print("- 使用 BASE_URL + /images/{batchId}/{imageName} 作为图片 URL")
print("- FastGPT 现在可以显示图片了")
