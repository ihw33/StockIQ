import { NextResponse } from 'next/server';

export async function POST() {
    try {
        const pythonApiUrl = 'http://localhost:8001/api/strategy/morning-briefing';

        const response = await fetch(pythonApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            // If Python server is down or errors
            const errorText = await response.text();
            console.error("Python API Error:", errorText);
            return NextResponse.json(
                { error: "Failed to fetch from AI Engine", details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);


    } catch (error) {
        console.error("Mocking connection error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: String(error) },
            { status: 500 }
        );
    }
}
