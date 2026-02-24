# Stage 1: Build Frontend
FROM node:22 AS client-build
WORKDIR /app

# 複製整個 client 目錄
COPY client ./client
WORKDIR /app/client

# 安裝依賴並建立專案 (包含 devDependencies 以便使用 vite)
RUN npm install
RUN npm run build

# Stage 2: Server Runtime
FROM node:22-slim
WORKDIR /app

# 安裝後端伺服器生產環境依賴
COPY package*.json ./
RUN npm install --omit=dev

# 複製後端程式碼與初始化檔案
COPY server/ ./server/
COPY init-db.sql ./

# 從 Stage 1 複製已編譯的前端靜態檔案
# server/index.js 預期路徑為 ../client/dist
COPY --from=client-build /app/client/dist ./client/dist

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "server/index.js"]
