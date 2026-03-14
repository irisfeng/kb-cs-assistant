# 产品知识库统一命名表（2026-03-14）

## 1. 目的

当前项目里同时存在：

- FastGPT 知识库英文键名
- 环境变量名
- 文档导入脚本里的产品线枚举
- 客服/运营口头叫法

为了避免后续测试、汇报、问题记录和页面文案混乱，统一约定下面这套命名。

## 2. 统一命名总表

| 技术键名 | FastGPT 知识库名 | 统一中文名 | 推荐业务叫法 | 主要覆盖范围 |
| --- | --- | --- | --- | --- |
| `baichuan` | `tysl-local-kb-baichuan` | 视联百川客户端 | 中国电信视联百川客户端 | 视联百川客户端登录、配网、绑定、共享、常见功能与异常 |
| `ebo` | `tysl-local-kb-ebo` | EBO-SE 移动机器人 | 赋之科技移动机器人（EBO-SE） | EBO-SE 设备相关客服知识 |
| `device-shop` | `tysl-local-kb-device-shop` | 商城设备类产品 | 天翼视联商城 / 翼支付商城设备 | 商城摄像头、云台摄像机、设备类商品客服知识 |
| `home-ai` | `tysl-local-kb-home-ai` | 天翼看家 AI 产品 | 天翼看家 AI 产品 | AI 守护、家人识别、火情识别、画面异常巡检、智能搜索等天翼看家 AI 能力 |
| `b2b-ict` | `tysl-local-kb-b2b-ict` | 政企版 AI 产品 | 中国电信行业版 AI 产品政企版 | 政企版 / ICT 产品客服知识 |

## 3. 推荐使用口径

### 3.1 对客服和运营

优先使用中文名：

- `视联百川客户端`
- `EBO-SE 移动机器人`
- `商城设备类产品`
- `天翼看家 AI 产品`
- `政企版 AI 产品`

如果需要更正式一点，可以使用“推荐业务叫法”列。

### 3.2 对研发、脚本和排障

优先使用技术键名：

- `baichuan`
- `ebo`
- `device-shop`
- `home-ai`
- `b2b-ict`

如果需要和 FastGPT 或 `.env` 对齐，再使用完整知识库名：

- `tysl-local-kb-baichuan`
- `tysl-local-kb-ebo`
- `tysl-local-kb-device-shop`
- `tysl-local-kb-home-ai`
- `tysl-local-kb-b2b-ict`

## 4. 不建议继续混用的叫法

下面这些叫法容易让人误会，后续尽量少用：

- `client`
  - 研发脚本里它表示 `视联百川客户端`
  - 但日常语义里容易被理解成“客户端总称”
- `ICT`
  - 技术上是产品线分类
  - 对业务同学不够直观，建议展示时改成 `政企版 AI 产品`
- `marketplace`
  - 技术上是商城设备大类
  - 对业务同学不如 `商城设备类产品` 清晰
- `home-ai`
  - 研发内部可用
  - 对外展示时优先说 `天翼看家 AI 产品`

## 5. 页面、文档、测试中的推荐写法

### 5.1 页面展示

建议直接显示中文名：

- 视联百川客户端
- EBO-SE 移动机器人
- 商城设备类产品
- 天翼看家 AI 产品
- 政企版 AI 产品

### 5.2 测试用例

建议写成“中文名（技术键名）”：

- 视联百川客户端（`baichuan`）
- EBO-SE 移动机器人（`ebo`）
- 商城设备类产品（`device-shop`）
- 天翼看家 AI 产品（`home-ai`）
- 政企版 AI 产品（`b2b-ict`）

### 5.3 汇报材料

建议写成“推荐业务叫法”，不要直接扔技术键名：

- 中国电信视联百川客户端
- 赋之科技移动机器人（EBO-SE）
- 天翼视联商城 / 翼支付商城设备
- 天翼看家 AI 产品
- 中国电信行业版 AI 产品政企版

## 6. 当前代码映射依据

当前导入和路由逻辑使用的是下面这套内部映射：

- `CLIENT -> BAICHUAN`
- `HOME_AI -> HOME_AI`
- `ICT / GENERAL -> B2B_ICT`
- `MARKETPLACE + EBO-SE -> EBO`
- 其他 `MARKETPLACE -> DEVICE_SHOP`

对应实现见：

- [README.md](/Users/tony/Documents/GitHub/kb-cs-assistant/README.md)
- [import-direct-docx-batch.js](/Users/tony/Documents/GitHub/kb-cs-assistant/server/src/scripts/import-direct-docx-batch.js)
- [KNOWLEDGE-IMPORT-CHECKLIST-2026-03-12.md](/Users/tony/Documents/GitHub/kb-cs-assistant/docs/KNOWLEDGE-IMPORT-CHECKLIST-2026-03-12.md)

## 7. 后续执行约定

从今天开始，建议统一采用下面这套规则：

1. 页面展示：中文名
2. 测试记录：中文名 + 技术键名
3. 脚本和排障：技术键名
4. 汇报和对外沟通：推荐业务叫法

## 8. 当前仓库替换评估

### 8.1 扫描结论

本轮已扫描 `client / server / docs / memory` 中的相关命名，结论是：

1. 前端用户可见代码里，当前几乎没有这 5 个产品库英文键名的直接展示。
2. 大量英文键名主要出现在：
   - 导入脚本
   - 环境变量
   - FastGPT 知识库名
   - 导入/补传/验证报告
   - 开发 memory 和技术记录
3. 因此当前不适合做“全仓库字符串替换”，否则会损坏技术可追踪性。

### 8.2 建议立即替换的范围

这些地方可以优先用中文展示：

1. 内测清单
2. 页面中的产品展示文案
3. 对客服/运营的说明文档
4. 汇报材料和阶段总结

### 8.3 不建议直接替换的范围

这些地方应继续保留技术键名，必要时只追加中文说明：

1. `.env` 中的变量名
2. FastGPT 数据集真实名称
3. 导入脚本中的 `dataset-filter`
4. 历史导入报告、补传报告、验证报告
5. 代码里依赖技术键名做路由或分类判断的逻辑

### 8.4 最稳的替换原则

建议统一按下面方式处理：

1. 面向用户和业务同学：
   - 只显示中文名
2. 面向测试和运营协作：
   - 显示 `中文名（技术键名）`
3. 面向研发和排障：
   - 保留技术键名
   - 在文档首次出现时补一行中文解释
