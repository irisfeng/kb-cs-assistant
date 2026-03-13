# 内部支持库启用记录（2026-03-13）

## 目标

完成 `视频AI算法舱` 这条受限知识的内部支持落库，避免其继续滞留在“待拆分/待脱敏”状态。

## 本次动作

### 1. 新建内部支持知识库

- 知识库名称：`tysl-local-kb-internal-support`
- datasetId：`69b3fc2708bebeccb30c2e2d`
- 用途：仅用于内部运维、二线客服和交付协同，不对外提供

### 2. 补齐环境配置

- 已在 [server/.env](/Users/tony/Documents/GitHub/kb-cs-assistant/server/.env) 中新增：
  - `FASTGPT_INTERNAL_DATASET_ID=69b3fc2708bebeccb30c2e2d`

### 3. 提取原始文档并生成脱敏稿

- 原始文档：
  - [天翼视联-翼智企标准 ICT 业务容器类增值应用-视频AI算法舱客服文档-全国-20250813V1.0.docx](/Users/tony/Downloads/天翼视联知识库%20祁慧靓/天翼视联-翼智企标准%20ICT%20业务容器类增值应用-视频AI算法舱客服文档-全国-20250813V1.0.docx)
- 提取中间稿：
  - [video-ai-algocabin-20260313.md](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/video-ai-algocabin-20260313.md)
- 脱敏后内部支持稿：
  - [tysl-internal-video-ai-algocabin-support-v1.md](/Users/tony/Documents/GitHub/kb-cs-assistant/docs/knowledge-drafts/tysl-internal-video-ai-algocabin-support-v1.md)

### 4. 导入内部支持知识库

- collection 名称：`翼智企标准 ICT 视频AI算法舱内部支持口径（脱敏版）`
- collectionId：`69b3fc7608bebeccb30c2e64`

## 脱敏原则

原始文档中的以下内容没有进入知识库：

- 私网平台地址
- 默认普通用户账号
- 默认管理员账号
- SSH 账号口令
- 内网端口和内部访问方式

知识库中只保留：

- 产品概览
- 订购 / 退订口径
- 平台模块说明
- 内部排障步骤
- 升级排查时必须收集的信息
- 明确的“不可对外提供”边界

## 验证结果

### 训练状态

- `rawTextLength = 1833`
- `indexAmount = 14`
- `trainingType = chunk`

### 安全检查

对 collection chunk 做了关键字检查：

- `192.168.`：未命中
- `task_test`：未命中
- `system@2024`：未命中
- `ictuser`：未命中
- `30907`：未命中
- `18080`：未命中

说明：

- `SSH` 关键词有命中，但仅出现在“SSH 信息不入库”的脱敏说明里，不包含账号或密码

### 路由检查

- [knowledge-workflow.js](/Users/tony/Documents/GitHub/kb-cs-assistant/server/src/knowledge-workflow.js) 中 `INTERNAL_SUPPORT` 现在会优先命中 `FASTGPT_INTERNAL_DATASET_ID`
- 本地验证 `resolveDatasetIdForSubmission({ audienceScope: 'INTERNAL_SUPPORT' })` 已返回新建的内部库 datasetId

### 服务状态

- 后端已重启并恢复监听 `:3001`
- `http://127.0.0.1:3001/api/solutions` 返回 `200`

## 剩余事项

1. 若后续需要处理 `视频AI算法舱` 对应的 Excel 派生 markdown，应继续沿用“脱敏后再入库”的方式
2. 当前内部支持库只导入了 `docx` 提炼出的脱敏支持稿，还没有导入任何原始私网登录细节
