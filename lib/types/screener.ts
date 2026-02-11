/**
 * 스크리너 타입 정의
 */

export interface ScreenerResult {
    symbol: string;
    name: string;
    sector: string;
    industry: string;
    market_cap: number;
    per?: number;
    pbr?: number;
    roe?: number;
    eps?: number;
    bps?: number;
}

export interface ScreenerRequest {
    profile: 'semiconductor_equipment' | 'all_kospi' | 'all_kosdaq';
    filters?: FilterConfig;
}

export interface FilterConfig {
    per_min?: number;
    per_max?: number;
    roe_min?: number;
    eps_min?: number;
    market_cap_min?: number;
    sector?: string[];
}

export interface ScreenerResponse {
    total: number;
    results: ScreenerResult[];
    updated_at?: string;
}
