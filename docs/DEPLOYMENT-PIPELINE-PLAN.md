# 部署流水线方案

## 1. 目标

为客服智能知识系统建立一套清晰可执行的发布流程，打通演示预览、测试验收和正式生产上线。

核心原则：
- `preview` 用于快速预览和基础冒烟验证。
- `staging` 是上线前的准生产验收环境。
- `production` 发布必须包含数据库迁移、核心冒烟和回滚准备。
- 生产数据、生产知识库和生产文件资产不得与预览或测试环境混用。

## 2. 环境拓扑

| 环境 | 用途 | 托管平台 | 数据库 | 文件存储 | FastGPT |
| --- | --- | --- | --- | --- | --- |
| `local` | 本地开发 | 本地机器 | 本地库或 Neon 开发分支 | 本地文件 | 开发数据集 |
| `preview` | PR 演示 / 冒烟验证 | Vercel Preview | Neon 临时分支 | 预览桶 | 预览数据集 |
| `staging` | 集成测试 / UAT | 阿里云 | Staging PostgreSQL | Staging 桶 | Staging 数据集 |
| `production` | 正式对外服务 | 阿里云 | Production PostgreSQL | Production 桶 | Production 数据集 |

推荐规则：
- `preview` 可以和生产在平台形态上不同。
- `staging` 必须尽量与生产同构。

## 3. 分支策略

推荐 Git 分支映射如下：

| Git 分支 | 用途 | 部署目标 |
| --- | --- | --- |
| `feature/*` | 功能开发 | `preview` |
| `develop` | 集成验证 | `staging` |
| `main` | 生产就绪分支 | `production` |

如果团队更偏向 release 分支，也可以采用：
- `feature/*` -> `preview`
- `main` -> `staging`
- `release/*` 或 Git Tag -> `production`

当前更推荐：
- `develop` 作为测试验收分支
- `main` 作为生产发布分支
- 生产发布通过合并或打 tag 控制，不直接在生产分支上手工修改

## 4. 发布流程

### 4.1 开发到预览

1. 开发在 `feature/*` 分支上工作。
2. 发起 PR 到 `develop`。
3. GitHub Actions 自动执行 CI：
   - 前端类型检查
   - 前端构建
   - 后端语法检查
   - 单元测试
   - 基础接口测试
4. Vercel 自动生成 Preview 部署。
5. 如果本次改动包含数据库 schema 变更，则自动创建一个 Neon preview branch，并在该分支上执行 migration。
6. 产品和测试在 Preview 上做基础验证：
   - 页面是否正常
   - 上传流程是否可用
   - 问答主链路是否可跑通
   - SOP 管理主路径是否可用

### 4.2 预览到测试环境

1. PR 合并到 `develop`。
2. 自动部署前后端到阿里云 `staging`。
3. 在 staging 数据库执行 migration。
4. 执行 staging 冒烟测试。
5. 在 staging 环境做完整验收：
   - 文档上传
   - 全局问答
   - 单文档问答
   - 账户流程
   - 会话历史
   - SOP 编辑
   - 权限边界

### 4.3 测试到生产

1. 冻结本次发布候选版本。
2. 准备发布说明和风险说明。
3. 对生产数据库执行备份或创建恢复点。
4. 执行生产 migration。
5. 发布生产应用。
6. 执行生产冒烟检查。
7. 观察日志和关键指标。
8. 如果发布异常，执行回滚。

## 5. CI/CD 任务设计

推荐建立 4 个 GitHub Actions 工作流。

### `ci.yml`

- 触发条件：PR 到 `develop` 或 `main`
- 职责：
  - 安装依赖
  - 执行前端 `tsc`
  - 执行前端 build
  - 执行后端语法检查
  - 执行单元测试
  - 后续接入 lint 后执行 lint

### `preview.yml`

- 触发条件：PR 创建或更新
- 职责：
  - 部署前端到 Vercel Preview
  - 按需创建 Neon preview branch
  - 在 preview 分支执行 migration
  - 跑 preview 冒烟测试

### `staging.yml`

- 触发条件：代码合并到 `develop`
- 职责：
  - 部署前端静态资源到 staging
  - 部署后端到阿里云 staging
  - 执行 staging migration
  - 跑 staging 冒烟测试

### `production.yml`

- 触发条件：手工审批或 Git Tag
- 职责：
  - 要求人工审批
  - 确认备份完成
  - 执行生产 migration
  - 发布生产应用
  - 执行生产冒烟测试
  - 汇总发布结果

## 6. 数据库发布规则

数据库变更必须遵守以下原则：
- 所有 schema 变更都必须以 migration 管理。
- migration 必须先在 preview 或 staging 验证，再进入生产。
- 尽量使用向前兼容的迁移方式。
- 生产环境避免一步到位的破坏性变更。

推荐迁移模式：
1. 先加新表或新字段
2. 再发布写入新结构的代码
3. 如有需要再做回填
4. 再切换读取逻辑
5. 旧字段和旧结构放到后续版本清理

环境对应关系：
- `preview`：Neon branch
- `staging`：阿里云 staging PostgreSQL
- `production`：阿里云 production PostgreSQL

重要规则：
- 预览和测试环境不得写入生产 FastGPT 数据集或生产文件桶。

## 7. 环境隔离要求

每个环境必须拥有独立资源：
- 数据库
- 文件桶
- FastGPT 数据集
- API 域名
- 前端域名
- 密钥和环境变量

推荐命名：
- `kb-preview`
- `kb-staging`
- `kb-prod`

推荐文件桶命名：
- `kb-preview-assets`
- `kb-staging-assets`
- `kb-prod-assets`

推荐 FastGPT 数据集命名：
- `kb-preview-dataset`
- `kb-staging-dataset`
- `kb-prod-dataset`

## 8. 发布检查表

### 发布前检查

- PR 已合并且 CI 全绿
- staging 部署通过
- UAT 验收通过
- 发布说明已准备
- 生产环境变量已复核
- 生产数据库备份或恢复点已创建
- migration 脚本已复查

### 发布后检查

- 登录正常
- 上传正常
- 全局问答正常
- 单文档问答正常
- SOP 管理正常
- 日志中无新的严重错误
- 文件上传和 FastGPT 入库链路正常

## 9. 回滚方案

回滚必须拆成应用回滚和数据库回滚两部分。

### 应用回滚

- 回滚前端到上一版静态资源
- 回滚后端到上一版应用包或镜像

### 数据库回滚

- 高风险发布优先依赖备份或恢复点恢复
- 不假设每一个 migration 都能安全逆向执行
- 对危险变更采用分阶段发布，而不是一步删除或覆盖

常见回滚触发条件：
- 登录失败
- 上传失败率异常升高
- 问答服务不可用
- 文档检索异常
- migration 失败

## 10. 实施顺序建议

1. 建立 `develop` / `main` 分支制度。
2. 落地 `ci.yml`。
3. 接入 Vercel Preview。
4. 接入阿里云 staging 发布链路。
5. 接入 migration 工具和 preview DB 验证机制。
6. 增加生产审批流程。
7. 把发布检查表和回滚 SOP 固化进团队流程。

## 11. 当前项目推荐方案

结合当前项目阶段，最实用的路径是：
- `preview`：Vercel + Neon preview DB
- `staging`：阿里云全链路
- `production`：阿里云全链路

这样既保留研发预览效率，也保证最终上线是在接近生产的链路里验证通过。
