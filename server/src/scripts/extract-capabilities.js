#!/usr/bin/env node

/**
 * Extract Product Capabilities from Solutions
 *
 * This script analyzes existing solutions and extracts structured product capabilities
 * that can be used to build the product capabilities library.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../src/db.json');

/**
 * Extract capabilities from a solution's markdown content
 */
function extractCapabilitiesFromSolution(solution) {
  const markdown = solution.localMarkdown || '';
  const title = solution.title;
  const fileName = solution.fileName;

  // Extract key sections based on common patterns
  const sections = extractSections(markdown);

  // Extract product features
  const features = extractFeatures(markdown, sections);

  // Extract use cases
  const useCases = extractUseCases(markdown, sections);

  // Extract technical specs
  const specs = extractSpecs(markdown, sections);

  // Extract benefits/advantages
  const benefits = extractBenefits(markdown, sections);

  return {
    productName: title,
    category: determineCategory(title, markdown, useCases),
    features: features,
    useCases: useCases,
    technicalSpecs: specs,
    benefits: benefits,
    source: {
      solutionId: solution.id,
      fileName: fileName,
      extractedAt: new Date().toISOString()
    }
  };
}

/**
 * Extract major sections from markdown
 */
function extractSections(markdown) {
  const sections = [];
  const lines = markdown.split('\n');

  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    // Match H1 (# ) or H2 (## ) headers
    const h1Match = line.match(/^#\s+(.+)$/);
    const h2Match = line.match(/^##\s+(.+)$/);

    if (h1Match || h2Match) {
      // Save previous section
      if (currentSection) {
        sections.push({
          title: currentSection,
          content: currentContent.join('\n').trim()
        });
      }

      // Start new section
      currentSection = (h1Match || h2Match)[1];
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    sections.push({
      title: currentSection,
      content: currentContent.join('\n').trim()
    });
  }

  return sections;
}

/**
 * Extract product features
 */
function extractFeatures(markdown, sections) {
  const features = [];

  // Look for feature sections
  const featureSections = sections.filter(s =>
    s.title.includes('功能') ||
    s.title.includes('Feature') ||
    s.title.includes('能力') ||
    s.title.includes('优势')
  );

  for (const section of featureSections) {
    // Extract bullet points as features
    const lines = section.content.split('\n');
    for (const line of lines) {
      // Match bullet points: •, -, *, or numbered lists
      const bulletMatch = line.match(/^[\s]*(?:[•\-\*]|\d+\.)\s*(.+)$/);
      if (bulletMatch) {
        const feature = bulletMatch[1].trim();
        if (feature.length > 0 && feature.length < 200) {
          features.push(feature);
        }
      }
    }
  }

  // If no features found in sections, try extracting from key headings
  if (features.length === 0) {
    const featureKeywords = ['AI', '智能', '自动', '支持', '语音', '呼叫', '客服', '机器人'];
    const lines = markdown.split('\n');
    for (const line of lines) {
      if (featureKeywords.some(kw => line.includes(kw))) {
        const cleanLine = line.replace(/^#+\s*/, '').trim();
        if (cleanLine.length > 5 && cleanLine.length < 100 && !cleanLine.includes('!')) {
          features.push(cleanLine);
        }
      }
      if (features.length >= 10) break;
    }
  }

  return [...new Set(features)].slice(0, 15); // Unique features, max 15
}

/**
 * Extract use cases / scenarios
 */
function extractUseCases(markdown, sections) {
  const useCases = [];

  // Look for use case sections
  const useCaseSections = sections.filter(s =>
    s.title.includes('场景') ||
    s.title.includes('应用') ||
    s.title.includes('案例') ||
    s.title.includes('客户') ||
    s.title.includes('行业')
  );

  for (const section of useCaseSections) {
    // Extract industry/sector mentions
    const industries = ['政务', '金融', '保险', '医疗', '教育', '文旅', '交通', '电商', '政务', '企业'];
    for (const industry of industries) {
      if (section.content.includes(industry)) {
        useCases.push({
          industry: industry,
          description: extractUseCaseDescription(section.content, industry)
        });
      }
    }

    // Extract from bullet points
    const lines = section.content.split('\n');
    for (const line of lines) {
      const bulletMatch = line.match(/^[\s]*[•\-\*]\s*(.+)$/);
      if (bulletMatch) {
        const useCase = bulletMatch[1].trim();
        if (useCase.length > 3 && useCase.length < 100) {
          useCases.push({ industry: '通用', description: useCase });
        }
      }
    }
  }

  return useCases.slice(0, 10);
}

/**
 * Extract use case description for an industry
 */
function extractUseCaseDescription(content, industry) {
  // Find sentences mentioning the industry
  const sentences = content.split(/[。！？\n]/);
  for (const sentence of sentences) {
    if (sentence.includes(industry) && sentence.length > 10 && sentence.length < 150) {
      return sentence.trim();
    }
  }
  return `${industry}行业解决方案`;
}

/**
 * Extract technical specifications
 */
function extractSpecs(markdown, sections) {
  const specs = [];

  // Look for technical sections
  const techSections = sections.filter(s =>
    s.title.includes('技术') ||
    s.title.includes('架构') ||
    s.title.includes('部署') ||
    s.title.includes('集成')
  );

  for (const section of techSections) {
    // Extract technical keywords
    const techKeywords = ['API', 'SDK', '协议', '支持', '并发', '延迟', '准确率'];
    const lines = section.content.split('\n');
    for (const line of lines) {
      if (techKeywords.some(kw => line.includes(kw))) {
        const cleanLine = line.replace(/^#+\s*/, '').replace(/^[\s]*(?:[•\-\*]|\d+\.)\s*/, '').trim();
        if (cleanLine.length > 5 && cleanLine.length < 200) {
          specs.push(cleanLine);
        }
      }
    }
  }

  return [...new Set(specs)].slice(0, 10);
}

/**
 * Extract benefits/advantages
 */
function extractBenefits(markdown, sections) {
  const benefits = [];

  // Look for benefit sections
  const benefitSectionTitles = ['优势', '特点', '价值', '效果', '为什么', '核心', '亮点'];
  const benefitSections = sections.filter(s =>
    benefitSectionTitles.some(keyword => s.title.includes(keyword))
  );

  // Also look for data/效果 sections
  const dataSections = sections.filter(s =>
    s.title.includes('数据') || s.title.includes('成效') || s.title.includes('客户反馈')
  );

  for (const section of [...benefitSections, ...dataSections]) {
    const lines = section.content.split('\n');
    for (const line of lines) {
      // Match bullet points with various formats
      const bulletMatch = line.match(/^[\s]*(?:[•\-\*]|\d+\.)\s*(.+)$/);
      if (bulletMatch) {
        let benefitText = bulletMatch[1].trim();
        // Clean up common artifacts
        benefitText = benefitText.replace(/^[\s\\]+/, '').trim();
        if (benefitText.length > 5 && benefitText.length < 150) {
          benefits.push(benefitText);
        }
      }

      // Also look for lines starting with benefit keywords
      const benefitPrefixes = ['降低', '提升', '改善', '节约', '提高', '减少', '支持', '实现'];
      for (const prefix of benefitPrefixes) {
        if (line.startsWith(prefix) && line.length > 10 && line.length < 100) {
          benefits.push(line.trim());
        }
      }
    }
  }

  // Look for percentage/number-based benefits (e.g., "85% 满意度")
  const allLines = markdown.split('\n');
  for (const line of allLines) {
    const percentMatch = line.match(/(\d+\.?\d*)%\s*(.+)/);
    if (percentMatch) {
      const benefit = `${percentMatch[1]}% ${percentMatch[2].trim()}`;
      if (benefit.length < 100) {
        benefits.push(benefit);
      }
    }
  }

  return [...new Set(benefits)].slice(0, 10);
}

/**
 * Determine product category
 */
function determineCategory(title, markdown, useCases) {
  const categories = {
    '智能客服': ['客服', '客服', '接待', '咨询'],
    '智能外呼': ['外呼', '回访', '通知', '营销'],
    '语音技术': ['语音', 'ASR', 'TTS', '识别', '合成'],
    '呼叫中心': ['呼叫中心', '中继', '云呼'],
    '通信解决方案': ['方案', '解决方案', '通信']
  };

  const combined = (title + ' ' + markdown).toLowerCase();

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(kw => combined.includes(kw))) {
      return category;
    }
  }

  return '通用产品';
}

/**
 * Main extraction function
 */
async function extractCapabilities() {
  console.log('[Extract] Reading solutions database...');

  const dbContent = fs.readFileSync(dbPath, 'utf-8');
  const db = JSON.parse(dbContent);
  const solutions = db.solutions || [];

  console.log(`[Extract] Found ${solutions.length} solutions`);

  const allCapabilities = [];

  for (const solution of solutions) {
    console.log(`[Extract] Processing: ${solution.title}`);

    try {
      const capabilities = extractCapabilitiesFromSolution(solution);
      allCapabilities.push(capabilities);

      console.log(`  - Category: ${capabilities.category}`);
      console.log(`  - Features: ${capabilities.features.length}`);
      console.log(`  - Use Cases: ${capabilities.useCases.length}`);
      console.log(`  - Specs: ${capabilities.technicalSpecs.length}`);
      console.log(`  - Benefits: ${capabilities.benefits.length}`);
    } catch (error) {
      console.error(`[Extract] Error processing ${solution.title}:`, error.message);
    }
  }

  // Generate output
  const outputPath = path.join(__dirname, '../../data/extracted-capabilities.json');
  fs.writeFileSync(outputPath, JSON.stringify(allCapabilities, null, 2), 'utf-8');

  console.log(`\n[Extract] Done! Extracted capabilities for ${allCapabilities.length} solutions`);
  console.log(`[Extract] Output saved to: ${outputPath}`);

  // Generate importable format for capabilities API
  const importable = allCapabilities.map((cap, index) => ({
    id: `cap_${Date.now()}_${index}`,
    name: cap.productName,
    category: cap.category,
    description: `${cap.features.slice(0, 3).join('；')}。${cap.benefits.slice(0, 2).join('，')}`,
    features: cap.features,
    useCases: cap.useCases,
    technicalSpecs: cap.technicalSpecs,
    benefits: cap.benefits,
    source: cap.source
  }));

  const importPath = path.join(__dirname, '../../data/capabilities-import.json');
  fs.writeFileSync(importPath, JSON.stringify({ capabilities: importable }, null, 2), 'utf-8');

  console.log(`[Extract] Importable format saved to: ${importPath}`);
  console.log(`[Extract] You can now import this via POST /api/capabilities/import`);

  return { allCapabilities, importable };
}

// Run extraction
extractCapabilities().catch(console.error);
