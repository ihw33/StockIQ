import { NextRequest, NextResponse } from 'next/server';
import { StockService } from '@/lib/providers/stock-service';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const themeId = params.id;

    try {
        const service = StockService.getInstance();
        const provider = service.getProvider('kiwoom');

        if (!provider.getStocksByTheme) {
            return NextResponse.json(
                { error: 'Provider does not support theme stocks' },
                { status: 501 }
            );
        }

        const stocks = await provider.getStocksByTheme(themeId);
        return NextResponse.json(stocks);

    } catch (error) {
        console.error('Stock Theme Stocks API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch theme stocks' },
            { status: 500 }
        );
    }
}
