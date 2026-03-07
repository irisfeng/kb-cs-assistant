# Development Memory

## 2026-03-06

### Project Status
- Confirmed the target product is the customer service intelligent knowledge system.
- Confirmed the repo is still in migration from the old solution/PPT generator to the customer service knowledge workflow.
- Confirmed the current main path includes knowledge upload, global Q&A, document-scoped Q&A, and SOP/capability management.

### Planning
- Added the sprint execution list in [docs/NEXT-SPRINT-BACKLOG.md](C:/Users/tonif/Documents/trae_projects/kb-cs-assistant/docs/NEXT-SPRINT-BACKLOG.md).
- Split follow-up work into P0, P1, and P2 priorities with acceptance criteria and test backlog.

### Completed Changes
- Narrowed the frontend primary navigation to knowledge base, upload, and SOP-related customer service flows.
- Updated the frontend view state to remove the exposed `generator`, `editor`, and `draft` primary path.
- Updated the README to position the project as a customer service knowledge assistant.
- Isolated backend legacy `draft/PPT` routes behind `ENABLE_LEGACY_DRAFTS`.
- Disabled legacy `draft/PPT` endpoints by default and changed disabled access to return `410 LEGACY_FEATURE_DISABLED`.
- Replaced the broken legacy PPT template lookup with a filesystem-based fallback.
- Updated the backend package description to match the customer service product.
- Added persistent `sessionId` storage for both global chat and document-scoped chat.
- Wired frontend chat requests to send `sessionId` to `/api/chat` and `/api/solutions/:id/chat`.
- Mapped incoming `sessionId` to FastGPT `chatId` on the backend for real session continuity.

### Verification
- `client`: `npx tsc --noEmit` passed earlier after frontend path cleanup.
- `client`: `npx tsc --noEmit` passed after the `sessionId` wiring change.
- `server`: `node --check src/index.js` passed after the legacy isolation and `sessionId` wiring changes.
- `vite build` has not completed successfully in this environment because of the sandboxed `esbuild` child process permission issue observed earlier.

### Remaining Risks
- Legacy `draft/PPT` implementation still exists in `server/src/index.js`; it is gated now, not removed.
- Upload task states still do not expose `queued/processing/success/failed`.
- Locale content and default sample data still contain old terminology and migration residue.
- The project still lacks its own automated test suite.

### Next Steps
- P0-04: wire `sessionId` through both frontend and backend chat paths.
- P0-05: add upload task state management.
- P0-06: normalize error codes and structured logs.

## 2026-03-07

### Completed Changes
- Added an upload state machine on the client with `queued`, `processing`, `success`, and `failed` states.
- Updated the upload modal to show current upload phase, progress, and error/success messaging clearly.
- Added upload status fields to backend upload responses and explicit status logs in the upload pipeline.
- Fixed upload failure cleanup so temporary files and copied originals do not linger after a failed import.
- Added request IDs, structured log events, and explicit error codes to the core upload/chat paths.
- Added structured support-section rendering in the main chat UI for reply, steps, verification, escalation, and evidence.
- Rebuilt capability library/category forms with clean customer-service category labels.
- Replaced the default capability data with customer-service SOP samples instead of legacy telecom / PPT-derived data.
- Rebuilt the Chinese locale file from source to remove乱码 and stale phrasing.
- Added a core acceptance scenario checklist and a backup tracking document.

### Verification
- `client`: `npx tsc --noEmit` passed after the upload state changes.
- `server`: `node --check src/index.js` passed after the upload response and cleanup changes.
- Milestone backup commit created: `658f1fb5ecf3349669039661ae3b4456ee95124d`.

### Next Steps
- P0-06: normalize error codes and structured logs.
- P1-05: clean legacy sample data and terminology in locale/content files.
- P1-06: build the five customer-service acceptance scenarios for regression.

### Additional Planning
- Added the deployment workflow draft in [docs/DEPLOYMENT-PIPELINE-PLAN.md](C:/Users/tonif/Documents/trae_projects/kb-cs-assistant/docs/DEPLOYMENT-PIPELINE-PLAN.md).
- Defined the recommended environment split as `preview` on Vercel + Neon, `staging` on Alibaba Cloud, and `production` on Alibaba Cloud.
- Defined the recommended Git branch mapping as `feature/*` -> preview, `develop` -> staging, and `main` -> production.
- Defined CI/CD workflow responsibilities for `ci.yml`, `preview.yml`, `staging.yml`, and `production.yml`.
- Defined release checks for migration, smoke testing, and rollback preparation.

### Additional Verification
- Documentation-only planning update; no extra build step was required.

### Additional Next Steps
- Create GitHub Actions workflow files based on the deployment pipeline plan.
- Define environment-specific variable groups and secret naming conventions.
- Convert the release checklist into an executable staging and production SOP.

### Documentation Update
- Translated [docs/DEPLOYMENT-PIPELINE-PLAN.md](C:/Users/tonif/Documents/trae_projects/kb-cs-assistant/docs/DEPLOYMENT-PIPELINE-PLAN.md) into Chinese so the deployment workflow can be reviewed directly by the product and delivery team.

### Documentation Verification
- Confirmed the deployment pipeline document is now fully available in Chinese.

### Lean Delivery Planning
- Added [docs/LEAN-DELIVERY-PATH.md](C:/Users/tonif/Documents/trae_projects/kb-cs-assistant/docs/LEAN-DELIVERY-PATH.md) to define the minimal collaboration and deployment path for the current solo-human + AI-assisted workflow.
- Narrowed the recommended setup to `local + demo`, `feature/* + main`, and a single Alibaba Cloud demo environment.
- Defined the MVP-focused scope, minimal cloud resources, minimum release flow, and smoke checklist for this project stage.

### Lean Delivery Verification
- Documentation-only planning update; no extra code validation was required.

### Detail Page Upgrade
- Updated homepage knowledge cards to open the document detail page in a new browser tab using the `?solution=` query parameter.
- Added the document-scoped chat panel back into the single-document detail page so preview and question answering can be tested together.
- Softened the homepage UI by replacing the large black statistic block, primary action button, active sidebar state, and main chat user bubbles with the amber service palette.
- Confirmed the frontend type check passed after the detail-page and UI updates.

### MinerU Image Finding
- Confirmed the current MinerU upload path still does not wire image assets into FastGPT via the `localFile` helper.
- Confirmed the code path currently prefers HTTP/base64 markdown handling for images, which likely explains why FastGPT collection previews are not rendering document images even though the local detail page can still show them.

### Citation And Accuracy Upgrade
- Tightened document-scoped citation extraction so single-document chat now filters quote results by both `collectionId` and source-name matching instead of relying on collection match only.
- Added normalized citation deduplication and score-based sorting for both global chat and single-document chat before sending references to the frontend.
- Enriched citation payloads with source labels, file names, chunk indexes, and related solution metadata to support clearer evidence rendering.
- Updated the global chat and single-document chat UI to display citation labels and richer evidence snippets instead of bare text blocks.

### Citation Verification
- Confirmed frontend type-check passes with `client/npx tsc --noEmit`.
- Confirmed backend syntax-check passes with `server/node --check src/index.js`.

### FastGPT Workflow Follow-up
- The backend now also passes `sourceName` alongside `collectionId` to the solution-scoped FastGPT workflow variables.
- FastGPT workflow-side filtering still needs to be aligned so the knowledge-search node and AI response node consistently respect the current document scope and preserve quote metadata.
