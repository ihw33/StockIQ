import { NextResponse } from 'next/server';
import { StockService } from '@/lib/providers/stock-service';

export async function GET() {
    try {
        const service = StockService.getInstance();
        const provider = service.getProvider('kiwoom'); // Default to Kiwoom

        if (!provider.getThemes) {
            return NextResponse.json(
                { error: 'Provider does not support themes' },
                { status: 501 }
            );
        }

        const themes = await provider.getThemes();
        return NextResponse.json(themes);
    } catch (error) {
        console.error('Stock Themes API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch themes' },
            { status: 500 }
        );
    }
}
