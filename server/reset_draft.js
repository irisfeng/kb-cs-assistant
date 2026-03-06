import fs from 'fs';

const dbPath = 'data/drafts.json';
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const draft = data.drafts.find(d => d.id === 'draft_1769332225077_nnoc95cdg');
if (draft) {
  draft.status = 'outline';
  draft.slideImages = [];
  draft.generationProgress = {
    total: 8,
    completed: 0,
    failed: 0,
    slides: {}
  };
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  console.log('Draft reset successfully');
} else {
  console.log('Draft not found');
}
