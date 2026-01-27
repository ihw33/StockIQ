import { NextResponse } from 'next/server';
import { StockService } from '@/lib/providers/stock-service';

// GET /api/stock/account?accountNo=...
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const accountNo = searchParams.get('accountNo') || undefined;

        console.log(`[API] Fetching Account Info (Account: ${accountNo || 'Default'})...`);

        const provider = StockService.getInstance().getProvider('kiwoom'); // Force Kiwoom for Account
        if (!provider) {
            return NextResponse.json({ error: 'Kiwoom Provider not active' }, { status: 503 });
        }

        // Check if provider supports getAccount
        // @ts-ignore - Interface has it now
        if (typeof provider.getAccount !== 'function') {
            return NextResponse.json({ error: 'Provider does not support Account Info' }, { status: 501 });
        }

        const data = await provider.getAccount(accountNo);
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("[API] Account Info Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch account info", details: error.message },
            { status: 500 }
        );
    }
}
