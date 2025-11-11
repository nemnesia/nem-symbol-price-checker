import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PriceDatabase } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// レート制限設定 - API全体に対して
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分間
  max: 100, // 最大100リクエスト
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// キャッシュAPIに対するより厳しいレート制限
const cacheLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分間
  max: 10, // 最大10リクエスト
  message: {
    error: 'Too many cache requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// データベースAPIに対するレート制限
const dbLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分間
  max: 30, // 最大30リクエスト
  message: {
    error: 'Too many database requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// JSONレスポンス用のヘッダー設定
app.use(express.json());
app.use(limiter); // 全エンドポイントに基本的なレート制限を適用
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Content-Type', 'application/json; charset=utf-8');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// データベースインスタンス
const db = new PriceDatabase();

/**
 * 日次価格データ取得API
 * GET /api/daily/:symbol?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
app.get('/api/daily/:symbol', dbLimiter, (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { from, to } = req.query;

    if (!symbol || !['XEM', 'XYM'].includes(symbol.toUpperCase())) {
      return res.status(400).json({
        error: 'Invalid symbol. Use XEM or XYM.',
      });
    }

    if (!from || !to) {
      return res.status(400).json({
        error: 'Both from and to date parameters are required. Format: YYYY-MM-DD',
      });
    }

    // 日付フォーマットの簡単な検証
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from as string) || !dateRegex.test(to as string)) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    const prices = db.getDailyPrices(symbol.toUpperCase(), from as string, to as string);

    res.json({
      symbol: symbol.toUpperCase(),
      from,
      to,
      count: prices.length,
      data: prices.map((price) => ({
        date: price.date,
        price_jpy: price.price_jpy,
        created_at: price.created_at,
      })),
    });
  } catch (error) {
    console.error('Error in /api/daily:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * 現在価格データ取得API（データベースから最新価格）
 * GET /api/current/:symbol
 */
app.get('/api/current/:symbol', dbLimiter, (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol || !['XEM', 'XYM'].includes(symbol.toUpperCase())) {
      return res.status(400).json({
        error: 'Invalid symbol. Use XEM or XYM.',
      });
    }

    const currentPrice = db.getLatestCurrentPrice(symbol.toUpperCase());

    if (!currentPrice) {
      return res.status(404).json({
        error: 'No current price data found',
      });
    }

    res.json({
      symbol: symbol.toUpperCase(),
      price_jpy: currentPrice.price_jpy,
      timestamp: currentPrice.timestamp,
    });
  } catch (error) {
    console.error('Error in /api/current:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * 現在価格データ取得API（JSONキャッシュファイルから）
 * GET /api/current-cache
 */
app.get('/api/current-cache', cacheLimiter, (req: Request, res: Response) => {
  try {
    const cacheFile = path.join(__dirname, '..', 'cache', 'current-prices.json');

    if (!fs.existsSync(cacheFile)) {
      return res.status(404).json({
        error: 'Cache file not found',
      });
    }

    const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    res.json(cacheData);
  } catch (error) {
    console.error('Error in /api/current-cache:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * 両コインの現在価格を一括取得
 * GET /api/current
 */
app.get('/api/current', dbLimiter, (req: Request, res: Response) => {
  try {
    const xemPrice = db.getLatestCurrentPrice('XEM');
    const xymPrice = db.getLatestCurrentPrice('XYM');

    res.json({
      XEM: xemPrice
        ? {
            price_jpy: xemPrice.price_jpy,
            timestamp: xemPrice.timestamp,
          }
        : null,
      XYM: xymPrice
        ? {
            price_jpy: xymPrice.price_jpy,
            timestamp: xymPrice.timestamp,
          }
        : null,
    });
  } catch (error) {
    console.error('Error in /api/current:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * ヘルスチェックAPI
 * GET /health
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * APIドキュメント
 * GET /
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'NEM/Symbol Price API',
    version: '1.0.0',
    endpoints: {
      'GET /api/daily/:symbol': {
        description: 'Get daily prices for XEM or XYM',
        parameters: {
          symbol: 'XEM or XYM',
          from: 'Start date (YYYY-MM-DD)',
          to: 'End date (YYYY-MM-DD)',
        },
        example: '/api/daily/XEM?from=2024-01-01&to=2024-01-31',
      },
      'GET /api/current/:symbol': {
        description: 'Get latest current price for XEM or XYM from database',
        parameters: {
          symbol: 'XEM or XYM',
        },
        example: '/api/current/XEM',
      },
      'GET /api/current': {
        description: 'Get latest current prices for both XEM and XYM from database',
      },
      'GET /api/current-cache': {
        description: 'Get current prices from JSON cache file',
      },
      'GET /health': {
        description: 'Health check endpoint',
      },
    },
  });
});

// エラーハンドリング
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Endpoint not found',
  });
});

app.use((error: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
  });
});

// サーバー起動
const server = app.listen(PORT, () => {
  console.log(`NEM/Symbol Price API server is running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} for API documentation`);
});

// グレースフルシャットダウン
process.on('SIGINT', () => {
  console.log('Received SIGINT. Graceful shutdown...');
  server.close(() => {
    db.close();
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Graceful shutdown...');
  server.close(() => {
    db.close();
    console.log('Server closed.');
    process.exit(0);
  });
});
