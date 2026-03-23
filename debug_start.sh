#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

NODE_BIN="/home/xg/.nvm/versions/node/v25.8.1/bin"
export PATH="$NODE_BIN:$PATH"

echo "Using Node version: $(node -v)"
echo "Checking dependencies..."
ls -d node_modules || echo "node_modules MISSING"

echo "Attempting to start server..."
npm run server
