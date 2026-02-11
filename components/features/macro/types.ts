// ─── Macro Dashboard Types ───────────────────────────────

export interface MacroScore {
    value?: number | null;
    change_pct?: number;
    change_bps?: number;
    score: number;
    net_amount?: number;
    net?: number;
    volume?: number;
}

export interface GlobalMarketItem {
    value: number | null;
    change_pct: number;
}

export interface GlobalMarkets {
    nasdaq: GlobalMarketItem;
    sp500: GlobalMarketItem;
    oil: GlobalMarketItem;
    gold: GlobalMarketItem;
    bitcoin: GlobalMarketItem;
    krw_usd: KrwUsdItem;
}

export interface KrwUsdItem {
    value: number | null;
    change: number;
    change_pct: number;
}

export interface RiskIndicators {
    us2y?: { value?: number | null; change_bps?: number };
    spread_2s10s?: number | null;
    hy_spread?: { value?: number | null; change_bps?: number };
    move?: { value?: number | null; change_pct?: number };
    us30y?: { value?: number | null; change_bps?: number };
}

export interface MacroData {
    date: string;
    kr_market_day?: string;
    us_market_date?: string;
    us_market_day?: string;
    global_markets?: GlobalMarkets & { ewy?: GlobalMarketItem };
    tier_a: {
        dxy: MacroScore;
        us10y: MacroScore;
        vix: MacroScore;
    };
    tier_b: {
        foreign_cash: MacroScore;
        futures: MacroScore;
        short_selling: MacroScore;
    };
    risk_indicators?: RiskIndicators;
    overall_score: number;
    safety_level: 1 | 2 | 3;
    prediction_direction: string;
    interpretation: string;
    chain_analysis?: string;
    llm_analysis?: string;
    llm_analysis_pm?: string;
    collected_at_am?: string;
    collected_at_pm?: string;
    news_context?: string;
    economic_calendar?: {
        economic_events: EconomicEvent[];
        collected_at?: string;
    };
}

export interface EconomicEvent {
    title: string;
    date: string;
    impact: 'High' | 'Medium';
    forecast: string;
    previous: string;
}

export interface DailyReview {
    date: string;
    prediction: {
        direction: string;
        overall_score: number;
        safety_level: number;
        level_label: string;
        summary: string;
    };
    actual: {
        kospi_change: number;
        foreign_net: number;
        direction: string;
    };
    evaluation: {
        hit: boolean;
        label: string;
        comment: string;
    };
}
