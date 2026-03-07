# Sample Batch Import Assessment

## Scope

This assessment summarizes the two sample document folders reviewed on 2026-03-07 for production import planning.

Reviewed batches:

1. Tianyi Home AI product customer-service documents
2. Mixed marketplace, client, and ICT support documents

## Batch Summary

Scanned totals:

- 29 files total
- 27 `.docx` documents
- 2 `.xlsx` spreadsheet files

Initial classification outcome from the scanner:

- `PUBLIC_CS`: 28
- `RESTRICTED`: 1

Restricted file identified:

- `天翼视联-翼智企标准 ICT 业务容器类增值应用-视频AI算法舱客服文档-全国-20250813V1.0.docx`

Restriction reason:

- private IP addresses
- default credentials
- SSH-related operational details

## Recommended Import Structure

### Global Reference

Use this layer for spreadsheet or FAQ-style reference content after manual review.

- `天翼视联产品F&Q.xlsx`
- `视联网知识库-AI产品.xlsx`

Rules:

- verify whether the spreadsheet is an index or true answer source
- if it only serves as an inventory, keep it outside retrieval and use it as metadata input

### Product Libraries

Create separate product datasets for the Home AI product batch.

Recommended product datasets:

- `产品-天翼看家-客流统计`
- `产品-天翼看家-车牌识别`
- `产品-天翼看家-车形检测`
- `产品-天翼看家-离岗检测`
- `产品-天翼看家-徘徊检测`
- `产品-天翼看家-AI时光缩影`
- `产品-天翼看家-AI守护`
- `产品-天翼看家-画面异常巡检`
- `产品-天翼看家-家人识别`
- `产品-天翼看家-陌生人识别`
- `产品-天翼看家-区域入侵`
- `产品-天翼看家-智能迎客`
- `产品-天翼看家-AI智能巡检`
- `产品-天翼看家-电动车识别`
- `产品-天翼看家-火情识别`
- `产品-天翼看家-玩手机识别`
- `产品-天翼看家-吸烟识别`
- `产品-天翼看家-智能筛选`
- `产品-天翼看家-智能搜索`

Additional product datasets:

- `产品-视联百川客户端`
- `产品-行业版AI产品政企版`

### Device Libraries

Keep device and marketplace support docs separate from product-policy documents.

Recommended device datasets:

- `设备-赋之科技移动机器人(EBO-SE)`
- `设备-赛达网络摄像头(SD-H680)`
- `设备-赛达网络摄像头(SD-H683-cloud)`
- `设备-可当超清摄像机xk001-A10`
- `设备-赛达超清云台摄像机H681`

### Internal Restricted Libraries

Do not import restricted mixed-content files into the ordinary support path.

Current blocked item:

- `内部-视频AI算法舱`

Required action before import:

1. split the document into customer-service content and internal operations content
2. redact private URLs and default credentials from the customer-service copy
3. keep the internal-only copy in a restricted support dataset

## Recommended Immediate Actions

### Ready To Import

These are suitable as first-wave customer-service import candidates:

- Home AI product customer-service documents
- marketplace device support documents
- client support document
- industry edition support document

### Review Before Import

These require a manual check:

- both spreadsheets
- any large comprehensive document that may mix product policy with operations content

### Block For Now

- `天翼视联-翼智企标准 ICT 业务容器类增值应用-视频AI算法舱客服文档-全国-20250813V1.0.docx`

## Operational Recommendation

For the next implementation step, generate an import manifest from the scanner output and use that manifest as the review checklist before any FastGPT dataset import.
