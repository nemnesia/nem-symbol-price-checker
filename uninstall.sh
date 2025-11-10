#!/bin/bash

# NEM/Symbol Price Checker Uninstall Script
set -e

echo "Uninstalling NEM/Symbol Price Checker..."

# 現在のディレクトリを取得
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Project directory: $PROJECT_DIR"

# サービス停止
echo "Stopping services..."
sudo systemctl stop nem-symbol-daily.timer 2>/dev/null || echo "nem-symbol-daily.timer was not running"
sudo systemctl stop nem-symbol-recovery.timer 2>/dev/null || echo "nem-symbol-recovery.timer was not running"
sudo systemctl stop nem-symbol-current.timer 2>/dev/null || echo "nem-symbol-current.timer was not running"
sudo systemctl stop nem-symbol-api.service 2>/dev/null || echo "nem-symbol-api.service was not running"

# サービス無効化
echo "Disabling services..."
sudo systemctl disable nem-symbol-daily.timer 2>/dev/null || echo "nem-symbol-daily.timer was not enabled"
sudo systemctl disable nem-symbol-recovery.timer 2>/dev/null || echo "nem-symbol-recovery.timer was not enabled"
sudo systemctl disable nem-symbol-current.timer 2>/dev/null || echo "nem-symbol-current.timer was not enabled"
sudo systemctl disable nem-symbol-api.service 2>/dev/null || echo "nem-symbol-api.service was not enabled"

# systemdサービスファイル削除
echo "Removing systemd service files..."
sudo rm -f /etc/systemd/system/nem-symbol-daily.service
sudo rm -f /etc/systemd/system/nem-symbol-daily.timer
sudo rm -f /etc/systemd/system/nem-symbol-recovery.service
sudo rm -f /etc/systemd/system/nem-symbol-recovery.timer
sudo rm -f /etc/systemd/system/nem-symbol-current.service
sudo rm -f /etc/systemd/system/nem-symbol-current.timer
sudo rm -f /etc/systemd/system/nem-symbol-api.service

# systemdデーモン再読み込み
echo "Reloading systemd..."
sudo systemctl daemon-reload
sudo systemctl reset-failed

# 生成されたサービスファイル削除
echo "Cleaning up generated files..."
rm -rf "$PROJECT_DIR/systemd/generated"

# データファイルの削除を確認
echo ""
echo "Data files cleanup options:"
echo "1) Keep all data (database, logs, cache) - Recommended for temporary uninstall"
echo "2) Remove logs and cache only"
echo "3) Remove ALL data including database - WARNING: This will delete all collected price data!"
echo "4) Skip data cleanup"

while true; do
    read -p "Select option (1-4): " choice
    case $choice in
        1)
            echo "Keeping all data files"
            break
            ;;
        2)
            echo "Removing logs and cache..."
            rm -rf "$PROJECT_DIR/logs"
            rm -rf "$PROJECT_DIR/cache"
            echo "✓ Logs and cache removed"
            break
            ;;
        3)
            read -p "Are you sure you want to delete ALL data including the database? (yes/no): " confirm
            if [ "$confirm" = "yes" ]; then
                echo "Removing all data..."
                rm -rf "$PROJECT_DIR/data"
                rm -rf "$PROJECT_DIR/logs"
                rm -rf "$PROJECT_DIR/cache"
                echo "✓ All data removed"
            else
                echo "Data removal cancelled"
            fi
            break
            ;;
        4)
            echo "Skipping data cleanup"
            break
            ;;
        *)
            echo "Invalid option. Please select 1-4."
            ;;
    esac
done

# dist ディレクトリの削除を確認
echo ""
read -p "Remove compiled JavaScript files (dist/)? (y/n): " remove_dist
if [ "$remove_dist" = "y" ] || [ "$remove_dist" = "Y" ]; then
    rm -rf "$PROJECT_DIR/dist"
    echo "✓ Compiled files removed"
fi

echo ""
echo "Uninstall completed!"
echo ""
echo "Final status check:"
echo "=================="

# サービス状態チェック
for service in nem-symbol-daily.timer nem-symbol-recovery.timer nem-symbol-current.timer nem-symbol-api.service; do
    if systemctl list-unit-files | grep -q "^$service"; then
        echo "⚠ $service still exists in systemd"
    else
        echo "✓ $service removed successfully"
    fi
done

echo ""
echo "Remaining files:"
echo "================"
echo "Project directory: $PROJECT_DIR"
if [ -d "$PROJECT_DIR/data" ]; then
    echo "✓ Database files preserved in: data/"
fi
if [ -d "$PROJECT_DIR/logs" ]; then
    echo "✓ Log files preserved in: logs/"
fi
if [ -d "$PROJECT_DIR/cache" ]; then
    echo "✓ Cache files preserved in: cache/"
fi

echo ""
echo "To reinstall, run: ./setup.sh"
echo "To completely remove this directory: rm -rf $PROJECT_DIR"
