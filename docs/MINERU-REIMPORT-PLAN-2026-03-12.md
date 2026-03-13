# MinerU 补传执行名单（2026-03-12）

## 结论
- 不需要全量重传。
- 优先重传“图片多、截图多、表格多”的文档。
- `0` 图或仅 `1~2` 张图的文档，通常没有必要为了 MinerU 额外重跑。

## 统计依据
- 图片统计产物：
  - [/tmp/docx_image_inventory_20260312.json](/tmp/docx_image_inventory_20260312.json)
- 统计口径：
  - 读取 docx 压缩包中的 `word/media/*`
  - 以嵌入图片数量作为“是否值得 MinerU 补传”的主要依据

## 第一批：必须补传

### `tysl-local-kb-home-ai`
- [天翼视联（原数字生活）-天翼看家-AI守护产品客服文档-全国-20251031V28.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/天翼视联（原数字生活）-天翼看家-AI守护产品客服文档-全国-20251031V28.0.docx)
  - `74` 张图
- [天翼视联（原数字生活）-天翼看家-画面异常巡检产品客服文档-全国-20250924V33.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/天翼视联（原数字生活）-天翼看家-画面异常巡检产品客服文档-全国-20250924V33.0.docx)
  - `37` 张图
- [天翼视联（原数字生活）-天翼看家-AI时光缩影客服文档-全国-20251031V29.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/天翼视联（原数字生活）-天翼看家-AI时光缩影客服文档-全国-20251031V29.0.docx)
  - `32` 张图
- [天翼视联（原数字生活）-天翼看家-区域入侵产品客服文档-全国-20251031V28.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/天翼视联（原数字生活）-天翼看家-区域入侵产品客服文档-全国-20251031V28.0.docx)
  - `29` 张图
- [天翼视联-天翼看家-吸烟识别产品客服文档-全国-20250826V1.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/天翼视联-天翼看家-吸烟识别产品客服文档-全国-20250826V1.0.docx)
  - `26` 张图
- [4月-天翼视联（原数字生活）-天翼看家-客流统计产品客服文档-全国-20250427V15.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/4月-天翼视联（原数字生活）-天翼看家-客流统计产品客服文档-全国-20250427V15.0.docx)
  - `25` 张图
- [4月-天翼视联（原数字生活）-天翼看家-车形检测产品客服文档-全国-20250427V12.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/4月-天翼视联（原数字生活）-天翼看家-车形检测产品客服文档-全国-20250427V12.0.docx)
  - `25` 张图
- [4月-天翼视联（原数字生活）-天翼看家-离岗检测产品客服文档-全国-20250427V9.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/4月-天翼视联（原数字生活）-天翼看家-离岗检测产品客服文档-全国-20250427V9.0.docx)
  - `23` 张图
- [4月-天翼视联（原数字生活）-天翼看家-徘徊检测产品客服文档-全国-20250427V9.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/4月-天翼视联（原数字生活）-天翼看家-徘徊检测产品客服文档-全国-20250427V9.0.docx)
  - `22` 张图
- [天翼视联-天翼看家-火情识别产品客服文档-全国-20250427V2.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/天翼视联-天翼看家-火情识别产品客服文档-全国-20250427V2.0.docx)
  - `22` 张图
- [4月-天翼视联（原数字生活）-天翼看家-车牌识别产品客服文档-全国-20250427V11.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/4月-天翼视联（原数字生活）-天翼看家-车牌识别产品客服文档-全国-20250427V11.0.docx)
  - `22` 张图
- [天翼视联（原数字生活）-天翼看家-家人识别产品客服文档-全国-20251124V21.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/天翼视联（原数字生活）-天翼看家-家人识别产品客服文档-全国-20251124V21.0.docx)
  - `22` 张图
- [天翼视联（原数字生活）-天翼看家-智能迎客产品客服文档-全国-20250427V4.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/天翼视联（原数字生活）-天翼看家-智能迎客产品客服文档-全国-20250427V4.0.docx)
  - `21` 张图

### 跨库高优先级
- [天翼视联-中国电信视联百川客户端客服文档-全国-20250530V4.0.docx](/Users/tony/Downloads/天翼视联知识库%20祁慧靓/天翼视联-中国电信视联百川客户端客服文档-全国-20250530V4.0.docx)
  - 目标库：`tysl-local-kb-baichuan`
  - `105` 张图
- [天翼视联-中国电信行业版AI产品政企版客服文档-全国-20250427V3.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/天翼视联-中国电信行业版AI产品政企版客服文档-全国-20250427V3.0.docx)
  - 目标库：`tysl-local-kb-b2b-ict`
  - `322` 张图

## 第二批：建议补传

### `tysl-local-kb-home-ai`
- [天翼视联-天翼看家-电动车识别产品客服文档-全国-20250826V1.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/天翼视联-天翼看家-电动车识别产品客服文档-全国-20250826V1.0.docx)
  - `18` 张图
- [天翼视联-天翼看家-AI智能巡检产品客服文档-全国-20251216V1.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/天翼视联-天翼看家-AI智能巡检产品客服文档-全国-20251216V1.0.docx)
  - `18` 张图
- [天翼视联-天翼看家-玩手机识别产品客服文档-全国-20250826V1.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/天翼视联-天翼看家-玩手机识别产品客服文档-全国-20250826V1.0.docx)
  - `12` 张图
- [天翼视联-天翼看家-智能搜索产品客服文档-全国-20251030V1.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/天翼视联-天翼看家-智能搜索产品客服文档-全国-20251030V1.0.docx)
  - `12` 张图
- [天翼视联-天翼看家-智能筛选产品客服文档-全国-20251031V9.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/天翼视联-天翼看家-智能筛选产品客服文档-全国-20251031V9.0.docx)
  - `10` 张图
- [天翼视联（原数字生活）-天翼看家-陌生人识别产品客服文档-全国-20250427V7.0.docx](/Users/tony/Downloads/天翼视联知识库-AI产品/天翼视联（原数字生活）-天翼看家-陌生人识别产品客服文档-全国-20250427V7.0.docx)
  - `10` 张图

### 第二批实际结果
- 执行时间：
  - `2026-03-13 15:13` 到 `2026-03-13 15:17`（Asia/Shanghai）
- 结果目录：
  - [/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-reimport-home-ai-batch2](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-reimport-home-ai-batch2)
- 汇总：
  - `reimported = 6`
  - `failed = 0`
- 实际替换：
  - `AI智能巡检`
    - 旧 collection: `69b289f308bebeccb30ba81b`
    - 新 collection: `69b3b95508bebeccb30c1fb0`
  - `电动车识别`
    - 旧 collection: `69b289f408bebeccb30ba9e7`
    - 新 collection: `69b3b97208bebeccb30c20dc`
  - `智能搜索`
    - 旧 collection: `69b289f308bebeccb30ba8bb`
    - 新 collection: `69b3b98f08bebeccb30c222a`
  - `玩手机识别`
    - 旧 collection: `69b289f408bebeccb30ba99f`
    - 新 collection: `69b3b9b108bebeccb30c2363`
  - `智能筛选`
    - 旧 collection: `69b289f308bebeccb30ba8f4`
    - 新 collection: `69b3b9ce08bebeccb30c247b`
  - `陌生人识别`
    - 旧 collection: `69b289f608bebeccb30bacbc`
    - 新 collection: `69b3b9e708bebeccb30c2593`

### 第二批验证
- 已纳入全量验证脚本结果：
  - [/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-verify-20260313-batch2/mineru-reimport-verify-2026-03-13T07-17-52-035Z.json](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-verify-20260313-batch2/mineru-reimport-verify-2026-03-13T07-17-52-035Z.json)
- 结果：
  - `21/21` 文档通过验证
  - `21/21` 文档包含图片 URL
  - 有旧 collection 的 `18` 份文档删除验证通过

## 第三批：可选补传

### `tysl-local-kb-device-shop`
- [天翼视联-翼支付商城-赛达超清云台摄像机H681客服文档-全国20250929V2.0.docx](/Users/tony/Downloads/天翼视联知识库%20祁慧靓/天翼视联-翼支付商城-赛达超清云台摄像机H681客服文档-全国20250929V2.0.docx)
  - `2` 张图
- [天翼视联-翼支付商城-可当超清摄像机xk001-A10客服文档-全国20251027V1.0.docx](/Users/tony/Downloads/天翼视联知识库%20祁慧靓/天翼视联-翼支付商城-可当超清摄像机xk001-A10客服文档-全国20251027V1.0.docx)
  - `2` 张图

## 可以跳过

### `tysl-local-kb-device-shop`
- [天翼视联-天翼视联商城-赛达网络摄像头(SD-H680)客服文档-全国-20250624V3.0.docx](/Users/tony/Downloads/天翼视联知识库%20祁慧靓/天翼视联-天翼视联商城-赛达网络摄像头(SD-H680)客服文档-全国-20250624V3.0.docx)
  - `0` 张图
- [天翼视联-天翼视联商城-赛达网络摄像头(SD-H683-cloud)客服文档-全国-20250630V1.0.docx](/Users/tony/Downloads/天翼视联知识库%20祁慧靓/天翼视联-天翼视联商城-赛达网络摄像头(SD-H683-cloud)客服文档-全国-20250630V1.0.docx)
  - `0` 张图

### `tysl-local-kb-ebo`
- [天翼视联-天翼视联商城-赋之科技移动机器人(EBO-SE)客服文档-全国-20250616V4.0.docx](/Users/tony/Downloads/天翼视联知识库%20祁慧靓/天翼视联-天翼视联商城-赋之科技移动机器人(EBO-SE)客服文档-全国-20250616V4.0.docx)
  - `0` 张图

## 推荐执行顺序
1. `b2b-ict` 的政企版总文档
2. `baichuan` 的客户端总文档
3. `home-ai` 第一批高图文文档
4. `home-ai` 第二批中等图文文档
5. `device-shop` 的 2 份可选图文文档

## 执行原则
- MinerU 重传只替换“图文保真优先”的文档，不需要覆盖全部文本型文档。
- Q&A、纯 SOP、纯规则型文档，继续保留当前文本导入即可。
- 内部支持文档 `视频AI算法舱` 暂不进入本轮，等内部支持库建好后再单独处理。

## 执行机制
- 已补充 MinerU helper：
  - [mineru-client.js](/Users/tony/Documents/GitHub/kb-cs-assistant/server/src/mineru-client.js)
- 已补充串行补传脚本：
  - [import-mineru-docx-batch.js](/Users/tony/Documents/GitHub/kb-cs-assistant/server/src/scripts/import-mineru-docx-batch.js)
- 已补充 npm 命令：
  - [package.json](/Users/tony/Documents/GitHub/kb-cs-assistant/server/package.json)
  - `npm run fastgpt:reimport-mineru-docx`

### 机制特点
- 串行执行：默认单文件顺序跑，避免同时压 MinerU API
- 可恢复：每个批次都会写 `mineru-reimport-state.json`
- 可替换：支持 `--replace-existing`，成功导入新 collection 后再删除旧 collection
- 可筛选：支持按 dataset、图片数、文件名正则筛选
- 有重试：MinerU 上传/轮询支持指数退避重试
- 有节流：文件之间默认间隔 `5000ms`

### 可调参数
- `MINERU_REQUEST_TIMEOUT_MS`
- `MINERU_UPLOAD_TIMEOUT_MS`
- `MINERU_RESULT_DOWNLOAD_TIMEOUT_MS`
- `MINERU_POLL_MAX_ATTEMPTS`
- `MINERU_POLL_INTERVAL_MS`
- `MINERU_MAX_RETRIES`
- `MINERU_RETRY_BASE_DELAY_MS`

## 推荐命令

### 先看 dry-run
```bash
cd /Users/tony/Documents/GitHub/kb-cs-assistant/server

npm run fastgpt:reimport-mineru-docx -- \
  --inventory=/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/inventory-20260312/knowledge-inventory.json \
  --dataset-filter=FASTGPT_DATASET_HOME_AI \
  --min-images=20 \
  --limit=2 \
  --dry-run \
  --replace-existing \
  --output=/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-reimport-dryrun
```

### 实际执行第一批
```bash
cd /Users/tony/Documents/GitHub/kb-cs-assistant/server

npm run fastgpt:reimport-mineru-docx -- \
  --inventory=/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/inventory-20260312/knowledge-inventory.json \
  --dataset-filter=FASTGPT_DATASET_HOME_AI \
  --limit=2 \
  --min-images=20 \
  --replace-existing \
  --delay-ms=8000 \
  --output=/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-reimport-home-ai-batch1
```

## 第一批实际结果
- 执行时间：
  - `2026-03-12 23:34` 到 `2026-03-12 23:36`（Asia/Shanghai）
- 结果目录：
  - [/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-reimport-home-ai-batch1](/Users/tony/Documents/GitHub/kb-cs-assistant/tmp/mineru-reimport-home-ai-batch1)
- 汇总：
  - `reimported = 2`
  - `failed = 0`
- 实际替换：
  - `AI守护`
    - 旧 collection: `69b289f408bebeccb30baa8b`
    - 新 collection: `69b2dd5608bebeccb30bda55`
    - 原始图片统计：`74`
    - MinerU 本地落图：`56`
    - FastGPT 索引块数：`82`
  - `画面异常巡检`
    - 旧 collection: `69b289f508bebeccb30bac1c`
    - 新 collection: `69b2dd7e08bebeccb30bdddd`
    - 原始图片统计：`37`
    - MinerU 本地落图：`33`
    - FastGPT 索引块数：`48`

## 第一批验证
- 旧 collection 已删除：
  - `69b289f408bebeccb30baa8b -> unExistCollection`
  - `69b289f508bebeccb30bac1c -> unExistCollection`
- 新 collection 已完成训练：
  - `69b2dd5608bebeccb30bda55 -> detailStatus=chunk`
  - `69b2dd7e08bebeccb30bdddd -> detailStatus=chunk`
- 新 chunk 中已确认包含图片 URL：
  - `http://kb-server.local:3001/images/2b3f0ac2-5574-4890-8320-67f2462b57bc/...`
  - `http://kb-server.local:3001/images/6da676e8-0917-4af9-91a3-52421f1c0db4/...`
