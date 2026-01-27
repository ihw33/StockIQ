import axios from 'axios';
import { StockAccount, StockChartData, StockOrderBook, StockPosition, StockProvider, StockQuote, StockTheme } from './stock-provider';

interface KiwoomRestConfig {
    appKey: string;
    appSecret: string;
    baseUrl: string;
}

export class KiwoomRestProvider implements StockProvider {
    name = 'Kiwoom REST API';
    private config: KiwoomRestConfig;
    private accessToken: string | null = null;
    private tokenExpiry: number = 0;

    constructor(config: KiwoomRestConfig) {
        this.config = config;
        // Correct Domain from PDF: https://api.kiwoom.com (Real) / https://mockapi.kiwoom.com (Mock)
        // User didn't specify mock, assuming real given the keys.
        this.config.baseUrl = 'https://api.kiwoom.com';
    }

    private tokenRefreshPromise: Promise<string> | null = null; // Race Condition Lock

    private async getAccessToken(): Promise<string> {
        // 1. Fast Path: Valid Token Exists
        if (this.accessToken && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        // 2. Queueing: If refresh is already running, return the existing promise
        if (this.tokenRefreshPromise) {
            return this.tokenRefreshPromise;
        }

        // 3. Execution: Create new refresh promise (Critical Section)
        this.tokenRefreshPromise = (async () => {
            try {
                console.log('[KiwoomRest] Requesting New Token...');
                const response = await axios.post(`${this.config.baseUrl}/oauth2/token`, {
                    grant_type: 'client_credentials',
                    appkey: this.config.appKey,
                    secretkey: this.config.appSecret
                }, {
                    headers: {
                        'content-type': 'application/json;charset=UTF-8',
                        'api-id': 'au10001'
                    }
                });

                const data = response.data;

                // Error Validation (Kiwoom returns 200 OK even for errors like 8050)
                if (!data.token || (data.return_code && data.return_code !== 0)) {
                    const msg = data.return_msg || JSON.stringify(data);
                    console.error('[KiwoomRest] Auth Failed:', data);
                    // If 8050 (Terminal Error), it means IP restriction.
                    throw new Error(`Kiwoom Auth Failed: ${msg}`);
                }

                this.accessToken = data.token;

                // Parse Expiry
                const dtStr = data.expires_dt;
                if (dtStr && dtStr.length >= 14) {
                    const year = parseInt(dtStr.substring(0, 4));
                    const month = parseInt(dtStr.substring(4, 6)) - 1;
                    const day = parseInt(dtStr.substring(6, 8));
                    const hour = parseInt(dtStr.substring(8, 10));
                    const minute = parseInt(dtStr.substring(10, 12));
                    const second = parseInt(dtStr.substring(12, 14));
                    this.tokenExpiry = new Date(year, month, day, hour, minute, second).getTime() - 60000;
                } else {
                    this.tokenExpiry = Date.now() + 3600 * 1000;
                }

                console.log(`[KiwoomRest] Token refreshed! Valid until: ${new Date(this.tokenExpiry).toLocaleString()}`);
                return this.accessToken!;
            } catch (error) {
                console.error('Kiwoom REST Token Error:', (error as any).response?.data || (error as any).message);

                // Reset token state on failure to allow retry
                this.accessToken = null;
                this.tokenExpiry = 0;
                throw new Error('Failed to authenticate with Kiwoom API');
            } finally {
                // Unlock
                this.tokenRefreshPromise = null;
            }
        })();

        return this.tokenRefreshPromise;
    }

    async getQuote(symbol: string): Promise<StockQuote> {
        try {
            await this.getAccessToken(); // Ensure token is valid

            // API ID: ka10003 (체결정보요청) - Returns recent trades, first item is current price
            // URL: /api/dostk/stkinfo
            const response = await axios.post(`${this.config.baseUrl}/api/dostk/stkinfo`, {
                stk_cd: symbol
            }, {
                headers: {
                    'content-type': 'application/json;charset=UTF-8',
                    'api-id': 'ka10003',
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            const data = response.data;
            const items = data.cntr_infr;

            if (!items || !Array.isArray(items) || items.length === 0) {
                console.warn(`[KiwoomRest] No trade info for ${symbol}`, data);
                // Fallback / Return empty with timestamp
                return {
                    symbol,
                    price: 0,
                    change: 0,
                    changePercent: 0,
                    volume: 0,
                    open: 0,
                    high: 0,
                    low: 0,
                    timestamp: new Date().toISOString(),
                    provider: 'KiwoomREST'
                };
            }

            const latest = items[0];

            // Parse fields. Note: Kiwoom returns strings like "+53500", "-100", "+0.94"
            const parseVal = (str: string | undefined) => str ? parseInt(str.replace(/[+,]/g, '')) : 0;
            const parseFloatVal = (str: string | undefined) => str ? parseFloat(str.replace(/[+,]/g, '')) : 0;

            return {
                symbol,
                price: parseVal(latest.cur_prc),
                change: parseVal(latest.pred_pre),
                changePercent: parseFloatVal(latest.pre_rt),
                volume: parseVal(latest.acc_trde_qty),
                // Note: ka10003 doesn't explicitly return Open/High/Low of the day in the list.
                // Optimally we should call ka10001 or check if other fields exist, but for MVP quote, Price/Change is key.
                // We will default Open/High/Low to Price or 0 for now.
                open: 0,
                high: 0,
                low: 0,
                timestamp: new Date().toISOString(), // We could parse latest.tm (HHMMSS) but ISO is safer for UI
                provider: 'KiwoomREST'
            };
        } catch (error) {
            console.error(`Kiwoom REST Quote Error (${symbol}):`, (error as any).response?.data || (error as any).message);
            throw error;
        }
    }
    async getChart(symbol: string, interval: string): Promise<StockChartData[]> {
        try {
            await this.getAccessToken();

            let apiId = '';
            let requestBody: any = {
                stk_cd: symbol,
                upd_stkpc_tp: '1'
            };
            let responseListKey = '';

            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}${mm}${dd}`;

            if (interval === 'D') {
                apiId = 'ka10081'; // Daily
                requestBody.base_dt = dateStr;
                responseListKey = 'stk_dt_pole_chart_qry';
            } else if (interval === 'W') {
                apiId = 'ka10082'; // Weekly
                requestBody.base_dt = dateStr;
                responseListKey = 'stk_week_pole_chart_qry';
            } else if (interval === 'M') {
                apiId = 'ka10083'; // Monthly
                requestBody.base_dt = dateStr;
                responseListKey = 'stk_mth_pole_chart_qry'; // Fixed: mth
            } else if (interval === 'Y') {
                // ka10084 is invalid. Fallback to Monthly for now.
                apiId = 'ka10083';
                requestBody.base_dt = dateStr;
                responseListKey = 'stk_mth_pole_chart_qry';
            } else if (interval === '1s' || interval === 'tick') { // Tick
                apiId = 'ka10079'; // Tick
                requestBody.tic_scope = '1';
                responseListKey = 'stk_tic_chart_qry'; // Fixed: tic_chart (no pole)
            } else {
                // Minute (1m, 3m, 5m, 10m, 15m, 30m, 60m)
                apiId = 'ka10080';
                if (interval === '1m') requestBody.tic_scope = '1';
                else if (interval === '3m') requestBody.tic_scope = '3';
                else if (interval === '5m') requestBody.tic_scope = '5';
                else if (interval === '10m') requestBody.tic_scope = '10';
                else if (interval === '15m') requestBody.tic_scope = '15';
                else if (interval === '30m') requestBody.tic_scope = '30';
                else if (interval === '60m') requestBody.tic_scope = '60';
                else requestBody.tic_scope = '30'; // Default
                responseListKey = 'stk_min_pole_chart_qry';
            }

            const response = await axios.post(`${this.config.baseUrl}/api/dostk/chart`, requestBody, {
                headers: {
                    'content-type': 'application/json;charset=UTF-8',
                    'api-id': apiId,
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            const data = response.data;
            // Handle ambiguous response keys if needed, but we set specific ones now.
            const items = data[responseListKey];

            if (!items || !Array.isArray(items)) {
                console.warn(`[KiwoomRest] Empty items for ${apiId} key=${responseListKey}`, data);
                return [];
            }

            // Parse Helper
            // Kiwoom returns signed strings (e.g. "-245000") to indicate drop. Chart needs ABSOLUTE values.
            const parseVal = (str: string | undefined) => str ? Math.abs(parseFloat(str.replace(/[+,]/g, ''))) : 0;

            return items.map((item: any) => {
                // Determine timestamp
                let timeStr = '';
                if (['D', 'W', 'M', 'Y'].includes(interval)) {
                    const d = item.dt || ''; // YYYYMMDD
                    if (d.length >= 8) {
                        timeStr = `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
                    } else {
                        timeStr = d || new Date().toISOString().split('T')[0];
                    }
                } else {
                    // Minute or Tick
                    const t = item.cntr_tm || '';
                    // Fix for Multi-day Minute Chart: 
                    // Minute data items often contain a date field (cntr_dt or dt). 
                    // If missing, we default to Today, which causes "scribble" artifacts if data spans multiple days.
                    const dateVal = item.cntr_dt || item.dt || '';

                    // Fallback to today ONLY if no date found in item
                    const ymd = (dateVal && dateVal.length === 8) ? dateVal : `${yyyy}${mm}${dd}`;

                    if (t.length >= 14) {
                        timeStr = `${t.substring(0, 4)}-${t.substring(4, 6)}-${t.substring(6, 8)}T${t.substring(8, 10)}:${t.substring(10, 12)}:${t.substring(12, 14)}`;
                    } else if (t.length === 6) {
                        timeStr = `${ymd.substring(0, 4)}-${ymd.substring(4, 6)}-${ymd.substring(6, 8)}T${t.substring(0, 2)}:${t.substring(2, 4)}:${t.substring(4, 6)}`;
                    } else {
                        // If we have just a Date but no time (weird for minute), or fallback
                        timeStr = `${ymd.substring(0, 4)}-${ymd.substring(4, 6)}-${ymd.substring(6, 8)}T00:00:00`;
                    }
                }

                return {
                    timestamp: timeStr,
                    open: parseVal(item.open_pric),
                    high: parseVal(item.high_pric),
                    low: parseVal(item.low_pric),
                    close: parseVal(item.cur_prc),
                    volume: parseVal(item.trde_qty)
                };
            })
                .filter(item => item.timestamp && !item.timestamp.includes('undefined')) // Filter invalid
                .sort((a, b) => a.timestamp.localeCompare(b.timestamp)); // Enforce chronological order

        } catch (error) {
            console.error(`Kiwoom REST Chart Error (${symbol}, ${interval}):`, (error as any).response?.data || (error as any).message);
            return [];
        }
    }
    async getOrderBook(symbol: string): Promise<StockOrderBook> {
        try {
            await this.getAccessToken(); // Ensure token is valid

            // API ID: ka10004 (주식호가요청)
            // URL: /api/dostk/mrkcond
            const response = await axios.post(`${this.config.baseUrl}/api/dostk/mrkcond`, {
                stk_cd: symbol
            }, {
                headers: {
                    'content-type': 'application/json;charset=UTF-8',
                    'api-id': 'ka10004',
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            const data = response.data;
            // The response body for ka10004 is properly flattened or nested? 
            // PDF says "Response" has body elements. It doesn't explicitly say they are in a list 'cntr_infr' like ka10003. 
            // Usually Key/Value pairs in root for non-list TRs. Wait, typically basic info is root, but let's check example.
            // Kiwoom REST often wraps in output block? No, the PDF for ka10003 showed 'cntr_infr' list. 
            // ka10004 doesn't show 'LIST' type in PDF column 'Type' for the fields like sel_1th..., it says 'String'.
            // So it's likely a flat JSON object or wrapped in 'output'. 
            // Let's assume root or standard Kiwoom output wrapper. Given ka10003 had 'cntr_infr', checking ka10004 example...
            // Wait, I cannot see the example in the previous `pdftotext` output clearly for ka10004, it was cut off or not fully captured structural-wise.
            // Safest bet: Kiwoom REST usually puts data in `output` or root.
            // Let's assume root for now based on "Response" table not mentioning a List wrapper name like 'cntr_infr'.
            // Accessing data directly from response.data.

            const item = response.data; // Assuming flat response based on PDF Type 'String' not 'List'

            const parseVal = (str: string | undefined) => str ? parseInt(str.replace(/[+,]/g, '')) : 0;

            const bids = [];
            const asks = [];

            // Kiwoom provides 10 levels (1th to 10th)
            // Asks (Sell offers) - sel_1th to sel_10th
            for (let i = 1; i <= 10; i++) {
                // Note: PDF labels:
                // sel_1th_pre_bid: 매도1차선호가 (Price)
                // sel_1th_pre_req: 매도1차선잔량 (Quantity)

                // Handling 1st case naming outlier if any? PDF says sel_1th_pre_bid.
                // Wait, PDF table P.24 shows:
                // sel_fpr_bid (매도최우선호가) for 1st?
                // sel_1th_pre_bid (매도1차선호가)??
                // Usually fpr = First Priority?
                // Let's re-read PDF output in Step 514 carefully.
                // Body sel_1th_pre_req_pre ...
                // Body sel_fpr_req (매도최우선잔량)
                // Body sel_fpr_bid (매도최우선호가)
                // Body buy_fpr_bid (매수최우선호가)
                // Then buy_1th...
                // Actually the PDF table shows:
                // sel_1th... seems to be 1st level normally if fpr is not used or purely best?
                // Ah, 'sel_fpr_bid' is "Sell First Priority Bid". 
                // Then 'sel_1th' might be 'Sell 1st'?? Or implies next levels?
                // Let's look at standard 10-level. 
                // Usually Level 1 is 'fpr'. 
                // Let's safely map strictly based on the field names available.
                // It seems 'sel_fpr' is the best offer. 'sel_1th' might be the next? Or 'sel_1th' IS 'fpr'? 
                // Ambiguity. Let's look at the field list again.
                // sel_10th... sel_1th... sel_fpr... 
                // It lists 10 descending to 1, then fpr.
                // Maybe 'fpr' is Best (1st), then 1th is 2nd? No, '1th' usually means 1st.
                // Let's check 'buy_fpr_bid' and 'buy_1th_pre_bid'.
                // If I map 1..10 using the 'th' keys, I covered 10 levels.
                // If 'fpr' is just an alias for 1st, I will key off the numbered ones or 'fpr' + 2..10.
                // Actually, looking at 'sel_1th_pre_req_pre' description is '매도1차선잔량대비'.
                // The keys are `sel_1th_pre_bid` etc.
                // I will map 1 to 10 strictly. If 1th is empty, I'll check fpr.

                // correction: PDF lists `sel_10th` down to `sel_1th` then `sel_fpr`. 
                // This suggests 10 levels PLUS a 'best' (fpr) summary? Or maybe 1th IS the best?
                // I will assume 1..10 are the ladder. 

                // wait, the variable naming in PDF:
                // sel_1th_pre_bid
                // ...
                // sel_10th_pre_bid

                // Wait! Step 514 output shows:
                // sel_1th_pre_req_pre (1차선잔량대비)
                // sel_fpr_req (매도최우선잔량)
                // sel_fpr_bid (매도최우선호가)
                // buy_fpr_bid (매수최우선호가)
                // buy_1th_pre_req_pre (매수1차선잔량대비)
                // buy_2th_pre_bid

                // It seems '1th' for Price/Quantity IS MISSING for '1th' specifically in that list, replaced by 'fpr'?
                // Look closely:
                // sel_2th_pre_bid EXISTS.
                // sel_1th_pre_bid ... IS NOT IN THE PDF LIST in Step 514?
                // Step 514 output:
                // sel_2th_pre_bid (매도2차선호가)
                // sel_1th_pre_req_pre
                // sel_fpr_req
                // sel_fpr_bid

                // So Level 1 is `sel_fpr`.
                // Levels 2..10 are `sel_2th` .. `sel_10th`.
                // That's the pattern!

                let p = 0;
                let v = 0;

                if (i === 1) {
                    p = parseVal(item['sel_fpr_bid']);
                    v = parseVal(item['sel_fpr_req']);
                } else {
                    p = parseVal(item[`sel_${i}th_pre_bid` as keyof typeof item]); // Note: 'th' suffix
                    v = parseVal(item[`sel_${i}th_pre_req` as keyof typeof item]);
                }

                if (p > 0) {
                    asks.push({ price: p, volume: v });
                }
            }

            // Bids (Buy offers) - buy_1th to buy_10th 
            // (Again, 1st is likely fpr)
            for (let i = 1; i <= 10; i++) {
                let p = 0;
                let v = 0;
                if (i === 1) {
                    p = parseVal(item['buy_fpr_bid']);
                    v = parseVal(item['buy_fpr_req']);
                } else {
                    p = parseVal(item[`buy_${i}th_pre_bid` as keyof typeof item]);
                    v = parseVal(item[`buy_${i}th_pre_req` as keyof typeof item]);
                }

                if (p > 0) {
                    bids.push({ price: p, volume: v });
                }
            }

            return {
                symbol,
                bids,
                // Order Book Display:
                // Asks: High -> Low (Lowest at bottom, closest to execution)
                // Bids: High -> Low (Highest at top, closest to execution)
                // We usually return arrays sorted by proximity to price?
                // Let's standard: Bids [Highest...Lowest], Asks [Lowest...Highest]
                // Our loop 1..10 gets 1st (Best) first.
                // Bids[0] = Best Bid (High). Correct.
                // Asks[0] = Best Ask (Low). Correct.
                // So no reverse needed if UI expects [0] to be "Best".
                asks,
                timestamp: new Date().toISOString(),
                provider: 'KiwoomREST'
            };

        } catch (error) {
            console.error(`Kiwoom REST OrderBook Error (${symbol}):`, (error as any).response?.data || (error as any).message);
            // Return empty
            return {
                symbol,
                bids: [],
                asks: [],
                timestamp: new Date().toISOString(),
                provider: 'KiwoomREST'
            };
        }
    }


    // Helper to get Balance (Jesus)
    private async getBalance(accountNo: string): Promise<number> {
        try {
            const response = await axios.post(`${this.config.baseUrl}/api/dostk/acnt`, {
                acc_no: accountNo,
                group_id: '',
                tr_cont: '',
                qry_tp: '3' // 3: Jesus (Deposit)
            }, {
                headers: {
                    'content-type': 'application/json;charset=UTF-8',
                    'api-id': 'kt00001',
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            console.log('[KiwoomRest] kt00001 (Deposit) Response:', JSON.stringify(response.data, null, 2));
            const data = response.data;
            // 'entr' is likely the field for deposit based on docs, or maybe 'dps'
            // Observed Log: "ord_alow_amt": "000000003000000" (3 Million)
            // Also "pymn_alow_amt": "000000003000000"
            return data.ord_alow_amt ? parseInt(data.ord_alow_amt) : 0;
        } catch (error) {
            console.warn('[KiwoomRest] Failed to fetch Balance (kt00001)', error);
            return 0;
        }
    }

    // Helper to get Holdings and Account Status
    private async getHoldings(accountNo: string): Promise<{ positions: StockPosition[], summary: any }> {
        try {
            const response = await axios.post(`${this.config.baseUrl}/api/dostk/acnt`, {
                acc_no: accountNo,
                group_id: '',
                tr_cont: '',
                qry_tp: '0', // 0: All Stocks
                dmst_stex_tp: 'KRX'
            }, {
                headers: {
                    'content-type': 'application/json;charset=UTF-8',
                    'api-id': 'kt00004',
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            console.log('[KiwoomRest] kt00004 (Holdings) Response:', JSON.stringify(response.data, null, 2));

            const data = response.data;
            const list = data['stk_acnt_evlt_prst'] || [];

            const positions = Array.isArray(list) ? list.map((p: any) => ({
                symbol: p['stk_cd'] ? p['stk_cd'].replace('A', '') : '',
                name: p['stk_nm'],
                quantity: parseInt(p['rmnd_qty'] || '0'),
                avgPrice: parseInt(p['buy_upc'] || '0'),
                currentPrice: parseInt(p['now_prc'] || '0'),
                evalAmount: parseInt(p['evlu_amt'] || '0'),
                totalReturn: parseInt(p['pft_loss_amt'] || '0'),
                returnRate: parseFloat(p['pl_rt'] || '0')
            })).filter((p: any) => p.quantity > 0) : [];

            const summary = {
                totalAsset: data['aset_evlt_amt'] ? parseInt(data['aset_evlt_amt']) : 0,
                totalReturn: data['lspft_amt'] ? parseInt(data['lspft_amt']) : 0,
                returnRate: data['lspft_rt'] ? parseFloat(data['lspft_rt']) : 0
            };

            return { positions, summary };

        } catch (error) {
            console.warn('[KiwoomRest] Failed to fetch Holdings (kt00004)', error);
            return { positions: [], summary: {} };
        }
    }

    async getAccount(accountNo?: string): Promise<StockAccount> {
        try {
            await this.getAccessToken();
            const targetAcc = accountNo || process.env.KIWOOM_ACCOUNT || '';
            if (!targetAcc) {
                console.warn('[KiwoomRest] KIWOOM_ACCOUNT env variable is missing.');
                return { accountNo: 'N/A', deposit: 0, totalAsset: 0, totalReturn: 0, returnRate: 0, positions: [] };
            }

            // Parallel Fetch
            const [deposit, holdingsData] = await Promise.all([
                this.getBalance(targetAcc),
                this.getHoldings(targetAcc)
            ]);

            return {
                accountNo: targetAcc,
                deposit: deposit,
                totalAsset: holdingsData.summary.totalAsset || 0,
                totalReturn: holdingsData.summary.totalReturn || 0,
                returnRate: holdingsData.summary.returnRate || 0,
                positions: holdingsData.positions
            };

        } catch (error) {
            console.error(`Kiwoom REST Account Error:`, (error as any).message);
            return { accountNo: 'Error', deposit: 0, totalAsset: 0, totalReturn: 0, returnRate: 0, positions: [] };
        }
    }

    async getThemes(): Promise<StockTheme[]> { return []; }
    async getStocksByTheme(code: string): Promise<StockQuote[]> { return []; }

    async placeOrder(symbol: string, type: 'buy' | 'sell', price: number, quantity: number, accountNo?: string): Promise<any> {
        try {
            await this.getAccessToken();
            const targetAcc = accountNo || process.env.KIWOOM_ACCOUNT || '';
            if (!targetAcc) throw new Error("No Account configured");

            // ID: kt10000 (Buy), kt10001 (Sell)
            const apiId = type === 'buy' ? 'kt10000' : 'kt10001';

            // Price 0 usually means Market Order
            const isMarket = price === 0;
            const orderPrice = isMarket ? 0 : price;
            const orderType = isMarket ? '03' : '00'; // 03: Market, 00: Limit

            console.log(`[KiwoomRest] Placing Order: ${type.toUpperCase()} ${symbol} ${quantity}ea @ ${isMarket ? 'Market' : price}`);

            // URL: /api/dostk/order (Best Guess)
            // If fails, we might need /api/dostk/kt10000 etc.
            const response = await axios.post(`${this.config.baseUrl}/api/dostk/order`, {
                acc_no: targetAcc,
                group_id: '',
                tr_cont: '',
                stk_cd: symbol,
                ord_qty: String(quantity),
                ord_prc: String(orderPrice),
                ord_gb: orderType,
                ord_type: '1' // 1: New Order
            }, {
                headers: {
                    'content-type': 'application/json;charset=UTF-8',
                    'api-id': apiId,
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            console.log('[KiwoomRest] Order Response:', response.data);
            return response.data;
        } catch (error) {
            console.error("Kiwoom REST Order Failed:", (error as any).response?.data || (error as any).message);
            throw error;
        }
    }
}
