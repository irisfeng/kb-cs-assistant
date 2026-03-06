import JSZip from 'jszip';
import fs from 'fs';
import axios from 'axios';
import PptxGenJS from 'pptxgenjs';
import {
  chooseContentLayout,
  expandSlidesForRendering,
  getSlideTypography,
  normalizeSlideForLayout,
} from './layout-engine.js';

// ==================== Style Definitions (based on baoyu-skills) ====================

/**
 * Style definitions for slide backgrounds and illustrations
 * Each style has:
 * - visualInstructions: for background image generation
 * - illustrationInstructions: for inset illustration generation
 */
const SLIDE_STYLES = {
  // === Core Principle: ILLUSTRATION MUST BE A COMPLETE SCENE, NOT ICON GRID ===
  // Each illustration should have: SINGLE MAIN SUBJECT + COMPOSITION + STORY + ATMOSPHERE
  // NO: icon grids, multiple elements scattered, checkerboard layouts
  // YES: one main focal point with supporting details, scene-based, storytelling

  minimal: {
    name: '简约风格',
    visualInstructions: `Clean, minimalist design with maximum whitespace. Soft gradient backgrounds in muted corporate colors (navy, slate, cream). Abstract geometric shapes - thin lines, small dots, subtle rectangles. No text or letters in the image. Professional business aesthetic with lots of breathing room. Flat design, no realistic elements.`,
    illustrationInstructions: `MINIMALIST SINGLE-SUBJECT ILLUSTRATION - Create ONE main focal element, not multiple icons. Composition: place the main subject off-center using rule-of-thirds. Subject options (choose ONE most relevant): a large stylized upward arrow on white space, a single circular chart dominating the frame, a hand holding a magnifying glass, a lightbulb with soft glow, a solitary tree on clean horizon. Style: thin 2px clean outlines, flat colors (navy deep navy blue, light blue medium blue, soft gray soft gray). NO grids, NO multiple boxes, NO icon arrays. Leave 60% of canvas as negative space. Japanese Muji simplicity - one idea, beautifully executed.`,
    colors: ['1F4E78', '5B9BD5', 'A5A5A5'],
    fontFamily: 'Microsoft YaHei'
  },
  corporate: {
    name: '商务风格',
    visualInstructions: `Professional corporate design with navy blue and gold accents. Subtle grid patterns in background. Abstract data visualization elements - charts, graphs, icons (bar charts, pie charts, trend lines) rendered as simple shapes. Clean geometric layout. No text or letters. Executive briefing aesthetic. Structured and formal.`,
    illustrationInstructions: `CORPORATE SCENE ILLUSTRATION - Create a BUSINESS SCENE with human elements, not just icons. Composition: diagonal layout from bottom-left to top-right. Main subject options: a professional handshake in foreground (large, detailed), a person presenting to a room with chart behind, a city skyline with office buildings in perspective, a team around a table with one person standing. Style: McKinsey consulting aesthetic - navy blue (deep navy blue), accent red (accent red), gold (gold). Subtle shadows for depth. Clean white or light gray background. NO scattered icons - create a cohesive business scene with depth and perspective.`,
    colors: ['1F4E78', 'C00000', 'FFC000'],
    fontFamily: 'Microsoft YaHei'
  },
  blueprint: {
    name: '蓝图风格',
    visualInstructions: `Technical blueprint aesthetic. Navy blue background with faint grid lines. White and light blue technical drawing elements - dotted lines, dimension markers, technical symbols. Circuit board or network topology patterns. No text or letters. Engineering and architecture feel. Precise, diagrammatic style.`,
    illustrationInstructions: `TECHNICAL BLUEPRINT SCENE - Create a DETAILED TECHNICAL DRAWING of ONE main system, not scattered symbols. Composition: centered symmetrical layout. Main subject options: a complex machine with labeled parts (gears, pipes, gauges), a building cross-section showing floors and rooms, a circuit board with connected chips in a branching pattern, a network topology with central hub and radiating connections. Style: CAD drawing aesthetic - fine 1px white and light blue (light blue) lines on navy (dark navy) background. Dashed dimension lines, technical markers. Create ONE complete technical diagram, not multiple disconnected elements.`,
    colors: ['0E294B', '5B9BD5', '87CEEB'],
    fontFamily: 'Consolas'
  },
  sketch: {
    name: '手绘风格',
    visualInstructions: `Hand-drawn sketch style with warm, friendly feel. Pencil-like textures and uneven lines. Soft pastel colors. Simple doodle illustrations - arrows, boxes, underlines, highlights. Paper texture background. No text or letters. Educational and approachable. Warm and organic.`,
    illustrationInstructions: `HAND-DRAWN SCENE - Create a SKETCHY ILLUSTRATION of ONE main concept, like a notebook doodle brought to life. Composition: asymmetrical with the main subject taking 70% of frame. Main subject options: a large lightbulb with sketchy glow rays, a rocket ship with exhaust trail drawn in pencil, a brain with ideas popping out as small doodles, a mountain peak with a flag on top, a hand giving thumbs-up. Style: intentional pencil texture in brown (warm brown) and tan (tan). Visible paper grain. Imperfect charming lines - make it look like a talented person's notebook sketch. NO grid of small doodles - ONE large detailed sketch.`,
    colors: ['FFF8DC', 'D2B48C', '8B4513'],
    fontFamily: 'KaiTi'
  },
  editorial: {
    name: '杂志风格',
    visualInstructions: `Bold editorial magazine design. High contrast with dramatic typography backgrounds (but no actual text). Large geometric shapes - circles, triangles, rectangles in vibrant colors. Dynamic diagonal lines and dividers. Modern print design aesthetic. Eye-catching and confident. Flat illustration style.`,
    illustrationInstructions: `BOLD EDITORIAL ILLUSTRATION - Create a HIGH-IMPACT MAGAZINE COVER STYLE scene, not scattered shapes. Composition: dynamic diagonal split (bottom-left to top-right). Main subject options: a LARGE abstract face profile made of geometric shapes, a hand holding a floating sphere, a person walking towards viewer with giant shadow, oversized everyday objects (pencil, phone) in dramatic perspective. Style: Vogue/Time magazine aesthetic - vibrant blue (vibrant blue), red (bright red), dark navy (dark navy gray). Flat design with NO outlines. High contrast. Create ONE powerful visual statement that dominates the frame.`,
    colors: ['2B2B2B', 'FF0000', '0078D4'],
    fontFamily: 'Microsoft YaHei'
  },

  // === New Styles (Optimized for Single-Subject Scenes) ===
  chalkboard: {
    name: '黑板风格',
    visualInstructions: `Black chalkboard background (rich black) with colorful chalk drawing style. Hand-drawn chalk illustrations with sketchy, imperfect lines. Chalk dust effects around text and key elements. Colorful chalk creates visual hierarchy - Chalk Yellow (chalk yellow), Chalk Pink (chalk pink), Chalk Blue (light blue violet). Doodles: stars, arrows, underlines, circles. Educational classroom aesthetic. No text or letters.`,
    illustrationInstructions: `BLACKBOARD CHALK DRAWING - Create a LARGE CENTRAL CHALK ILLUSTRATION, not scattered doodles. Composition: centered with subject taking 80% of frame. Main subject options: a detailed atom model with orbiting electrons, a solar system with sun and planets, a DNA helix stretching across the board, a tree with branches and roots, a human brain with labeled regions. Style: classroom chalkboard aesthetic - sketchy chalk lines in yellow (chalk yellow), pink (chalk pink), blue (light blue violet). Chalk dust texture around edges. Imperfect lines with texture specks. ONE large educational drawing that fills the board.`,
    colors: ['1A1A1A', 'FFD700', '9370DB'],
    fontFamily: 'KaiTi'
  },
  notion: {
    name: 'Notion 风格',
    visualInstructions: `SaaS dashboard aesthetic with clean data focus. Blue accent background (true blue) with card-based layouts. Clean data tables and charts, progress bars and metric displays. Icon-based navigation hints, checkbox and toggle styling. System UI font stack. Notion, Linear style. Professional and trustworthy. No text or letters.`,
    illustrationInstructions: `MODERN SAAS INTERFACE SCENE - Create a DASHBOARD VIEW with ONE main data visualization, not scattered UI elements. Composition: card-based layout with one large chart taking 60% of space. Main subject options: a large line chart showing upward trend, a pie chart with detailed legend, a kanban board with cards in columns, a calendar view with events, a project timeline with milestones. Style: Notion/Linear app aesthetic - blue (true blue) background, white cards with subtle shadows, teal (deep teal) accents. Clean flat UI style with rounded corners. Create ONE complete interface view, not disconnected components.`,
    colors: ['2383E2', 'F7F7F5', '008080'],
    fontFamily: 'Microsoft YaHei'
  },
  darkAtmospheric: {
    name: '暗色氛围风格',
    visualInstructions: `Dark moody aesthetic with deep colors and glowing accent elements. Deep purple-black background (deep purple black) with atmospheric fog effect. Glowing accent elements - Electric Purple (electric purple), Cyan Blue (cyan blue), Magenta Pink (magenta pink). Neon-style highlights on key elements, radiating light circles. Cinematic dark mode, mysterious and sophisticated. No text or letters.`,
    illustrationInstructions: `CYBERPUNK NEON SCENE - Create a DRAMATIC FUTURISTIC SCENE with glowing elements, not just scattered icons. Composition: cinematic with strong light source creating atmospheric depth. Main subject options: a person in hoodie with neon city skyline behind, a robot head with glowing eyes in darkness, a floating holographic interface, a cyberpunk city street with neon signs, a data stream visualization flowing through space. Style: Blade Runner aesthetic - deep purple-black (deep purple black) background, glowing electric purple (electric purple), cyan (cyan blue), magenta (magenta pink). Soft bloom/glow effects. High contrast neon on dark. Create an atmospheric scene with mood.`,
    colors: ['1A0B2E', 'BF00FF', '00FFFF'],
    fontFamily: 'Microsoft YaHei'
  },
  editorialInfographic: {
    name: '杂志信息图风格',
    visualInstructions: `Modern magazine-style editorial infographic with clear visual storytelling. Pure white background (pure white) with clean flat illustrations. Structured multi-section layouts, callout boxes for key insights. Icon-based data visualization, flow diagrams with clear directional hierarchy. Pull quotes and highlight boxes. Magazine-quality polish. No text or letters.`,
    illustrationInstructions: `INFOGRAPHIC DATA STORY - Create a NARRATIVE INFOGRAPHIC with flow, not scattered charts. Composition: left-to-right narrative flow or top-down cascade. Main subject options: a journey map with stages along a path, a funnel diagram with detailed layers, a process flow with connected steps (not just arrows), a comparison split (before/after, problem/solution), a pyramid with labeled levels. Style: Wired/Information Today magazine - pure white (pure white) background, bold blue (bold blue) and orange (bright orange). Clear directional flow with arrows. Create ONE complete infographic story, not disconnected elements.`,
    colors: ['FFFFFF', '0066CC', 'FF6600'],
    fontFamily: 'Microsoft YaHei'
  },
  fantasyAnimation: {
    name: '奇幻动画风格',
    visualInstructions: `Whimsical hand-drawn animation style inspired by classic Disney, Studio Ghibli. Soft sky blue background (soft sky blue) with watercolor wash. Friendly illustrated characters, small companion creatures, magical floating objects. Decorative elements: stars, sparkles, flowers, leaves. Soft shadows and gentle highlights. Enchanting, nostalgic, emotionally engaging. No text or letters.`,
    illustrationInstructions: `WHIMSICAL ANIMATION SCENE - Create a ENCHANTING SCENE with character(s), not scattered decorative elements. Composition: rule-of-thirds with character off-center. Main subject options: a cute character holding a glowing object, a character riding on a friendly creature, a small house on a hill with smoke rising, a treehouse with ladder, a character reading under a tree with falling leaves. Style: Studio Ghibli inspired - soft pastels sky blue (soft sky blue), yellow (golden yellow), pink (soft pink). Watercolor soft edges. Cute rounded shapes. Create ONE heartwarming scene that tells a story.`,
    colors: ['87CEEB', 'FFD700', 'FFB6C1'],
    fontFamily: 'KaiTi'
  },
  intuitionMachine: {
    name: '直觉机器风格',
    visualInstructions: `Technical briefing infographic style with aged paper texture (aged paper). Isometric 3D technical illustrations or flat 2D diagrams. Bilingual callout labels pointing to key parts. Faded thematic background patterns (circuits, gears, flowcharts). Clean black outlines on all elements. Split layouts with visuals on left and text boxes on right. Academic/technical briefing. No text or letters.`,
    illustrationInstructions: `TECHNICAL BRIEFING DIAGRAM - Create a DETAILED ISOMETRIC TECHNICAL ILLUSTRATION, not scattered symbols. Composition: isometric 3D perspective or centered 2D diagram. Main subject options: an isometric server room with racks, a cross-section of a machine showing internal parts, a network topology with central hub, a layered architecture diagram (presentation/app/data layers), a factory floor with machines and workers. Style: academic textbook - aged paper (aged paper), clean black 2px outlines, teal (teal green) and rust red (rust red) accents. Create ONE complete technical diagram with labeled parts.`,
    colors: ['F5E6D3', '008080', '8B4513'],
    fontFamily: 'Microsoft YaHei'
  },
  pixelArt: {
    name: '像素艺术风格',
    visualInstructions: `Retro 8-bit pixel art aesthetic with nostalgic gaming visual style. Light blue background (sky blue) with subtle pixel grid pattern. Chunky pixels, limited color palette (16-32 colors max). All elements rendered with visible pixel structure. Simple iconography: notepad, checkboxes, gears, rockets. Text bubbles with pixel borders. Dithering patterns for gradients. Fun, playful, retro tech aesthetic. No text or letters.`,
    illustrationInstructions: `RETRO PIXEL ART SCENE - Create a COMPLETE GAME-LIKE SCENE, not scattered pixel sprites. Composition: side-scrolling or top-down game view. Main subject options: a pixel character standing in a landscape, a spaceship flying through stars, a castle on a hill with flags, a dungeon room with treasure chest, a robot in a futuristic city. Style: NES/SNES game aesthetic - visible chunky pixels, limited palette. Light blue (sky blue) background, bright green (bright green) and red (bright red tone) accents. Dithering for gradients. Create ONE complete pixel art scene like a game screenshot.`,
    colors: ['87CEEB', '00FF00', 'FF0000'],
    fontFamily: 'Microsoft YaHei'
  },
  scientific: {
    name: '科学风格',
    visualInstructions: `Academic scientific illustration style for pathways and technical diagrams. Deep blue background (deep navy blue) with clean, precise diagrams. Horizontal membrane or structure bases, labeled modular components with distinct colors. Flow arrows (electron, proton movement), chemical formulas and molecular notation. Numbered step sequences, pathway diagrams in teal (dusty teal), blue (primary blue), purple (electric purple). Textbook quality. No text or letters.`,
    illustrationInstructions: `SCIENTIFIC DIAGRAM - Create a TEXTBOOK-QUALITY SCIENTIFIC ILLUSTRATION, not scattered elements. Composition: centered with clear flow from left to right or top to bottom. Main subject options: a detailed molecular structure with bonds, a biological pathway with numbered steps, a cell with labeled organelles, a physics diagram with forces and vectors, a chemical reaction mechanism with arrows. Style: Nature journal/Scientific American - deep blue (deep navy blue) background, clean precise diagrams in teal (dusty teal), blue (primary blue), purple (electric purple). Numbered step indicators. Create ONE complete scientific figure with labels.`,
    colors: ['2E5090', '5F9EA0', '0078D4'],
    fontFamily: 'Microsoft YaHei'
  },
  vectorIllustration: {
    name: '矢量插画风格',
    visualInstructions: `Flat vector illustration with clear black outlines and retro soft color palette. Cream off-white background (aged paper) with subtle paper texture. All objects have closed black outlines (coloring book style) with consistent thickness. Rounded line endings, simplified geometric shapes. Soft vintage color palette - Coral Red (coral red), Mint Green (mint green), Mustard Yellow (mustard yellow). Cute, playful, approachable toy model aesthetic. No text or letters.`,
    illustrationInstructions: `PLAYFUL VECTOR SCENE - Create a CUTE ILLUSTRATED SCENE like a children's book, not scattered objects. Composition: centered scene with ground line and sky. Main subject options: a cute animal in a setting (cat in garden, bear in forest), a house with tree and sun, a child holding a balloon with clouds, a train on tracks with landscape, a rocket ship on a launchpad with stars. Style: children's book illustration - cream background (aged paper), consistent 3px black outlines on everything. Soft vintage colors coral (coral red), mint (mint green), mustard (mustard yellow). Rounded friendly shapes. Create ONE complete adorable scene.`,
    colors: ['F5E6D3', 'FF7F50', '98FB98'],
    fontFamily: 'Microsoft YaHei'
  },
  vintage: {
    name: '复古风格',
    visualInstructions: `Vintage aged-paper aesthetic for historical presentations. Deep navy background (dark navy) with aged paper textures. Antique maps with route lines, compass roses, nautical elements. Specimen drawings (flora, fauna), handwritten-style annotations. Rope, leather, brass decorative motifs. Rich warm tones - Forest Green (forest green), Navy Blue (dark navy), Burgundy (burgundy). Evokes discovery and heritage. No text or letters.`,
    illustrationInstructions: `VINTAGE ANTIQUE ILLUSTRATION - Create a DETAILED PERIOD ILLUSTRATION, not scattered artifacts. Composition: framed like an old engraving or map. Main subject options: an antique map with trade routes and compass, a botanical specimen drawing with plant parts labeled, a nautical scene with ship and sea creatures, a vintage portrait scene with period clothing, an architectural drawing of a historical building. Style: 19th century field guide - deep navy (dark navy) background, aged parchment accents. Rich warm tones forest green (forest green), cream (warm cream), burgundy (burgundy). Create ONE complete vintage illustration that looks authentic.`,
    colors: ['1F4E78', 'F5E6D3', '228B22'],
    fontFamily: 'KaiTi'
  },
  watercolor: {
    name: '水彩风格',
    visualInstructions: `Soft watercolor illustration style with hand-painted textures. Warm off-white background (warm off white) with subtle watercolor paper texture. Visible brush strokes and natural color bleeding, soft edges. Watercolor washes as section backgrounds. Natural elements: leaves, bubbles, flowers. Soft coral (soft coral), dusty rose (dusty rose), sage green (sage green), sky blue (sky blue tone). Warm, approachable, artistically refined. No text or letters.`,
    illustrationInstructions: `WATERCOLOR PAINTING SCENE - Create a SOFT WATERCOLOR PAINTING, not scattered washes. Composition: artistic with natural subject placement. Main subject options: a floral arrangement in a vase, a landscape with hills and tree, a bird on a branch with blossoms, a seascape with horizon and clouds, a still life with fruit and bowl. Style: picture book illustration - visible brush strokes, color bleeding. Warm palette coral (soft coral), dusty rose (dusty rose), sage (sage green), sky blue (sky blue tone). Natural elements. Soft edges. Create ONE complete artistic watercolor painting.`,
    colors: ['FFFEF0', 'FFB6C1', '9CAF88'],
    fontFamily: 'KaiTi'
  },
  boldEditorial: {
    name: '粗体杂志风格',
    visualInstructions: `High-impact magazine editorial style with bold visual expression. Deep black background (pure black) or pure white (pure white) with bold color blocks. Oversized headlines dominating the slide. Geometric shapes and bold color blocks - Electric Blue (primary blue), Bright Orange (orange accent), Magenta (magenta pink). Dynamic diagonal lines and angles, dramatic lighting effects. Every slide feels like a premium magazine cover. Maximum visual impact. No text or letters.`,
    illustrationInstructions: `MAXIMUM IMPACT EDITORIAL - Create a BOLD MAGAZINE COVER SCENE, not scattered shapes. Composition: dramatic with high contrast, either stark black (pure black) or pure white (pure white) background. Main subject options: a dramatic portrait with bold color blocking, a hand holding an object with strong shadow, a silhouette against bright color shapes, a large everyday object in unusual scale, a person in motion with blur effect. Style: premium magazine cover - electric blue (primary blue), bright orange (orange accent), magenta (magenta pink). Dynamic diagonal compositions. Dramatic high contrast. Create ONE powerful cover-worthy image.`,
    colors: ['000000', '0078D4', 'FF6600'],
    fontFamily: 'Microsoft YaHei'
  }
};

/**
 * Generate a style-specific background image prompt
 * Enhanced with baoyu-skills "The Architect" persona and Layout Principles
 * Now uses visual and layout fields from JSON outline when available
 */
function generateBackgroundPrompt(style, slideData) {
  const styleConfig = SLIDE_STYLES[style] || SLIDE_STYLES.minimal;
  const visualHints = extractVisualHints(slideData);

  // Build the prompt with custom visual description if available
  let customVisualSection = '';
  if (visualHints.customVisual) {
    customVisualSection = `
## Custom Visual Design Instructions
**Original Description**: ${visualHints.customVisual}
**Layout**: ${visualHints.layout}

Please interpret this visual description and create a background that matches the described aesthetic while maintaining the "${styleConfig.name}" style.
`;
  }

  return {
    prompt: `# Presentation Slide Background Generation

## Image Specifications
- Type: Presentation slide background
- Aspect Ratio: 16:9 (landscape)
- Style: ${styleConfig.name}

## Core Persona: "The Architect"
You are a master visual storyteller creating presentation slides. Your backgrounds:
- Tell a visual story that complements the narrative
- Use bold, confident visual language
- Balance information density with visual clarity
- Create memorable, impactful visuals

## Core Principles
- Hand-drawn or illustration quality throughout - NO realistic or photographic elements
- Clean, uncluttered layouts with clear visual hierarchy
- Leave ample space for text overlays (left/center 2/3 should be relatively clean)
- Create visual interest without distracting from content

## Layout Principles
- **Visual Hierarchy**: Most important element gets most visual weight
- **Breathing Room**: Generous margins and spacing between elements
- **Rule of Thirds**: Key elements at intersection points for dynamic compositions
- **Focal Point**: One clear area draws the eye first

## Style-Specific Instructions
${styleConfig.visualInstructions}
${customVisualSection}

## Visual Theme
**Theme**: ${visualHints.theme}
**Key Elements**: ${visualHints.elements.join(', ')}

## Critical Constraints
- NO text, numbers, letters, or words in the image
- NO slide numbers, page numbers, footers, headers, or logos
- Design for text overlay compatibility
- Professional presentation quality
- Subtle and non-distracting background`,
    style: style
  };
}

/**
 * Extract visual hints from slide content for image generation
 * Enhanced to use 'visual' and 'layout' fields from JSON outline
 */
/**
 * 下载图片（带重试机制）
 * @param {string} imageUrl - 图片URL
 * @param {number} slideNum - 幻灯片编号（用于日志）
 * @param {number} maxRetries - 最大重试次数
 * @returns {Promise<Buffer|null>} - 图片buffer或null
 */
async function downloadImageWithRetry(imageUrl, slideNum, maxRetries = 3) {
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      console.log(`[Optimized PPT] Downloading image for slide ${slideNum} (attempt ${retry + 1}/${maxRetries})...`);

      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (imageResponse.data && imageResponse.data.byteLength > 0) {
        const imageBuffer = Buffer.from(imageResponse.data);
        console.log(`[Optimized PPT] Image downloaded for slide ${slideNum}: ${imageBuffer.length} bytes`);
        return imageBuffer;
      } else {
        throw new Error('Empty response data');
      }
    } catch (error) {
      console.warn(`[Optimized PPT] Download attempt ${retry + 1} failed for slide ${slideNum}:`, error.message);

      if (retry < maxRetries - 1) {
        const delayMs = 1000 * Math.pow(2, retry); // 指数退避: 1s, 2s, 4s
        console.log(`[Optimized PPT] Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error(`[Optimized PPT] All ${maxRetries} attempts failed for slide ${slideNum}`);
        return null;
      }
    }
  }
  return null;
}

function extractVisualHints(slideData) {
  const { type, keyContent, visual, layout } = slideData;

  // If visual description is provided in JSON, use it as primary source
  if (visual) {
    // Parse the visual description to extract key elements
    const visualLower = visual.toLowerCase();
    const extractedElements = [];

    // Common visual elements mapping
    const visualPatterns = {
      '渐变|背景': ['gradient background', 'subtle texture'],
      '图表|数据|折线': ['chart', 'graph', 'data visualization'],
      '图标|剪影|立体': ['icons', 'silhouettes', '3D elements'],
      '网格|阵列': ['grid pattern', 'array layout'],
      '时间轴|流程': ['timeline', 'flow arrows'],
      '卡片|方块': ['card layout', 'content blocks'],
      '中心|辐射|发散': ['central layout', 'radial design'],
      '握手|连接|连线': ['connection', 'link lines'],
      '金线|装饰': ['decorative lines', 'accent elements'],
      '大楼|建筑|服务器': ['building', 'architecture', 'infrastructure'],
      '机器人|客服|人物': ['character', 'person icon', 'illustration'],
      '时钟|问题|警示': ['icon', 'symbol', 'warning indicator'],
      '仪表盘|指标': ['dashboard', 'metrics display'],
      '架构图|分层': ['architecture diagram', 'layered structure']
    };

    for (const [pattern, elements] of Object.entries(visualPatterns)) {
      if (new RegExp(pattern).test(visualLower)) {
        extractedElements.push(...elements);
      }
    }

    return {
      theme: `${type === 'cover' ? 'Cover' : type === 'back-cover' ? 'Ending' : 'Content'} - Custom visual design`,
      elements: [...extractedElements.slice(0, 4), 'professional layout'],
      customVisual: visual, // Include the original visual description
      layout: layout || 'balanced composition'
    };
  }

  // Fallback: use type-based and content-based extraction
  const typeThemes = {
    'cover': { theme: 'Introduction / Title', elements: ['abstract geometric shapes', 'gradient background', 'subtle pattern'] },
    'content': { theme: 'Information presentation', elements: ['diagram elements', 'icon placeholders', 'structured layout'] },
    'back-cover': { theme: 'Conclusion / Thank you', elements: ['calming patterns', 'minimalist design', 'soft colors'] }
  };

  const baseTheme = typeThemes[type] || typeThemes.content;
  const keywordElements = [];
  const contentText = [
    keyContent?.headline || '',
    keyContent?.subHeadline || '',
    ...(keyContent?.body || [])
  ].join(' ').toLowerCase();

  const keywordMap = {
    '数据|分析|图表': ['chart elements', 'graph lines', 'data visualization hints'],
    '技术|架构|系统': ['circuit patterns', 'network nodes', 'technical lines'],
    '客户|用户': ['person icons', 'user silhouettes', 'connection nodes'],
    '流程|步骤': ['arrow flows', 'step indicators', 'path lines'],
    '增长|提升': ['upward trends', 'growth arrows', 'positive indicators'],
    '问题|挑战': ['question marks', 'puzzle pieces', 'challenge symbols'],
    '方案|解决': ['solution icons', 'lightbulb hints', 'gear symbols'],
    '团队|协作': ['connection dots', 'team circles', 'collaboration links']
  };

  for (const [pattern, elements] of Object.entries(keywordMap)) {
    if (new RegExp(pattern).test(contentText)) {
      keywordElements.push(...elements);
    }
  }

  return {
    theme: baseTheme.theme,
    elements: [...baseTheme.elements, ...keywordElements].slice(0, 5)
  };
}

/**
 * Add editable text content to a slide
 */
function addTextContent(slide, keyContent, slideNum, styleConfig) {
  const { headline, subHeadline, body } = keyContent;

  const textX = 0.5;
  const textW = 8;
  let textY = 1.5;

  if (headline) {
    slide.addText(headline, {
      x: textX,
      y: textY,
      w: textW,
      h: 1,
      fontSize: 32,
      fontFace: styleConfig.fontFamily,
      color: styleConfig.colors[0],
      bold: true,
      align: 'left'
    });
    textY += 1.2;
  }

  if (subHeadline) {
    slide.addText(subHeadline, {
      x: textX,
      y: textY,
      w: textW,
      h: 0.6,
      fontSize: 18,
      fontFace: styleConfig.fontFamily,
      color: '666666',
      align: 'left'
    });
    textY += 0.8;
  }

  if (body && body.length > 0) {
    const bulletPoints = body.map(text => ({
      text: text,
      options: {
        bullet: true,
        fontSize: 16,
        fontFace: styleConfig.fontFamily,
        color: '333333',
        breakLine: true
      }
    }));

    slide.addText(bulletPoints, {
      x: textX,
      y: textY,
      w: textW,
      h: 4,
      align: 'left',
      valign: 'top'
    });
  }
}

/**
 * Generate PowerPoint presentation with style-based backgrounds and editable text
 * @param {object} outline - Outline object with slides data
 * @param {string} templatePath - Path to template PPTX file
 * @param {string} title - Presentation title
 * @param {string} style - Visual style key
 * @returns {Promise<Buffer>} PPT file buffer
 */
async function generateStyledPPT(outline, templatePath, title = 'AI 生成方案', style = 'minimal') {
  console.log(`[PPT Gen] Generating PPT with style: ${style}`);

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'AI 方案生成器';
  pptx.subject = title;
  pptx.title = title;

  const styleConfig = SLIDE_STYLES[style] || SLIDE_STYLES.minimal;
  const renderData = expandSlidesForRendering(
    outline.slides || [],
    outline.slideImages || [],
  );
  const outlineSlides = renderData.slides;
  const slideImages = renderData.slideImages;

  if (renderData.didSplit) {
    console.log(
      `[Optimized PPT] Auto-split oversized slides: ${outline.slides.length} -> ${outlineSlides.length}`,
    );
  }

  const imageMap = {};
  for (const img of slideImages) {
    imageMap[img.number] = img.url;
  }

  for (let i = 0; i < outlineSlides.length; i++) {
    const slideData = outlineSlides[i];
    const slideNum = i + 1;

    console.log(`[PPT Gen] Processing slide ${slideNum}: ${slideData.filename}`);

    const slide = pptx.addSlide();

    const imageUrl = imageMap[slideNum];
    if (imageUrl) {
      console.log(`[PPT Gen] Adding background image for slide ${slideNum}`);
      try {
        const imageResponse = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 30000
        });
        const imageBuffer = Buffer.from(imageResponse.data);

        slide.addImage({
          data: `data:image/png;base64,${imageBuffer.toString('base64')}`,
          x: 0,
          y: 0,
          w: '100%',
          h: '100%',
          sizing: { type: 'cover', w: '100%', h: '100%' }
        });

        console.log(`[PPT Gen] Background image added for slide ${slideNum}`);
      } catch (error) {
        console.error(`[PPT Gen] Failed to load image for slide ${slideNum}:`, error.message);
      }
    }

    if (slideData.keyContent) {
      addTextContent(slide, slideData.keyContent, slideNum, styleConfig);
      console.log(`[PPT Gen] Added text overlays to slide ${slideNum}`);
    }
  }

  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  console.log(`[PPT Gen] PPTX buffer generated, size: ${buffer.length} bytes`);

  return buffer;
}

/**
 * 验证PPT生成所需资源
 * @param {object} outline - Outline object with slides and images
 * @param {string} style - Style key
 * @returns {object} - { valid: boolean, errors: string[], missingImages: number[] }
 */
function validatePPTResources(outline, style) {
  const errors = [];
  const missingImages = [];

  // 1. 验证 outline 结构
  if (!outline || typeof outline !== 'object') {
    errors.push('无效的outline数据');
    return { valid: false, errors, missingImages };
  }

  const slides = outline.slides || [];
  if (!Array.isArray(slides) || slides.length === 0) {
    errors.push('outline中没有幻灯片数据');
    return { valid: false, errors, missingImages };
  }

  // 2. 验证风格配置
  if (!SLIDE_STYLES[style]) {
    errors.push(`未知的风格: ${style}`);
  }

  // 3. 检查每个需要图片的幻灯片是否都有对应的图片
  const slideImages = outline.slideImages || [];
  const imageMap = new Map();
  for (const img of slideImages) {
    if (img && img.number) {
      imageMap.set(img.number, img.url);
    }
  }

  for (let i = 0; i < slides.length; i++) {
    const slideData = slides[i];
    const slideNum = i + 1;

    // 使用智能判断确定是否需要图片
    const imageDecision = shouldGenerateImageSmart(slideData, slideNum);

    if (imageDecision.shouldGenerate) {
      const hasImage = imageMap.has(slideNum) && imageMap.get(slideNum);
      if (!hasImage) {
        missingImages.push(slideNum);
        errors.push(`幻灯片 ${slideNum} 需要图片但未找到`);
      }
    }
  }

  // 4. 验证幻灯片数据结构
  const invalidSlides = slides.filter((s, i) => {
    if (!s || typeof s !== 'object') return true;
    if (!s.type && !s.keyContent) return true;
    return false;
  });

  if (invalidSlides.length > 0) {
    errors.push(`${invalidSlides.length} 张幻灯片数据格式无效`);
  }

  return {
    valid: errors.length === 0,
    errors,
    missingImages,
    totalSlides: slides.length,
    requiredImages: slides.filter((s, i) => shouldGenerateImageSmart(s, i + 1).shouldGenerate).length,
    availableImages: imageMap.size
  };
}

/**
 * 添加风格化的文字覆盖层
 * 应用 SLIDE_STYLES 中的颜色和字体配置，保持可编辑性
 * @param {object} slide - PptxGenJS slide object
 * @param {object} keyContent - Content with headline, subHeadline, body
 * @param {object} styleConfig - Style configuration from SLIDE_STYLES
 */
function addStyledTextOverlay(slide, keyContent, styleConfig) {
  if (!keyContent) return;

  // 调试日志：输出 keyContent 的类型和内容
  console.log('[addStyledTextOverlay] keyContent type:', typeof keyContent);
  console.log('[addStyledTextOverlay] keyContent value:', JSON.stringify(keyContent).substring(0, 200));

  // 类型检查：处理 keyContent 是字符串的情况
  if (typeof keyContent === 'string') {
    console.log('[addStyledTextOverlay] Processing as string:', keyContent);
    const colors = styleConfig.colors;
    const fontFamily = styleConfig.fontFamily;

    // 确保字符串不为空
    if (!keyContent || keyContent.trim() === '') {
      console.warn('[addStyledTextOverlay] Empty string, skipping');
      return;
    }

    slide.addText(keyContent, {
      x: 0.5,
      y: 2,
      w: 8,
      h: 4,
      fontSize: 32,
      fontFace: fontFamily,
      color: colors[0] || '1F4E78',
      bold: true,
      align: 'left',
      transparent: true
    });
    return;
  }

  // 确保 keyContent 是对象
  if (typeof keyContent !== 'object') {
    console.warn('[addStyledTextOverlay] Invalid keyContent type:', typeof keyContent);
    return;
  }

  const { headline, subHeadline, body } = keyContent;
  const colors = styleConfig.colors;
  const fontFamily = styleConfig.fontFamily;

  const textX = 0.5;
  const textW = 8;
  let textY = 1.5;

  // 主标题（使用主色）
  if (headline) {
    slide.addText(headline, {
      x: textX,
      y: textY,
      w: textW,
      h: 1,
      fontSize: 40,
      fontFace: fontFamily,
      color: colors[0], // 主色
      bold: true,
      align: 'left',
      transparent: true // 可编辑
    });
    textY += 1.2;
  }

  // 概述段落（斜体，灰色）
  if (subHeadline) {
    slide.addText(subHeadline, {
      x: textX,
      y: textY,
      w: textW,
      h: 0.8,
      fontSize: 16,
      fontFace: fontFamily,
      color: '555555',
      italic: true,
      align: 'left',
      transparent: true
    });
    textY += 0.9;
  }

  // 正文要点（富文本：要点标题加粗 + 说明文字常规）
  if (body && body.length > 0) {
    const bodyArray = Array.isArray(body) ? body : [body];
    const cleanBody = bodyArray.map(item => String(item || '').trim()).filter(item => item);

    if (cleanBody.length > 0) {
      const textRows = [];
      for (const item of cleanBody) {
        // 检测 "标题 — 说明" 格式
        const dashMatch = item.match(/^(.+?)\s*[—–\-]\s*(.+)$/);
        if (dashMatch) {
          textRows.push(
            { text: `• ${dashMatch[1]}`, options: { bold: true, fontSize: 15, color: colors[0] || '1F4E78', fontFace: fontFamily } },
            { text: `  ${dashMatch[2]}`, options: { fontSize: 14, color: '444444', fontFace: fontFamily } },
            { text: '\n', options: { fontSize: 6 } }
          );
        } else {
          textRows.push(
            { text: `• ${item}`, options: { fontSize: 14, color: '333333', fontFace: fontFamily } },
            { text: '\n', options: { fontSize: 6 } }
          );
        }
      }

      slide.addText(textRows, {
        x: textX,
        y: textY,
        w: textW,
        h: 4.2 - textY + 1.5,
        fontFace: fontFamily,
        align: 'left',
        valign: 'top',
        lineSpacing: 20,
        transparent: true
      });
    }
  }
}

/**
 * 优化的 PPT 生成函数 - 多样化布局 + 图片形状优化
 * 参考 Gamma、Canva 等现代设计工具的理念
 * @param {object} outline - Outline object with slides and images
 * @param {string} templatePath - (保留参数兼容，不再使用)
 * @param {string} title - Presentation title
 * @param {string} style - Style key from SLIDE_STYLES
 * @returns {Promise<Buffer>} PPT file buffer
 */
async function generateHybridPPT(outline, templatePath, title = 'AI 生成方案', style = 'minimal') {
  console.log(`[Optimized PPT] Generating with style: ${style}`);

  // === 事务性预检查 ===
  // 验证所有必需资源是否就绪
  const validationResult = validatePPTResources(outline, style);
  if (!validationResult.valid) {
    console.error('[Optimized PPT] Validation failed:', validationResult.errors);
    throw new Error(`PPT生成失败: ${validationResult.errors.join(', ')}`);
  }

  // 1. 加载风格配置
  const styleConfig = SLIDE_STYLES[style] || SLIDE_STYLES.minimal;
  const colors = styleConfig.colors || ['1F4E78', '5B9BD5', 'A5A5A5'];
  const fontFamily = styleConfig.fontFamily || 'Microsoft YaHei';

  const renderData = expandSlidesForRendering(
    outline.slides || [],
    outline.slideImages || [],
  );
  const outlineSlides = renderData.slides;
  const slideImages = renderData.slideImages;

  if (renderData.didSplit) {
    console.log(
      `[Optimized PPT] Auto-split oversized slides: ${outline.slides.length} -> ${outlineSlides.length}`,
    );
  }

  console.log(`[Optimized PPT] Total slides: ${outlineSlides.length}, style: ${styleConfig.name}`);

  // 2. 创建 PPT
  const ppt = new PptxGenJS();
  ppt.layout = 'LAYOUT_16x9';
  ppt.author = 'AI 方案生成器';
  ppt.title = title;

  // 3. 定义多样化内容页布局
  const CONTENT_LAYOUTS = [
    // 布局 0: 左圆图 + 右文
    {
      name: 'left-circle',
      orderWeight: 0,
      hasImage: true,
      image: { shape: 'circle', x: 1.0, y: 1.8, w: 2.5, h: 2.5 },
      title: { x: 4.2, y: 0.5, w: 5, h: 0.7 },
      body: { x: 4.2, y: 1.3, w: 4.5, h: 3.5 }
    },
    // 布局 1: 右圆角图 + 左文
    {
      name: 'right-rounded',
      orderWeight: 1,
      hasImage: true,
      image: { shape: 'rounded', x: 6.0, y: 1.3, w: 3.2, h: 2.4 },
      title: { x: 0.5, y: 0.5, w: 5.5, h: 0.7 },
      body: { x: 0.5, y: 1.3, w: 5, h: 3.5 }
    },
    // 布局 2: 上图 + 下文
    {
      name: 'top-banner',
      orderWeight: 2,
      hasImage: true,
      image: { shape: 'banner', x: 0.5, y: 0.5, w: 9, h: 2.0 },
      title: { x: 0.5, y: 2.7, w: 9, h: 0.6 },
      body: { x: 0.5, y: 3.4, w: 9, h: 1.5 }
    },
    // 布局 3: 左浮动卡片 + 右文
    {
      name: 'left-float',
      orderWeight: 3,
      hasImage: true,
      image: { shape: 'float', x: 0.7, y: 1.2, w: 3.5, h: 2.6 },
      title: { x: 4.5, y: 0.5, w: 4.5, h: 0.7 },
      body: { x: 4.5, y: 1.3, w: 4.2, h: 3.5 }
    },
    // 布局 4: 纯文字（无图）
    {
      name: 'text-only',
      orderWeight: 4,
      hasImage: false,
      title: { x: 0.5, y: 0.8, w: 9, h: 0.7 },
      body: { x: 0.5, y: 1.6, w: 9, h: 3.0 }
    },
    // 布局 5: 右圆形 + 左文
    {
      name: 'right-circle',
      orderWeight: 5,
      hasImage: true,
      image: { shape: 'circle', x: 7.0, y: 1.8, w: 2.2, h: 2.2 },
      title: { x: 0.5, y: 0.5, w: 6, h: 0.7 },
      body: { x: 0.5, y: 1.3, w: 6, h: 3.5 }
    }
  ];

  // 4. 辅助函数：根据幻灯片索引选择布局
  function selectLayout(slideIndex, hasImage) {
    if (!hasImage) {
      return CONTENT_LAYOUTS[4]; // text-only
    }
    // 循环使用有图的布局
    const imageLayouts = CONTENT_LAYOUTS.filter(l => l.hasImage);
    return imageLayouts[slideIndex % imageLayouts.length];
  }

  // 5. 辅助函数：添加带形状的图片
  async function addShapedImage(slide, imageBuffer, imageConfig, styleColor) {
    const { shape, x, y, w, h } = imageConfig;

    if (shape === 'circle') {
      // PptxGenJS 不直接支持圆形裁剪，使用圆角矩形模拟
      slide.addImage({
        data: imageBuffer,
        x: x,
        y: y,
        w: w,
        h: w, // 保持正方形
        sizing: { type: 'contain', w: w, h: w }
      });
    } else if (shape === 'rounded') {
      // 圆角矩形 - 添加阴影效果
      slide.addImage({
        data: imageBuffer,
        x: x,
        y: y,
        w: w,
        h: h,
        sizing: { type: 'contain', w: w, h: h },
        shadow: {
          type: 'outer',
          color: styleColor + '40', // 25% 透明度
          blur: 10,
          offset: 5
        }
      });
    } else if (shape === 'banner') {
      // 通栏横幅图片
      slide.addImage({
        data: imageBuffer,
        x: x,
        y: y,
        w: w,
        h: h,
        sizing: { type: 'cover', w: w, h: h }
      });
    } else if (shape === 'float') {
      // 浮动卡片效果 - 带阴影和轻微旋转
      slide.addImage({
        data: imageBuffer,
        x: x,
        y: y,
        w: w,
        h: h,
        sizing: { type: 'contain', w: w, h: h },
        shadow: {
          type: 'outer',
          color: '00000030',
          blur: 15,
          offset: 8
        },
        rotate: -2 // 轻微逆时针旋转
      });
    } else {
      // 默认矩形
      slide.addImage({
        data: imageBuffer,
        x: x,
        y: y,
        w: w,
        h: h,
        sizing: { type: 'contain', w: w, h: h }
      });
    }
  }

  // 6. 生成每一页
  let contentSlideCount = 0; // 用于选择不同的内容页布局

  for (let i = 0; i < outlineSlides.length; i++) {
    const slideData = outlineSlides[i];
    const slideType = slideData.type || 'content';
    const slideNum = i + 1;

    // 智能判断是否需要图片
    const imageDecision = shouldGenerateImageSmart(slideData, slideNum);
    const imageUrl = slideImages[i]?.url;
    const normalizedSlide = normalizeSlideForLayout(slideData, {
      hasImage: imageDecision.shouldGenerate && Boolean(imageUrl),
    });
    const keyContent = normalizedSlide.keyContent || {};
    const typography = getSlideTypography(normalizedSlide);

    console.log(`[Optimized PPT] Slide ${slideNum} (${slideType}): ${imageDecision.shouldGenerate ? '需要图片' : '不需要图片'}`);

    const slide = ppt.addSlide();

    // === 封面页 ===
    if (slideType === 'cover') {
      if (imageDecision.shouldGenerate && imageUrl) {
        try {
          // 下载图片（带重试机制）
          const imageBuffer = await downloadImageWithRetry(imageUrl, slideNum);

          if (imageBuffer) {
            // AI 图片全屏背景
            slide.addImage({
              data: `data:image/png;base64,${imageBuffer.toString('base64')}`,
              x: 0,
              y: 0,
              w: '100%',
              h: '100%',
              sizing: { type: 'cover', w: '100%', h: '100%' }
            });

            // 添加半透明蒙层
            slide.addShape(ppt.ShapeType.rect, {
              x: 0,
              y: 0,
              w: '100%',
              h: '100%',
              fill: { color: colors[0] + 'CC' } // 80% 透明度
            });
          } else {
            // 降级策略：使用纯色背景+渐变
            console.warn(`[Optimized PPT] Slide ${slideNum} image failed, using fallback background`);
            slide.background = { color: colors[0] };
            // 添加简单的装饰形状
            slide.addShape(ppt.ShapeType.rect, {
              x: 0, y: 0, w: '100%', h: '100%',
              fill: { color: colors[0], transparency: 20 }
            });
          }

          // 标题（白色）
          if (keyContent.headline) {
            slide.addText(keyContent.headline, {
              x: 0.5, y: 1.5, w: 9, h: 1.2,
              fontSize: 48, fontFace: fontFamily, bold: true,
              color: 'FFFFFF', align: 'center'
            });
          }
          if (keyContent.subHeadline) {
            slide.addText(keyContent.subHeadline, {
              x: 0.5, y: 2.7, w: 9, h: 0.6,
              fontSize: 28, fontFace: fontFamily,
              color: 'FFFFFF', align: 'center', transparency: 20
            });
          }
        } catch (error) {
          console.error(`[Optimized PPT] Cover image error:`, error.message);
          // 降级：使用纯色背景
          slide.background = { color: colors[0] };
        }
      } else {
        // 无图片或不需要图片时使用纯色背景
        slide.background = { color: colors[0] };
      }
    }
    // === 章节页 ===
    else if (slideType === 'section') {
      slide.background = { color: colors[0] };
      if (keyContent.headline) {
        slide.addText(keyContent.headline, {
          x: 0.5, y: 2.0, w: 9, h: 1.5,
          fontSize: 44, fontFace: fontFamily, bold: true,
          color: 'FFFFFF', align: 'center'
        });
      }
    }
    // === 封底页 ===
    else if (slideType === 'back-cover') {
      slide.background = { color: colors[0] };
      if (keyContent.headline) {
        slide.addText(keyContent.headline, {
          x: 0.5, y: 1.8, w: 9, h: 1.0,
          fontSize: 40, fontFace: fontFamily, bold: true,
          color: 'FFFFFF', align: 'center'
        });
      }
      if (keyContent.body && keyContent.body.length > 0) {
        slide.addText(keyContent.body.join(' • '), {
          x: 0.5, y: 3.0, w: 8, h: 1.0,
          fontSize: 18, fontFace: fontFamily,
          color: 'FFFFFF', align: 'center', transparency: 30
        });
      }
    }
    // === 内容页（多样化布局）===
    else {
      // 白色背景
      slide.background = { color: 'FFFFFF' };

      // 选择布局
      const layout = chooseContentLayout(CONTENT_LAYOUTS, normalizedSlide, {
        hasImage: imageDecision.shouldGenerate && Boolean(imageUrl),
        cycleSeed: contentSlideCount,
      }) || CONTENT_LAYOUTS[4];
      contentSlideCount++;

      console.log(`[Optimized PPT] Using layout: ${layout.name}`);

      // 标题
      if (keyContent.headline && layout.title) {
        slide.addText(keyContent.headline, {
          x: layout.title.x, y: layout.title.y, w: layout.title.w, h: layout.title.h,
          fontSize: typography.titleFontSize, fontFace: fontFamily, bold: true,
          color: colors[0]
        });
      }

      // 图片
      if (layout.hasImage && imageDecision.shouldGenerate && imageUrl && layout.image) {
        try {
          // 使用带重试的下载
          const imageBuffer = await downloadImageWithRetry(imageUrl, slideNum);

          if (imageBuffer) {
            const imageData = `data:image/png;base64,${imageBuffer.toString('base64')}`;
            await addShapedImage(slide, imageData, layout.image, colors[0]);
            console.log(`[Optimized PPT] Added ${layout.image.shape} image`);
          } else {
            // 降级：跳过此图片，不影响PPT生成
            console.warn(`[Optimized PPT] Slide ${slideNum} image unavailable, continuing without image`);
          }
        } catch (error) {
          console.warn(`[Optimized PPT] Image error for slide ${slideNum}:`, error.message);
          // 降级：继续生成PPT，不影响整体流程
        }
      }

      // 概述段落（subHeadline）
      if (keyContent.subHeadline && layout.title) {
        slide.addText(keyContent.subHeadline, {
          x: layout.body ? layout.body.x : 0.5,
          y: layout.title.y + layout.title.h + 0.1,
          w: layout.body ? layout.body.w : 9,
          h: 0.6,
          fontSize: 13, fontFace: fontFamily, italic: true,
          color: '555555'
        });
      }

      // 正文要点（富文本格式）
      if (keyContent.body && keyContent.body.length > 0 && layout.body) {
        const subHeadlineOffset = keyContent.subHeadline ? 0.7 : 0;
        const bodyY = layout.body.y + subHeadlineOffset;
        const bodyH = layout.body.h - subHeadlineOffset;

        const textRows = [];
        for (const item of keyContent.body) {
          const text = String(item || '').trim();
          if (!text) continue;
          const dashMatch = text.match(/^(.+?)\s*[—–\-]\s*(.+)$/);
          if (dashMatch) {
            textRows.push(
              { text: `• ${dashMatch[1]}`, options: { bold: true, fontSize: 13, color: colors[0], fontFace: fontFamily } },
              { text: `  ${dashMatch[2]}`, options: { fontSize: 12, color: '444444', fontFace: fontFamily } },
              { text: '\n', options: { fontSize: 5 } }
            );
          } else {
            textRows.push(
              { text: `• ${text}`, options: { fontSize: 12, color: '333333', fontFace: fontFamily } },
              { text: '\n', options: { fontSize: 5 } }
            );
          }
        }

        slide.addText(textRows, {
          x: layout.body.x, y: bodyY, w: layout.body.w, h: bodyH,
          fontFace: fontFamily, align: 'left', valign: 'top',
          lineSpacing: 18
        });
      }
    }

    // 添加演讲备注
    if (slideData.speakerNotes) {
      slide.addNotes(slideData.speakerNotes);
    }
  }

  // 7. 生成 PPT
  const pptBuffer = await ppt.write({ outputType: 'nodebuffer' });
  console.log(`[Optimized PPT] Generated ${outlineSlides.length} slides, size: ${pptBuffer.length} bytes`);

  return pptBuffer;
}

/**
 * 生成模板页面（应用风格配置）
 * @param {Array} templateSlides - 需要使用模板的页面数组
 * @param {string} templatePath - 模板文件路径
 * @param {object} styleConfig - 风格配置
 * @param {Array} slideImages - 所有页面图片数组
 * @returns {Promise<Buffer>} 模板PPT buffer
 */
async function generateTemplateSlidesWithStyle(templateSlides, templatePath, styleConfig, slideImages) {
  console.log(`[Template Slides] Generating ${templateSlides.length} template slides with style`);

  // 构建新的 outline 对象，只包含模板页面
  const templateOutline = {
    slides: templateSlides.map(s => s.data),
    slideImages: templateSlides.map(s => slideImages[s.index])
  };

  // 使用现有的模板生成逻辑
  const tempBuffer = await generatePPTFromTemplate(
    templateOutline,
    templatePath,
    'AI 生成方案',
    styleConfig.name?.toLowerCase() || 'minimal'
  );

  return tempBuffer;
}

/**
 * 合并两个PPT：AI背景页面 + 模板页面
 * @param {object} pptxAI - PptxGenJS 对象（包含AI背景页面）
 * @param {Buffer} templateBuffer - 模板PPT buffer
 * @param {number} templateSlideCount - 模板页面数量
 * @returns {Promise<Buffer>} 合并后的PPT buffer
 */
async function mergePresentations(pptxAI, templateBuffer, templateSlideCount) {
  console.log(`[Merge PPT] Merging AI slides with template slides (${templateSlideCount} templates)`);

  // 如果没有模板页面，直接返回AI背景PPT
  if (!templateBuffer || templateSlideCount === 0) {
    console.log(`[Merge PPT] No template slides, returning AI slides only`);
    return await pptxAI.write({ outputType: 'nodebuffer' });
  }

  // 如果没有AI背景页面，直接返回模板PPT
  const aiSlides = pptxAI.slides.length;
  if (aiSlides === 0) {
    console.log(`[Merge PPT] No AI slides, returning template only`);
    return templateBuffer;
  }

  // 读取两个PPT的ZIP结构
  const aiBuffer = await pptxAI.write({ outputType: 'nodebuffer' });
  const aiZip = await JSZip.loadAsync(aiBuffer);
  const templateZip = await JSZip.loadAsync(templateBuffer);

  // 从AI PPT中提取所有幻灯片
  const aiSlideFiles = [];
  for (let i = 1; i <= aiSlides; i++) {
    const slidePath = `ppt/slides/slide${i}.xml`;
    const relPath = `ppt/slides/_rels/slide${i}.xml.rels`;
    const mediaFiles = [];

    // 获取幻灯片XML
    const slideXml = await aiZip.file(slidePath).async('string');
    const slideRels = await aiZip.file(relPath)?.async('string') || '';

    // 收集媒体文件
    if (slideRels) {
      const relMatches = slideRels.match(/Target="..\/media\/([^"]+)"/g);
      if (relMatches) {
        for (const match of relMatches) {
          const mediaName = match.match(/Target="..\/media\/([^"]+)"/)[1];
          const mediaPath = `ppt/media/${mediaName}`;
          const mediaData = await aiZip.file(mediaPath)?.async('base64');
          if (mediaData) {
            mediaFiles.push({ path: mediaPath, data: mediaData });
          }
        }
      }
    }

    aiSlideFiles.push({
      slideXml,
      slideRels,
      mediaFiles
    });
  }

  // 从模板PPT获取当前幻灯片数量
  const templateSlidesCount = parseInt((await templateZip.file('ppt/presentation.xml').async('string')).match(/<p:sldId[^>]*>/g)?.length || 0);
  const nextSlideId = templateSlidesCount + 1;
  const nextRelId = templateSlidesCount + 2;

  // 将AI幻灯片添加到模板PPT的开头
  for (let i = 0; i < aiSlideFiles.length; i++) {
    const aiSlide = aiSlideFiles[i];
    const newSlideNum = i + 1;
    const actualSlideNum = nextSlideId + i;

    // 添加幻灯片XML
    templateZip.file(`ppt/slides/slide${actualSlideNum}.xml`, aiSlide.slideXml);

    // 添加关系文件
    if (aiSlide.slideRels) {
      templateZip.file(`ppt/slides/_rels/slide${actualSlideNum}.xml.rels`, aiSlide.slideRels);
    }

    // 添加媒体文件
    for (const media of aiSlide.mediaFiles) {
      if (!templateZip.file(media.path)) {
        templateZip.file(media.path, media.data, { base64: true });
      }
    }

    // 更新 presentation.xml
    const slideId = 256 + (actualSlideNum - 1) * 2;
    const slideEntry = `<p:sldId id="${slideId}" r:id="rId${nextRelId + i}"/>`;
    // 将新幻灯片插入到开头
    let presXml = await templateZip.file('ppt/presentation.xml').async('string');
    presXml = presXml.replace('<p:sldIdLst>', `<p:sldIdLst>${slideEntry}`);
    templateZip.file('ppt/presentation.xml', presXml);

    // 更新 presentation.xml.rels
    const newRel = `<Relationship Id="rId${nextRelId + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${actualSlideNum}.xml"/>`;
    let presRels = await templateZip.file('ppt/_rels/presentation.xml.rels').async('string');
    presRels = presRels.replace('</Relationships>', `${newRel}</Relationships>`);
    templateZip.file('ppt/_rels/presentation.xml.rels', presRels);
  }

  // 重新编号模板幻灯片（因为我们在前面插入了新的幻灯片）
  // 这一步比较复杂，暂时跳过，让PowerPoint自己处理

  const finalBuffer = await templateZip.generateAsync({ type: 'nodebuffer' });
  console.log(`[Merge PPT] Merged PPT generated, size: ${finalBuffer.length} bytes`);

  return finalBuffer;
}

/**
 * Generate PowerPoint from template (refactored for consistency)
 * Uses template as master design, adds content overlays and AI illustrations on top
 * @param {object} outline - Outline object with slides data
 * @param {string} templatePath - Path to template PPTX file
 * @param {string} title - Presentation title
 * @param {string} style - Style for AI illustrations (不影响模板)
 * @returns {Promise<Buffer>} PPT file buffer
 */
async function generatePPTFromTemplate(outline, templatePath, title = 'AI 生成方案', style = 'minimal') {
  console.log(`[PPT Gen] Using template as master: ${templatePath}, illustration style: ${style}`);

  // 1. 加载风格配置
  const styleConfig = SLIDE_STYLES[style] || SLIDE_STYLES.minimal;

  // 2. 加载模板
  const templateBuffer = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  // 3. 获取模板幻灯片（用于复制额外页面）
  // slide4.xml 是内容页模板，有标题占位符
  const contentSlideXml = await zip.file('ppt/slides/slide4.xml').async('string');
  const contentSlideRels = await zip.file('ppt/slides/_rels/slide4.xml.rels').async('string');

  // 4. 获取 outline 数据
  const renderData = expandSlidesForRendering(
    outline.slides || [],
    outline.slideImages || [],
  );
  const outlineSlides = renderData.slides;
  const slideImages = renderData.slideImages;
  const requiredSlideCount = outlineSlides.length;

  console.log(`[PPT Gen] Required slides: ${requiredSlideCount}, clearing template slides`);

  // === 修复：清空模板原始幻灯片 ===
  // 删除所有原始幻灯片文件（slide1-5.xml）
  for (let i = 1; i <= 5; i++) {
    zip.remove(`ppt/slides/slide${i}.xml`);
    zip.remove(`ppt/slides/_rels/slide${i}.xml.rels`);
  }

  // 重置 presentation.xml 和 presentation.xml.rels
  let presXml = await zip.file('ppt/presentation.xml').async('string');
  presXml = presXml.replace(/<p:sldId[^>]*>[\s\S]*?<\/p:sldIdLst>/, '<p:sldIdLst/>');
  zip.file('ppt/presentation.xml', presXml);

  let presRels = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
  // 移除所有 slide 关系，保留其他关系（如主题、视图属性等）
  presRels = presRels.replace(/<Relationship[^>]*Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/slide"[^>]*\/>\s*/g, '');
  zip.file('ppt/_rels/presentation.xml.rels', presRels);

  // === 重新生成所需的幻灯片 ===
  for (let i = 0; i < requiredSlideCount; i++) {
    const slideData = outlineSlides[i];
    const slideNum = i + 1;
    const slideXmlPath = `ppt/slides/slide${slideNum}.xml`;
    const slideRelsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;

    console.log(`[PPT Gen] Creating slide ${slideNum}: ${slideData.filename} (type: ${slideData.type})`);

    // === 创建新的幻灯片（基于 contentSlideXml 模板） ===
    let slideXml = contentSlideXml.replace(/rId1/g, `rId${slideNum + 1}`);
    zip.file(slideXmlPath, slideXml);

    // 创建关系文件
    let slideRels = contentSlideRels.replace(/rId1/g, `rId${slideNum + 1}`);
    zip.file(slideRelsPath, slideRels);

    // 更新 presentation.xml
    const slideId = 256 + i * 2;
    const slideEntry = `<p:sldId id="${slideId}" r:id="rId${slideNum + 1}"/>`;
    presXml = await zip.file('ppt/presentation.xml').async('string');
    presXml = presXml.replace('</p:sldIdLst>', `${slideEntry}</p:sldIdLst>`);
    zip.file('ppt/presentation.xml', presXml);

    // 更新 presentation.xml.rels
    const newRel = `<Relationship Id="rId${slideNum + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNum}.xml"/>`;
    presRels = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
    presRels = presRels.replace('</Relationships>', `${newRel}</Relationships>`);
    zip.file('ppt/_rels/presentation.xml.rels', presRels);

    // 添加标题和正文内容（应用风格配置）
    slideXml = await zip.file(slideXmlPath).async('string');
    const textShapes = generateTextShapes(slideData, slideNum, styleConfig);
    if (textShapes) {
      slideXml = slideXml.replace('<p:spTree>', `<p:spTree>${textShapes}`);
      zip.file(slideXmlPath, slideXml);
      console.log(`[PPT Gen] Added text content to slide ${slideNum}`);
    }

    // 添加 AI 插图（仅内容页，且图片存在）
    if (shouldHaveIllustration(slideData) && slideImages[i]) {
      const imageUrl = slideImages[i].url;
      console.log(`[PPT Gen] Adding illustration to slide ${slideNum} from ${imageUrl}`);

      try {
        // 下载图片（带重试机制）
        let imageBuffer;
        let downloadSuccess = false;
        const maxRetries = 3;

        for (let retry = 0; retry < maxRetries; retry++) {
          try {
            console.log(`[PPT Gen] Downloading image (attempt ${retry + 1}/${maxRetries})...`);
            const imageResponse = await axios.get(imageUrl, {
              responseType: 'arraybuffer',
              timeout: 60000,  // 增加超时到 60 秒
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });

            if (imageResponse.data && imageResponse.data.byteLength > 0) {
              imageBuffer = Buffer.from(imageResponse.data);
              downloadSuccess = true;
              console.log(`[PPT Gen] Image downloaded successfully: ${imageBuffer.length} bytes`);
              break;
            } else {
              throw new Error('Empty response data');
            }
          } catch (downloadError) {
            console.warn(`[PPT Gen] Download attempt ${retry + 1} failed:`, downloadError.message);
            if (retry < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // 等待 2 秒后重试
            } else {
              throw downloadError;
            }
          }
        }

        if (!downloadSuccess || !imageBuffer) {
          throw new Error('Failed to download image after retries');
        }

        const imageFileName = `illustration_${slideNum}.png`;
        zip.file(`ppt/media/${imageFileName}`, imageBuffer);

        // 重新获取更新后的 slideXml
        slideXml = await zip.file(slideXmlPath).async('string');

        // 添加图片元素
        const pictureXml = generatePictureXml(slideNum, imageFileName);
        slideXml = slideXml.replace('</p:spTree>', pictureXml + '</p:spTree>');
        zip.file(slideXmlPath, slideXml);

        // 更新关系文件
        const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
        let relsContent = await zip.file(relsPath).async('string');

        // 检查是否已经有关系，添加新的图片关系
        const matches = relsContent.match(/rId(\d+)/g);
        const maxRId = matches ? Math.max(...matches.map(m => parseInt(m.replace('rId', '')))) : 0;
        const newRId = maxRId + 1;
        const newRel = `<Relationship Id="rId${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${imageFileName}"/>`;

        // 更新图片元素的 r:id
        slideXml = await zip.file(slideXmlPath).async('string');
        slideXml = slideXml.replace(`r:embed="rId${slideNum * 10}"`, `r:embed="rId${newRId}"`);
        zip.file(slideXmlPath, slideXml);

        relsContent = relsContent.replace('</Relationships>', newRel + '</Relationships>');
        zip.file(relsPath, relsContent);

        console.log(`[PPT Gen] Added illustration to slide ${slideNum} (${imageBuffer.length} bytes)`);
      } catch (error) {
        console.error(`[PPT Gen] Failed to add illustration to slide ${slideNum}:`, error.message);
        console.error(`[PPT Gen] Image URL was: ${imageUrl}`);
        // 继续生成 PPT，只是这张幻灯片没有插图
        console.warn(`[PPT Gen] Continuing without illustration for slide ${slideNum}`);
      }
    }
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  console.log(`[PPT Gen] PPTX buffer generated, size: ${buffer.length} bytes`);

  return buffer;
}

/**
 * 判断幻灯片是否需要插图（旧版本，保留兼容）
 * 封面页和结束页不需要插图
 */
function shouldHaveIllustration(slideData) {
  if (!slideData) return false;
  const type = slideData.type || '';
  // 封面页、结束页、总结页不需要插图
  return !['cover', 'back-cover', 'title', 'closing'].includes(type);
}

/**
 * 智能图片生成策略 - 根据页面类型和内容决定是否生成图片
 * @param {object} slideData - 幻灯片数据
 * @param {number} slideNum - 幻灯片编号
 * @returns {object} - { shouldGenerate: boolean, reason: string, defaultConfig: object }
 */
function shouldGenerateImageSmart(slideData, slideNum) {
  if (!slideData) {
    return { shouldGenerate: false, reason: '无幻灯片数据', defaultConfig: null };
  }

  const type = slideData.type || 'content';
  if (slideData.preferredLayout === 'text-only') {
    return {
      shouldGenerate: false,
      reason: 'text-only 布局不生成图片',
      defaultConfig: { enabled: false }
    };
  }
  const visual = slideData.visual || '';
  const keyContent = slideData.keyContent || {};
  const body = keyContent.body || [];

  // === 规则 1: 封面页必须生成图片 ===
  if (type === 'cover') {
    return {
      shouldGenerate: true,
      reason: '封面页需要视觉冲击',
      defaultConfig: {
        enabled: true,
        position: 'background',
        opacity: 1,
        size: 'large',
        shape: 'rectangle'
      }
    };
  }

  // === 规则 2: 章节页不生成图片 ===
  if (type === 'section' || type === 'section-divider') {
    return {
      shouldGenerate: false,
      reason: '章节页使用纯色背景',
      defaultConfig: { enabled: false }
    };
  }

  // === 规则 3: 封底页建议生成图片 ===
  if (type === 'back-cover') {
    return {
      shouldGenerate: true,
      reason: '封底页需要品牌感',
      defaultConfig: {
        enabled: true,
        position: 'background',
        opacity: 0.5,
        size: 'large',
        shape: 'rectangle'
      }
    };
  }

  // === 规则 4: 结束页不生成图片 ===
  if (type === 'closing') {
    return {
      shouldGenerate: false,
      reason: '结束页使用纯色背景',
      defaultConfig: { enabled: false }
    };
  }

  // === 规则 5: 内容页智能判断 ===
  if (type === 'content' || type === 'two-columns') {
    // 5.1 有明确的 visual 描述 → 生成
    if (visual && visual.length > 10) {
      return {
        shouldGenerate: true,
        reason: '有明确的 visual 描述',
        defaultConfig: {
          enabled: true,
          position: 'right',
          opacity: 1,
          size: 'medium',
          shape: 'rounded'
        }
      };
    }

    // 5.2 body 内容全是纯文字 → 不生成
    const isTextOnly = body.length > 0 && body.every(item =>
      typeof item === 'string' &&
      item.length < 100 &&
      !/图|表|数据|架构|流程|示意图|截图|界面|仪表盘/.test(item)
    );
    if (isTextOnly && body.length <= 5) {
      return {
        shouldGenerate: false,
        reason: '纯文字内容，不需要图片',
        defaultConfig: { enabled: false }
      };
    }

    // 5.3 body 有数据/图表关键词 → 生成
    const hasDataKeywords = body.some(item =>
      /数据|图表|增长|趋势|统计|占比|分析|指标|监控|仪表盘|dashboard/.test(item)
    );
    if (hasDataKeywords) {
      return {
        shouldGenerate: true,
        reason: '包含数据/图表内容',
        defaultConfig: {
          enabled: true,
          position: 'right',
          opacity: 1,
          size: 'small',
          shape: 'rounded'
        }
      };
    }

    // 5.4 body 有架构/流程关键词 → 生成
    const hasArchKeywords = body.some(item =>
      /架构|系统|模块|组件|接口|流程|步骤|拓扑|网络|分层/.test(item)
    );
    if (hasArchKeywords) {
      return {
        shouldGenerate: true,
        reason: '包含架构/流程内容',
        defaultConfig: {
          enabled: true,
          position: 'right',
          opacity: 1,
          size: 'medium',
          shape: 'rounded'
        }
      };
    }

    // 5.5 默认不生成（节省成本）
    return {
      shouldGenerate: false,
      reason: '默认不生成（节省成本）',
      defaultConfig: { enabled: false }
    };
  }

  // === 默认不生成 ===
  return {
    shouldGenerate: false,
    reason: '未知页面类型，默认不生成',
    defaultConfig: { enabled: false }
  };
}

/**
 * 图片配置预设（根据页面类型自动推荐）
 */
const IMAGE_CONFIG_PRESETS = {
  cover: {
    enabled: true,
    position: 'background',
    opacity: 1,
    size: 'large',
    shape: 'rectangle'
  },
  section: {
    enabled: false
  },
  'section-divider': {
    enabled: false
  },
  content: {
    enabled: false,  // 默认不生成，由智能判断决定
    position: 'right',
    opacity: 1,
    size: 'medium',
    shape: 'rounded'
  },
  'two-columns': {
    enabled: false,
    position: 'right',
    opacity: 1,
    size: 'medium',
    shape: 'rounded'
  },
  closing: {
    enabled: false
  },
  'back-cover': {
    enabled: true,
    position: 'background',
    opacity: 0.5,
    size: 'large',
    shape: 'rectangle'
  }
};

/**
 * 生成文本内容的 XML 形状（支持风格配置）
 * @param {object} slideData - Slide data with keyContent
 * @param {number} slideNum - Slide number
 * @param {object} styleConfig - Style configuration from SLIDE_STYLES
 */
function generateTextShapes(slideData, slideNum, styleConfig = null) {
  if (!slideData.keyContent) return '';

  const normalizedSlide = normalizeSlideForLayout(slideData);
  let keyContent = normalizedSlide.keyContent;

  // 类型检查：处理 keyContent 是字符串的情况
  if (typeof keyContent === 'string') {
    keyContent = { headline: keyContent, subHeadline: '', body: [] };
  }

  // 确保 keyContent 是对象
  if (typeof keyContent !== 'object' || !keyContent) {
    console.warn('[generateTextShapes] Invalid keyContent type:', typeof keyContent);
    return '';
  }

  let textShapes = '';
  let yPos = 1500000; // 起始 Y 位置

  // 从风格配置获取颜色和字体，如果没有则使用默认值
  const titleColor = styleConfig?.colors?.[0] || '1F4E78';
  const subtitleColor = styleConfig?.colors?.[1] || '44546A';
  const bodyColor = styleConfig?.colors?.[2] || '333333';
  const fontFamily = styleConfig?.fontFamily || 'Microsoft YaHei';
  const typography = getSlideTypography(normalizedSlide);
  const titleSize = Math.round((typography.titleFontSize + 12) * 100);
  const subtitleSize = Math.round(Math.max(24, typography.bodyFontSize + 10) * 100);
  const bodySize = Math.round(typography.bodyFontSize * 100);

  // 标题
  if (keyContent.headline) {
    textShapes += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${slideNum * 100}" name="Title"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="title"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="700000" y="${yPos}"/>
            <a:ext cx="8000000" cy="1200000"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr>
              <a:defRPr lang="zh-CN" sz="${titleSize}">
                <a:solidFill>
                  <a:srgbClr val="${titleColor}"/>
                </a:solidFill>
                <a:latin typeface="${fontFamily}"/>
                <a:ea typeface="${fontFamily}"/>
              </a:defRPr>
            </a:pPr>
            <a:r>
              <a:rPr lang="zh-CN" sz="${titleSize}">
                <a:solidFill>
                  <a:srgbClr val="${titleColor}"/>
                </a:solidFill>
                <a:latin typeface="${fontFamily}"/>
                <a:ea typeface="${fontFamily}"/>
              </a:rPr>
              <a:t>${escapeXml(keyContent.headline)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;
    yPos += 1500000;
  }

  // 副标题
  if (keyContent.subHeadline) {
    textShapes += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${slideNum * 101}" name="Subtitle"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="body"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="700000" y="${yPos}"/>
            <a:ext cx="8000000" cy="700000"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr>
              <a:defRPr lang="zh-CN" sz="${subtitleSize}">
                <a:solidFill>
                  <a:srgbClr val="${subtitleColor}"/>
                </a:solidFill>
                <a:latin typeface="${fontFamily}"/>
                <a:ea typeface="${fontFamily}"/>
              </a:defRPr>
            </a:pPr>
            <a:r>
              <a:rPr lang="zh-CN" sz="${subtitleSize}">
                <a:solidFill>
                  <a:srgbClr val="${subtitleColor}"/>
                </a:solidFill>
                <a:latin typeface="${fontFamily}"/>
                <a:ea typeface="${fontFamily}"/>
              </a:rPr>
              <a:t>${escapeXml(keyContent.subHeadline)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;
    yPos += 1200000;
  }

  // 正文内容（列表）
  if (keyContent.body && keyContent.body.length > 0) {
    const bullets = keyContent.body.map((text, idx) => `
      <a:p>
        <a:pPr lvl="0">
          <a:buChar char="•">
            <a:font typeface="${fontFamily}"/>
          </a:buChar>
          <a:defRPr lang="zh-CN" sz="${bodySize}">
            <a:solidFill>
              <a:srgbClr val="${bodyColor}"/>
            </a:solidFill>
            <a:latin typeface="${fontFamily}"/>
            <a:ea typeface="${fontFamily}"/>
          </a:defRPr>
        </a:pPr>
        <a:r>
          <a:rPr lang="zh-CN" sz="${bodySize}">
            <a:solidFill>
              <a:srgbClr val="${bodyColor}"/>
            </a:solidFill>
            <a:latin typeface="${fontFamily}"/>
            <a:ea typeface="${fontFamily}"/>
          </a:rPr>
          <a:t>${escapeXml(text)}</a:t>
        </a:r>
      </a:p>
    `).join('');

    textShapes += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${slideNum * 102}" name="Content"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="body" sz="half" idx="1"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="700000" y="${yPos}"/>
            <a:ext cx="8500000" cy="3500000"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          ${bullets}
        </p:txBody>
      </p:sp>`;
  }

  return textShapes;
}

/**
 * 生成图片元素的 XML
 */
function generatePictureXml(slideNum, imageFileName) {
  return `
    <p:pic>
      <p:nvPicPr>
        <p:cNvPr id="${slideNum * 50}" name="Illustration ${slideNum}"/>
        <p:cNvPicPr>
          <a:picLocks noChangeAspect="1" noGrp="1"/>
        </p:cNvPicPr>
        <p:nvPr/>
      </p:nvPicPr>
      <p:blipFill>
        <a:blip r:embed="rId${slideNum * 10}"/>
        <a:stretch>
          <a:fillRect/>
        </a:stretch>
      </p:blipFill>
      <p:spPr>
        <a:xfrm>
          <a:off x="10000000" y="1500000"/>
          <a:ext cx="5500000" cy="4000000"/>
        </a:xfrm>
        <a:prstGeom prst="rect">
          <a:avLst/>
        </a:prstGeom>
      </p:spPr>
    </p:pic>`;
}

/**
 * XML 转义函数
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate PowerPoint from markdown presentation (fallback function)
 * @param {object} presentation - Parsed presentation object
 * @param {string} template - Template name (not used, always uses default)
 * @returns {Promise<Buffer>} PPT file buffer
 */
async function generatePPT(presentation, template = 'business') {
  console.log(`[PPT Gen] Generating PPT from markdown, template: ${template}`);

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'AI 方案生成器';
  pptx.title = presentation.title || 'AI 生成方案';

  const slides = presentation.slides || [];

  for (const slide of slides) {
    const pptSlide = pptx.addSlide();

    if (slide.title) {
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 1.5,
        w: 9,
        h: 1.5,
        fontSize: 36,
        bold: true,
        color: '1F4E78',
        fontFace: '等线'
      });
    }

    if (slide.points && slide.points.length > 0) {
      const bulletPoints = slide.points.map(p => p.text || p).join('\n');
      pptSlide.addText(bulletPoints, {
        x: 0.5,
        y: 3,
        w: 9,
        h: 4,
        fontSize: 18,
        color: '333333',
        fontFace: '等线',
        bullet: true
      });
    }
  }

  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  console.log(`[PPT Gen] PPTX buffer generated from markdown, size: ${buffer.length} bytes`);

  return buffer;
}

export {
  generateStyledPPT,
  generatePPTFromTemplate,
  generateHybridPPT,
  generatePPT,
  generateBackgroundPrompt,
  shouldGenerateImageSmart,
  IMAGE_CONFIG_PRESETS,
  SLIDE_STYLES
};
