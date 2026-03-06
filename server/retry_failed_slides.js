import fs from 'fs';
import axios from 'axios';

// Read draft data
const dbPath = 'data/drafts.json';
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const draft = data.drafts.find(d => d.id === 'draft_1769332225077_nnoc95cdg');
if (!draft) {
  console.log('Draft not found');
  process.exit(1);
}

// Get failed slides
const failedSlides = draft.outline.slides.filter(slide =>
  draft.generationProgress.slides[slide.filename]?.status === 'failed'
);

console.log(`Found ${failedSlides.length} failed slides to retry`);

// Image generation function
async function generateSlideImage(slide, styleInstructions) {
  const visualDesc = slide.visual || '';
  const keyContent = slide.keyContent || {};

  // Build prompt for ILLUSTRATION generation (small image, NO text)
  let prompt = `Create a professional business illustration icon (square aspect ratio).

Purpose: ${keyContent.headline || slide.type || 'Business concept'}

Visual Description:
${visualDesc}

Style Requirements:
- Clean, modern flat design or hand-drawn vector style
- NO TEXT, NO LETTERS, NO WORDS - pure visual/graphic only
- Simple, recognizable icon or symbol
- Professional business aesthetic
- ${styleInstructions.colorPalette || 'Blue and corporate colors'}
- Transparent or white background
- Minimalist design with 2-4 colors maximum

IMPORTANT:
- This is an ILLUSTRATION for placing on a slide, NOT a full slide
- Size: square/compact icon (not wide banner)
- Absolutely NO TEXT content
- Focus on the core concept: ${keyContent.headline || slide.type}`;

  const response = await axios.post(
    `${process.env.AIHUBMIX_BASE_URL}/v1/models/${process.env.AIHUBMIX_MODEL}/predictions`,
    {
      input: {
        prompt: prompt,
        size: "1024x1024",
        sequential_image_generation: "disabled",
        stream: false,
        response_format: "url",
        watermark: false
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.AIHUBMIX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    }
  );

  if (response.data && response.data.output && response.data.output[0] && response.data.output[0].url) {
    return response.data.output[0].url;
  } else {
    throw new Error('Invalid response from AIHubMix');
  }
}

// Retry failed slides
async function retryFailedSlides() {
  const styleInstructions = draft.outline.styleInstructions || {};
  const retryCount = 3;

  for (const slide of failedSlides) {
    let success = false;
    let lastError = null;

    for (let i = 0; i < retryCount && !success; i++) {
      try {
        console.log(`Retrying ${slide.filename} (attempt ${i + 1}/${retryCount})...`);
        const imageUrl = await generateSlideImage(slide, styleInstructions);

        // Update draft
        draft.generationProgress.slides[slide.filename] = {
          status: 'completed',
          url: imageUrl,
          error: null
        };
        draft.generationProgress.completed++;
        draft.slideImages.push({
          number: slide.number,
          filename: `${slide.filename}.png`,
          url: imageUrl
        });

        console.log(`Success: ${slide.filename}`);
        success = true;
      } catch (error) {
        lastError = error.message;
        console.error(`Failed: ${slide.filename} - ${error.message}`);
        // Wait before retry
        if (i < retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (!success) {
      draft.generationProgress.slides[slide.filename] = {
        status: 'failed',
        url: null,
        error: lastError
      };
      draft.generationProgress.failed++;
    }
  }

  // Save updated draft
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  console.log(`\nDone: ${draft.generationProgress.completed}/${draft.generationProgress.total} slides completed`);
}

retryFailedSlides().catch(console.error);
