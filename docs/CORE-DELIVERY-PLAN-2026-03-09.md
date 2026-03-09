# 核心功能快速可用执行方案（2026-03-09）

## 1. 当前目标

本轮以“先可用、再优化”为原则：

1. 知识提报 -> 审核 -> 发布主链路稳定可跑。
2. 单文档问答与全局问答可用于辅助检索，但仍保留人工复核。
3. Excel 问答资产可批量转化并可导入 FastGPT。

---

## 2. 已落实改造（今晚）

### 2.1 单文档工作流模型改为可配置

后端已从硬编码模型切换为环境变量配置：

- `FASTGPT_SOLUTION_APP_MODEL`（默认 `solution-kb-chat`）
- `FASTGPT_SOLUTION_APP_KEY`（未配置时回退到 `FASTGPT_WORKFLOW_KEY`）

收益：

1. 后续切换单文档工作流模型不需要改代码。
2. 可按环境（本地/测试/生产）分别指定不同 FastGPT app channel。

### 2.2 新增 Excel -> FastGPT 问答模板导出脚本

新增脚本：`server/src/scripts/export-xlsx-fastgpt-qa.js`

输出：

1. `fastgpt-qa-template.csv`（列：`q,a,indexes`）
2. `fastgpt-qa-records.json`
3. `summary.json`

用途：

1. 将 Excel 问答直接转成 FastGPT 模板导入格式。
2. 可作为“问答对模式”导入源，不再只能走 chunk。

---

## 3. 明日执行顺序（按优先级）

### P0（上午，必须完成）

1. 跑两份 Excel 导出 `q,a,indexes` CSV。
2. 在 FastGPT 对应知识库执行模板导入。
3. 完成 20 条高频问题抽检（命中率、引用稳定性、答复一致性）。
4. 仅发布 `PUBLIC_CS` 资产，内部资产保持未发布。

验收标准：

1. Excel 问答对导入成功率 >= 99%。
2. 高频问题首轮可回答率 >= 90%。
3. 不出现“无依据却给确定承诺”的回答。

### P1（本周）

1. 单文档工作流与全局工作流拆分会话策略与提示词策略。
2. 完成“证据不足时固定保守答复”兜底。
3. 补齐内部库并配置 `FASTGPT_INTERNAL_DATASET_ID`。

---

## 4. 持续优化方案（两周）

### 阶段 A：质量稳定

1. 增加问答回归集（退款/投诉/账号/激活/物流）。
2. 每次发布前自动跑回归，输出通过率报告。
3. 对“欢迎语漂移”与“空检索”建立告警计数。

### 阶段 B：治理与权限

1. 提报、审核、发布增加角色权限校验（非仅前端按钮控制）。
2. 增加操作审计日志（谁在何时发布了什么）。
3. 建立版本回滚机制（文档级、库级）。

### 阶段 C：运营闭环

1. 统计 Top 问题与低命中问题。
2. 自动沉淀“待补知识清单”。
3. 周节奏复盘：新增知识、命中率、人工升级率。

---

## 5. 部署方案（由快到稳）

### 路径 1：快速可用（当前推荐）

1. 单机部署前后端 + 独立 FastGPT。
2. 仅开公共库发布，内部库先控流量。
3. 每日备份 `server/src/db.json` 与 `server/public/files`。

### 路径 2：准生产

1. 增加 `staging` 环境，所有发布先过 staging 回归。
2. 生产发布需包含回滚预案与冒烟清单。
3. 将文件与结构化数据逐步迁移到更稳存储（对象存储 + DB）。

---

## 6. 单文档工作流与 DeepSeek V3 迁移矩阵

### 6.1 单文档方案对应工作流

当前单文档问答走：

- 后端接口：`POST /api/solutions/:id/chat`
- FastGPT channel：`FASTGPT_SOLUTION_APP_MODEL`（默认 `solution-kb-chat`）

### 6.2 是否都能换 DeepSeek V3

可以换（文本问答类）：

1. 单文档问答工作流（solution channel）
2. 全局问答工作流（global channel）
3. 复杂度分析与方案生成（如果启用 legacy drafts 且对应 FastGPT app 使用文本模型）

不能直接用 DeepSeek V3 替代（非文本工作流）：

1. MinerU 文档解析（OCR/版面抽取能力）
2. 幻灯片图片生成（Volcengine/AIHubMix 图像模型链路）

结论：

1. “问答工作流”可统一迁移到 DeepSeek V3。
2. “文档解析/图片生成”仍需保留专用服务。

---

## 7. 明日可直接执行命令（示例）

```powershell
Set-Location "C:\Users\tonif\Documents\trae_projects\kb-cs-assistant\server"
node src/scripts/export-xlsx-fastgpt-qa.js `
  --file "C:\Users\tonif\Documents\work\1207\BSY\项目\天翼视联\知识库资料\天翼视联知识库 祁慧靓\天翼视联网产品F&Q.xlsx" `
  --file "C:\Users\tonif\Documents\work\1207\BSY\项目\天翼视联\知识库资料\天翼视联知识库-AI产品\视联网知识库-AI产品.xlsx" `
  --output "C:\Users\tonif\Documents\trae_projects\kb-cs-assistant\tmp\qa-csv-20260309"
```

