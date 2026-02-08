export interface ParsedIndicator {
    name: string;
    value: string;
    status: 'bullish' | 'bearish' | 'neutral';
    icon?: string;
}

export interface ParsedTimeframe {
    name: string;
    icon: string;
    subtitle: string;
    trend: string;
    trendStatus: 'bullish' | 'bearish' | 'neutral';
    indicators: ParsedIndicator[];
    strategy: string;
    strategyStatus: 'bullish' | 'bearish' | 'neutral';
    entry?: string;
    stopLoss?: string;
    target?: string;
    extra?: string;
    rawMarkdown: string;
}

export interface ParsedVolatilityDay {
    date: string;
    close: string;
    changePct: number;
    volumeRatio: string;
    status: 'up' | 'down' | 'flat' | 'surge' | 'crash';
}

export interface ParsedSmartSummary {
    recommendation: string;
    icon: string;
    reason: string;
    risk?: string;
    others: string[];
    cautions: string[];
    rawMarkdown: string;
}

export interface ParsedAlgoReport {
    symbol: string;
    currentPrice: string;
    stressAlert?: {
        level: string;
        icon: string;
        score: string;
        reasons: string[];
    };
    volatility: {
        days: ParsedVolatilityDay[];
        cumulativeChange: string;
        avgDaily: string;
        level: string;
        warning?: string;
    };
    smartSummary: ParsedSmartSummary;
    timeframes: ParsedTimeframe[];
    allocation: Array<{ style: string; weight: string; timeframe: string; period: string }>;
    rawMarkdown: string;
}

function classifyStatus(text: string): 'bullish' | 'bearish' | 'neutral' {
    if (/[✅🟢🔥⚡]|상승|강세|골든|매수|진입|지지/.test(text)) return 'bullish';
    if (/[❌🔴]|하락|약세|데드|매도|이탈|과열|침체/.test(text)) return 'bearish';
    return 'neutral';
}

function extractPrice(text: string): string | undefined {
    const match = text.match(/([\d,]+)원/);
    return match ? match[1] + '원' : undefined;
}

function parseVolatilitySection(section: string): ParsedAlgoReport['volatility'] {
    const days: ParsedVolatilityDay[] = [];
    const tableRows = section.match(/\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|/g) || [];

    for (const row of tableRows) {
        if (row.includes('날짜') || row.includes('---')) continue;
        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 4) {
            const changePct = parseFloat(cells[2]) || 0;
            let status: ParsedVolatilityDay['status'] = 'flat';
            if (changePct > 3) status = 'surge';
            else if (changePct > 0) status = 'up';
            else if (changePct < -3) status = 'crash';
            else if (changePct < 0) status = 'down';

            days.push({
                date: cells[0],
                close: cells[1],
                changePct,
                volumeRatio: cells[3].replace(/[📈📊📉]/g, '').trim(),
                status,
            });
        }
    }

    const cumMatch = section.match(/5일 누적 변동:\s*([^\|*]+)/);
    const avgMatch = section.match(/평균 일간 변동:\s*([^\|*]+)/);
    const levelMatch = section.match(/변동성 수준:\s*(\w+)/);
    const warningMatch = section.match(/⚠️\s*\*\*([^*]+)\*\*/);

    return {
        days,
        cumulativeChange: cumMatch ? cumMatch[1].trim() : '',
        avgDaily: avgMatch ? avgMatch[1].trim() : '',
        level: levelMatch ? levelMatch[1].trim() : 'NORMAL',
        warning: warningMatch ? warningMatch[1].trim() : undefined,
    };
}

function parseTimeframeSection(section: string, rawMarkdown: string): ParsedTimeframe | null {
    try {
        const headerMatch = section.match(/##\s*([^\n]+)/);
        if (!headerMatch) return null;

        const header = headerMatch[1];

        let name = '';
        let icon = '';
        let subtitle = '';

        if (/주봉/.test(header)) { name = '주봉'; icon = '📊'; subtitle = '장기 포지션 (6개월~1년)'; }
        else if (/일봉/.test(header)) { name = '일봉'; icon = '📈'; subtitle = '스윙 매매 (3~10일)'; }
        else if (/15분봉/.test(header)) { name = '15분봉'; icon = '⚡'; subtitle = '데이 트레이딩 (1~3시간)'; }
        else if (/5분봉/.test(header)) { name = '5분봉'; icon = '💨'; subtitle = '스캘핑 (5~15분)'; }
        else return null;

        // Extract trend line
        const trendMatch = section.match(/\*\*([🟢🟡🔴🔥⚪]+)\s*([^*]+)\*\*/);
        const trend = trendMatch ? trendMatch[2].trim() : '';
        const trendStatus = classifyStatus(trendMatch ? trendMatch[1] + trend : '');

        // Extract indicators from table rows
        const indicators: ParsedIndicator[] = [];
        const tableRows = section.match(/\|[^|\n]+\|[^|\n]+\|[^|\n]*\|/g) || [];
        for (const row of tableRows) {
            if (row.includes('---') || row.includes('지표') || row.includes('이동평균')) continue;
            const cells = row.split('|').map(c => c.trim()).filter(Boolean);
            if (cells.length >= 2) {
                for (const cell of cells) {
                    // Extract individual indicators like "RSI 45.2 ✅"
                    const indicatorMatches = cell.match(/(RSI|MA\d+|MACD|Stochastic|%K|이격도|VWAP|거래량)\s*[:\s]?\s*([\d.,]+[%x]?)/i);
                    if (indicatorMatches) {
                        indicators.push({
                            name: indicatorMatches[1],
                            value: indicatorMatches[2],
                            status: classifyStatus(cell),
                        });
                    }
                    // Extract MA lines like "13주선 | 145,000원 | ✅ 지지"
                    const maMatch = cell.match(/(\d+[주일]선)\s*([\d,]+원?)/);
                    if (maMatch) {
                        indicators.push({
                            name: maMatch[1],
                            value: maMatch[2],
                            status: classifyStatus(cell),
                        });
                    }
                }
            }
        }

        // Also try to parse inline indicators
        const rsiMatch = section.match(/RSI[:\s]*([\d.]+)/);
        if (rsiMatch && !indicators.find(i => i.name === 'RSI')) {
            const rsi = parseFloat(rsiMatch[1]);
            indicators.push({
                name: 'RSI',
                value: rsiMatch[1],
                status: rsi > 70 ? 'bearish' : rsi < 30 ? 'bearish' : 'neutral',
                icon: rsi > 70 ? '🔥' : rsi < 30 ? '💧' : '✅',
            });
        }

        // Extract strategy line
        const strategyMatch = section.match(/\*\*전략:\*\*\s*([🟢🟡🔴⚪🔥]+)\s*\*\*([^*]+)\*\*/);
        const strategy = strategyMatch ? strategyMatch[2].trim() : '';
        const strategyStatus = classifyStatus(strategyMatch ? strategyMatch[0] : '');

        // Extract opinion line (weekly)
        const opinionMatch = section.match(/\*\*투자 의견:\*\*\s*([🟢🟡🔴]+)\s*\*\*([^*]+)\*\*/);

        // Extract prices
        const entryMatch = section.match(/진입\s*([\d,~]+원[^\|]*)/);
        const slMatch = section.match(/손절\s*([\d,]+원)/);
        const targetMatch = section.match(/목표\s*([\d,]+원)/);

        // Extract bonus/extra content
        let extra: string | undefined;
        const bonusMatch = section.match(/###\s*💡[^\n]*\n([\s\S]*?)(?=\n---|\n##|$)/);
        if (bonusMatch) extra = bonusMatch[1].trim();

        return {
            name,
            icon,
            subtitle,
            trend: opinionMatch ? opinionMatch[2].trim() : trend,
            trendStatus,
            indicators,
            strategy: opinionMatch ? opinionMatch[2].trim() : strategy,
            strategyStatus: opinionMatch ? classifyStatus(opinionMatch[0]) : strategyStatus,
            entry: entryMatch ? entryMatch[1].trim() : undefined,
            stopLoss: slMatch ? slMatch[1].trim() : undefined,
            target: targetMatch ? targetMatch[1].trim() : undefined,
            extra,
            rawMarkdown: rawMarkdown,
        };
    } catch {
        return null;
    }
}

function parseSmartSummary(section: string): ParsedSmartSummary {
    const iconMatch = section.match(/\*\*([^\s*]+)\s+([^*]+)\*\*/);
    const reasonMatch = section.match(/\*\*\n\n([^\n]+)/);
    const riskMatch = section.match(/위험도:\s*([^\n]+)/);
    const othersMatch = section.match(/\*\*다른 관점:\*\*\n([\s\S]*?)(?=\n\*\*|---)/);
    const cautionsMatch = section.match(/\*\*참고 사항:\*\*\s*([^\n]+)/);

    const others: string[] = [];
    if (othersMatch) {
        const lines = othersMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
        for (const line of lines) others.push(line.replace(/^-\s*/, '').trim());
    }

    const cautions: string[] = [];
    if (cautionsMatch) {
        cautions.push(...cautionsMatch[1].split('/').map(c => c.trim()));
    }

    return {
        recommendation: iconMatch ? iconMatch[2].trim() : '',
        icon: iconMatch ? iconMatch[1].trim() : '',
        reason: reasonMatch ? reasonMatch[1].trim() : '',
        risk: riskMatch ? riskMatch[1].trim() : undefined,
        others,
        cautions,
        rawMarkdown: section,
    };
}

export function parseAlgoReport(markdown: string): ParsedAlgoReport {
    // Extract symbol and current price from header
    const symbolMatch = markdown.match(/# 🧠\s*(\S+)\s*멀티/);
    const priceMatch = markdown.match(/\*\*현재가\*\*:\s*([\d,]+원)/);

    // Split into sections by ## headers
    const sections = markdown.split(/(?=## )/);

    // Parse stress alert
    let stressAlert: ParsedAlgoReport['stressAlert'] | undefined;
    const stressMatch = markdown.match(/🚨\s*\*\*시장 상태:\s*([🔴🟠🟡🟢])\s*(\w+)\s*스트레스\*\*\s*\(점수\s*(\d+)\/100\)/);
    if (stressMatch) {
        const reasonLines = markdown.match(/감지된 이상 신호:\n([\s\S]*?)(?=\n---)/);
        const reasons = reasonLines
            ? reasonLines[1].split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^-\s*/, '').trim())
            : [];
        stressAlert = {
            level: stressMatch[2],
            icon: stressMatch[1],
            score: stressMatch[3],
            reasons,
        };
    }

    // Parse volatility section
    const volSection = sections.find(s => s.includes('최근 5일 변동'));
    const volatility = volSection
        ? parseVolatilitySection(volSection)
        : { days: [], cumulativeChange: '', avgDaily: '', level: 'NORMAL' };

    // Parse smart summary
    const summarySection = sections.find(s => s.includes('현재 시장 상황'));
    const smartSummary = summarySection
        ? parseSmartSummary(summarySection)
        : { recommendation: '', icon: '', reason: '', others: [], cautions: [], rawMarkdown: '' };

    // Parse timeframes
    const timeframes: ParsedTimeframe[] = [];
    const tfKeywords = ['주봉', '일봉', '15분봉', '5분봉'];
    for (const section of sections) {
        if (tfKeywords.some(kw => section.includes(kw))) {
            const parsed = parseTimeframeSection(section, section);
            if (parsed) timeframes.push(parsed);
        }
    }

    // Parse allocation table
    const allocation: ParsedAlgoReport['allocation'] = [];
    const allocSection = sections.find(s => s.includes('포지션별 배분'));
    if (allocSection) {
        const rows = allocSection.match(/\|[^|\n]+\|[^|\n]+\|[^|\n]+\|[^|\n]+\|/g) || [];
        for (const row of rows) {
            if (row.includes('---') || row.includes('투자 스타일')) continue;
            const cells = row.split('|').map(c => c.trim()).filter(Boolean);
            if (cells.length >= 4) {
                allocation.push({
                    style: cells[0],
                    weight: cells[1],
                    timeframe: cells[2],
                    period: cells[3],
                });
            }
        }
    }

    return {
        symbol: symbolMatch ? symbolMatch[1] : '',
        currentPrice: priceMatch ? priceMatch[1] : '',
        stressAlert,
        volatility,
        smartSummary,
        timeframes,
        allocation,
        rawMarkdown: markdown,
    };
}
