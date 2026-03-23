#!/bin/bash
# 修復 Stock Screener 版本問題並啟動

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 強制切換至 v25 (若 installed)
NODE_PATH="/home/xg/.nvm/versions/node/v25.8.1/bin"
export PATH="$NODE_PATH:$PATH"

# 啟動命令 (根據 package.json 中的 dev 腳本)
$NODE_PATH/npm run dev
