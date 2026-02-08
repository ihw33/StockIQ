import { NextResponse } from 'next/server';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const symbol = searchParams.get('symbol');

        if (!symbol) {
            return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
        }

        const response = await fetch(`${AI_ENGINE_URL}/api/company/${symbol}/after-hours`, {
            cache: 'no-store',
        });

        if (!response.ok) {
            return NextResponse.json({ status: 'no_data', data: null });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ status: 'no_data', data: null });
    }
}
