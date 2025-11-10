#!/usr/bin/env node
import { PriceDatabase } from './database.js';
import { CoinGeckoAPI } from './coingecko.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function recoveryCollection() {
  const db = new PriceDatabase();
  const api = new CoinGeckoAPI();
  
  console.log('Starting recovery collection...');
  
  // 過去3日間の欠損データをチェック（7日から短縮）
  const today = api.getJapanToday();
  const symbols: ('XEM' | 'XYM')[] = ['XEM', 'XYM'];
  const results: { date: string; symbol: string; success: boolean; error?: string; price?: number }[] = [];
  
  for (let i = 1; i <= 3; i++) {
    const checkDate = api.getPreviousDate(today);
    const targetDate = new Date(checkDate);
    targetDate.setDate(targetDate.getDate() - (i - 1));
    const dateStr = targetDate.toISOString().split('T')[0];
    
    for (const symbol of symbols) {
      try {
        // 既に取得済みかチェック
        if (db.isDailyPriceExists(symbol, dateStr)) {
          console.log(`Price for ${symbol} on ${dateStr} already exists, skipping`);
          continue;
        }
        
        console.log(`Recovery: Fetching price for ${symbol} on ${dateStr}`);
        const price = await api.getDailyPrice(symbol, dateStr);
        
        if (price > 0) {
          db.insertOrUpdateDailyPrice({
            symbol,
            date: dateStr,
            price_jpy: price,
            created_at: new Date().toISOString()
          });
          
          console.log(`✓ Recovered ${symbol}: ¥${price.toFixed(6)} for ${dateStr}`);
          results.push({ date: dateStr, symbol, success: true, price });
        } else {
          throw new Error('Invalid price received (0 or negative)');
        }
        
        // API制限を避けるため待機（3秒）
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`✗ Recovery failed for ${symbol} on ${dateStr}: ${errorMsg}`);
        results.push({ date: dateStr, symbol, success: false, error: errorMsg });
      }
    }
  }
  
  db.close();
  
  // 結果を記録
  const logData = {
    timestamp: new Date().toISOString(),
    recovery_results: results,
    recovered_count: results.filter(r => r.success).length,
    failed_count: results.filter(r => !r.success).length
  };
  
  const logDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logFile = path.join(logDir, `recovery-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`);
  fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
  
  console.log(`Recovery completed. Recovered: ${logData.recovered_count}, Failed: ${logData.failed_count}`);
  console.log(`Log saved to: ${logFile}`);
  
  if (logData.failed_count > 0) {
    console.error('Some recovery attempts failed.');
    process.exit(1);
  }
  
  console.log('Recovery completed successfully.');
}

// スクリプトとして実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  recoveryCollection().catch(error => {
    console.error('Fatal error in recovery collection:', error);
    process.exit(1);
  });
}

export { recoveryCollection };
