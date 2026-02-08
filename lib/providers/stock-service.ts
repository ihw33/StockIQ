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
        // Try REST Provider first (if keys exist)
        const hasKeys = !!(process.env.KIWOOM_APP_KEY && process.env.KIWOOM_SECRET_KEY);

        if (hasKeys) {
            if (!this.kiwoomRestProvider) {
                console.log('[StockService] Initializing Kiwoom REST Provider...');
                this.kiwoomRestProvider = new KiwoomRestProvider({
                    appKey: process.env.KIWOOM_APP_KEY!,
                    appSecret: process.env.KIWOOM_SECRET_KEY!,
                    baseUrl: process.env.KIWOOM_BASE_URL || 'https://openapi.kiwoom.com'
                });
            }
            return this.kiwoomRestProvider;
        }

        // Fallback to KiwoomProvider (Bridge/Mock)
        console.log('[StockService] Using KiwoomProvider (with Mock fallback)...');

        if (!this.kiwoomProvider) {
            console.log('[StockService] Initializing KiwoomProvider...');
            this.kiwoomProvider = new KiwoomProvider({
                isMock: false,
                bridgeIp: '172.30.1.10'
            });
        }
        return this.kiwoomProvider;
    }
}
