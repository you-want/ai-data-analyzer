# 使用轻量级的 Node.js 18 Alpine 镜像作为构建环境
FROM node:18-alpine AS builder
WORKDIR /app

# 启用 pnpm
RUN corepack enable pnpm

# 首先只复制 package.json 和 pnpm-lock.yaml 以利用 Docker 缓存层
COPY package.json pnpm-lock.yaml ./

# 安装依赖（包括 devDependencies，因为 build 需要）
RUN pnpm install --frozen-lockfile

# 复制其余源代码并构建
COPY . .
RUN pnpm run build

# 生产环境镜像
FROM node:18-alpine AS runner
WORKDIR /app

# 生产环境仅需安装生产依赖
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# 从构建镜像中复制编译后的文件
COPY --from=builder /app/dist ./dist

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3001

# 暴露后端端口
EXPOSE 3001

# 启动命令
CMD ["node", "dist/main"]
