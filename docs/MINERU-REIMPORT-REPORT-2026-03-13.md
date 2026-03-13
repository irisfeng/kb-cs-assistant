# MinerU 补传报告（2026-03-13）

## 结论
- 本轮继续执行了 `home-ai` 高图文第一批剩余文档、`home-ai` 第二批中等图文文档，以及跨库最高优先级的 `政企版`、`视联百川客户端`。
- 实际补传并验证通过 `21` 份文档，`0` 失败。
- 验证脚本结果：
  - `total = 21`
  - `passed = 21`
  - `failed = 0`
  - `withImageUrls = 21`
  - `oldDeletedVerified = 18`
- 当前 MinerU 图文补传链路在 macOS 本机可稳定工作，包含：
  - MinerU API 解析
  - 本地图片落盘
  - FastGPT 新 collection 写入
  - 旧 collection 替换删除
  - `kb-server.local` 图片 URL 可访问

## 本轮执行范围

### `tysl-local-kb-home-ai`
- 连续补传完成 `13` 份高图文文档
- 结果：
  - `reimported = 10`
  - `imported = 3`
  - `failed = 0`
- 其中 `3` 份为新导入而不是替换：
  - `4月-天翼视联（原数字生活）-天翼看家-客流统计产品客服文档-全国-20250427V15.0.docx`
  - `4月-天翼视联（原数字生活）-天翼看家-车形检测产品客服文档-全国-20250427V12.0.docx`
  - `4月-天翼视联（原数字生活）-天翼看家-车牌识别产品客服文档-全国-20250427V11.0.docx`

### `tysl-local-kb-home-ai` 第二批
- 连续补传完成 `6` 份中等图文文档
- 结果：
  - `reimported = 6`
  - `failed = 0`
- 实际文档：
  - `天翼视联-天翼看家-AI智能巡检产品客服文档-全国-20251216V1.0.docx`
  - `天翼视联-天翼看家-电动车识别产品客服文档-全国-20250826V1.0.docx`
  - `天翼视联-天翼看家-智能搜索产品客服文档-全国-20251030V1.0.docx`
  - `天翼视联-天翼看家-玩手机识别产品客服文档-全国-20250826V1.0.docx`
  - `天翼视联-天翼看家-智能筛选产品客服文档-全国-20251031V9.0.docx`
  - `天翼视联（原数字生活）-天翼看家-陌生人识别产品客服文档-全国-20250427V7.0.docx`

### 截至当前的 `home-ai` 进度
- 第一批高图文 + 第二批中等图文累计完成 `19` 份
- 这 19 份已经覆盖当前计划里 `home-ai` 的第一批和第二批全部名单

### 跨库高优先级
- `tysl-local-kb-b2b-ict`
  - `天翼视联-中国电信行业版AI产品政企版客服文档-全国-20250427V3.0.docx`
  - `reimported = 1`
- `tysl-local-kb-baichuan`
  - `天翼视联-中国电信视联百川客户端客服文档-全国-20250530V4.0.docx`
  - `reimported = 1`

## 产物
- `home-ai` 结果目录：
  - [/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-reimport-home-ai-batch1](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-reimport-home-ai-batch1)
- `home-ai` 第二批结果目录：
  - [/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-reimport-home-ai-batch2](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-reimport-home-ai-batch2)
- 跨库结果目录：
  - [/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-reimport-cross-batch1](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-reimport-cross-batch1)
- 全量验证结果：
  - [/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-verify-20260313-batch2/mineru-reimport-verify-2026-03-13T07-17-52-035Z.json](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-verify-20260313-batch2/mineru-reimport-verify-2026-03-13T07-17-52-035Z.json)

## 全面验证

### 1. 新 collection 有效
- `21/21` 文档的新 collection 均能正常读取 detail
- 所有文档都满足：
  - `rawTextLength > 0`
  - `indexAmount > 0`
  - `detailStatus = chunk`

### 2. 图片链路有效
- `21/21` 文档的 chunk 中都发现了图片 URL
- 图片 URL 统一为：
  - `http://kb-server.local:3001/images/...`
- 验证脚本对每份文档都抽检了一个图片 URL，结果均为：
  - `HTTP 200`

### 3. 旧 collection 删除有效
- 有旧 collection 的 `18` 份文档，删除验证全部通过
- 结果均返回：
  - `unExistCollection`

### 4. 知识库计数符合预期
- `tysl-local-kb-home-ai = 52`
- `tysl-local-kb-b2b-ict = 3`
- `tysl-local-kb-baichuan = 7`

### 5. 本地服务链路正常
- `http://127.0.0.1:3001/api/solutions` 返回 `30`
- `http://kb-server.local:3001/api/solutions` 返回 `30`
- 说明这轮补传没有污染本地 `solutions` 数据，也没有破坏 `kb-server.local` 解析

## 复用脚本
- MinerU 串行补传：
  - [import-mineru-docx-batch.js](/Users/tony/Documents/GitHub/kb-cs-assistant/server/src/scripts/import-mineru-docx-batch.js)
- MinerU 全量验证：
  - [verify-mineru-reimports.js](/Users/tony/Documents/GitHub/kb-cs-assistant/server/src/scripts/verify-mineru-reimports.js)

## 当前状态判断
- MinerU 图文补传机制已经可以作为正式迁移工具继续使用，不再只是 smoke test。
- `home-ai` 第一批和第二批文档已经全部完成。
- 下一步更值得做的是：
  1. 评估 `device-shop` 那两份 `2` 图文档是否值得补传
  2. 处理内部支持库后，再单独看 `视频AI算法舱`
  3. 如果不补 `device-shop`，MinerU 主线可以暂时收束
