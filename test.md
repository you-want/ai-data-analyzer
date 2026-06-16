## 完整启动流程

### 第一步：启动依赖服务（PostgreSQL & Redis）

```bash
# 在项目根目录执行
cd /Users/rain9/you-want/ai-data-analyzer

# 启动 Docker 容器（首次启动会创建容器，后续启动会启动已存在的容器）
docker compose up -d
```

验证服务是否启动成功：
```bash
# 检查容器状态
docker ps

# 应该看到两个容器：
# - ai_analyzer_postgres (PostgreSQL)
# - ai_analyzer_redis (Redis)

# 测试 PostgreSQL 连接
docker exec -it ai_analyzer_postgres psql -U rain9_ai_data -d ai_analysis_db -c "SELECT 1;"

# 测试 Redis 连接
docker exec -it ai_analyzer_redis redis-cli ping
```

### 第二步：启动后端服务

打开一个新终端窗口：

```bash
# 进入后端目录
cd /Users/rain9/you-want/ai-data-analyzer/backend

# 安装依赖（如果还没安装）
pnpm install

# 启动后端服务
pnpm run start:dev
```

后端会运行在 `http://localhost:3001`

验证后端是否启动成功：
```bash
# 多智能体健康检查
curl -X POST http://localhost:3001/multi-agent/health
```

### 第三步：启动前端服务

打开另一个新终端窗口：

```bash
# 进入前端目录
cd /Users/rain9/you-want/ai-data-analyzer/frontend

# 安装依赖（如果还没安装）
pnpm install

# 启动前端服务
pnpm run dev
```

前端会运行在 `http://localhost:3000`

### 第四步：测试多智能体功能

#### 方式一：通过前端界面测试

1. 打开浏览器访问 `http://localhost:3000/dashboard`
2. 滚动到页面底部的"多智能体协作分析"区域
3. 输入分析请求，例如：
   ```
   分析销售趋势并找出异常月份
   ```
4. 点击"开始分析"按钮
5. 观察实时进度更新和任务状态变化

#### 方式二：通过 curl 命令测试

```bash
# 执行多智能体分析
curl -X POST http://localhost:3001/multi-agent/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "分析销售趋势并找出异常月份",
    "data": [
      {"month": "1月", "amount": 800},
      {"month": "2月", "amount": 450},
      {"month": "3月", "amount": 1800},
      {"month": "4月", "amount": 1200},
      {"month": "5月", "amount": 950}
    ],
    "options": {
      "maxSteps": 10,
      "enableReview": true,
      "enableCharts": true
    }
  }'
```

### 第五步：观察日志

在后端终端窗口中，你会看到详细的日志输出：

1. **Router Agent**：生成任务计划
   ```
   [RouterAgent] 开始路由分析任务: ma_xxx
   ```

2. **Supervisor**：执行任务
   ```
   [Supervisor] 开始多智能体分析: ma_xxx
   [Supervisor] 已生成任务计划: 5 个任务
   ```

3. **Data Coder Agent**：数据处理
   ```
   [DataCoderAgent] 开始数据处理任务: t1
   ```

4. **Viz Agent**：图表生成
   ```
   [VizAgent] 开始图表编排任务: t3
   ```

5. **Reviewer Agent**：质量审阅
   ```
   [ReviewerAgent] 开始审阅任务: t4
   ```

6. **最终报告**：生成分析报告

### 第六步：检查 WebSocket 连接（前端测试时）

1. 打开浏览器开发者工具（F12）
2. 切换到 Network 标签页
3. 选择 WS（WebSocket）过滤器
4. 应该能看到与 `http://localhost:3001/multi-agent` 的 WebSocket 连接
5. 点击连接可以查看实时消息流

### 常见问题排查

**问题 1：PostgreSQL 端口 5432 被占用**
```bash
# 查找占用端口的进程
lsof -i :5432

# 终止进程（替换 <PID> 为实际进程 ID）
kill -9 <PID>

# 或者修改 docker-compose.yml 中的端口映射
```

**问题 2：Redis 连接失败**
```bash
# 检查 Redis 容器是否运行
docker ps | grep redis

# 如果没有运行，启动容器
docker start ai_analyzer_redis
```

**问题 3：后端启动失败**
```bash
# 检查端口 3001 是否被占用
lsof -i :3001

# 终止进程
kill -9 <PID>

# 或者使用 kill-port（项目已集成）
pnpm run start:dev
```

**问题 4：LLM 服务连接失败**
```bash
# 检查 .env 文件中的 AI 模型配置
cat backend/.env

# 如果使用 Ollama，确保 Ollama 服务已启动
ollama serve
```

### 测试完成后的清理

```bash
# 停止所有服务
docker compose down

# 或者仅停止容器（保留数据）
docker compose stop
```