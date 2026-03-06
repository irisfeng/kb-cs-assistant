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

## Notes

- The backend still lives mostly in `server/src/index.js`.
- Some legacy draft/PPT generation code still exists in the backend and is now disabled by default unless `ENABLE_LEGACY_DRAFTS=true`.
- This project focuses on customer service knowledge retrieval, SOP execution, and AI response assistance.
