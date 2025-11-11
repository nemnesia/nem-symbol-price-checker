#!/usr/bin/env node
import { CoinGeckoAPI } from './coingecko.js';
import { PriceDatabase } from './database.js';

async function testSystem() {
  console.log('🔍 Testing NEM/Symbol Price Checker System...');
  console.log('================================================');

  // 必要なディレクトリを事前作成
  console.log('\n0. Setting up directories...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.join(__dirname, '..');

    const requiredDirs = ['data', 'logs', 'cache'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(projectRoot, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✓ Created directory: ${dir}/`);
      } else {
        console.log(`✓ Directory exists: ${dir}/`);
      }
    }
  } catch (error) {
    console.error('✗ Directory setup failed:', error);
  }

  // データベーステスト
  console.log('\n1. Testing Database...');
  try {
    const db = new PriceDatabase();
    console.log('✓ Database initialized successfully');

    // テストデータの挿入
    db.insertOrUpdateDailyPrice({
      symbol: 'XEM',
      date: '2024-01-01',
      price_jpy: 4.123456,
      created_at: new Date().toISOString(),
    });

    db.insertCurrentPrice({
      symbol: 'XEM',
      price_jpy: 4.234567,
      timestamp: new Date().toISOString(),
    });

    console.log('✓ Test data inserted successfully');

    // データの取得テスト
    const dailyPrices = db.getDailyPrices('XEM', '2024-01-01', '2024-01-01');
    const currentPrice = db.getLatestCurrentPrice('XEM');

    console.log(`✓ Daily prices retrieved: ${dailyPrices.length} records`);
    console.log(`✓ Current price retrieved: ¥${currentPrice?.price_jpy || 'N/A'}`);

    db.close();
  } catch (error) {
    console.error('✗ Database test failed:', error);
  }

  // CoinGecko API テスト
  console.log('\n2. Testing CoinGecko API...');
  try {
    const api = new CoinGeckoAPI();

    console.log('Fetching current prices...');
    const currentPrices = await api.getCurrentPrices();
    console.log(`✓ XEM: ¥${currentPrices.XEM.toFixed(6)}`);
    console.log(`✓ XYM: ¥${currentPrices.XYM.toFixed(6)}`);

    console.log('Testing date utilities...');
    const today = api.getJapanToday();
    const yesterday = api.getJapanYesterday();
    console.log(`✓ Today (JST): ${today}`);
    console.log(`✓ Yesterday (JST): ${yesterday}`);
  } catch (error) {
    console.error('✗ CoinGecko API test failed:', error);
  }

  // ファイル構造テスト
  console.log('\n3. Testing File Structure...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.join(__dirname, '..');

    const requiredDirs = ['data', 'logs', 'cache', 'dist'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(projectRoot, dir);
      if (fs.existsSync(dirPath)) {
        console.log(`✓ Directory exists: ${dir}/`);
      } else if (dir === 'dist') {
        console.log(`⚠ Directory missing: ${dir}/ (run 'npm run build' to create)`);
      } else {
        console.log(`✓ Directory created: ${dir}/`);
      }
    }
  } catch (error) {
    console.error('✗ File structure test failed:', error);
  }

  console.log('\n🎉 System test completed!');
  console.log('\nNext steps:');
  console.log('1. Run `./setup.sh` to install and start services');
  console.log('2. Check service status with `sudo systemctl status nem-symbol-*.service`');
  console.log('3. Test API at http://localhost:3000');
}

// スクリプトとして実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  testSystem().catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { testSystem };
