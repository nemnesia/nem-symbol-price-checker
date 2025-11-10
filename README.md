# NEM/Symbol Price Checker

CoinGecko APIを使用してXEM（NEM）とXYM（Symbol）の価格データを収集し、SQLiteに保存してWeb APIで提供するTypeScriptアプリケーションです。

## 機能

### 価格データ収集
- **日次価格収集**: 毎日日本時間0:00に前日の平均価格を取得してSQLiteに保存
- **リカバリ機能**: 毎時実行され、欠損データを自動で補完
- **現在価格収集**: 5分おきに現在価格を取得し、データベースとJSONキャッシュに保存

### Web API
- 日付範囲指定での日次価格データ取得
- 最新の現在価格データ取得
- JSONキャッシュファイルからの高速価格データ取得
- ヘルスチェック機能

## セットアップ

### 1. 依存関係のインストール
```bash
npm install
```

### 2. 自動セットアップ
```bash
chmod +x setup.sh
./setup.sh
```

セットアップスクリプトは以下を自動で実行します：
- TypeScriptのコンパイル
- systemdサービスファイルの生成・インストール
- サービスの有効化・開始

### 3. 手動セットアップ（オプション）
```bash
# TypeScriptコンパイル
npm run build

# 個別実行
npm run daily     # 日次価格収集
npm run recovery  # リカバリ
npm run current   # 現在価格収集
npm run dev       # APIサーバー起動（開発用）
npm start         # APIサーバー起動（本番用）
```

## アンインストール

### 自動アンインストール
```bash
./uninstall.sh
```

アンインストールスクリプトは以下のオプションを提供します：
- **オプション1**: 全データ保持（再インストール用）
- **オプション2**: ログ・キャッシュのみ削除
- **オプション3**: 全データ削除（データベース含む）
- **オプション4**: データクリーンアップをスキップ

### 手動アンインストール
```bash
# サービス停止・無効化
sudo systemctl stop nem-symbol-*.timer
sudo systemctl stop nem-symbol-*.service
sudo systemctl disable nem-symbol-*.timer
sudo systemctl disable nem-symbol-*.service

# サービスファイル削除
sudo rm /etc/systemd/system/nem-symbol-*
sudo systemctl daemon-reload

# プロジェクトディレクトリ削除
rm -rf /path/to/nem-symbol-price-checker
```

## API エンドポイント

### 基本情報
- ベースURL: `http://localhost:3000`
- レスポンス形式: JSON

### エンドポイント一覧

#### ルート
```
GET /
```
API仕様書とエンドポイント一覧を表示

#### ヘルスチェック
```
GET /health
```
サーバーの動作状況を確認

#### 日次価格データ取得
```
GET /api/daily/:symbol?from=YYYY-MM-DD&to=YYYY-MM-DD
```
- `symbol`: `XEM` または `XYM`
- `from`: 開始日（YYYY-MM-DD形式）
- `to`: 終了日（YYYY-MM-DD形式）

例:
```
GET /api/daily/XEM?from=2024-01-01&to=2024-01-31
```

#### 現在価格取得（個別）
```
GET /api/current/:symbol
```
- `symbol`: `XEM` または `XYM`

#### 現在価格取得（両コイン）
```
GET /api/current
```

#### 現在価格取得（キャッシュ）
```
GET /api/current-cache
```

## systemdサービス

### サービス一覧
- `nem-symbol-daily.timer`: 日次価格収集（毎日日本時間0:00）
- `nem-symbol-recovery.timer`: リカバリ（毎時）
- `nem-symbol-current.timer`: 現在価格収集（5分おき）
- `nem-symbol-api.service`: Web APIサーバー

### サービス管理コマンド

#### ステータス確認
```bash
sudo systemctl status nem-symbol-daily.timer
sudo systemctl status nem-symbol-recovery.timer
sudo systemctl status nem-symbol-current.timer
sudo systemctl status nem-symbol-api.service
```

#### ログ確認
```bash
sudo journalctl -u nem-symbol-daily.service -f
sudo journalctl -u nem-symbol-recovery.service -f
sudo journalctl -u nem-symbol-current.service -f
sudo journalctl -u nem-symbol-api.service -f
```

## ライセンス

MIT License
