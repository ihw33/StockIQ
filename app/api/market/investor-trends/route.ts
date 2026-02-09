import { NextResponse } from 'next/server';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';

export async function GET() {
    try {
        const response = await fetch(`${AI_ENGINE_URL}/api/market/investor-trends`, {
            cache: 'no-store',
        });

        if (!response.ok) {
            return NextResponse.json({ status: 'no_data', data: null });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ status: 'no_data', data: null });
    }
}
