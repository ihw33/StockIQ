'use client';

import { useState, useEffect } from 'react';
import { X, Filter, Loader2, CheckCircle2, AlertCircle, Star, ChevronDown, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WATCHLIST_GROUPS } from '@/lib/hooks/use-watchlist';

interface ScreenerResult {
    symbol: string;
    name: string;
    market: string;
    close: number;
    change_pct: number;
    volume: number;
    market_cap: number;
    conditions_met: string[];
    score: number;
}

interface ScreenerCondition {
    name: string;
    description: string;
    value: number | boolean;
    min_value?: number;
    max_value?: number;
    enabled: boolean;
}

interface ScreenerProfile {
    id: string;
    name: string;
    description: string;
    conditions: ScreenerCondition[];
}

interface ScreenerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectStock: (symbol: string, name: string) => void;
    onAddToWatchlist: (symbol: string, name: string, group: number) => void;
    isInWatchlist: (symbol: string) => boolean;
    getItemGroup: (symbol: string) => number | null;
}

// 파라미터별 선택지 정의
const PARAM_OPTIONS: Record<string, { label: string; value: number }[]> = {
    change_min: [
        { label: '+1%', value: 1 },
        { label: '+3%', value: 3 },
        { label: '+5%', value: 5 },
        { label: '+7%', value: 7 },
    ],
    change_max: [
        { label: '+7%', value: 7 },
        { label: '+10%', value: 10 },
        { label: '+15%', value: 15 },
        { label: '+20%', value: 20 },
    ],
    volume_min_ratio: [
        { label: '1배', value: 1.0 },
        { label: '1.5배', value: 1.5 },
        { label: '2배', value: 2.0 },
        { label: '3배', value: 3.0 },
    ],
    volume_max_ratio: [
        { label: '3배', value: 3.0 },
        { label: '5배', value: 5.0 },
        { label: '7배', value: 7.0 },
        { label: '10배', value: 10.0 },
    ],
    upper_wick_pct: [
        { label: '0%', value: 0 },
        { label: '1%', value: 1 },
        { label: '2%', value: 2 },
        { label: '3%', value: 3 },
    ],
    price_min: [
        { label: '1천', value: 1000 },
        { label: '3천', value: 3000 },
        { label: '5천', value: 5000 },
        { label: '1만', value: 10000 },
    ],
    price_max: [
        { label: '3만', value: 30000 },
        { label: '5만', value: 50000 },
        { label: '10만', value: 100000 },
        { label: '무제한', value: 999999 },
    ],
    market_cap_min: [
        { label: '500억', value: 500 },
        { label: '1천억', value: 1000 },
        { label: '3천억', value: 3000 },
        { label: '1조', value: 10000 },
    ],
};

export function ScreenerModal({
    isOpen,
    onClose,
    onSelectStock,
    onAddToWatchlist,
    isInWatchlist,
    getItemGroup,
}: ScreenerModalProps) {
    const [loading, setLoading] = useState(false);
    const [loadingProfiles, setLoadingProfiles] = useState(false);
    const [results, setResults] = useState<ScreenerResult[]>([]);
    const [profiles, setProfiles] = useState<ScreenerProfile[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<ScreenerProfile | null>(null);
    const [customParams, setCustomParams] = useState<Record<string, number | boolean>>({});
    const [minScore, setMinScore] = useState(8);
    const [maxStocks, setMaxStocks] = useState(100);
    const [error, setError] = useState<string | null>(null);
    const [lastRun, setLastRun] = useState<string | null>(null);
    const [openGroupMenu, setOpenGroupMenu] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    // 프로필 목록 가져오기
    useEffect(() => {
        if (isOpen && profiles.length === 0) {
            loadProfiles();
        }
    }, [isOpen]);

    const loadProfiles = async () => {
        setLoadingProfiles(true);
        try {
            const response = await fetch('/api/screener/run');
            if (response.ok) {
                const data = await response.json();
                setProfiles(data.profiles || []);
                if (data.profiles?.length > 0 && !selectedProfile) {
                    const firstProfile = data.profiles[0];
                    setSelectedProfile(firstProfile);
                    // 기본 파라미터 설정
                    const params: Record<string, number | boolean> = {};
                    firstProfile.conditions.forEach((c: ScreenerCondition) => {
                        params[c.name] = c.value;
                    });
                    setCustomParams(params);
                }
            }
        } catch (err) {
            console.error('Failed to load profiles:', err);
        } finally {
            setLoadingProfiles(false);
        }
    };

    const handleProfileChange = (profileId: string) => {
        const profile = profiles.find(p => p.id === profileId);
        if (profile) {
            setSelectedProfile(profile);
            // 파라미터 초기화
            const params: Record<string, number | boolean> = {};
            profile.conditions.forEach((c: ScreenerCondition) => {
                params[c.name] = c.value;
            });
            setCustomParams(params);
        }
    };

    const handleParamChange = (name: string, value: number | boolean) => {
        setCustomParams(prev => ({ ...prev, [name]: value }));
    };

    const runScreener = async () => {
        if (!selectedProfile) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/screener/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profile_id: selectedProfile.id,
                    params: customParams,
                    min_score: minScore,
                    max_stocks: maxStocks
                }),
            });

            if (!response.ok) {
                throw new Error('스크리너 실행 실패');
            }

            const data = await response.json();
            setResults(data.results || []);
            setLastRun(new Date().toLocaleTimeString('ko-KR'));
        } catch (err) {
            setError(err instanceof Error ? err.message : '알 수 없는 오류');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectStock = (result: ScreenerResult) => {
        onSelectStock(result.symbol, result.name);
        onClose();
    };

    const handleAddToGroup = (symbol: string, name: string, groupId: number) => {
        onAddToWatchlist(symbol, name, groupId);
        setOpenGroupMenu(null);
    };

    if (!isOpen) return null;

    const totalConditions = selectedProfile?.conditions.length || 10;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <Filter className="w-6 h-6" />
                        <div>
                            <h2 className="text-lg font-bold">종목 스크리너</h2>
                            <p className="text-xs text-indigo-200">조건 기반 종목 필터링</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Profile Selector & Controls */}
                <div className="p-4 border-b bg-gray-50 shrink-0">
                    {/* Profile Selection */}
                    <div className="flex items-center gap-4 mb-3">
                        <label className="text-sm font-medium text-gray-700">스크리너:</label>
                        <div className="flex gap-2">
                            {loadingProfiles ? (
                                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            ) : (
                                profiles.map((profile) => (
                                    <button
                                        key={profile.id}
                                        onClick={() => handleProfileChange(profile.id)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedProfile?.id === profile.id
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'bg-white border text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        {profile.name}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Profile Description */}
                    {selectedProfile && (
                        <p className="text-sm text-gray-600 mb-3 bg-white p-2 rounded border">
                            💡 {selectedProfile.description}
                        </p>
                    )}

                    {/* Settings Toggle & Run Button */}
                    <div className="flex items-center gap-4 flex-wrap">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${showSettings
                                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                                    : 'bg-white border text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <Settings2 className="w-4 h-4" />
                            조건 설정
                            <ChevronDown className={`w-4 h-4 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                        </button>

                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600" title="충족해야 할 최소 조건 수">최소 조건:</label>
                            <div className="flex gap-1">
                                {[6, 7, 8, 9, 10].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setMinScore(n)}
                                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${minScore === n
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white border text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        {n}개
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600" title="시총/가격 1차 필터 후 상세 검사할 종목 수 (많을수록 느림)">스캔 범위:</label>
                            <div className="flex gap-1">
                                {[
                                    { label: '빠름', value: 50 },
                                    { label: '보통', value: 100 },
                                    { label: '넓음', value: 200 },
                                    { label: '전체', value: 500 },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setMaxStocks(opt.value)}
                                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${maxStocks === opt.value
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white border text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Button
                            onClick={runScreener}
                            disabled={loading || !selectedProfile}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    스캔 중...
                                </>
                            ) : (
                                <>
                                    <Filter className="w-4 h-4 mr-2" />
                                    스크리닝 실행
                                </>
                            )}
                        </Button>
                        {lastRun && (
                            <span className="text-xs text-gray-500">마지막: {lastRun}</span>
                        )}
                    </div>
                </div>

                {/* Conditions Settings Panel */}
                {showSettings && selectedProfile && (
                    <div className="p-4 border-b bg-indigo-50/50 shrink-0">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {selectedProfile.conditions.map((condition) => {
                                const options = PARAM_OPTIONS[condition.name];
                                const currentValue = customParams[condition.name] ?? condition.value;

                                return (
                                    <div key={condition.name} className="bg-white p-3 rounded-lg border shadow-sm">
                                        <label className="block text-xs font-medium text-gray-700 mb-2">
                                            {condition.description}
                                        </label>

                                        {typeof condition.value === 'boolean' ? (
                                            // Boolean 토글
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleParamChange(condition.name, true)}
                                                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${currentValue === true
                                                            ? 'bg-green-500 text-white'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    ON
                                                </button>
                                                <button
                                                    onClick={() => handleParamChange(condition.name, false)}
                                                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${currentValue === false
                                                            ? 'bg-gray-500 text-white'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    OFF
                                                </button>
                                            </div>
                                        ) : options ? (
                                            // 프리셋 옵션
                                            <div className="flex flex-wrap gap-1">
                                                {options.map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => handleParamChange(condition.name, opt.value)}
                                                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${currentValue === opt.value
                                                                ? 'bg-indigo-600 text-white'
                                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                            }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            // 숫자 입력 (fallback)
                                            <input
                                                type="number"
                                                value={currentValue as number}
                                                onChange={(e) => handleParamChange(condition.name, Number(e.target.value))}
                                                min={condition.min_value}
                                                max={condition.max_value}
                                                className="w-full border rounded px-2 py-1.5 text-sm text-gray-800 bg-gray-50"
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Results */}
                <div className="flex-1 overflow-auto p-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
                            <AlertCircle className="w-5 h-5" />
                            {error}
                        </div>
                    )}

                    {!loading && results.length === 0 && !error && (
                        <div className="text-center py-12 text-gray-500">
                            <Filter className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg font-medium">스크리너를 선택하고 실행해주세요</p>
                            <p className="text-sm mt-2">위에서 스크리너를 선택하고 조건을 설정한 후 실행 버튼을 클릭하세요</p>
                        </div>
                    )}

                    {results.length > 0 && (
                        <div>
                            <div className="mb-3 text-sm text-gray-600">
                                <span className="font-bold text-indigo-600">{results.length}개</span> 종목이 조건을 충족합니다
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            <th className="text-left p-3 font-medium w-10">관심</th>
                                            <th className="text-left p-3 font-medium">종목</th>
                                            <th className="text-right p-3 font-medium">현재가</th>
                                            <th className="text-right p-3 font-medium">등락률</th>
                                            <th className="text-right p-3 font-medium">시가총액</th>
                                            <th className="text-center p-3 font-medium">점수</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((result) => {
                                            const inWatchlist = isInWatchlist(result.symbol);
                                            const currentGroup = getItemGroup(result.symbol);
                                            const isMenuOpen = openGroupMenu === result.symbol;

                                            return (
                                                <tr
                                                    key={result.symbol}
                                                    className="border-b hover:bg-indigo-50 transition-colors"
                                                >
                                                    {/* Watchlist Star Button */}
                                                    <td className="p-3 relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setOpenGroupMenu(isMenuOpen ? null : result.symbol);
                                                            }}
                                                            className={`p-1.5 rounded-lg transition-colors ${inWatchlist
                                                                    ? 'text-yellow-500 hover:bg-yellow-50'
                                                                    : 'text-gray-300 hover:text-yellow-500 hover:bg-yellow-50'
                                                                }`}
                                                            title={inWatchlist ? `관심 ${(currentGroup ?? 0) + 1}에 추가됨` : '관심종목 추가'}
                                                        >
                                                            <Star className={`w-4 h-4 ${inWatchlist ? 'fill-yellow-500' : ''}`} />
                                                        </button>

                                                        {/* Group Selection Dropdown */}
                                                        {isMenuOpen && (
                                                            <div className="absolute left-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 py-1 min-w-[100px]">
                                                                {WATCHLIST_GROUPS.map((group) => (
                                                                    <button
                                                                        key={group.id}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleAddToGroup(result.symbol, result.name, group.id);
                                                                        }}
                                                                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex items-center gap-2 ${currentGroup === group.id ? 'bg-blue-50 text-blue-700' : ''
                                                                            }`}
                                                                    >
                                                                        <span
                                                                            className="w-2 h-2 rounded-full"
                                                                            style={{
                                                                                backgroundColor: group.color === 'blue' ? '#3b82f6' : group.color === 'green' ? '#22c55e' : '#a855f7'
                                                                            }}
                                                                        />
                                                                        {group.name}
                                                                        {currentGroup === group.id && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td
                                                        className="p-3 cursor-pointer"
                                                        onClick={() => handleSelectStock(result)}
                                                    >
                                                        <div className="font-medium text-gray-900">{result.name}</div>
                                                        <div className="text-xs text-gray-500">{result.symbol} · {result.market}</div>
                                                    </td>
                                                    <td className="text-right p-3 font-mono text-gray-800">
                                                        {result.close.toLocaleString()}원
                                                    </td>
                                                    <td className={`text-right p-3 font-bold ${result.change_pct > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                                        {result.change_pct > 0 ? '+' : ''}{result.change_pct.toFixed(2)}%
                                                    </td>
                                                    <td className="text-right p-3 text-gray-600">
                                                        {(result.market_cap / 10000).toFixed(1)}조
                                                    </td>
                                                    <td className="text-center p-3">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${result.score === totalConditions
                                                                ? 'bg-green-100 text-green-700'
                                                                : result.score >= totalConditions - 2
                                                                    ? 'bg-yellow-100 text-yellow-700'
                                                                    : 'bg-gray-100 text-gray-700'
                                                            }`}>
                                                            {result.score === totalConditions && <CheckCircle2 className="w-3 h-3" />}
                                                            {result.score}/{totalConditions}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Click outside to close dropdown */}
            {openGroupMenu && (
                <div
                    className="fixed inset-0 z-0"
                    onClick={() => setOpenGroupMenu(null)}
                />
            )}
        </div>
    );
}
