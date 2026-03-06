# FastGPT 社区版部署与本项目对接（2026-03-06）

## 1. 目标
在本地启动 FastGPT 社区版，并与本项目后端完成 API 对接。

## 2. 前置条件
1. Docker 与 Docker Compose 可用。
2. Node.js 18+。
3. 本项目代码已拉取。

## 3. 部署 FastGPT 社区版
1. 参考 FastGPT 官方仓库说明启动服务。
2. 首次进入 FastGPT 控制台，完成管理员初始化。
3. 创建：
   - 一个知识库（用于客服文档）
   - 一个工作流应用（用于客服问答）
4. 在应用发布后创建 API Key（用于 `chat/completions`）。
5. 为知识库操作创建 API Key（用于文档入库）。

## 4. 本项目环境变量（`server/.env`）
```env
PORT=3001

# FastGPT
FASTGPT_BASE_URL=http://localhost:3000/api
FASTGPT_DATASET_ID=your_dataset_id
FASTGPT_API_KEY=your_dataset_api_key
FASTGPT_WORKFLOW_KEY=your_workflow_api_key
FASTGPT_APP_KEY=your_app_api_key
```

说明：
1. 文档入库一般使用 `FASTGPT_API_KEY`。
2. 聊天问答一般使用应用/工作流 Key（`FASTGPT_WORKFLOW_KEY` 或 `FASTGPT_APP_KEY`）。

## 5. 启动项目
```bash
# backend
cd server
npm install
npm start

# frontend
cd client
npm install
npm run dev
```

访问：`http://localhost:5173`

## 6. 联调检查
1. 上传文档成功后，确认可在 FastGPT 知识库看到新增数据。
2. 在前端提问，确认返回内容含引用信息。
3. 若 401：检查对应接口使用的 Key 是否匹配。
4. 若无引用：检查应用是否关联了目标知识库。

## 7. 推荐实践
1. 不在前端暴露 FastGPT 长期 API Key。
2. 上传统一经本项目后端中转，便于审计和重试。
3. 每次升级 FastGPT 后，先验证 OpenAPI 兼容性再上线。

## 8. 参考
1. FastGPT 仓库：https://github.com/labring/FastGPT
2. OpenAPI 总览：https://doc.fastgpt.io/docs/introduction/development/openapi/
3. 对话接口：https://doc.fastgpt.io/docs/introduction/development/openapi/chat/
4. 知识库接口：https://doc.fastgpt.io/docs/introduction/development/openapi/dataset/
