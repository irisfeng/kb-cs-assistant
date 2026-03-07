# 本地联调验证记录（2026-03-08）

## 1. 验证目标

在本机确认以下核心链路可用：

1. 知识提报
2. 班长审核
3. 发布入 FastGPT
4. 知识列表展示
5. 单文档详情与预览
6. 全局问答
7. 单文档问答
8. 内部支持文档发布保护
9. Excel 知识素材分流

## 2. 本地环境

当时在线服务：

1. 前端：`http://127.0.0.1:5173`
2. 后端：`http://127.0.0.1:3001`
3. FastGPT：`http://127.0.0.1:3000`

已确认：

1. `GET /api/knowledge/submissions` 返回 `200`
2. `GET /api/solutions` 返回 `200`

## 3. 已执行验证

### 3.1 API 主链路

已通过。

执行内容：

1. 使用临时 Markdown 文档走 `提报 -> 审核 -> 发布`
2. 使用真实 `.docx` 文档再次走 `提报 -> 审核 -> 发布`

结果：

1. 两次都成功生成 `solution`
2. `solutions` 数量按预期增长
3. `.docx` 文档被判定为 `PUBLIC_CS / IMPORT`

### 3.2 前端真实操作

已通过。

执行内容：

1. 在首页点击 `Submit Knowledge Change`
2. 通过前端页面提交一份 Markdown 联调文档
3. 在队列中点击“审核通过”
4. 点击“发布入库”
5. 在知识列表中打开新资产详情页

使用的固定样本：

1. [server/test-fixtures/ui-smoke-knowledge.md](/Users/tonif/Documents/trae_projects/kb-cs-assistant/server/test-fixtures/ui-smoke-knowledge.md)

结果：

1. 页面创建提报成功
2. 审核状态从 `PENDING_REVIEW` 变为 `APPROVED`
3. 发布后资产出现在知识列表
4. 详情页预览正常显示

### 3.3 单文档问答

已通过。

执行内容：

1. 打开 `UI Smoke Test Submission`
2. 提问“这份文档验证的是什么流程？”

结果：

1. 返回结构化答案
2. 页面正常渲染 `建议回复 / 处理步骤 / 核验要点 / 升级建议 / 引用依据`

### 3.4 全局问答

已通过。

执行内容：

1. 首页全局聊天提问“UI Smoke Test Submission 主要验证什么流程？”

结果：

1. 返回结构化答案
2. 显示引用来源按钮与来源列表

### 3.5 `.docx` 详情预览

已通过。

执行内容：

1. 打开 `天翼视联-天翼视联商城-赋之科技移动机器人(EBO-SE)客服文档-全国-20250616V4.0.docx`

结果：

1. 详情页能正常加载解析内容
2. 文档元信息、标题层级和正文都可见
3. 页面显示 `由 MinerU 智能解析`

### 3.6 内部支持文档保护

已通过。

执行内容：

1. 在前端对 `INTERNAL_SUPPORT` 提报点击“发布入库”

结果：

1. 发布失败
2. 后端返回 `FASTGPT_DATASET_NOT_CONFIGURED`
3. 当前待发布记录仍保留 `APPROVED / IMPORT_INTERNAL_ONLY`
4. 未误入公共知识库

说明：

仓库中还存在一条更早的内部支持已发布记录，这是安全修复前的历史测试数据，不代表当前行为。

### 3.7 Excel 知识素材分流

已通过。

执行内容：

1. 提交 `视联网知识库-AI产品.xlsx`

结果：

1. 系统识别为 `PUBLIC_CS`
2. 推荐动作为 `EXTRACT_THEN_IMPORT`
3. 没有被错误当成普通文档直接发布

## 4. 本轮修正

### 4.1 前端错误提示

已修正。

内容：

1. 前端现在会优先展示后端返回的真实错误信息
2. 内部支持文档发布失败时，不再只有泛化的 `Publish failed`

代码位置：

- [client/src/App.tsx](/Users/tonif/Documents/trae_projects/kb-cs-assistant/client/src/App.tsx)

### 4.2 本地 `BASE_URL`

已做本地修正，不进入 Git。

处理：

1. 原值 `http://kb-server.local:3001` 返回 `502`
2. 已改成本机可访问地址 `http://192.168.6.121:3001`
3. 并创建本地备份文件 `server/.env.backup-20260308-baseurl`

说明：

这个改动只在本机环境生效，用于保证 Docker 中的 FastGPT 可访问后端静态图片路径。

## 5. 当前结论

就今天的“先本机跑通再上线”目标来说，核心功能已经通过：

1. 主链路通过
2. 前端真实操作通过
3. 问答通过
4. 保护分支通过
5. Excel 分流通过

## 6. 剩余注意项

1. Playwright 浏览器会话在后半程被系统现有 Chrome 会话挤掉，最后一次“前端错误提示文案”未再次通过浏览器截图确认，但代码已编译通过。
2. 本地 `BASE_URL` 修改没有推送到 Git，只在当前机器有效。
3. `server/src/db.json` 与 FastGPT 当前已有多条 smoke 数据，后续如需清理应统一做一次测试数据清场。
