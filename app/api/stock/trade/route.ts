import { NextResponse } from 'next/server';
import { StockService } from '@/lib/providers/stock-service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { symbol, type, price, quantity } = body;

        // Validation (Price can be 0 for Market Order)
        if (!symbol || !type || quantity === undefined || quantity <= 0 || price === undefined) {
            return NextResponse.json({
                error: "Missing required fields",
                details: `Symbol:${symbol}, Type:${type}, Qty:${quantity}, Price:${price}`
            }, { status: 400 });
        }

        const provider = StockService.getInstance().getProvider('kiwoom');

        // KiwoomProvider (Real) has sendOrder method
        // We need to cast it or add it to the interface. 
        // For now, let's assume valid provider usage.

        // Note: StockProvider interface might not have sendOrder yet? 
        // Let's check. If not, we should assume it exists on KiwoomProvider instance.

        // Call placeOrder
        const result = await provider.placeOrder(symbol, type as 'buy' | 'sell', price, quantity);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("[Trade API] Error:", error);
        return NextResponse.json(
            { error: "Trade Failed", details: error.message },
            { status: 500 }
        );
    }
}
