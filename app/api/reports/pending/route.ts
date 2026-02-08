import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const minutes = searchParams.get('minutes') || '30';

        const res = await fetch(
            `http://127.0.0.1:8001/api/reports/pending?minutes=${minutes}`,
            { cache: 'no-store' }
        );

        if (!res.ok) {
            return NextResponse.json({ error: 'Backend error' }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch pending reports', details: String(error) },
            { status: 500 }
        );
    }
}
