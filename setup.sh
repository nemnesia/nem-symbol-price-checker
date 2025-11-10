#!/bin/bash

# NEM/Symbol Price Checker Setup Script
set -e

echo "Setting up NEM/Symbol Price Checker..."

# 現在のユーザーとディレクトリを取得
CURRENT_USER="$(whoami)"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_PATH="$(which node)"

echo "User: $CURRENT_USER"
echo "Project directory: $PROJECT_DIR"
echo "Node.js path: $NODE_PATH"

# 必要なディレクトリを作成
echo "Creating directories..."
mkdir -p "$PROJECT_DIR/data"
mkdir -p "$PROJECT_DIR/logs" 
mkdir -p "$PROJECT_DIR/cache"
mkdir -p "$PROJECT_DIR/dist"

# TypeScriptコンパイル
echo "Building TypeScript..."
cd "$PROJECT_DIR"
npm run build

# systemdサービスファイルをテンプレートから生成
echo "Generating systemd service files..."
mkdir -p "$PROJECT_DIR/systemd/generated"

for service_file in systemd/*.service; do
    if [ -f "$service_file" ]; then
        base_name=$(basename "$service_file")
        echo "Processing $base_name..."
        sed -e "s|__USER__|$CURRENT_USER|g" \
            -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
            -e "s|__NODE_PATH__|$NODE_PATH|g" \
            "$service_file" > "$PROJECT_DIR/systemd/generated/$base_name"
    fi
done

# systemdサービスファイルをコピー
echo "Installing systemd services..."
sudo cp systemd/generated/nem-symbol-daily.service /etc/systemd/system/
sudo cp systemd/nem-symbol-daily.timer /etc/systemd/system/
sudo cp systemd/generated/nem-symbol-recovery.service /etc/systemd/system/
sudo cp systemd/nem-symbol-recovery.timer /etc/systemd/system/
sudo cp systemd/generated/nem-symbol-current.service /etc/systemd/system/
sudo cp systemd/nem-symbol-current.timer /etc/systemd/system/
sudo cp systemd/generated/nem-symbol-api.service /etc/systemd/system/

# systemdデーモン再読み込み
echo "Reloading systemd..."
sudo systemctl daemon-reload

# サービス有効化
echo "Enabling services..."
sudo systemctl enable nem-symbol-daily.timer
sudo systemctl enable nem-symbol-recovery.timer  
sudo systemctl enable nem-symbol-current.timer
sudo systemctl enable nem-symbol-api.service

# タイマー開始
echo "Starting timers..."
sudo systemctl start nem-symbol-daily.timer
sudo systemctl start nem-symbol-recovery.timer
sudo systemctl start nem-symbol-current.timer

# APIサーバー開始
echo "Starting API server..."
sudo systemctl start nem-symbol-api.service

echo ""
echo "Setup completed!"
echo ""
echo "Service Status:"
echo "==============="
sudo systemctl status nem-symbol-daily.timer --no-pager
echo ""
sudo systemctl status nem-symbol-recovery.timer --no-pager
echo ""
sudo systemctl status nem-symbol-current.timer --no-pager
echo ""
sudo systemctl status nem-symbol-api.service --no-pager

echo ""
echo "Useful Commands:"
echo "================"
echo "Check logs:"
echo "  sudo journalctl -u nem-symbol-daily.service -f"
echo "  sudo journalctl -u nem-symbol-recovery.service -f"
echo "  sudo journalctl -u nem-symbol-current.service -f"
echo "  sudo journalctl -u nem-symbol-api.service -f"
echo ""
echo "Manual execution:"
echo "  npm run daily     # Manual daily collection"
echo "  npm run recovery  # Manual recovery collection"
echo "  npm run current   # Manual current price collection"
echo ""
echo "API Endpoints:"
echo "  http://localhost:3000                    # API documentation"
echo "  http://localhost:3000/health             # Health check"
echo "  http://localhost:3000/api/current        # Current prices (both)"
echo "  http://localhost:3000/api/current/XEM    # Current XEM price"
echo "  http://localhost:3000/api/daily/XEM?from=2024-01-01&to=2024-01-31"
echo ""
echo "Stop services:"
echo "  sudo systemctl stop nem-symbol-*.service"
echo "  sudo systemctl stop nem-symbol-*.timer"
