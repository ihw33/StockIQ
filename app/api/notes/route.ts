import { NextResponse } from 'next/server';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const qs = searchParams.toString();
        const response = await fetch(`${AI_ENGINE_URL}/api/notes${qs ? `?${qs}` : ''}`, {
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Notes API failed: ${response.status}`);
        return NextResponse.json(await response.json());
    } catch (error) {
        console.error('[Notes] Error:', error);
        return NextResponse.json([], { status: 500 });
    }
}
