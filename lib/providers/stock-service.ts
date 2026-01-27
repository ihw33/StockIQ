import { KiwoomProvider } from './kiwoom-provider';
import { KiwoomRestProvider } from './kiwoom-rest-provider';
import { StockProvider } from './stock-provider';

export class StockService {
    private static instance: StockService;
    private kiwoomProvider: KiwoomProvider | null = null;
    private kiwoomRestProvider: KiwoomRestProvider | null = null;

    private constructor() { }

    public static getInstance(): StockService {
        if (!StockService.instance) {
            StockService.instance = new StockService();
        }
        return StockService.instance;
    }

    public getProvider(name: string = 'kiwoom'): StockProvider {
        // Debug: Check Env Vars
        const hasKeys = !!(process.env.KIWOOM_APP_KEY && process.env.KIWOOM_SECRET_KEY);
        console.log(`[StockService] Requesting provider '${name}'. Keys present: ${hasKeys}`);

        // 1. Try Kiwoom REST Provider if Env Vars enable it (Priority for Mac)
        // User provided keys indicate they want to use this.
        if (hasKeys) {
            if (!this.kiwoomRestProvider) {
                console.log("[StockService] Initializing Kiwoom REST Provider (Mac Native)...");
                this.kiwoomRestProvider = new KiwoomRestProvider({
                    appKey: process.env.KIWOOM_APP_KEY!,
                    appSecret: process.env.KIWOOM_SECRET_KEY!,
                    baseUrl: 'https://api.kiwoom.com'
                });
            }
            return this.kiwoomRestProvider;
        }

        console.warn("[StockService] ⚠️ Kiwoom Keys missing! Falling back to Legacy Bridge (May not work).");

        // 2. Default to Kiwoom Bridge (Windows)
        if (!this.kiwoomProvider) {
            console.log("[StockService] Initializing KiwoomProvider (Bridge)...");
            this.kiwoomProvider = new KiwoomProvider({
                isMock: false,
                bridgeIp: '172.30.1.10'
            });
        }
        return this.kiwoomProvider;
    }
}
