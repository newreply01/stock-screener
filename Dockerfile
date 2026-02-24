# Stage 1: Build Frontend
FROM node:22-alpine AS client-build
WORKDIR /app

# 複製所有檔案 (受到 .dockerignore 保護，不會複製 node_modules)
COPY . .

# 進入 client 目錄並進行清潔構建
WORKDIR /app/client
RUN npm install
RUN npm run build

# Stage 2: Server Runtime
FROM node:22-slim
WORKDIR /app

# 安裝後端生產依賴
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# 複製後端程式碼與初始化檔案
COPY server/ ./server/
COPY init-db.sql ./

# 從 Stage 1 複製已編譯的前端靜態檔案
COPY --from=client-build /app/client/dist ./client/dist

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "server/index.js"]
