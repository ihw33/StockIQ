import { NextRequest, NextResponse } from 'next/server';
import { StockService } from '@/lib/providers/stock-service';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const providerName = searchParams.get('provider') || 'kiwoom';

    if (!symbol) {
        return NextResponse.json(
            { error: 'Symbol parameter is required' },
            { status: 400 }
        );
    }

    try {
        const service = StockService.getInstance();
        const provider = service.getProvider(providerName);
        const quote = await provider.getQuote(symbol);

        return NextResponse.json(quote);
    } catch (error) {
        console.error('Stock API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stock quote', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
