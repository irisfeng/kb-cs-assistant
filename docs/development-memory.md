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
