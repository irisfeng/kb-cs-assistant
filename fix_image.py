#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re

with open('server/src/index.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 查找并替换代码块
old_code = '''const imagePlaceholderCount = (cleanedMarkdown.match(/!\\[.*?\\]\\(.*?\\.(?:png|jpg|jpeg|gif|webp).*?\\)/gi) || []).length;
      const fastGptMarkdown = cleanedMarkdown.replace(
        /!\\[([^\\]]*)\\]\\((images\\\\/[^)]+|[^)]+\\.(png|jpg|jpeg|gif|webp))\\)/gi,
        (match, alt) => {
          // 用占位符替换图片
          return alt ? `[图片: ${alt}]` : '[图片]';
        },
      );'''

new_code = '''const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
      const fastGptMarkdown = cleanedMarkdown.replace(
        /!\\[([^\\]]*)\\]\\((images\\\\/[^)]+|[^)]+\\.(png|jpg|jpeg|gif|webp))\\)/gi,
        (match, alt, imagePath) => {
          const imageName = path.basename(imagePath);
          // 使用绝对 URL，FastGPT 可以访问图片
          const imageUrl = baseUrl + '/images/' + batchId + '/' + imageName;
          return '![' + alt + '](' + imageUrl + ')';
        },
      );'''

if old_code in content:
    content = content.replace(old_code, new_code)
    print("✅ 替换成功: fastGptMarkdown 逻辑")
else:
    print("❌ 未找到 old_code")

# 替换 console.log
old_log = '''console.log(
        `[MinerU] FastGPT markdown: ${imagePlaceholderCount} images removed (text only for testing)`,
      );'''

new_log = '''const imageCount = (cleanedMarkdown.match(/!\\[.*?\\]\\(.*?\\.(?:png|jpg|jpeg|gif|webp).*?\\)/gi) || []).length;
      console.log(
        `[MinerU] FastGPT markdown: ${imageCount} images with absolute URLs`,
      );'''

if old_log in content:
    content = content.replace(old_log, new_log)
    print("✅ 替换成功: console.log")
else:
    print("❌ 未找到 console.log")

# 替换注释
old_comment = '// base64Markdown 现在只包含文字（测试用）'
new_comment = '// base64Markdown 使用带 URL 的版本'

if old_comment in content:
    content = content.replace(old_comment, new_comment)
    print("✅ 替换成功: 注释")
else:
    print("❌ 未找到注释")

with open('server/src/index.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("\n✅ 修复完成！")
