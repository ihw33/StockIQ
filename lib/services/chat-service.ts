
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    type?: 'briefing' | 'text';
}

export interface MorningBriefingResponse {
    status: string;
    briefing_content: string;
    data_sources: {
        market_movers_count: number;
        news_count: number;
        macro_available: boolean;
    }
}

class ChatService {
    private static instance: ChatService;
    private baseUrl = 'http://localhost:8000'; // Python AI Engine API

    private constructor() { }

    public static getInstance(): ChatService {
        if (!ChatService.instance) {
            ChatService.instance = new ChatService();
        }
        return ChatService.instance;
    }

    async generateMorningBriefing(): Promise<ChatMessage> {
        try {
            // In a real production setup, we might proxy this through Next.js API route 
            // to hide the Python backend URL, but for local dev direct call is fine 
            // if CORS is handled. If not, we'll use a Next.js API proxy (TODO).
            // For now assuming we might need a proxy, but let's try direct first or 
            // implement a proxy route in Next.js if direct fails.

            // Let's assume we call a Next.js API route that forwards to Python
            // to avoid CORS and mixed content issues easily.

            const response = await fetch('/api/ai/morning-briefing', {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch briefing');
            }

            const data: MorningBriefingResponse = await response.json();

            return {
                id: Date.now().toString(),
                role: 'assistant',
                content: data.briefing_content,
                timestamp: new Date(),
                type: 'briefing'
            };
        } catch (error) {
            console.error("ChatService Error:", error);
            return {
                id: Date.now().toString(),
                role: 'assistant',
                content: "⚠️ **Error**: Could not connect to AI Engine. Please check if the Python backend is running.",
                timestamp: new Date(),
                type: 'text'
            };
        }
    }

    async analyzeChart(symbol: string, mode: 'algo' | 'llm' = 'llm', query?: string): Promise<ChatMessage> {
        try {
            const response = await fetch('/api/ai/chart-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, mode, query })
            });

            if (!response.ok) throw new Error('Failed to analyze chart');
            const data = await response.json();

            return {
                id: Date.now().toString(),
                role: 'assistant',
                content: data.analysis,
                timestamp: new Date(),
                type: 'text' // Markdown analysis
            };
        } catch (error) {
            console.error("ChatService Error:", error);
            return {
                id: Date.now().toString(),
                role: 'assistant',
                content: "⚠️ **Analysis Failed**: Could not connect to AI Analyst.",
                timestamp: new Date(),
                type: 'text'
            };
        }
    }

    async sendMessage(message: string): Promise<ChatMessage> {
        // Placeholder for future general chat capability
        return {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: "I am currently valid only for Morning Briefings. Please click the 'Morning Briefing' button.",
            timestamp: new Date(),
        }
    }
}

export const chatService = ChatService.getInstance();
