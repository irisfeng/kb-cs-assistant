# 单文档 Workflow 配置记录（2026-03-12）

## 目的
把单文档问答的 FastGPT workflow 配置固定下来，避免继续依赖零散聊天记录口头对齐。

## 当前实现约束

### 后端依赖
- 单文档聊天当前调用的 channel 由 `FASTGPT_SOLUTION_APP_MODEL` 决定，默认是 `solution-kb-chat`。
- 后端会把两个变量传给 workflow：
  - `collectionId`
  - `sourceName`
- 后端还会对返回的 `quoteList` 再做一次当前文档过滤，只保留匹配当前文档的引用。

代码依据：
- [index.js#L349](/Users/tony/Documents/GitHub/kb-cs-assistant/server/src/index.js#L349)
- [index.js#L1765](/Users/tony/Documents/GitHub/kb-cs-assistant/server/src/index.js#L1765)
- [index.js#L1936](/Users/tony/Documents/GitHub/kb-cs-assistant/server/src/index.js#L1936)

### 当前调试约束
- 新产品知识库尚未完成正式迁移，因此单文档 workflow 的调试阶段先挂旧库 `天翼视联`。
- 当前本地 `solutions` 列表也是从旧库恢复回来的，调试时 `collectionId` 主要对应旧库里的 collection。

## 推荐节点结构

```text
流程开始
  -> 知识库搜索
      -> 判断器
          IF -> AI 对话 -> 指定回复(透传)
          ELSE -> 指定回复(固定兜底)
```

## 节点配置

### 1. 系统配置
- 对话开场白：留空
- 全局变量：
  - `collectionId`
  - `sourceName`

## 2. 知识库搜索
- 知识库：当前先选 `天翼视联`
- 用户问题：`流程开始 -> 用户问题`
- 搜索方式：`混合检索`
- 引用上限：`2000`
- 最低相关度：`0.45` 到 `0.55`
- 结果重排：开
- 问题优化：关

### 过滤规则
- 如果 FastGPT 当前版本支持 metadata / where / 过滤条件：
  - 先加 `collectionId = {{collectionId}}`
  - 如果还能加第二条，再加 `sourceName = {{sourceName}}`
- 如果当前版本不支持显式过滤：
  - 保持单知识库检索
  - 由后端 prompt + `quoteList` 二次过滤兜底

## 3. 判断器
- 左侧字段：`知识库搜索 -> 知识库引用`
- 条件：`长度大于`
- 值：`0`

### 分支语义
- `IF`：本轮知识库已返回引用，允许进入 AI 对话
- `ELSE`：本轮没有引用，直接返回固定兜底

## 4. AI 对话
- 模型：沿用当前稳定模型即可
- 聊天记录数：`4` 或 `6`
- 知识库引用：绑定 `知识库搜索 -> 知识库引用`
- 用户问题：绑定 `流程开始 -> 用户问题`

### 推荐提示词
```text
你是当前单文档的问答助手。

当前目标文档：
- collectionId: {{collectionId}}
- sourceName: {{sourceName}}

规则：
1. 只能依据知识库搜索节点返回的当前文档引用回答。
2. 只允许使用 collectionId 等于 {{collectionId}} 或 sourceName 等于 {{sourceName}} 的引用。
3. 如果检索结果里混入其他文档内容，全部忽略。
4. 如果当前文档没有足够依据，必须只回复：当前文档未找到足够依据，请人工复核。
5. 不要输出欢迎语。
6. 不要编造，不要总结其他文档。
7. 用用户提问的语言回答。

输出格式：
推荐回复：
处理步骤：
核验项：
升级建议：
引用依据：
```

## 5. 指定回复

### IF 分支
- 直接透传：`AI 对话 -> AI 回复内容`

### ELSE 分支
- 固定文案：

```text
当前文档未找到足够依据，请人工复核。
```

## 发布方式

### 当前 FastGPT UI 实测结论
- 这版 FastGPT 的“发布渠道 -> API 访问”页只提供当前应用的 API key 管理，没有单独可配置的模型别名。
- 后端 OpenAI 兼容调用实测应对齐：
  - `FASTGPT_SOLUTION_APP_MODEL = 当前应用名`
  - `FASTGPT_SOLUTION_APP_KEY = 当前应用在 API 访问页新建的 key`

### 当前落地方案
- 保留工作流名称：`solution-doc-scope-v1`
- 在 FastGPT 的 `发布渠道 -> API 访问` 中为该应用创建专用 key
- 将 [server/.env](/Users/tony/Documents/GitHub/kb-cs-assistant/server/.env) 更新为：
  - `FASTGPT_SOLUTION_APP_MODEL=solution-doc-scope-v1`
  - `FASTGPT_SOLUTION_APP_KEY=<该应用的 API key>`
- 重启后端，使单文档聊天切到这条 workflow

## 验收标准

### 通过标准
1. 命中当前文档时，返回结构化答复
2. 引用只来自当前文档
3. 连续追问时，不退化成欢迎语
4. 无命中时，稳定返回“当前文档未找到足够依据，请人工复核”

### 最小回归问题
1. `这份文档主要说明什么内容？`
2. 文档内一个明确问题
3. 文档外一个问题
4. 同一问题连续追问两次

## 当前风险提示
1. FastGPT 社区版不支持真正的 collection 硬隔离，当前仍是“workflow 检索 + prompt 限制 + 后端引用过滤”的组合方案。
2. 单文档 workflow 的关键不是换模型，而是先保证命中时有 `quoteList`、空命中时不再欢迎语退化。
3. 在新产品知识库完成迁移前，不要把单文档 workflow 直接切到那些空知识库上调试。

## 2026-03-12 实测补充
- 这版 FastGPT 的 `知识库搜索 -> 搜索过滤` 页面仅支持：
  - `引用上限`
  - `最低相关度`
- 当前 UI 不支持按 `collectionId`、`sourceName` 或 metadata 做真正的搜索前硬过滤。
- 因此，当前判断器条件：
  - `知识库搜索 -> 知识库引用 -> 长度大于 0`
  只能判断“是否搜到任意引用”，不能判断“是否搜到当前文档引用”。
- 实测表现：
  - 文档内问题可正常回答，并能保留当前文档引用
  - 文档外问题可返回“当前文档未找到足够依据，请人工复核。”
  - 但这类兜底目前主要是由 AI 提示词和后端 `quoteList` 过滤共同实现，不是 workflow 的 `ELSE` 分支稳定命中

## 后端待办
- 在 `/api/solutions/:id/chat` 中增加硬兜底：
  - 当当前文档有效引用数为 `0` 时，覆盖/终止 AI 输出，直接返回固定文案：
    - `当前文档未找到足够依据，请人工复核。`
- 同时增加单文档流式输出去重，避免偶发的重复段落或重复兜底文案。

## 后续切换建议
当产品知识库迁移完成后：
- 单文档 workflow 仍保持同一骨架
- 只把“知识库搜索”的目标数据集从旧库 `天翼视联` 切到对应的新产品知识库
- 不要把多个产品知识库一起挂到同一个单文档检索节点上
