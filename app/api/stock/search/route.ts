import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface StockItem {
    symbol: string;
    name: string;
    market: string;
    marcap?: number;
    size?: string;
}

interface StockListData {
    updated_at: string;
    total_count: number;
    stocks: StockItem[];
}

// 전체 종목 리스트 캐시
let stockListCache: StockItem[] | null = null;
let cacheLoadedAt: number = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1시간 캐시

// 기본 종목 리스트 (JSON 파일 없을 때 사용)
const DEFAULT_STOCKS: StockItem[] = [
    { symbol: '005930', name: '삼성전자', market: 'KOSPI', size: 'Large' },
    { symbol: '000660', name: 'SK하이닉스', market: 'KOSPI', size: 'Large' },
    { symbol: '035420', name: 'NAVER', market: 'KOSPI', size: 'Large' },
    { symbol: '035720', name: '카카오', market: 'KOSPI', size: 'Large' },
    { symbol: '005380', name: '현대차', market: 'KOSPI', size: 'Large' },
    { symbol: '000270', name: '기아', market: 'KOSPI', size: 'Large' },
    { symbol: '373220', name: 'LG에너지솔루션', market: 'KOSPI', size: 'Large' },
    { symbol: '207940', name: '삼성바이오로직스', market: 'KOSPI', size: 'Large' },
];

function loadStockList(): StockItem[] {
    const now = Date.now();

    // 캐시가 유효하면 반환
    if (stockListCache && (now - cacheLoadedAt) < CACHE_TTL) {
        return stockListCache;
    }

    try {
        // JSON 파일에서 종목 리스트 로드
        const filePath = path.join(process.cwd(), 'data', 'krx_stock_list.json');

        if (fs.existsSync(filePath)) {
            const data: StockListData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            stockListCache = data.stocks;
            cacheLoadedAt = now;
            console.log(`[StockSearch] Loaded ${stockListCache.length} stocks from JSON (updated: ${data.updated_at})`);
            return stockListCache;
        }
    } catch (error) {
        console.error('[StockSearch] Failed to load stock list:', error);
    }

    // 파일이 없으면 기본 리스트 사용
    console.log('[StockSearch] Using default stock list');
    return DEFAULT_STOCKS;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q')?.toLowerCase() || '';

        // 필터 파라미터 (쉼표로 구분)
        const marketFilter = searchParams.get('market')?.split(',').filter(Boolean);
        const sizeFilter = searchParams.get('size')?.split(',').filter(Boolean);

        const stockList = loadStockList();

        let results = stockList;

        // 1. 검색어 필터링
        if (query && query.length > 0) {
            results = results.filter(stock =>
                stock.symbol.toLowerCase().includes(query) ||
                stock.name.toLowerCase().includes(query)
            );
        }

        // 2. 마켓 필터링 (예: KOSPI, KOSDAQ)
        if (marketFilter && marketFilter.length > 0) {
            results = results.filter(stock =>
                marketFilter.includes(stock.market)
            );
        }

        // 3. 사이즈 필터링 (예: Large, Mid, Small)
        if (sizeFilter && sizeFilter.length > 0) {
            results = results.filter(stock =>
                stock.size && sizeFilter.includes(stock.size)
            );
        }

        // 검색어가 없을 때는 상위 20개만 (필터가 있으면 필터된 결과 중 상위 30개)
        const limit = (query || marketFilter?.length || sizeFilter?.length) ? 30 : 0;

        // 검색어도 없고 필터도 없으면 빈 결과 반환
        if (limit === 0) {
            return NextResponse.json({ results: [] });
        }

        results = results.slice(0, limit);

        return NextResponse.json({
            results,
            total: stockList.length,
            matched: results.length
        });

    } catch (error) {
        console.error('Stock search error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
