# Stage 1: Build Frontend
FROM node:22-alpine AS client-build
LABEL "language"="nodejs"
LABEL "framework"="vite"
WORKDIR /app

# 只複製 package 文件，利用 Docker 快取
COPY client/package.json client/package-lock.json ./client/

# 安裝前端依賴（包括 devDependencies 用於構建）
WORKDIR /app/client
RUN npm ci

# 複製所有原始碼 (包含 client 下的其他檔案)
WORKDIR /app
COPY . .

# 構建前端
WORKDIR /app/client
RUN npm run build

# Stage 2: Server Runtime
FROM node:22-slim
LABEL "language"="nodejs"
LABEL "framework"="express"
WORKDIR /app

# 只複製 package 文件，利用 Docker 快取
COPY package.json package-lock.json ./

# 安裝後端生產依賴
RUN npm ci --omit=dev

# 複製後端程序代碼和初始化文件
COPY server/ ./server/
COPY init-db.sql ./

# 從 Stage 1 複製已編譯的前端靜態文件
# server/index.js 預期路徑為 ../client/dist
COPY --from=client-build /app/client/dist ./client/dist

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "server/index.js"]
