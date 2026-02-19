// ─── Zone Gauge Configuration ────────────────────────────
// 각 지표별 구간 정의: [매우위험, 위험, 중립, 안전, 매우안전] 경계값
// position: 0(최악)~100(최선) 로 정규화

export type ZoneConfig = {
    zones: { min: number; max: number; color: string; label: string }[];
    normalize: (val: number) => number; // 값 → 0~100 위치
    unit: string;
    ticks: { pos: number; label: string }[];
};

export const ZONE_CONFIGS: Record<string, ZoneConfig> = {
    dxy_change: {
        zones: [
            { min: 0, max: 15, color: 'bg-red-500', label: '급등' },
            { min: 15, max: 35, color: 'bg-red-400/60', label: '상승' },
            { min: 35, max: 65, color: 'bg-slate-500', label: '보합' },
            { min: 65, max: 85, color: 'bg-emerald-400/60', label: '하락' },
            { min: 85, max: 100, color: 'bg-emerald-500', label: '급락' },
        ],
        normalize: (v) => Math.max(0, Math.min(100, 50 - v * 25)),  // +2%→0, 0→50, -2%→100
        unit: '%',
        ticks: [{ pos: 15, label: '+1.5%' }, { pos: 35, label: '+0.5%' }, { pos: 65, label: '-0.5%' }, { pos: 85, label: '-1.5%' }],
    },
    us10y_change: {
        zones: [
            { min: 0, max: 15, color: 'bg-red-500', label: '급등' },
            { min: 15, max: 35, color: 'bg-red-400/60', label: '상승' },
            { min: 35, max: 65, color: 'bg-slate-500', label: '보합' },
            { min: 65, max: 85, color: 'bg-emerald-400/60', label: '하락' },
            { min: 85, max: 100, color: 'bg-emerald-500', label: '급락' },
        ],
        normalize: (v) => Math.max(0, Math.min(100, 50 - v * 3.33)),  // +15bp→0, 0→50, -15bp→100
        unit: 'bp',
        ticks: [{ pos: 15, label: '+10bp' }, { pos: 35, label: '+3bp' }, { pos: 65, label: '-3bp' }, { pos: 85, label: '-10bp' }],
    },
    vix_level: {
        zones: [
            { min: 0, max: 15, color: 'bg-red-500', label: '패닉' },
            { min: 15, max: 30, color: 'bg-red-400/60', label: '불안' },
            { min: 30, max: 60, color: 'bg-slate-500', label: '정상' },
            { min: 60, max: 80, color: 'bg-emerald-400/60', label: '안정' },
            { min: 80, max: 100, color: 'bg-emerald-500', label: '낙관' },
        ],
        normalize: (v) => Math.max(0, Math.min(100, (35 - v) * 2.86)),  // VIX 35→0, 20→43, 10→71, 0→100
        unit: '',
        ticks: [{ pos: 15, label: '30' }, { pos: 30, label: '25' }, { pos: 60, label: '15' }, { pos: 80, label: '12' }],
    },
    foreign: {
        zones: [
            { min: 0, max: 10, color: 'bg-red-500', label: '대량매도' },
            { min: 10, max: 35, color: 'bg-red-400/60', label: '매도' },
            { min: 35, max: 65, color: 'bg-slate-500', label: '중립' },
            { min: 65, max: 90, color: 'bg-emerald-400/60', label: '매수' },
            { min: 90, max: 100, color: 'bg-emerald-500', label: '대량매수' },
        ],
        normalize: (v) => Math.max(0, Math.min(100, 50 + v / 100)),  // -5000→0, 0→50, +5000→100
        unit: '억',
        ticks: [{ pos: 10, label: '-5천' }, { pos: 35, label: '-500' }, { pos: 65, label: '+500' }, { pos: 90, label: '+5천' }],
    },
    futures: {
        zones: [
            { min: 0, max: 10, color: 'bg-red-500', label: '대량매도' },
            { min: 10, max: 35, color: 'bg-red-400/60', label: '매도' },
            { min: 35, max: 65, color: 'bg-slate-500', label: '중립' },
            { min: 65, max: 90, color: 'bg-emerald-400/60', label: '매수' },
            { min: 90, max: 100, color: 'bg-emerald-500', label: '대량매수' },
        ],
        normalize: (v) => Math.max(0, Math.min(100, 50 + v / 250)),  // -12500→0, 0→50, +12500→100
        unit: '계약',
        ticks: [{ pos: 10, label: '-1만' }, { pos: 35, label: '-2천' }, { pos: 65, label: '+2천' }, { pos: 90, label: '+1만' }],
    },
    short_change: {
        zones: [
            { min: 0, max: 10, color: 'bg-red-500', label: '급증' },
            { min: 10, max: 35, color: 'bg-red-400/60', label: '증가' },
            { min: 35, max: 65, color: 'bg-slate-500', label: '보합' },
            { min: 65, max: 90, color: 'bg-emerald-400/60', label: '감소' },
            { min: 90, max: 100, color: 'bg-emerald-500', label: '급감' },
        ],
        normalize: (v) => Math.max(0, Math.min(100, 50 - v * 1.25)),  // +40→0, 0→50, -40→100
        unit: '%',
        ticks: [{ pos: 10, label: '+30%' }, { pos: 35, label: '+10%' }, { pos: 65, label: '-10%' }, { pos: 90, label: '-30%' }],
    },
};
