import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { symbol, data_prompt } = body;

        if (!symbol) {
            return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
        }

        const pythonApiUrl = 'http://127.0.0.1:8001/api/strategy/company-analysis';

        const response = await fetch(pythonApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol, data_prompt }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Python Company Analysis API Error:", errorText);
            return NextResponse.json(
                { error: "Failed to fetch from Company Analysis Engine", details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error("Company Analysis Proxy Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: String(error) },
            { status: 500 }
        );
    }
}
