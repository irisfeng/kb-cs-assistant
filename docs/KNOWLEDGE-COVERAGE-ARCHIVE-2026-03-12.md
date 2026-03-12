# 知识覆盖补强归档（2026-03-12）

## 目的
记录 2026-03-12 为全局客服工作流补强 `activate / acct-sec / logistics(签收异常)` 知识覆盖时的来源、草稿、导入结果与回归结论，供业务复核和后续继续扩写使用。

## 本次补强范围
- 激活绑定异常：
  - `已被其他账号绑定`
  - `网络异常 / 2.4G / 二维码扫描距离`
- 账号安全：
  - `账号异常登录 / 疑似被盗 / 修改绑定信息`
- 物流异常：
  - `已签收但本人未收到`

## 新增聚焦草稿
- [tysl-activate-bound-by-other-account-focus-v1.md](/Users/tony/Documents/GitHub/kb-cs-assistant/docs/knowledge-drafts/tysl-activate-bound-by-other-account-focus-v1.md)
- [tysl-activate-network-triage-focus-v1.md](/Users/tony/Documents/GitHub/kb-cs-assistant/docs/knowledge-drafts/tysl-activate-network-triage-focus-v1.md)
- [tysl-acct-sec-abnormal-login-focus-v1.md](/Users/tony/Documents/GitHub/kb-cs-assistant/docs/knowledge-drafts/tysl-acct-sec-abnormal-login-focus-v1.md)
- [tysl-logistics-signed-not-received-focus-v1.md](/Users/tony/Documents/GitHub/kb-cs-assistant/docs/knowledge-drafts/tysl-logistics-signed-not-received-focus-v1.md)

## 来源映射

### 1. `tysl-activate-bound-by-other-account-focus-v1`
- 目标知识库：`tysl-local-kb-activate`
- 原始来源文件夹：`天翼视联知识库-AI产品`
- 具体原始文档：
  - `天翼视联-中国电信行业版AI产品政企版客服文档-全国-20250427V3.0.docx`
- 直接提取的已核验证据：
  - 天翼云眼 APP 可扫描二维码或手动输入 `UID` 完成绑定
  - 绑定进度达到 `100%` 表示绑定成功
  - 如提示设备已被其他账号绑定，需原绑定用户先解绑
  - 转人工前需收集账号、截图/录屏、`UID/CTEI`、客户端版本、手机号等要素
- 本次聚焦目的：
  - 把“已被其他账号绑定”从总 SOP 中拆成单独条目，提升精确问法的检索命中率

### 2. `tysl-activate-network-triage-focus-v1`
- 目标知识库：`tysl-local-kb-activate`
- 原始来源文件夹：
  - `天翼视联知识库 祁慧靓`
  - `天翼视联知识库-AI产品`
- 具体原始文档：
  - `天翼视联-中国电信视联百川客户端客服文档-全国-20250530V4.0.docx`
  - `天翼视联-中国电信行业版AI产品政企版客服文档-全国-20250427V3.0.docx`
- 直接提取的已核验证据：
  - 视联百川二维码配网需输入 WiFi 密码
  - 设备仅支持 `2.4G` WiFi
  - 二维码需置于镜头前 `15-30cm`
  - 双频路由器需确认连接的是 `2.4G`
  - 绑定失败多与网络异常相关
  - 设备联网并重启后建议等待 `60 秒`
- 本次聚焦目的：
  - 把“摄像头一直无法绑定 / 网络异常怎么办”这类高频泛问压成单独可引用条目

### 3. `tysl-acct-sec-abnormal-login-focus-v1`
- 目标知识库：`tysl-local-kb-acct-sec`
- 原始来源文件夹：
  - `天翼视联知识库 祁慧靓`
  - `天翼视联知识库-AI产品`
- 具体原始文档：
  - `天翼视联-中国电信视联百川客户端客服文档-全国-20250530V4.0.docx`
  - `天翼视联-中国电信行业版AI产品政企版客服文档-全国-20250427V3.0.docx`
- 直接提取的已核验证据：
  - 视联百川支持短信验证码登录、账号密码登录
  - 共享邀请以手机号账号为准
  - 删除云回看需验证码确认
  - 删除设备会解绑已绑定云回看或 AI 套餐
  - 天翼云眼疑难场景转人工前需收集账号、截图、`UID/CTEI`、客户端版本等信息
- 明确边界：
  - 原始资料并未提供“忘记密码找回 / 异常登录拦截 / 被盗恢复 / 后台改绑”的固定流程
- 本次聚焦目的：
  - 形成“保守但可引用”的安全口径，避免模型在无依据时编造账号恢复流程

### 4. `tysl-logistics-signed-not-received-focus-v1`
- 目标知识库：`tysl-local-kb-logistics`
- 原始来源文件夹：`天翼视联知识库 祁慧靓`
- 直接上游草稿：
  - [tysl-logistics-sop-v1.md](/Users/tony/Documents/GitHub/kb-cs-assistant/docs/knowledge-drafts/tysl-logistics-sop-v1.md)
- 上游草稿对应的原始文档：
  - `天翼视联-翼支付商城-可当超清摄像机xk001-A10客服文档-全国20251027V1.0.docx`
  - `天翼视联-翼支付商城-赛达超清云台摄像机H681客服文档-全国20250929V2.0.docx`
  - `天翼视联-天翼视联商城-赛达网络摄像头(SD-H680)客服文档-全国-20250624V3.0.docx`
- 直接提取的已核验证据：
  - 商品一般 `48 小时内安排发货`
  - 物流判断以物流信息为准
  - 当前已核验资料没有给出 `虚假签收 / 丢件 / 赔偿金额 / 固定补发时效` 的标准流程
  - `已签收未收到` 应先核商品、订单、物流状态和截图，再转商城售后人工复核
- 本次聚焦目的：
  - 把“已签收但本人未收到”从物流总 SOP 中单独拆出来，避免检索只命中“未发货”或“7 天无理由退换货”

## 导入记录

### 目标数据集
- `tysl-local-kb-activate`
  - datasetId: `69acddd6515619370eac52dd`
- `tysl-local-kb-acct-sec`
  - datasetId: `69acdda1515619370eac518a`
- `tysl-local-kb-logistics`
  - datasetId: `69acde41515619370eac53b3`

### 导入结果
- `天翼视联绑定异常：提示已被其他账号绑定 v1`
  - collectionId: `69b2507d08bebeccb30b8d6f`
- `天翼视联绑定异常：网络与2.4G检查要点 v1`
  - collectionId: `69b2507d08bebeccb30b8d87`
- `天翼视联账号异常登录分诊口径 v1`
  - collectionId: `69b2507d08bebeccb30b8db9`
- `天翼视联物流异常：已签收但本人未收到 v1`
  - collectionId: `69b2507d08bebeccb30b8da1`

## 导入方式
- 使用新增脚本：
  - [import-fastgpt-text.js](/Users/tony/Documents/GitHub/kb-cs-assistant/server/src/scripts/import-fastgpt-text.js)
- 对应 npm 命令：
  - `npm run fastgpt:import-text -- --dataset-id <datasetId> --file <file> --name "<collection name>"`

## 回归结果

### 本次验证通过
- `用户反馈摄像头一直无法绑定，应该怎么排查？`
  - 已能命中 `网络与 2.4G 检查` 聚焦知识，并返回引用
- `用户反馈天翼云眼绑定设备时提示已被其他账号绑定，应该怎么处理？`
  - 已能命中 `已被其他账号绑定` 聚焦知识，并返回引用
- `用户反馈账号疑似被盗，需要修改绑定信息，客服怎么处理？`
  - 已能命中 `账号异常登录分诊口径`，并返回引用
- `用户说物流显示已签收但本人没有收到，客服该怎么回复？`
  - 已能命中 `已签收但本人未收到` 聚焦知识，并返回引用

### 变化趋势
- 变更前：
  - 这几类问题多为统一兜底或无引用回复
- 变更后：
  - 已升级为带引用的结构化答复
  - 回答边界更保守，减少了无依据扩写

## 已知事项
- 首批导入时 collection 名在 FastGPT 内部显示为 `.txt.txt`
  - 原因：FastGPT 文本 collection 会自动补 `.txt`，而初版导入参数也带了 `.txt`
  - 影响：仅影响显示名称，不影响检索与引用
  - 已处理：导入脚本已修复，后续导入不会再重复补 `.txt`

## 后续建议
- 继续按“总 SOP + 聚焦条目”双层结构补知识，不要只堆总文档
- 下一批优先考虑：
  - `物流长期未更新`
  - `要求赔偿或立即补发`
  - `绑定时提示网络异常`
  - `账号共享/解绑异常`
- 如需做业务复核，优先按本文件“来源映射”逐条回看原始文档，不要只看导入后的 FastGPT collection
