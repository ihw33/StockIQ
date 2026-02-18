'use client'

import Link from 'next/link'
import { ArrowLeft, TrendingUp, Target, BarChart3, Activity, Clock, AlertTriangle, BookOpen } from 'lucide-react'

// ─── 전략 데이터 ───────────────────────────────────────────────────────────────

const STRATEGIES = [
  {
    id: 'momentum',
    label: '고성장 주도주',
    emoji: '🚀',
    tag: 'High Growth Momentum',
    tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    borderColor: 'border-rose-500/30',
    bgColor: 'bg-rose-500/5',
    desc: 'AI·반도체·바이오 등 테마 주도주. 강한 상승 모멘텀을 타지만 리스크도 가장 높다.',
    params: {
      목표수익률: '+30~50%',
      '1차 익절': '+15% / 30% 매도',
      '2차 익절': '+30% / 잔여 전량',
      손절: '-8% (철칙)',
      '추가매수 1차': '-3% (조건부)',
      '추가매수 2차': '❌ 손절이 원칙',
      보유기간: '수일~수주',
      리스크리워드: '1:4 이상',
      포지션비중: '5~10%',
    },
    principles: [
      '손절 -8%는 규칙이 아닌 생존 원칙 — 어떤 경우에도 예외 없음',
      '물타기(추가매수) 절대 금지 — 하락 시 손절, 상승 확인 후 추가매수',
      '돌파 직후 매수, 조정이 -3% 이내면 허용, 그 이상은 즉시 손절',
      '포트폴리오 집중 — 최대 3~5종목, 종목당 비중 엄격 제한',
      '거래량 수반 확인 필수 — 거래량 없는 돌파는 가짜 신호',
    ],
    warning: '고변동성 종목. 짧게 수익 실현하는 습관이 가장 중요. 존버는 금물.',
    ref: 'William O\'Neil CANSLIM 전략 기반',
  },
  {
    id: 'growth',
    label: '성장주',
    emoji: '📈',
    tag: 'Growth Stock',
    tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    borderColor: 'border-emerald-500/30',
    bgColor: 'bg-emerald-500/5',
    desc: '매출·영업이익이 연 20% 이상 성장하는 기업. 실적 성장이 주가의 핵심 동력.',
    params: {
      목표수익률: '+20~30%',
      '1차 익절': '+15% / 30% 매도',
      '2차 익절': '+25% / 50% 매도',
      손절: '-12%',
      '추가매수 1차': '-7% (상승 추세 중)',
      '추가매수 2차': '-12%',
      보유기간: '1~6개월',
      리스크리워드: '1:2.5',
      포지션비중: '10~20%',
    },
    principles: [
      'PEG Ratio 1.0 이하 = 성장 대비 저평가 기준',
      '실적 발표 직전 포지션 크기 줄이기 — 어닝 서프라이즈 대비',
      '20일선 이탈해도 실적이 양호하면 홀딩 가능 — 판단 필요',
      '분할 매도: 1차에서 30% 정리, 나머지는 추세 따라 트레일링',
      '성장 스토리가 훼손되면 즉시 매도 (실적 급감, 핵심 경영진 이탈)',
    ],
    warning: '실적 성장이 꺾이는 순간이 매도 시점. 숫자로만 판단하세요.',
    ref: 'Peter Lynch 10배 성장주 전략 / CAN SLIM 응용',
  },
  {
    id: 'value',
    label: '가치주',
    emoji: '💎',
    tag: 'Value Stock',
    tagColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    borderColor: 'border-blue-500/30',
    bgColor: 'bg-blue-500/5',
    desc: 'PBR·PER 저평가 기업, 배당주. 내재가치 대비 시장가격이 낮은 종목.',
    params: {
      목표수익률: '+15~20% (or 적정가치 도달)',
      '1차 익절': '+10% / 50% 매도 (or PBR 1.0 도달)',
      '2차 익절': '+20% / 나머지 (or 업종 평균 PER 도달)',
      손절: '-18% (넓은 손절폭)',
      '추가매수 1차': '-10% (분할매수 전략)',
      '추가매수 2차': '-18%',
      보유기간: '6개월~2년',
      리스크리워드: '1:1.5',
      포지션비중: '15~25%',
    },
    principles: [
      '목표가 = 적정 PBR(1.0~1.5) 또는 업종 평균 PER 회귀 시점',
      '배당수익률 3% 이상이면 손절 기준을 더 느슨하게 적용 가능',
      '적극적 추가매수 허용 — 저평가가 더 심해지면 오히려 기회',
      '시간이 무기 — 내재가치 해소에는 6개월~2년 걸릴 수 있음',
      '펀더멘탈 훼손(실적 급락, 부채 급증) 시에만 손절',
    ],
    warning: '저평가는 오래 지속될 수 있음. 기회비용과 심리적 인내 필요.',
    ref: 'Benjamin Graham 안전마진 이론 / 워런 버핏 내재가치 투자',
  },
  {
    id: 'trend',
    label: '추세추종',
    emoji: '〰️',
    tag: 'Trend Following',
    tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-amber-500/5',
    desc: '이동평균선(5/20/60일) 기반 기계적 매매. 추세가 살아있는 동안 보유.',
    params: {
      목표수익률: '+15~20% (추세 유지기간)',
      '1차 익절': '5일선 이탈 시 50% 매도',
      '2차 익절': '20일선 하향 이탈 시 전량',
      손절: '20일선 종가 기준 이탈 또는 -8%',
      '추가매수 1차': '20일선 지지 확인 후',
      '추가매수 2차': '❌ 추세 이탈 시 손절',
      보유기간: '추세 유지기간 (다양)',
      리스크리워드: '추세 기반',
      포지션비중: '10~15%',
    },
    principles: [
      '이동평균 배열: 5일 > 20일 > 60일 = 정배열 = 매수 유지',
      '5일선 이탈 = 1차 경고, 20일선 이탈 = 추세 전환 신호',
      '감정 배제 — 이동평균 돌파/이탈은 기계적으로 판단',
      '거래량이 수반된 이동평균 지지 = 신뢰도 높은 추가매수 시점',
      '데드크로스(단기선이 장기선 하향 돌파) 발생 시 즉시 청산',
    ],
    warning: '횡보장에서는 효과 없음. 명확한 추세가 형성된 종목에만 적용.',
    ref: '이동평균 추세추종 / 듀얼 모멘텀 전략',
  },
  {
    id: 'swing',
    label: '스윙',
    emoji: '⚡',
    tag: 'Swing Trading',
    tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    borderColor: 'border-purple-500/30',
    bgColor: 'bg-purple-500/5',
    desc: '2주~1개월 단기 스윙. 지지/저항 구간 사이 단기 수익 실현.',
    params: {
      목표수익률: '+8~12%',
      '1차 익절': '+6% / 50% 매도 (저항선)',
      '2차 익절': '+10% / 나머지 전량',
      손절: '-4% (빠른 손절 필수)',
      '추가매수 1차': '-3% (지지선에서만)',
      '추가매수 2차': '❌',
      보유기간: '1~4주',
      리스크리워드: '1:2 이상 (진입 전 확인)',
      포지션비중: '5~10%',
    },
    principles: [
      '진입 전 리스크/리워드 최소 1:2 확인 — 안 되면 진입 안 함',
      '손절 -4%는 스윙의 생명선 — 느린 손절은 단기매매의 독',
      '주요 저항선 돌파 여부로 1차/2차 익절 결정',
      '거래량 분석 필수 — 거래량 없는 저항선 돌파는 신뢰도 낮음',
      '1~4주 내 목표 미달 시 미련 없이 청산 (기회비용)',
    ],
    warning: '잦은 매매로 수수료·세금 누적 주의. 수익률 계산 시 이를 포함.',
    ref: '기술적 분석 기반 단기 스윙 / 지지저항 매매법',
  },
]

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/" className="text-slate-400 hover:text-slate-200">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <BookOpen size={20} className="text-amber-400" />
              <h1 className="text-xl font-bold">투자 전략 지식 베이스</h1>
            </div>
          </div>
          <p className="text-slate-500 text-sm ml-9">
            매매 노트 작성 시 참고하는 전략별 익절·손절·추가매수 기준 가이드
          </p>
        </div>

        {/* 전략 빠른 이동 */}
        <div className="flex flex-wrap gap-2 mb-8 p-4 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-500 self-center mr-1">빠른 이동 →</span>
          {STRATEGIES.map(s => (
            <a key={s.id} href={`#${s.id}`}
              className={`text-xs px-2.5 py-1 rounded border font-medium transition-colors ${s.tagColor}`}>
              {s.emoji} {s.label}
            </a>
          ))}
        </div>

        {/* 전략별 섹션 */}
        <div className="space-y-10">
          {STRATEGIES.map(s => (
            <section key={s.id} id={s.id}
              className={`border rounded-xl p-6 ${s.borderColor} ${s.bgColor}`}>

              {/* 섹션 헤더 */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{s.emoji}</span>
                    <h2 className="text-lg font-bold">{s.label}</h2>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${s.tagColor}`}>
                      {s.tag}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">{s.desc}</p>
                </div>
              </div>

              {/* 파라미터 표 */}
              <div className="mb-5">
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <BarChart3 size={12} />
                  기본 파라미터
                </div>
                <div className="grid grid-cols-1 gap-px bg-slate-800 rounded-lg overflow-hidden">
                  {Object.entries(s.params).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between px-3 py-2 bg-slate-900/80">
                      <span className="text-xs text-slate-500">{key}</span>
                      <span className={`text-xs font-mono font-medium ${
                        val.startsWith('-') ? 'text-red-400'
                        : val.startsWith('+') ? 'text-emerald-400'
                        : val === '❌' ? 'text-slate-600'
                        : 'text-slate-300'
                      }`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 핵심 원칙 */}
              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <Target size={12} />
                  핵심 원칙
                </div>
                <ul className="space-y-1.5">
                  {s.principles.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-300">
                      <span className="text-slate-600 shrink-0 mt-0.5">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 주의사항 */}
              <div className="flex gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-amber-300">{s.warning}</p>
                  <p className="text-[11px] text-slate-600 mt-1">참고: {s.ref}</p>
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* 리스크/리워드 비율 가이드 */}
        <section className="mt-10 border border-slate-700 rounded-xl p-6 bg-slate-900/50">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-blue-400" />
            <h2 className="font-bold">리스크/리워드 비율 이해</h2>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            리스크/리워드 = <span className="text-white font-mono">기대 수익 ÷ 감수 손실</span>
          </p>
          <div className="space-y-2">
            {[
              { ratio: '1:1', judge: '❌ 진입 금지', desc: '손익이 같음 — 거래 비용 고려하면 마이너스' },
              { ratio: '1:1.5', judge: '⚠️ 가치주에서만', desc: '안정적 기업 + 배당 + 긴 보유 기간일 때만 허용' },
              { ratio: '1:2', judge: '✅ 기본 기준', desc: '스윙·추세에서 최소 기준. 이 이상일 때만 진입' },
              { ratio: '1:3+', judge: '🎯 최적', desc: '성장주·주도주 목표. 손절폭 줄이고 목표가 높게' },
            ].map(r => (
              <div key={r.ratio} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2">
                <span className="font-mono text-sm text-white w-12 shrink-0">{r.ratio}</span>
                <span className="text-xs w-28 shrink-0">{r.judge}</span>
                <span className="text-xs text-slate-400">{r.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 범용 원칙 */}
        <section className="mt-6 border border-slate-700 rounded-xl p-6 bg-slate-900/50">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-emerald-400" />
            <h2 className="font-bold">모든 전략에 공통되는 원칙</h2>
          </div>
          <ul className="space-y-2">
            {[
              '계획 없이 매수하지 말 것 — 진입 전 익절·손절가 반드시 설정',
              '손절은 계획의 일부 — 손절은 실패가 아닌 리스크 관리',
              '포지션 크기 조절 — 종목당 포트폴리오 비중 사전 결정',
              '분할 매수 + 분할 매도 — 한 번에 올인·전량 매도는 감정적 판단',
              '매매 일지 작성 — 기록 없이는 성장 없음',
            ].map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-300">
                <span className="text-emerald-500 shrink-0">{i + 1}.</span>
                {p}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-8 text-center">
          <Link href="/notes/new"
            className="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors">
            ← 매매 노트 작성으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  )
}
