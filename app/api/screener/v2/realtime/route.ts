import { NextResponse } from 'next/server';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const response = await fetch(`${AI_ENGINE_URL}/api/screener/v2/realtime`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`realtime API failed: ${response.status}`);
        return NextResponse.json(await response.json());
    } catch (error) {
        console.error('[Screener Realtime] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch realtime prices', results: [] }, { status: 500 });
    }
}
