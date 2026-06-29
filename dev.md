# 开发文档

## 项目状态

### ✅ 已完成功能

1. **认证系统**
   - ✅ 用户注册/登录（邮箱+密码）
   - ✅ JWT 认证
   - ⚠️ OAuth（GitHub/Google）- 已实现代码，需要配置环境变量

2. **工作空间管理**
   - ✅ 创建工作空间
   - ✅ 邀请成员
   - ✅ 角色管理（owner/admin/member）
   - ✅ 审计日志

3. **数据分析**
   - ✅ 多智能体协作分析
   - ✅ 数据清洗和转换
   - ✅ 可视化图表生成

4. **监控运维**
   - ✅ 健康检查（/health）
   - ✅ 深度健康检查（/health/deep）
   - ✅ Prometheus 指标（/metrics）
   - ✅ 结构化日志

5. **DevOps**
   - ✅ Docker 多阶段构建
   - ✅ CI/CD GitHub Actions
   - ✅ Kubernetes 部署配置

### ⚠️ 待配置功能

1. **OAuth 登录** - 需要配置以下环境变量：
   ```env
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

2. **AI 模型** - 需要配置有效的 API Key：
   ```env
   OPENAI_API_KEY=sk-your-openai-key
   ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
   ```

## 快速开始

### 第一步：启动依赖服务

```bash
cd /Users/rain9/you-want/ai-data-analyzer
docker compose up -d
```

### 第二步：配置环境变量

```bash
# 复制环境变量模板
cp backend/.template.env backend/.env

# 编辑 backend/.env，配置必要的环境变量
```

### 第三步：启动后端服务

```bash
cd backend
pnpm install
pnpm migration:run  # 运行数据库迁移
pnpm run start:dev
```

### 第四步：启动前端服务

```bash
cd frontend
pnpm install
pnpm run dev
```

## 常见问题排查

### 问题 1：PostgreSQL 连接失败

```bash
# 检查容器状态
docker ps | grep postgres

# 查看日志
docker logs ai_analyzer_postgres

# 测试连接
docker exec -it ai_analyzer_postgres psql -U ai_data_user -d ai_analysis_db -c "SELECT 1;"
```

### 问题 2：Redis 连接失败

```bash
# 检查容器状态
docker ps | grep redis

# 测试 Redis（带密码）
docker exec -it ai_analyzer_redis redis-cli -a redis_dev_password ping
```

### 问题 3：后端启动失败

```bash
# 检查端口占用
lsof -i :3001

# 清理端口并重启
pnpm run start:dev
```

### 问题 4：LLM 服务连接失败

如果看到 "API key not configured" 警告，请确保 `.env` 文件中配置了有效的 API Key。

## 测试

### 运行单元测试

```bash
cd backend
pnpm test
```

### 运行 E2E 测试

```bash
cd backend
pnpm test:e2e
```

### 代码检查

```bash
cd backend
pnpm lint

cd frontend
pnpm lint
```

## 生产部署

### 必需的环境变量

请参考 `.env` 文件模板，确保以下变量已配置：

1. **数据库**
   - `DATABASE_HOST`
   - `DATABASE_PORT`
   - `DATABASE_USER`
   - `DATABASE_PASSWORD`
   - `DATABASE_NAME`

2. **Redis**
   - `REDIS_HOST`
   - `REDIS_PORT`
   - `REDIS_PASSWORD`

3. **安全**
   - `JWT_SECRET`（强随机字符串）
   - `ENCRYPTION_KEY`（32 字符密钥）
   - `SESSION_SECRET`

4. **OAuth**（可选）
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

5. **AI 模型**
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`

### Kubernetes 部署

```bash
kubectl apply -f k8s/
```

注意：在生产部署前，请务必更新 `k8s/secrets.yaml` 中的所有占位符值。
