import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DailyPrice {
  id?: number;
  symbol: string;
  date: string; // YYYY-MM-DD
  price_jpy: number;
  created_at: string;
}

export interface CurrentPrice {
  id?: number;
  symbol: string;
  price_jpy: number;
  timestamp: string;
}

export class PriceDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(__dirname, '..', 'data', 'prices.db');
    const finalPath = dbPath || defaultPath;

    // データベースディレクトリを作成
    const dbDir = path.dirname(finalPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(finalPath);
    this.initializeTables();
  }

  private initializeTables() {
    // 日次価格テーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS daily_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        date TEXT NOT NULL,
        price_jpy REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, date)
      )
    `);

    // 現在価格テーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS current_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        price_jpy REAL NOT NULL,
        timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // インデックス作成
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_daily_prices_symbol_date ON daily_prices(symbol, date);
      CREATE INDEX IF NOT EXISTS idx_current_prices_symbol_timestamp ON current_prices(symbol, timestamp);
    `);
  }

  // 日次価格の挿入・更新
  insertOrUpdateDailyPrice(price: DailyPrice): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO daily_prices (symbol, date, price_jpy, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(price.symbol, price.date, price.price_jpy);
  }

  // 現在価格の挿入
  insertCurrentPrice(price: CurrentPrice): void {
    const stmt = this.db.prepare(`
      INSERT INTO current_prices (symbol, price_jpy, timestamp)
      VALUES (?, ?, ?)
    `);
    stmt.run(price.symbol, price.price_jpy, price.timestamp);
  }

  // 日次価格の取得（日付範囲指定）
  getDailyPrices(symbol: string, fromDate: string, toDate: string): DailyPrice[] {
    const stmt = this.db.prepare(`
      SELECT * FROM daily_prices
      WHERE symbol = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `);
    return stmt.all(symbol, fromDate, toDate) as DailyPrice[];
  }

  // 最新の現在価格を取得
  getLatestCurrentPrice(symbol: string): CurrentPrice | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM current_prices
      WHERE symbol = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    return stmt.get(symbol) as CurrentPrice | undefined;
  }

  // 特定日の日次価格が存在するかチェック
  isDailyPriceExists(symbol: string, date: string): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM daily_prices
      WHERE symbol = ? AND date = ?
    `);
    const result = stmt.get(symbol, date) as { count: number };
    return result.count > 0;
  }

  // 古い現在価格データのクリーンアップ（7日間より古いデータを削除）
  cleanupOldCurrentPrices(): void {
    const stmt = this.db.prepare(`
      DELETE FROM current_prices
      WHERE timestamp < datetime('now', '-7 days')
    `);
    stmt.run();
  }

  close(): void {
    this.db.close();
  }
}
