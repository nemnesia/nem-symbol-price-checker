#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CoinGeckoAPI } from './coingecko.js';
import { PriceDatabase } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function collectCurrentPrices() {
  const db = new PriceDatabase();
  const api = new CoinGeckoAPI();

  try {
    console.log('Fetching current prices...');
    const prices = await api.getCurrentPrices();
    const timestamp = new Date().toISOString();

    // データベースに保存
    db.insertCurrentPrice({
      symbol: 'XEM',
      price_jpy: prices.XEM,
      timestamp,
    });

    db.insertCurrentPrice({
      symbol: 'XYM',
      price_jpy: prices.XYM,
      timestamp,
    });

    console.log(`✓ Saved current prices - XEM: ¥${prices.XEM.toFixed(6)}, XYM: ¥${prices.XYM.toFixed(6)}`);

    // JSONファイルにキャッシュ
    const cacheData = {
      timestamp,
      prices: {
        XEM: prices.XEM,
        XYM: prices.XYM,
      },
    };

    const cacheDir = path.join(__dirname, '..', 'cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const cacheFile = path.join(cacheDir, 'current-prices.json');
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));

    console.log(`Cache updated: ${cacheFile}`);

    // 古いデータのクリーンアップ
    db.cleanupOldCurrentPrices();
  } catch (error) {
    console.error('Failed to collect current prices:', error);
    process.exit(1);
  } finally {
    db.close();
  }

  console.log('Current price collection completed successfully.');
}

// スクリプトとして実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  collectCurrentPrices().catch((error) => {
    console.error('Fatal error in current price collection:', error);
    process.exit(1);
  });
}

export { collectCurrentPrices };
