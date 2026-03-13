# Excel Q&A 拆分导入报告（2026-03-13）

## 结论
- 两份 Excel 的 Q&A 已完成按知识库拆分并导入 5 个主知识库。
- 本轮共拆分并导入 `216` 对 Q&A。
- `视频AI算法舱` 相关 `11` 条原始 Q&A 未进入普通客服库，继续按内部支持脱敏路径处理。
- FastGPT 侧验证结果：`5/5` 目标知识库全部通过。
- 当前全局 `/api/chat` 还不会直接吃到这些新产品 Q&A，因为已发布的全局 workflow 仍主要挂载 SOP/规则类知识库，而不是这些产品知识库。

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

## 用户侧烟雾验证
- 我用 `/api/chat` 按真实问法抽测了 `baichuan / ebo / device-shop / home-ai / b2b-ict`。
- 结果说明：
  - 新 Q&A collection 已经成功入库。
  - 但当前全局问答 workflow 还没有把这些产品知识库纳入主要检索范围，所以多数问法仍走保守兜底。
  - `device-shop` 的测试问法命中了现有激活绑定相关知识并返回引用，但这不是新 Q&A collection 直接生效的证据，而是现有全局 SOP 在工作。

## 后续建议
1. 如果希望全局问答直接利用这些新 Q&A，需要更新已发布的全局 FastGPT workflow，把相关产品知识库纳入检索范围。
2. 单文档链路暂时不依赖这批 Q&A collection，可继续保持当前方案。
3. 这轮 Excel 处理完成后，可以准备合并 `codex/knowledge-governance -> main`。
