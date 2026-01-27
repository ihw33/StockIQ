import { StockProvider, StockQuote, StockChartData, StockOrderBook, OrderBookItem, StockTheme, StockAccount } from './stock-provider';
import WebSocket from 'ws';
import axios from 'axios';

interface KiwoomConfig {
    appKey?: string;
    appSecret?: string;
    accountNo?: string;
    isMock: boolean;
    bridgeIp?: string; // e.g. '172.30.1.10'
}

// Centralized Mock Data Configuration
// Attached to globalThis to persist across Next.js Hot Module Reloads (Singleton Pattern)
// Centralized Mock Data Configuration
// Attached to globalThis to persist across Next.js Hot Module Reloads (Singleton Pattern)
const INITIAL_MOCK_DB: Record<string, { name: string, basePrice: number, theme: string, currentPrice?: number }> = {
    // Semiconductors (8 items)
    '000660': { name: 'SK하이닉스', basePrice: 747000, theme: 'SEMICON' }, // 2026 Price
    '005930': { name: '삼성전자', basePrice: 141000, theme: 'SEMICON' }, // 2026 Price
    '042700': { name: '한미반도체', basePrice: 184000, theme: 'SEMICON' },
    '000100': { name: '유한양행', basePrice: 111000, theme: 'SEMICON' },
    '039200': { name: '오스코텍', basePrice: 54000, theme: 'SEMICON' },
    '028300': { name: 'HLB', basePrice: 54500, theme: 'SEMICON' },
    '272210': { name: '한화시스템', basePrice: 24000, theme: 'SEMICON' },
    '005380': { name: '현대차', basePrice: 406000, theme: 'SEMICON' }, // 2026 Price

    // Auto
    '000270': { name: '기아', basePrice: 135000, theme: 'AUTO' },

    // Battery
    '373220': { name: 'LG에너지솔루션', basePrice: 363000, theme: 'BATTERY' },
    '006400': { name: '삼성SDI', basePrice: 267500, theme: 'BATTERY' },

    // Bio
    '207940': { name: '삼성바이오로직스', basePrice: 1910000, theme: 'BIO' }, // 2026 Price (~1.9M)
};

// Ensure global singleton exists
declare global {
    var STOCK_MOCK_DB: typeof INITIAL_MOCK_DB | undefined;
}

if (!globalThis.STOCK_MOCK_DB) {
    globalThis.STOCK_MOCK_DB = INITIAL_MOCK_DB;
}

export class KiwoomProvider implements StockProvider {
    name = 'kiwoom';
    private ws: WebSocket | null = null;
    private bridgeUrl: string;
    private baseUrl: string; // Legacy REST URL
    private isConnected = false;
    private realtimeCache = new Map<string, StockQuote>();
    private subscribedSymbols = new Set<string>();
    private hasSentLogin = false;
    // Queue for pending chart requests: Symbol -> Resolve Function
    private pendingChartRequests = new Map<string, (data: StockChartData[]) => void>();

    // Throttling Queue
    private requestQueue: Array<() => Promise<void>> = [];
    private isProcessingQueue = false;

    // Centralized Mock Data Configuration
    // Base prices roughly based on early 2025/late 2024 realistic/fictional values
    // Using a map for O(1) properties.
    // Centralized Mock Data Configuration
    // Base prices roughly based on early 2025/late 2024 realistic/fictional values
    // Using a map for O(1) properties.
    // Centralized Mock Data Configuration
    // Made Global to persist across API handler instances (Singleton-like behavior for Mock DB)


    // Helper to get consistent mock price
    private getBasePrice(symbol: string): number {
        return globalThis.STOCK_MOCK_DB?.[symbol]?.basePrice || 10000;
    }

    // Single source of truth for "Live" price in Mock
    private getCurrentPrice(symbol: string): number {
        const db = globalThis.STOCK_MOCK_DB;
        if (!db || !db[symbol]) return 10000;

        // Initialize if not set
        if (!db[symbol].currentPrice) {
            const base = db[symbol].basePrice;
            // Random start point +/- 5%
            const change = Math.floor(Math.random() * (base * 0.05)) * (Math.random() > 0.4 ? 1 : -1);
            db[symbol].currentPrice = base + change;
        }
        return db[symbol].currentPrice!;
    }

    // Helper to get name
    private getName(symbol: string): string {
        return globalThis.STOCK_MOCK_DB?.[symbol]?.name || symbol;
    }

    constructor(private config: KiwoomConfig) {
        // Default to Mock if no IP provided
        const ip = config.bridgeIp || '172.30.1.10';
        this.bridgeUrl = `ws://${ip}:8000/ws/trade`;

        this.baseUrl = config.isMock
            ? 'https://mockapi.kiwoom.com'
            : 'https://api.kiwoom.com';

        if (!config.isMock) {
            this.connectBridge();
        }
    }

    private connectBridge() {
        console.log(`[KiwoomProvider] Connecting to Bridge at ${this.bridgeUrl}...`);
        try {
            this.ws = new WebSocket(this.bridgeUrl);

            this.ws.onopen = () => {
                console.log('[KiwoomProvider] Connected to Windows Bridge ✅');
                this.isConnected = true;

                // Only send CONNECT command once per session to avoid popups on reconnect
                if (!this.hasSentLogin) {
                    this.ws?.send(JSON.stringify({ type: "CONNECT_KIWOOM", client: "StockIQ_Backend" }));
                    this.hasSentLogin = true;
                }

                // Flush queued subscriptions with slight delay to ensure readiness
                setTimeout(() => {
                    if (this.subscribedSymbols.size > 0) {
                        const symbols = Array.from(this.subscribedSymbols);
                        console.log(`[Kiwoom] Flushing queued subscriptions: ${symbols.join(',')}`);
                        const payload = {
                            type: "SUBSCRIBE",
                            codes: symbols.join(';')
                        };
                        this.ws?.send(JSON.stringify(payload));
                    }
                }, 500);
            };

            this.ws.onerror = (err: any) => {
                console.error('[KiwoomProvider] WS Error:', err.message);
            };

            this.ws.onclose = () => {
                console.log('[KiwoomProvider] Disconnected. Reconnecting in 5s...');
                this.isConnected = false;
                setTimeout(() => this.connectBridge(), 5000);
            };

            this.ws.onmessage = (event: any) => {
                try {
                    const msg = JSON.parse(event.data as string);

                    if (msg.type === 'REAL_DATA') {
                        // msg: { code, price, change, percent, volume }
                        const symbol = msg.code;
                        const quote: StockQuote = {
                            symbol: symbol,
                            name: this.getName(symbol),
                            price: msg.price,
                            change: msg.change,
                            changePercent: msg.percent,
                            volume: msg.volume,
                            open: 0, high: 0, low: 0,
                            timestamp: new Date().toISOString(),
                            provider: 'kiwoom-realtime'
                        };
                        this.realtimeCache.set(symbol, quote);

                    } else if (msg.type === 'TR_DATA') {
                        // Handle Chart Data Response
                        // Payload: { type: 'TR_DATA', tr_code: 'opt10081', data: [...], symbol: '005930' }
                        const symbol = msg.symbol;
                        console.log(`[KiwoomProvider] Received TR_DATA for ${symbol} (${msg.data?.length} rows)`);

                        if (symbol && this.pendingChartRequests.has(symbol)) {
                            const resolve = this.pendingChartRequests.get(symbol);
                            if (resolve) {
                                resolve(msg.data || []);
                                this.pendingChartRequests.delete(symbol);
                            }
                        }
                    } else {
                        console.log('[KiwoomProvider] Received:', msg);
                    }
                } catch (e) {
                    console.error("Parse Error:", e);
                }
            };

        } catch (e) {
            console.error('WS Setup Failed:', e);
        }
    }

    private subscribe(symbols: string[]) {
        const newSymbols = symbols.filter(s => !this.subscribedSymbols.has(s));
        if (newSymbols.length === 0) return;

        newSymbols.forEach(s => this.subscribedSymbols.add(s));

        if (!this.isConnected || !this.ws) {
            console.log(`[Kiwoom] Queued subscription for ${newSymbols.join(',')} (Not connected)`);
            return;
        }

        const payload = {
            type: "SUBSCRIBE",
            codes: newSymbols.join(';')
        };
        this.ws.send(JSON.stringify(payload));
        console.log(`[Kiwoom] Subscribing to ${newSymbols.join(',')}`);
    }

    // --- Trading Logic ---
    async sendOrder(symbol: string, type: 'BUY' | 'SELL', price: number, quantity: number) {
        if (!this.isConnected) {
            console.log("[KiwoomProvider] Waiting for connection...");
            for (let i = 0; i < 20; i++) {
                if (this.isConnected) break;
                await new Promise(r => setTimeout(r, 100));
            }
        }

        if (!this.isConnected || !this.ws) {
            throw new Error("Bridge Not Connected (Gateway Timeout)");
        }

        const payload = {
            type: "ORDER",
            payload: {
                scode: symbol,
                order_type: type,
                price: price,
                quantity: quantity,
                hoga: "00" // Limit
            }
        };

        this.ws.send(JSON.stringify(payload));
        console.log(`[KiwoomProvider] Order Sent: ${type} ${symbol} ${quantity}ea @ ${price}`);
        return { success: true, message: "Order Sent to Windows" };
    }

    async placeOrder(symbol: string, type: 'buy' | 'sell', price: number, quantity: number, accountNo?: string): Promise<any> {
        return this.sendOrder(symbol, type === 'buy' ? 'BUY' : 'SELL', price, quantity);
    }

    async getAccount(accountNo?: string): Promise<StockAccount> {
        // Mock implementation for now
        return {
            accountNo: accountNo || "87654321-11",
            deposit: 10000000,
            totalAsset: 15000000,
            totalReturn: 5000000,
            returnRate: 50.0,
            positions: []
        };
    }

    // --- Data Provider Logic (Hybrid) ---
    async getThemes(): Promise<StockTheme[]> {
        return [
            { code: 'SEMICON', name: '반도체', sentiment: 'Very Good', avgChange: 3.2, leadingStockName: 'SK하이닉스' },
            { code: 'AUTO', name: '자동차', sentiment: 'Good', avgChange: 1.5, leadingStockName: '기아' },
            { code: 'BATTERY', name: '2차전지', sentiment: 'Bad', avgChange: -1.2, leadingStockName: 'LG에너지솔루션' },
            { code: 'BIO', name: '제약/바이오', sentiment: 'Neutral', avgChange: 0.1, leadingStockName: '삼성바이오로직스' },
        ];
    }

    async getStocksByTheme(themeCode: string): Promise<StockQuote[]> {
        let symbols: string[] = [];

        if (themeCode === 'SEMICON') {
            // Return 8 stocks as requested
            symbols = ['000660', '005930', '042700', '000100', '039200', '028300', '272210', '005380'];
        } else if (themeCode === 'AUTO') {
            symbols = ['000270', '005380'];
        } else if (themeCode === 'BATTERY') {
            symbols = ['373220', '006400'];
        } else if (themeCode === 'BIO') {
            symbols = ['207940'];
        }

        const quotes: StockQuote[] = [];
        for (const sym of symbols) {
            quotes.push(await this.getQuote(sym));
        }
        return quotes;
    }

    private getMockQuote(symbol: string, name?: string): StockQuote {
        const currentPrice = this.getCurrentPrice(symbol);
        const basePrice = this.getBasePrice(symbol);
        const change = currentPrice - basePrice;

        return {
            symbol,
            name: name || this.getName(symbol),
            price: currentPrice,
            change: change,
            changePercent: (change / basePrice) * 100,
            volume: Math.floor(basePrice / 10) + Math.floor(Math.random() * 50000),
            open: basePrice,
            high: Math.max(basePrice, currentPrice) + 500,
            low: Math.min(basePrice, currentPrice) - 500,
            timestamp: new Date().toISOString(),
            provider: 'kiwoom-mock',
        };
    }

    private async getAccessToken(): Promise<string> {
        return "mock_token";
    }

    async getQuote(symbol: string): Promise<StockQuote> {
        this.subscribe([symbol]);

        // STRICT REAL MODE: No Mock Fallback

        if (this.realtimeCache.has(symbol)) {
            return this.realtimeCache.get(symbol)!;
        }

        // Wait for Real Data (up to 3s)
        if (this.isConnected) {
            for (let i = 0; i < 30; i++) {
                if (this.realtimeCache.has(symbol)) return this.realtimeCache.get(symbol)!;
                await new Promise(r => setTimeout(r, 100));
            }
        }

        // If still no data, return Empty/Zero Quote to indicate failure
        return {
            symbol,
            name: this.getName(symbol),
            price: 0,
            change: 0,
            changePercent: 0,
            volume: 0,
            open: 0, high: 0, low: 0,
            timestamp: new Date().toISOString(),
            provider: 'kiwoom-strict-fail'
        };
    }

    async getChart(symbol: string, interval: string): Promise<StockChartData[]> {
        // STRICT REAL MODE: No Mock Fallback
        try {
            return await this.requestChartWait(symbol, interval);
        } catch (e) {
            console.error(`[KiwoomProvider] Chart Request Failed (Strict Mode): ${e}`);
            return []; // Return empty array to show "No Data" instead of Fake Chart
        }
    }

    private requestChartWait(symbol: string, interval: string): Promise<StockChartData[]> {
        return new Promise((resolve, reject) => {
            // Push to Throttled Queue
            this.requestQueue.push(async () => {
                if (!this.isConnected || !this.ws) {
                    reject("Bridge not connected");
                    return;
                }

                // Timeout Safety
                const timeout = setTimeout(() => {
                    if (this.pendingChartRequests.has(symbol)) {
                        this.pendingChartRequests.delete(symbol);
                        reject("Timeout waiting for Chart Data");
                    }
                }, 8000); // Increased timeout for queue delays

                // Register Pending Request
                this.pendingChartRequests.set(symbol, (data) => {
                    clearTimeout(timeout);
                    resolve(data);
                });

                // Send Command
                const payload = {
                    type: "REQUEST_CHART",
                    payload: {
                        symbol: symbol,
                        interval: interval
                    }
                };
                this.ws.send(JSON.stringify(payload));
                console.log(`[KiwoomProvider] Requested Real Chart for ${symbol} (${interval})`);
            });

            this.processRequestQueue();
        });
    }

    private async processRequestQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const req = this.requestQueue.shift();
            if (req) {
                try {
                    await req();
                } catch (e) { console.error(e); }
                // Kiwoom Rate Limit Safety (approx 3-4 req/sec safe)
                await new Promise(r => setTimeout(r, 50));
            }
        }
        this.isProcessingQueue = false;
    }

    private calculateIndicators(data: StockChartData[]) {
        const calculateRSI = (period: number) => {
            let gains = 0;
            let losses = 0;
            for (let i = 1; i <= period; i++) {
                const diff = data[i].close - data[i - 1].close;
                if (diff >= 0) gains += diff;
                else losses -= diff;
            }
            let avgGain = gains / period;
            let avgLoss = losses / period;

            for (let i = period + 1; i < data.length; i++) {
                const diff = data[i].close - data[i - 1].close;
                const gain = diff >= 0 ? diff : 0;
                const loss = diff < 0 ? -diff : 0;
                avgGain = (avgGain * (period - 1) + gain) / period;
                avgLoss = (avgLoss * (period - 1) + loss) / period;
                const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                data[i].rsi = 100 - (100 / (1 + rs));
            }
        };
        if (data.length > 14) calculateRSI(14);

        const calculateBollinger = (period: number, stdDevMultiplier: number) => {
            for (let i = period - 1; i < data.length; i++) {
                const slice = data.slice(i - period + 1, i + 1);
                const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
                const mean = sum / period;
                const squaredDiffs = slice.map(d => Math.pow(d.close - mean, 2));
                const variance = squaredDiffs.reduce((acc, curr) => acc + curr, 0) / period;
                const stdDev = Math.sqrt(variance);
                data[i].bollinger = {
                    middle: mean,
                    upper: mean + (stdDev * stdDevMultiplier),
                    lower: mean - (stdDev * stdDevMultiplier)
                };
            }
        };
        if (data.length > 20) calculateBollinger(20, 2);

        const calculateEMA = (values: number[], period: number) => {
            const k = 2 / (period + 1);
            const emaArray = [values[0]];
            for (let i = 1; i < values.length; i++) {
                emaArray.push(values[i] * k + emaArray[i - 1] * (1 - k));
            }
            return emaArray;
        };
        const closes = data.map(d => d.close);
        if (closes.length > 26) {
            const ema12 = calculateEMA(closes, 12);
            const ema26 = calculateEMA(closes, 26);
            const macdLine = ema12.map((val, i) => val - ema26[i]);
            const signalLine = calculateEMA(macdLine, 9);
            for (let i = 0; i < data.length; i++) {
                data[i].macd = {
                    value: macdLine[i],
                    signal: signalLine[i],
                    histogram: macdLine[i] - signalLine[i]
                };
            }
        }
    }

    private getMockChart(symbol: string, interval: string = 'D'): StockChartData[] {
        const data: StockChartData[] = [];
        const basePrice = this.getBasePrice(symbol);

        // Dynamic Sync: Prioritize Realtime Cache (Live Data) -> Then Mock DB
        // This ensures that even if we use a Mock Chart (because historical API is unavailable),
        // it aligns perfectly with the Real-Time Header Price.
        let currentPrice = this.getCurrentPrice(symbol);
        if (this.realtimeCache.has(symbol)) {
            currentPrice = this.realtimeCache.get(symbol)!.price;
        }

        // Debug Log
        console.log(`[KiwoomProvider] Generating Random Walk Chart for ${symbol}. Target: ${currentPrice} (Source: ${this.realtimeCache.has(symbol) ? 'RealtimeCache' : 'MockDB'})`);

        const isMinute = ['1m', '5m', '15m'].includes(interval);
        const now = new Date();
        now.setSeconds(0);
        now.setMilliseconds(0);

        const count = 60;
        const intervalOffset = interval === '1m' ? 0 : interval === '5m' ? 100 : interval === '15m' ? 200 : 500;

        // --- Seeded PRNG (Pseudo Random Number Generator) ---
        // Simple linear congruential generator or similar is enough for UI
        // We use the symbol + interval string to create a starting seed
        const seedStr = symbol + interval + "v2"; // v2 to force refresh
        let h = 0x811c9dc5;
        for (let i = 0; i < seedStr.length; i++) {
            h ^= seedStr.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        let seed = h >>> 0;

        // Mulberry32 generator
        const nextRandom = () => {
            let t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };

        // --- Generate Random Walk ---
        // Start from an arbitrary price, then walk. Finally adjust to match Target.
        let walkPrice = basePrice;
        const tempPoints: number[] = [];

        // Volatility depends on interval (higher for daily, lower for minute)
        const volatility = isMinute ? 0.002 : 0.02;

        for (let i = 0; i < count; i++) {
            // Random walk step: -0.5 to 0.5 * volatility
            const changePct = (nextRandom() - 0.5) * 2 * volatility;
            walkPrice = walkPrice * (1 + changePct);
            tempPoints.push(walkPrice);
        }

        // --- Adjust curve to match Start(Base) and End(Current) ---
        // We want the chart to roughly end at `currentPrice`.
        // We scale the entire walk so the last point hits `currentPrice`.
        // However, we strictly want the LAST point to be `currentPrice`.

        const lastWalkVal = tempPoints[tempPoints.length - 1];
        const firstWalkVal = tempPoints[0];

        // Simple shift/scale isn't perfect for random walk, but "Shift" is safest to preserve shape.
        // Let's just shift the whole random walk so the last point equals currentPrice.
        const shift = currentPrice - lastWalkVal;

        for (let i = 0; i < count; i++) {
            const timeIdx = count - 1 - i;
            const date = new Date(now);
            if (isMinute) {
                const minutes = interval === '1m' ? 1 : interval === '5m' ? 5 : 15;
                date.setMinutes(date.getMinutes() - (timeIdx * minutes));
            } else {
                date.setDate(date.getDate() - timeIdx);
            }

            // Calculate OHLC from the walk point (Close)
            // We simulate intraday volatility for High/Low relative to Close
            const rawClose = tempPoints[i] + shift;

            // Generate Candle Body
            const candleVol = volatility * 0.5; // candle height factor
            const rndOpen = (nextRandom() - 0.5) * rawClose * candleVol;
            const open = Math.round(rawClose + rndOpen);

            // High/Low - Add randomized variance to wicks so they don't look identical
            // Use distinct randoms for Top/Bottom wicks. Some candles might have no wick (random < 0).
            const topVar = nextRandom();
            const botVar = nextRandom();
            const topWick = topVar > 0.2 ? (nextRandom() * rawClose * candleVol * 1.5) : 0; // 80% chance of wick
            const botWick = botVar > 0.2 ? (nextRandom() * rawClose * candleVol * 1.5) : 0;

            const high = Math.round(Math.max(open, rawClose) + topWick);
            const low = Math.round(Math.min(open, rawClose) - botWick);
            const close = Math.round(rawClose);
            const volume = Math.floor(nextRandom() * 100000) + 10000;

            let timestamp = '';
            if (isMinute) {
                const pad = (n: number) => n.toString().padStart(2, '0');
                timestamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
            } else {
                timestamp = date.toISOString().split('T')[0];
            }

            data.push({ timestamp, open, high, low, close, volume });
        }

        this.calculateIndicators(data);
        return data;
    }

    async getOrderBook(symbol: string): Promise<StockOrderBook> {
        return this.getMockOrderBook(symbol);
    }

    private getMockOrderBook(symbol: string): StockOrderBook {
        const basePrice = this.getBasePrice(symbol);
        // Sync with centralized mock price OR Realtime Cache if available
        let currentPrice = this.getCurrentPrice(symbol);
        if (this.realtimeCache.has(symbol)) {
            currentPrice = this.realtimeCache.get(symbol)!.price;
        }

        const asks: OrderBookItem[] = [];
        const bids: OrderBookItem[] = [];

        for (let i = 0; i < 10; i++) {
            asks.push({
                price: currentPrice + ((10 - i) * (basePrice > 50000 ? 100 : 10)),
                volume: Math.floor(Math.random() * 5000) + 100
            });
        }

        for (let i = 0; i < 10; i++) {
            bids.push({
                price: currentPrice - ((i + 1) * (basePrice > 50000 ? 100 : 10)),
                volume: Math.floor(Math.random() * 5000) + 100
            });
        }

        return {
            symbol,
            asks: asks.sort((a, b) => a.price - b.price),
            bids: bids.sort((a, b) => b.price - a.price),
            timestamp: new Date().toISOString(),
            provider: 'kiwoom-mock',
        };
    }
}
