# Development Memory

## 2026-03-06

### 项目状态评估
- 完成仓库结构、文档、前后端代码与运行脚本核对。
- 明确当前项目定位为“客服智能知识助手”，但代码仍处于从旧的方案/PPT 生成器向客服助手迁移的过渡态。
- 确认当前主能力包括：知识文档上传、全局问答、单文档问答、SOP/能力库管理。
- 确认当前缺口包括：会话隔离、上传状态机、审计日志、运营看板、自动化测试基线。

### 规划与文档
- 新增下一阶段冲刺清单：[docs/NEXT-SPRINT-BACKLOG.md](./NEXT-SPRINT-BACKLOG.md)。
- 将冲刺任务拆分为 P0/P1/P2，并补充测试 Backlog、两周排期和冲刺退出标准。

### 已完成开发
- 完成前端主路径收口，移除 `generator`、`editor`、`draft` 相关导航与视图状态。
- 更新前端 `ViewMode`，只保留 `solutions`、`upload`、`solution-detail`、`capabilities`。
- 重写侧边栏组件，聚焦客服知识库、上传和 SOP 主路径。
- 更新首页摘要卡片和说明文案，减少旧的 playbook/PPT 产品表达。
- 更新 README，明确 legacy draft/PPT 代码不再属于主产品路径。

### 验证结果
- `client`: `npx tsc --noEmit` 通过。
- `server`: `node --check src/index.js` 通过。
- `vite build` 未完成过一次完整验证，历史失败原因为沙箱环境中的 `esbuild` 子进程权限限制，而非已确认代码错误。

### 当前遗留
- 后端 legacy `draft/PPT` 路由仍存在，尚未隔离出主服务路径。
- 聊天链路仍未引入 `sessionId` 端到端隔离。
- 上传尚无 `queued/processing/success/failed` 状态机。
- 中文文案和默认数据仍有乱码与历史样本污染问题。
- 项目尚未建立自有自动化测试。

### 下一步
- P0-04：打通 `sessionId` 会话隔离链路。
- P0-05：补上传任务状态机。
- P0-06：统一错误码与日志结构。
