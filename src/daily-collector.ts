#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CoinGeckoAPI } from './coingecko.js';
import { PriceDatabase } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function collectDailyPrices() {
  const db = new PriceDatabase();
  const api = new CoinGeckoAPI();

  // 日本時間の昨日の日付を取得（0:00に実行されるため、昨日のデータを収集）
  const targetDate = api.getJapanYesterday();

  console.log(`Collecting daily prices for ${targetDate}`);

  const symbols: ('XEM' | 'XYM')[] = ['XEM', 'XYM'];
  const results: { symbol: string; success: boolean; error?: string; price?: number }[] = [];

  for (const symbol of symbols) {
    try {
      // 既に取得済みかチェック
      if (db.isDailyPriceExists(symbol, targetDate)) {
        console.log(`Price for ${symbol} on ${targetDate} already exists, skipping`);
        results.push({ symbol, success: true, price: 0 });
        continue;
      }

      console.log(`Fetching price for ${symbol} on ${targetDate}`);
      const price = await api.getDailyPrice(symbol, targetDate);

      if (price > 0) {
        db.insertOrUpdateDailyPrice({
          symbol,
          date: targetDate,
          price_jpy: price,
          created_at: new Date().toISOString(),
        });

        console.log(`✓ Saved ${symbol}: ¥${price.toFixed(6)} for ${targetDate}`);
        results.push({ symbol, success: true, price });
      } else {
        throw new Error('Invalid price received (0 or negative)');
      }

      // API制限を避けるため待機（3秒）
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`✗ Failed to fetch ${symbol} price for ${targetDate}: ${errorMsg}`);
      results.push({ symbol, success: false, error: errorMsg });
    }
  }

  db.close();

  // 結果を記録
  const logData = {
    date: targetDate,
    timestamp: new Date().toISOString(),
    results,
  };

  const logDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFile = path.join(logDir, `daily-${targetDate}.json`);
  fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));

  console.log(`Daily collection completed. Log saved to: ${logFile}`);

  // 失敗した場合は終了コード1で終了
  const hasFailures = results.some((r) => !r.success);
  if (hasFailures) {
    console.error('Some collections failed. Check recovery process.');
    process.exit(1);
  }

  console.log('All daily prices collected successfully.');
}

// スクリプトとして実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  collectDailyPrices().catch((error) => {
    console.error('Fatal error in daily collection:', error);
    process.exit(1);
  });
}

export { collectDailyPrices };
