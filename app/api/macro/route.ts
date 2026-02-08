import { NextResponse } from 'next/server';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const endpoint = searchParams.get('endpoint') || 'today';
        const period = searchParams.get('period') || 'weekly';
        const date = searchParams.get('date');

        let url = `${AI_ENGINE_URL}/api/macro/${endpoint}`;
        if (endpoint === 'history') {
            url += `?period=${period}`;
        } else if (endpoint === 'date' && date) {
            url = `${AI_ENGINE_URL}/api/macro/date/${date}`;
        } else if (endpoint === 'dates') {
            url = `${AI_ENGINE_URL}/api/macro/dates`;
        }

        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Macro API failed: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[Macro API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch macro data', details: error.message },
            { status: 500 }
        );
    }
}

export async function POST() {
    try {
        const response = await fetch(`${AI_ENGINE_URL}/api/macro/collect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`Macro collect failed: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[Macro API] Collect Error:', error);
        return NextResponse.json(
            { error: 'Failed to collect macro data', details: error.message },
            { status: 500 }
        );
    }
}
