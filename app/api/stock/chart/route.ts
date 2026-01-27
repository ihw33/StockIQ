import { NextRequest, NextResponse } from 'next/server';
import { StockService } from '@/lib/providers/stock-service';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const interval = searchParams.get('interval') || 'D'; // D: Daily, M: Minute
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

        if (!provider.getChart) {
            return NextResponse.json(
                { error: 'Provider does not support chart data' },
                { status: 501 }
            );
        }

        const chartData = await provider.getChart(symbol, interval);

        return NextResponse.json(chartData);
    } catch (error) {
        console.error('Stock Chart API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stock chart' },
            { status: 500 }
        );
    }
}
