import { NextResponse } from 'next/server';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ symbol: string }> }
) {
    try {
        const { symbol } = await params;
        const url = `${AI_ENGINE_URL}/api/company/${symbol}/fundamentals`;

        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Company API failed: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Company API] Error:', message);
        return NextResponse.json(
            { error: 'Failed to fetch company data', details: message },
            { status: 500 }
        );
    }
}
