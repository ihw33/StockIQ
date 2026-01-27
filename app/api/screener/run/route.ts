import { NextResponse } from 'next/server';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const response = await fetch(`${AI_ENGINE_URL}/api/screener/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Screener API failed: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[Screener API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to run screener' },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const response = await fetch(`${AI_ENGINE_URL}/api/screener/profiles`);

        if (!response.ok) {
            throw new Error(`Screener API failed: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[Screener API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to get profiles' },
            { status: 500 }
        );
    }
}
