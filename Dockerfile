# Stage 1: Build Frontend
FROM node:22-alpine AS client-build
WORKDIR /app

# 受到 .dockerignore 保護，不複製本地 node_modules
COPY . .

# 進入 client 目錄
WORKDIR /app/client

# 強制設定為開發模式以確保安裝所有構建工具 (vite, @vitejs/plugin-react)
ENV NODE_ENV=development

# 執行安裝與構建
RUN npm install
RUN npm run build

# Stage 2: Server Runtime
FROM node:22-slim
WORKDIR /app

# 安裝後端生產環境依賴
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# 複製後端程式碼與連線邏輯
COPY server/ ./server/
COPY init-db.sql ./

# 從第一階段複製編譯好的靜態檔案
COPY --from=client-build /app/client/dist ./client/dist

# Zeabur 標準端口與環境變數
EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "server/index.js"]
