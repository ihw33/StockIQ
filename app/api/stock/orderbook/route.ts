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

        if (!provider.getOrderBook) {
            return NextResponse.json(
                { error: 'Provider does not support order book data' },
                { status: 501 }
            );
        }

        const orderBook = await provider.getOrderBook(symbol);

        return NextResponse.json(orderBook);
    } catch (error) {
        console.error('Stock OrderBook API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stock order book' },
            { status: 500 }
        );
    }
}
