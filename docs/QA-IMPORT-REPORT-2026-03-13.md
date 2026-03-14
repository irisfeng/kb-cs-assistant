# Excel Q&A 拆分导入报告（2026-03-13）

## 结论
- 两份 Excel 的 Q&A 已完成按知识库拆分并导入 5 个主知识库。
- 本轮共拆分并导入 `216` 对 Q&A。
- `视频AI算法舱` 相关 `11` 条原始 Q&A 未进入普通客服库，继续按内部支持脱敏路径处理。
- FastGPT 侧验证结果：`5/5` 目标知识库全部通过。
- 全局 workflow 已补充 5 个产品知识库，并完成 `/api/chat` 烟雾回归，当前产品问法已能命中引用返回。

## 产物
- 拆分脚本：
  - [split-fastgpt-qa-by-dataset.js](/Users/tony/Documents/GitHub/kb-cs-assistant/server/src/scripts/split-fastgpt-qa-by-dataset.js)
- 导入脚本：
  - [import-fastgpt-qa-batch.js](/Users/tony/Documents/GitHub/kb-cs-assistant/server/src/scripts/import-fastgpt-qa-batch.js)
- 验证脚本：
  - [verify-fastgpt-qa-imports.js](/Users/tony/Documents/GitHub/kb-cs-assistant/server/src/scripts/verify-fastgpt-qa-imports.js)
- npm 命令：
  - [package.json](/Users/tony/Documents/GitHub/kb-cs-assistant/server/package.json)

## 拆分结果
- 总计：`216` 对
- `FASTGPT_DATASET_BAICHUAN`: `53`
- `FASTGPT_DATASET_EBO`: `7`
- `FASTGPT_DATASET_DEVICE_SHOP`: `20`
- `FASTGPT_DATASET_HOME_AI`: `112`
- `FASTGPT_DATASET_B2B_ICT`: `24`
- `SKIP_INTERNAL_SENSITIVE`: `11`

对应产物：
- [split-summary.json](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/qa-split-20260313/split-summary.json)
- [split-manifest.json](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/qa-split-20260313/split-manifest.json)
- [skipped-records.json](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/qa-split-20260313/skipped-records.json)

## 导入结果
- `tysl-local-kb-baichuan`
  - collection: `天翼视联产品F&Q-视联百川问答库.txt`
  - `collectionId = 69b405a408bebeccb30c5a51`
  - `dataAmount = 53`
- `tysl-local-kb-ebo`
  - collection: `天翼视联产品F&Q-EBO问答库.txt`
  - `collectionId = 69b405a408bebeccb30c5a53`
  - `dataAmount = 7`
- `tysl-local-kb-device-shop`
  - collection: `天翼视联产品F&Q-设备商城问答库.txt`
  - `collectionId = 69b4069a08bebeccb30c60ae`
  - `dataAmount = 20`
- `tysl-local-kb-home-ai`
  - collection: `视联网知识库-AI产品-天翼看家问答库.txt`
  - `collectionId = 69b4057008bebeccb30c4c51`
  - `dataAmount = 112`
- `tysl-local-kb-b2b-ict`
  - collection: `视联网知识库-AI产品-政企版问答库.txt`
  - `collectionId = 69b4057808bebeccb30c54fb`
  - `dataAmount = 24`

运行结果：
- [qa-import-2026-03-13T12-39-22-429Z.json](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/qa-import-20260313-v2/qa-import-2026-03-13T12-39-22-429Z.json)
- [qa-import-2026-03-13T12-40-05-449Z.json](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/qa-import-20260313-v3/qa-import-2026-03-13T12-40-05-449Z.json)
- [qa-import-2026-03-13T12-40-12-852Z.json](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/qa-import-20260313-v3/qa-import-2026-03-13T12-40-12-852Z.json)
- [qa-import-2026-03-13T12-44-11-981Z.json](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/qa-import-20260313-v4/qa-import-2026-03-13T12-44-11-981Z.json)

## 验证结果
- FastGPT collection 验证：`5/5` 通过
- 验证依据：
  - collection 名称命中
  - `trainingType = chunk`
  - `dataAmount` 与预期 Q&A 数一致

验证报告：
- [qa-verify-2026-03-13T12-44-29-560Z.json](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/qa-verify-20260313/qa-verify-2026-03-13T12-44-29-560Z.json)

## 全局 workflow 联调
- 已在本地 FastGPT 社区版 UI 中更新已发布工作流：
  - 应用：`tysl-local-app-global-v2`
  - `appId = 69ad0ba2515619370eac7129`
- 知识库搜索节点已新增：
  - `tysl-local-kb-device-shop`
  - `tysl-local-kb-b2b-ict`
  - `tysl-local-kb-baichuan`
  - `tysl-local-kb-home-ai`
  - `tysl-local-kb-ebo`
- 已保存并发布到现有发布渠道，后端 `/api/chat` 无需改代码即可生效。

## 用户侧烟雾验证
- 我用 `/api/chat` 按真实问法抽测了 `baichuan / ebo / device-shop / home-ai / b2b-ict`。
- 结果：
  - `baichuan`：通过，`8` 条引用，首条命中 `天翼视联产品F&Q-视联百川问答库.txt`
  - `ebo`：通过，`6` 条引用，命中 EBO 产品问答库
  - `device-shop`：通过，`7` 条引用，命中设备商城相关问答/激活知识
  - `home-ai`：通过，`7` 条引用，命中车牌识别相关问答
  - `b2b-ict`：通过，`5` 条引用，首条命中 `视联网知识库-AI产品-政企版问答库.txt`
- 说明：
  - 新 Q&A collection 已被全局 workflow 检索范围覆盖。
  - 部分问题的首条引用仍可能落在此前已存在的产品问答库或派生问答库上，这属于正常现象；本轮导入的汇总 Q&A collection 主要起补全覆盖和增强召回作用。

## 后续建议
1. 单文档链路暂时不依赖这批 Q&A collection，可继续保持当前方案。
2. 这轮 Excel 处理完成后，可以准备合并 `codex/knowledge-governance -> main`。
3. 合并前如果还想再稳一点，建议补一轮前端页面人工抽问验证。
