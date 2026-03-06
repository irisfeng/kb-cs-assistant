const SLIDE_LIMITS = {
  default: {
    maxHeadline: 30,
    maxSubHeadline: 60,
    maxBullets: 5,
    maxCharsPerBullet: 90,
  },
  cover: {
    maxHeadline: 24,
    maxSubHeadline: 50,
    maxBullets: 3,
    maxCharsPerBullet: 40,
  },
  section: {
    maxHeadline: 20,
    maxSubHeadline: 0,
    maxBullets: 0,
    maxCharsPerBullet: 0,
  },
  "back-cover": {
    maxHeadline: 22,
    maxSubHeadline: 40,
    maxBullets: 3,
    maxCharsPerBullet: 40,
  },
  closing: {
    maxHeadline: 22,
    maxSubHeadline: 40,
    maxBullets: 3,
    maxCharsPerBullet: 40,
  },
  "two-columns": {
    maxHeadline: 26,
    maxSubHeadline: 50,
    maxBullets: 4,
    maxCharsPerBullet: 60,
  },
};

const RENDER_CHUNK_LIMITS = {
  default: {
    maxBulletsPerChunk: 4,
    maxCharsPerChunk: 350,
  },
  "two-columns": {
    maxBulletsPerChunk: 3,
    maxCharsPerChunk: 250,
  },
};

function getSlideLimits(slideType) {
  return SLIDE_LIMITS[slideType] || SLIDE_LIMITS.default;
}

function getRenderChunkLimits(slideType) {
  return RENDER_CHUNK_LIMITS[slideType] || RENDER_CHUNK_LIMITS.default;
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function clampText(value, maxLength) {
  if (!maxLength) {
    return "";
  }

  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function normalizeBody(body, limits) {
  if (!Array.isArray(body)) {
    return [];
  }

  const items = body
    .map((item) => clampText(item, limits.maxCharsPerBullet))
    .filter(Boolean);

  return items.slice(0, limits.maxBullets);
}

function normalizeBodyItems(body, limits) {
  if (!Array.isArray(body)) {
    return [];
  }

  return body
    .map((item) => clampText(item, limits.maxCharsPerBullet))
    .filter(Boolean);
}

function chunkBodyForRender(bodyItems, slideType) {
  const chunkLimits = getRenderChunkLimits(slideType);
  const chunks = [];
  let currentChunk = [];
  let currentChars = 0;

  for (const item of bodyItems) {
    const nextChars = currentChars + item.length;
    const exceedsBulletLimit =
      currentChunk.length >= chunkLimits.maxBulletsPerChunk;
    const exceedsCharLimit =
      currentChunk.length > 0 && nextChars > chunkLimits.maxCharsPerChunk;

    if (exceedsBulletLimit || exceedsCharLimit) {
      chunks.push(currentChunk);
      currentChunk = [item];
      currentChars = item.length;
      continue;
    }

    currentChunk.push(item);
    currentChars = nextChars;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [[]];
}

function createContinuationHeadline(headline, chunkIndex) {
  const base = normalizeText(headline);
  if (!base) {
    return `Continued ${chunkIndex + 1}`;
  }

  return `${base} (cont. ${chunkIndex + 1})`;
}

function calculateDensity(headline, subHeadline, body) {
  const bodyLength = body.reduce((sum, item) => sum + item.length, 0);
  const totalLength = headline.length + subHeadline.length + bodyLength;
  const bulletCount = body.length;

  if (bulletCount >= 5 || totalLength >= 180) {
    return "high";
  }

  if (bulletCount >= 3 || totalLength >= 90) {
    return "medium";
  }

  return "low";
}

function inferVisualMode(slideType, body, visual, shouldHaveImage) {
  if (!shouldHaveImage) {
    if (slideType === "section" || slideType === "closing") {
      return "none";
    }
    return "shape";
  }

  if (slideType === "cover" || slideType === "back-cover") {
    return "ai-image";
  }

  const joined = body.join(" ");

  if (/timeline|phase|milestone|roadmap|step|steps|time/i.test(joined)) {
    return "timeline";
  }

  if (/kpi|metric|growth|trend|ratio|rate|analysis|dashboard/i.test(joined)) {
    return "chart";
  }

  if (/architecture|system|module|platform|integration|api|network/i.test(joined)) {
    return "diagram";
  }

  if (visual && visual.length > 16) {
    return "ai-image";
  }

  return "icon";
}

export function normalizeSlideForLayout(slideData, options = {}) {
  const safeSlide = slideData && typeof slideData === "object" ? slideData : {};
  const slideType = safeSlide.type || "content";
  const limits = getSlideLimits(slideType);
  const rawKeyContent =
    safeSlide.keyContent && typeof safeSlide.keyContent === "object"
      ? safeSlide.keyContent
      : typeof safeSlide.keyContent === "string"
        ? { headline: safeSlide.keyContent }
        : {};

  const headline = clampText(rawKeyContent.headline, limits.maxHeadline);
  const subHeadline = clampText(rawKeyContent.subHeadline, limits.maxSubHeadline);
  const body = normalizeBody(rawKeyContent.body, limits);
  const density = calculateDensity(headline, subHeadline, body);
  const visualMode = inferVisualMode(
    slideType,
    body,
    normalizeText(safeSlide.visual),
    Boolean(options.hasImage),
  );

  return {
    ...safeSlide,
    keyContent: {
      ...rawKeyContent,
      headline,
      subHeadline,
      body,
    },
    layoutMeta: {
      density,
      visualMode,
      bulletCount: body.length,
      avgBulletLength:
        body.length > 0
          ? body.reduce((sum, item) => sum + item.length, 0) / body.length
          : 0,
      contentScore:
        headline.length +
        subHeadline.length * 0.7 +
        body.reduce((sum, item) => sum + item.length, 0),
      wasTrimmed:
        body.length !== (Array.isArray(rawKeyContent.body) ? rawKeyContent.body.length : 0) ||
        headline !== normalizeText(rawKeyContent.headline) ||
        subHeadline !== normalizeText(rawKeyContent.subHeadline),
    },
  };
}

export function expandSlidesForRendering(outlineSlides = [], slideImages = []) {
  const expandedSlides = [];
  const expandedSlideImages = [];
  const imageByNumber = new Map();

  for (const image of slideImages) {
    if (image && typeof image.number === "number") {
      imageByNumber.set(image.number, image);
    }
  }

  outlineSlides.forEach((slideData, index) => {
    const safeSlide = slideData && typeof slideData === "object" ? slideData : {};
    const slideType = safeSlide.type || "content";
    const limits = getSlideLimits(slideType);
    const rawKeyContent =
      safeSlide.keyContent && typeof safeSlide.keyContent === "object"
        ? safeSlide.keyContent
        : typeof safeSlide.keyContent === "string"
          ? { headline: safeSlide.keyContent }
          : {};
    const normalizedBody = normalizeBodyItems(rawKeyContent.body, limits);
    const bodyChunks = chunkBodyForRender(normalizedBody, slideType);
    const sourceSlideNumber =
      typeof safeSlide.number === "number" ? safeSlide.number : index + 1;
    const sourceImage = imageByNumber.get(sourceSlideNumber) || null;

    bodyChunks.forEach((bodyChunk, chunkIndex) => {
      const isContinuation = chunkIndex > 0;
      const nextSlide = {
        ...safeSlide,
        filename: isContinuation
          ? `${safeSlide.filename || `slide-${sourceSlideNumber}`}-part-${chunkIndex + 1}`
          : safeSlide.filename,
        keyContent: {
          ...rawKeyContent,
          headline: isContinuation
            ? createContinuationHeadline(rawKeyContent.headline, chunkIndex)
            : rawKeyContent.headline,
          subHeadline: rawKeyContent.subHeadline || "",
          body: bodyChunk,
        },
        visual: isContinuation ? "" : safeSlide.visual,
        preferredLayout: isContinuation
          ? "text-only"
          : safeSlide.preferredLayout,
        splitMeta: {
          sourceSlideNumber,
          chunkIndex,
          chunkCount: bodyChunks.length,
        },
      };

      expandedSlides.push(nextSlide);
      expandedSlideImages.push(isContinuation ? null : sourceImage);
    });
  });

  const numberedSlides = expandedSlides.map((slide, index) => ({
    ...slide,
    number: index + 1,
  }));

  const numberedImages = expandedSlideImages
    .map((image, index) =>
      image
        ? {
            ...image,
            number: index + 1,
          }
        : null,
    )
    .filter(Boolean);

  return {
    slides: numberedSlides,
    slideImages: numberedImages,
    didSplit: numberedSlides.length !== outlineSlides.length,
  };
}

function scoreLayout(layout, normalizedSlide, options) {
  const meta = normalizedSlide.layoutMeta || {};
  const density = meta.density || "medium";
  const bodyArea = (layout.body?.w || 0) * (layout.body?.h || 0);
  const titleArea = (layout.title?.w || 0) * (layout.title?.h || 0);
  const bodyWidth = layout.body?.w || 0;
  const bulletCount = meta.bulletCount || 0;
  const avgBulletLength = meta.avgBulletLength || 0;
  const cycleSeed = options.cycleSeed || 0;

  let score = titleArea * 0.5;

  if (density === "high") {
    score += bodyArea * 2.5;
  } else if (density === "medium") {
    score += bodyArea * 1.6;
  } else {
    score += bodyArea;
  }

  if (bulletCount >= 4 && bodyWidth < 5.5) {
    score -= 3;
  }

  if (avgBulletLength > 28 && bodyWidth < 5.5) {
    score -= 3;
  }

  if (avgBulletLength > 36 && layout.name === "top-banner") {
    score -= 6;
  }

  if ((meta.visualMode === "diagram" || meta.visualMode === "chart") && layout.name === "top-banner") {
    score -= 4;
  }

  if (meta.visualMode === "ai-image" && layout.name === "left-float") {
    score += 1.2;
  }

  if (density === "low" && (layout.name === "left-float" || layout.name === "right-circle")) {
    score += 1;
  }

  if (density === "high" && layout.name === "text-only") {
    score += 2;
  }

  score += ((cycleSeed + (layout.orderWeight || 0)) % 4) * 0.1;

  return score;
}

export function chooseContentLayout(layouts, normalizedSlide, options = {}) {
  if (!Array.isArray(layouts) || layouts.length === 0) {
    return null;
  }

  if (normalizedSlide?.preferredLayout) {
    const preferred = layouts.find(
      (layout) => layout.name === normalizedSlide.preferredLayout,
    );
    if (preferred) {
      return preferred;
    }
  }

  const wantsImage = Boolean(options.hasImage);
  const candidates = layouts.filter((layout) => {
    if (!wantsImage) {
      return !layout.hasImage;
    }
    return layout.hasImage;
  });

  const safeCandidates = candidates.length > 0 ? candidates : layouts;
  let bestLayout = safeCandidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const layout of safeCandidates) {
    const score = scoreLayout(layout, normalizedSlide, options);
    if (score > bestScore) {
      bestLayout = layout;
      bestScore = score;
    }
  }

  return bestLayout;
}

export function getSlideTypography(normalizedSlide) {
  const meta = normalizedSlide?.layoutMeta || {};

  if (meta.density === "high") {
    return {
      titleFontSize: 28,
      bodyFontSize: 14,
      lineSpacing: 22,
    };
  }

  if (meta.density === "low") {
    return {
      titleFontSize: 34,
      bodyFontSize: 18,
      lineSpacing: 30,
    };
  }

  return {
    titleFontSize: 32,
    bodyFontSize: 16,
    lineSpacing: 26,
  };
}
