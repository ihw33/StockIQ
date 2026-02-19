import { NextResponse } from 'next/server';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';

export async function GET() {
    try {
        const response = await fetch(`${AI_ENGINE_URL}/api/portfolio/holdings`, {
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Holdings API failed: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[Portfolio API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch holdings', details: error.message },
            { status: 500 }
        );
    }
}
