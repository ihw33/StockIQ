export interface StockQuote {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  timestamp: string;
  provider: string;
}

export interface StockChartData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volumeColor?: string;
  candleColor?: string;

  // Technical Indicators
  bollinger?: {
    upper: number;
    middle: number;
    lower: number;
  };
  macd?: {
    value: number;
    signal: number;
    histogram: number;
  };
  rsi?: number;
}

export interface OrderBookItem {
  price: number;
  volume: number;
}

export interface StockOrderBook {
  symbol: string;
  bids: OrderBookItem[]; // 매수 호가
  asks: OrderBookItem[]; // 매도 호가
  timestamp: string;
  provider: string;
}

export interface StockTradingInfo {
  symbol: string;
  tradingStrength: number; // 체결강도
  volumePower: number; // Volume Analysis (placeholder)
}

export interface StockTheme {
  code: string;
  name: string;
  sentiment: 'Very Good' | 'Good' | 'Neutral' | 'Bad' | 'Very Bad';
  avgChange: number;
  leadingStockName: string;
}

export interface StockPosition {
  symbol: string;
  name?: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  evalAmount: number; // 평가금액
  totalReturn: number; // 손익금
  returnRate: number; // 수익률 (%)
}

export interface StockAccount {
  accountNo: string;
  deposit: number; // 예수금
  totalAsset: number; // 추정 자산
  totalReturn: number; // 총 손익
  returnRate: number; // 총 수익률
  positions: StockPosition[];
}

export interface StockProvider {
  name: string;
  getQuote(symbol: string): Promise<StockQuote>;
  getChart(symbol: string, interval: string): Promise<StockChartData[]>;
  getOrderBook(symbol: string): Promise<StockOrderBook>;
  getThemes(): Promise<StockTheme[]>;
  getStocksByTheme(themeCode: string): Promise<StockQuote[]>;
  getAccount(accountNo?: string): Promise<StockAccount>;
  placeOrder(symbol: string, type: 'buy' | 'sell', price: number, quantity: number, accountNo?: string): Promise<any>;
}
