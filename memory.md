# MEMORY - Long-term Curated Knowledge

## User Profile

- **Tony**: Product Manager with basic coding skills
- **Language**: Chinese (primary) / English (secondary)
- **Goal**: Exploring Claude Code and intelligent product development

---

## Project Background

**Project Name**: Internal Intelligent Solution Library (内部智能方案库)

**Core Objectives** (Two Modules):
1. **Solution Knowledge Management**: Intelligent search and Q&A for existing solutions
2. **AI-Assisted Solution Writing**: Auto-generate new solutions based on product capability library + PPT generation

**Target Users**: Product Managers, Solution Architects

**Tech Stack**: React + Tailwind (Frontend) / Node.js + Express (Backend)

---

## Environment Configuration

### Domain Configuration (Critical)

**Use fixed domain** `kb-server.local` instead of IP address to avoid broken image links when IP changes.

**hosts file**: `C:\Windows\System32\drivers\etc\hosts`
```
192.168.1.121  kb-server.local
```

**Update script**: `update-hosts.ps1` (run as Administrator)

### Files to Update When IP Changes

| File | Setting | Current Value |
|------|---------|---------------|
| `server/.env` | `BASE_URL` | `http://kb-server.local:3001` |
| `client/vite.config.ts` | `proxy.*.target` | `http://kb-server.local:3001` |

### Environment Variables

```bash
# FastGPT
FASTGPT_API_KEY=sk-xxx
FASTGPT_BASE_URL=http://localhost:3000/api

# FastGPT Applications
FASTGPT_WORKFLOW_KEY=fastgpt-xxx
FASTGPT_SOLUTION_GENERATOR_APP_KEY=fastgpt-xxx
FASTGPT_SOLUTION_GENERATOR_CHAT_ID=6975be07f01eea03a02ee1ca
FASTGPT_COMPLEXITY_ANALYZER_APP_KEY=fastgpt-xxx
FASTGPT_COMPLEXITY_ANALYZER_CHAT_ID=697737f57edd6198ff857567
FASTGPT_CAPABILITY_EXTRACTOR_APP_KEY=fastgpt-xxx
FASTGPT_CAPABILITY_EXTRACTOR_CHAT_ID=6979ca98a1907f6252a59dc5

# MinerU
MINERU_BASE_URL=http://localhost:8887
MINERU_API_TOKEN=xxx

# Server
PORT=3001
BASE_URL=http://kb-server.local:3001
```

---

## Product Methodology

**Core Principle**: "Simple" - Focus on one feature and do it extremely well, not adding features

**Product Trinity**:
1. **Predict** - Predict market trends
2. **Single Point Breakthrough** - Find a foothold
3. **All-in** - Invest all resources

**Practice**: Every project should pursue extreme simplicity

---

## Development Principles

1. **Keep it Simple** - Each feature does one thing extremely well
2. **Avoid Over-engineering** - Don't add complexity for "future possible" needs
3. **Progressive Development** - Verify core functionality first, then extend

---

## File Upload Strategy

- **Local parsing**: mammoth (Word), xlsx (Excel)
- **Online API**: MinerU (PDF/DOC/PPT)
- **FastGPT**: Text import for knowledge base

---

## Important Lessons

### Port Management - Don't Kill FastGPT!
- **3000 port** = FastGPT (NEVER close this)
- **3001 port** = kb-server (restart this for code changes)

### Service Restart Workflow
1. Kill old service: `powershell -Command "Stop-Process -Id <PID> -Force"`
2. User manual start: `cd server && npm start`
3. Logs output to terminal for debugging
4. User can Ctrl+C to stop when done

### FastGPT Application Configuration
- **FastGPT 忽略 API 的 system message** — 必须把指令放到 user message 里
- 已修复: systemPrompt + user prompt 合并为一条 user message 发送
- 如需更新 FastGPT 平台上的系统提示词，需要手动在 FastGPT 后台操作

---

## Project Status

**产品定位已重新定义** (2026-02-03)

### 核心能力：让方案人员更快写好方案

| 能力 | 描述 | 状态 |
|------|------|------|
| 方案知识库 | 上传历史方案，智能搜索和问答 | ✅ 完成 |
| AI 方案生成 | 输入需求，AI 生成方案 + 导出 PPT | ✅ 完成 |
| 产品能力库 | 公司产品能力清单（人工维护） | ✅ 完成 |

### 模块进度

| Module | Status | Progress |
|--------|--------|----------|
| Module 1: Solution Knowledge Base | ✅ Complete | Phase 1-5 |
| Module 2: AI Solution Writing | ⏳ Partial | Phase 6-7 ✅, Phase 8 ⏳ |
| Module 3: Experience Enhancement | 📋 Planned | Phase 9 |
| Module 4: PPT Generation | ⏳ 优化中 | Phase 10 ✅ 基础功能, 内容丰富度优化中 |
| Module 5: Capability Extraction | ❌ Cancelled | 存在逻辑循环 |

### PPT 内容丰富度优化 (2026-03-03 进行中)

**目标**: 将 PPT 从"关键词提词卡"升级为"方案叙事模式"，每页 ~35 字 → ~150-250 字

**已完成**:
- ✅ layout-engine.js: 放宽字符限制 (maxCharsPerBullet 46→90, maxCharsPerChunk 150→350)
- ✅ index.js systemPrompt: 重写为方案叙事模式（要点标题 — 展开说明，50-80字/条）
- ✅ ppt-generator.js: 富文本渲染（要点标题加粗 + 说明文字）、斜体概述段落、speakerNotes
- ✅ **关键修复**: 发现 systemPrompt 从未被发送给 FastGPT（FastGPT 忽略 system message），改为将 systemPrompt + user prompt 合并为一条 user message 发送
- ✅ SolutionEditor.tsx: 修复全部中文乱码（encoding corruption）和英文翻译

**待验证** (明天继续):
- ⏳ 重新生成一份方案，验证内容丰富度是否提升
- ⏳ 如果内容仍不够丰富，可能需要在 FastGPT 平台上也更新 prompt
- ⏳ PPT 视觉质量优化（布局、图片、排版）— 后续再做

### 重要发现: FastGPT prompt 传递机制
- FastGPT 对话应用**忽略** API 发送的 system message
- 必须把所有指令放到 user message 里（已修复）
- 或者在 FastGPT 平台上直接配置系统提示词

### 阶段 8 待完成
- **导出功能**：已完整 ✅（PPT 是唯一演示输出格式）
- ❌ 版本管理（历史/对比/回退）

---

## Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| localStorage for chat persistence | Simple, no backend support needed |
| MinerU online API | Avoid local deployment complexity |
| react-markdown for rendering | Supports GitHub Flavored Markdown |
| Separate global chat and per-solution chat | Different use cases |
| Capability library separate from solution library | Clear concepts, easier management |
| JSON file storage for initial version | Simple and fast, no database needed |
| Fixed domain `kb-server.local` | Avoid broken links when IP changes |
| **Capability library manually maintained** | **Not extracted from solutions (2026-02-03)** |
| **Phase 11 cancelled** | **Logic loop: solutions → capabilities → solutions...** |

---

*Last updated: 2026-03-03*
