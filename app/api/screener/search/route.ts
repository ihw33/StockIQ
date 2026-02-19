import { NextResponse } from 'next/server';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q') || '';
        const response = await fetch(`${AI_ENGINE_URL}/api/screener/search?q=${encodeURIComponent(q)}`, {
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Search API failed: ${response.status}`);
        return NextResponse.json(await response.json());
    } catch (error) {
        console.error('[Screener Search] Error:', error);
        return NextResponse.json({ results: [] }, { status: 500 });
    }
}
