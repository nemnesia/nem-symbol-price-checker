export interface CoinGeckoPrice {
  [coinId: string]: {
    jpy: number;
  };
}

export interface CoinGeckoHistoryPrice {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export class CoinGeckoAPI {
  private baseUrl = 'https://api.coingecko.com/api/v3';

  // XEM: nem, XYM: symbol
  private coinIds = {
    XEM: 'nem',
    XYM: 'symbol',
  } as const;

  /**
   * リトライ機能付きのfetch
   */
  private async fetchWithRetry(url: string, maxRetries = 3, baseDelay = 1000): Promise<Response> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url);

        if (response.status === 429) {
          // Rate limit exceeded - wait and retry
          const delay = baseDelay * Math.pow(2, i); // Exponential backoff
          console.log(`Rate limit hit, waiting ${delay}ms before retry ${i + 1}/${maxRetries}`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }
        const delay = baseDelay * Math.pow(2, i);
        console.log(`Request failed, retrying in ${delay}ms... (${i + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries reached');
  }

  /**
   * 現在価格を取得
   */
  async getCurrentPrices(): Promise<{ XEM: number; XYM: number }> {
    const coinIdsParam = Object.values(this.coinIds).join(',');
    const url = `${this.baseUrl}/simple/price?ids=${coinIdsParam}&vs_currencies=jpy`;

    try {
      const response = await this.fetchWithRetry(url);
      const data: CoinGeckoPrice = await response.json();

      return {
        XEM: data[this.coinIds.XEM]?.jpy || 0,
        XYM: data[this.coinIds.XYM]?.jpy || 0,
      };
    } catch (error) {
      console.error('Failed to fetch current prices:', error);
      throw error;
    }
  }

  /**
   * 指定日の平均価格を取得（Range APIで日本時間1日分のデータから計算）
   * @param coinSymbol XEM or XYM
   * @param date YYYY-MM-DD format (日本時間ベース)
   */
  async getDailyPrice(coinSymbol: 'XEM' | 'XYM', date: string): Promise<number> {
    const coinId = this.coinIds[coinSymbol];
    
    try {
      // 日本時間での指定日の開始時刻と終了時刻を設定
      // 日本時間 00:00:00 - 23:59:59 をUTCタイムスタンプに変換
      const jstStartDate = new Date(date + 'T00:00:00+09:00'); // JST 00:00
      const jstEndDate = new Date(date + 'T23:59:59+09:00');   // JST 23:59
      
      const fromTimestamp = Math.floor(jstStartDate.getTime() / 1000);
      const toTimestamp = Math.floor(jstEndDate.getTime() / 1000);
      
      const url = `${this.baseUrl}/coins/${coinId}/market_chart/range?vs_currency=jpy&from=${fromTimestamp}&to=${toTimestamp}`;
      
      const response = await this.fetchWithRetry(url);
      const data: CoinGeckoHistoryPrice = await response.json();
      
      if (!data.prices || data.prices.length === 0) {
        console.warn(`No price data available for ${coinSymbol} on ${date} (JST)`);
        return 0;
      }
      
      // 全価格データの平均を計算
      const averagePrice = data.prices.reduce((sum, [, price]) => sum + price, 0) / data.prices.length;
      
      console.log(`${coinSymbol} ${date} (JST): ${data.prices.length} data points, average price: ¥${averagePrice.toFixed(6)}`);
      
      return averagePrice;
      
    } catch (error) {
      console.error(`Failed to fetch daily average price for ${coinSymbol} on ${date} (JST):`, error);
      
      // フォールバックとして従来のHistory APIを使用
      console.log(`Falling back to History API for ${coinSymbol} ${date}`);
      try {
        const formattedDate = this.formatDateForAPI(date);
        const fallbackUrl = `${this.baseUrl}/coins/${coinId}/history?date=${formattedDate}`;
        const fallbackResponse = await this.fetchWithRetry(fallbackUrl);
        const fallbackData = await fallbackResponse.json();
        return fallbackData.market_data?.current_price?.jpy || 0;
      } catch (fallbackError) {
        console.error(`Fallback History API also failed for ${coinSymbol} on ${date}:`, fallbackError);
        throw error;
      }
    }
  }

  /**
   * 期間の価格履歴を取得
   * @param coinSymbol XEM or XYM
   * @param fromDate YYYY-MM-DD format
   * @param toDate YYYY-MM-DD format
   */
  async getPriceHistory(
    coinSymbol: 'XEM' | 'XYM',
    fromDate: string,
    toDate: string
  ): Promise<Array<{ date: string; price: number }>> {
    const coinId = this.coinIds[coinSymbol];
    const fromTimestamp = Math.floor(new Date(fromDate).getTime() / 1000);
    const toTimestamp = Math.floor(new Date(toDate).getTime() / 1000);

    const url = `${this.baseUrl}/coins/${coinId}/market_chart/range?vs_currency=jpy&from=${fromTimestamp}&to=${toTimestamp}`;

    try {
      const response = await this.fetchWithRetry(url);
      const data: CoinGeckoHistoryPrice = await response.json();

      return data.prices.map(([timestamp, price]) => ({
        date: this.formatTimestampToDate(timestamp),
        price: price,
      }));
    } catch (error) {
      console.error(`Failed to fetch price history for ${coinSymbol}:`, error);
      throw error;
    }
  }

  /**
   * 日付をCoinGecko API形式にフォーマット (DD-MM-YYYY)
   */
  private formatDateForAPI(date: string): string {
    const [year, month, day] = date.split('-');
    return `${day}-${month}-${year}`;
  }

  /**
   * タイムスタンプを日付文字列に変換
   */
  private formatTimestampToDate(timestamp: number): string {
    return new Date(timestamp).toISOString().split('T')[0];
  }

  /**
   * 指定した日付の前日の日付を取得
   */
  getPreviousDate(date: string): string {
    const targetDate = new Date(date);
    targetDate.setDate(targetDate.getDate() - 1);
    return targetDate.toISOString().split('T')[0];
  }

  /**
   * 日本時間での今日の日付を取得
   */
  getJapanToday(): string {
    // Intl.DateTimeFormat を使って直接YYYY-MM-DD形式で日本時間の日付を取得
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
  }

  /**
   * 日本時間での昨日の日付を取得
   */
  getJapanYesterday(): string {
    // 24時間前のタイムスタンプを日本時間で表示
    const yesterdayTimestamp = Date.now() - 24 * 60 * 60 * 1000;
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date(yesterdayTimestamp));
  }
}
