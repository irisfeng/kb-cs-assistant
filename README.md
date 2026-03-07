# Customer Service Knowledge Assistant

This project is a cloned and adapted version of the original knowledge-base workspace. It is now positioned as a customer service intelligent knowledge assistant built around a local FastGPT deployment.

## What It Supports

- upload and parse support knowledge documents
- global AI support Q&A over the knowledge base
- document-specific Q&A for a single support document
- SOP and standard-reply library management
- support guidance with citations and operational consistency

## Recommended Use Cases

- refund and after-sales policy lookup
- complaint handling and de-escalation guidance
- account, permission, and product activation support
- escalation and handoff decision support
- support team onboarding and knowledge unification

## Prerequisites

1. FastGPT Community Edition is running locally and exposed on `http://localhost:3000`.
2. Node.js is installed.

## Backend Setup

```bash
cd server
npm install
npm start
```

Create or update `server/.env` with the FastGPT credentials used by this project.

Recommended values:

- `FASTGPT_BASE_URL=http://localhost:3000`
- `FASTGPT_DATASET_ID=...`
- `FASTGPT_PUBLIC_DATASET_ID=...` for normal customer-service assets
- `FASTGPT_INTERNAL_DATASET_ID=...` for internal-support-only assets
- `FASTGPT_API_KEY=...`
- `FASTGPT_APP_KEY=...`
- `FASTGPT_WORKFLOW_KEY=...`
- `ENABLE_LEGACY_DRAFTS=false` to keep old draft/PPT endpoints disabled in the main customer-service path

## Frontend Setup

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

## Main Flows

1. Upload FAQ, refund policy, product manual, or training material into the knowledge base.
2. Ask the global AI assistant support questions across all uploaded materials.
3. Open a single document and run scoped Q&A against that source only.
4. Maintain SOPs, escalation rules, and standard replies in the SOP library.
5. Use the assistant as a support copilot for refund, complaint, activation, account, and escalation scenarios.
6. Submit new knowledge or knowledge changes into a review queue, then approve and publish them to FastGPT.

## Architecture

- Frontend: React 19 + Vite + TypeScript + Tailwind CSS
- Backend: Node.js + Express
- AI layer: FastGPT (local deployment)
- Storage: local JSON files for documents and SOP items

## Runtime Data

- Knowledge documents: `server/src/db.json`
- SOP library: `server/data/capabilities.json`
- Uploaded files: `server/public/files`
- Extracted images: `server/public/images`

`server/src/db.json` now stores both published knowledge assets and `knowledgeSubmissions` waiting for review or publication.

Internal-support submissions require `FASTGPT_INTERNAL_DATASET_ID`. If it is not configured, internal documents will stay blocked at publish time instead of falling back to the public dataset.

## Inventory And Governance

Before importing large document batches into FastGPT, generate an inventory and review version/security classification first.

```bash
cd server
node src/scripts/generate-knowledge-inventory.js --dir="C:\\path\\to\\docs" --output="C:\\path\\to\\inventory-output"
```

The scanner produces JSON and CSV inventory files, classifies files into `PUBLIC_CS` / `INTERNAL_SUPPORT` / `RESTRICTED`, and records `SCAN_ERROR` items instead of aborting the whole batch when a source file cannot be parsed.

See `docs/KNOWLEDGE-BASE-GOVERNANCE-PLAN.md` for the recommended production library structure and document classification rules.

To convert the inventory into an import checklist and recommended dataset plan:

```bash
cd server
node src/scripts/generate-import-manifest.js --inventory="C:\\path\\to\\inventory-output\\knowledge-inventory.json" --output="C:\\path\\to\\manifest-output"
```

The manifest generator maps internal-only documents to `IMPORT_INTERNAL_ONLY`, spreadsheet sources to `EXTRACT_THEN_IMPORT`, and explicitly sensitive files to `SPLIT_OR_REDACT`.

To extract Q&A spreadsheets and device compatibility sheets into import-ready Markdown and JSON:

```bash
cd server
node src/scripts/extract-xlsx-knowledge.js --file="C:\\path\\to\\知识素材.xlsx" --output="C:\\path\\to\\xlsx-derived-output"
```

## Notes

- The backend still lives mostly in `server/src/index.js`.
- Some legacy draft/PPT generation code still exists in the backend and is now disabled by default unless `ENABLE_LEGACY_DRAFTS=true`.
- This project focuses on customer service knowledge retrieval, SOP execution, and AI response assistance.
- For the current release checklist and minimum deployment sizing, see `docs/FASTGPT_DEPLOYMENT.md`.
