# Development Backups

This file records important local or remote backup points during the customer service intelligent knowledge system migration.

## 2026-03-07

- Milestone backup commit: `658f1fb5ecf3349669039661ae3b4456ee95124d`
- Scope:
  - legacy `draft/PPT` route isolation
  - `sessionId` chat continuity wiring
  - upload state machine
  - structured reply rendering
  - capability data cleanup
  - acceptance scenario checklist

## 2026-03-08

- Local backup created before adjusting the local callback base URL:
  - `server/.env.backup-20260308-baseurl`
- Purpose:
  - preserve the original `.env` before changing `BASE_URL`
  - keep a rollback point for the local-only FastGPT callback path
