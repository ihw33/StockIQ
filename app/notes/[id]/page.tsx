'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit2, Trash2, Save, X, TrendingUp, TrendingDown, MessageSquarePlus, Send } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001'

interface ExitPlanData {
  preset?: string
  base_price?: number
  target_price?: number; target_pct?: number
  p1_price?: number; p1_pct?: number; p1_sell?: number
  p2_price?: number; p2_pct?: number; p2_sell?: number
  sl_price?: number; sl_pct?: number; sl_note?: string
  a1_price?: number; a1_pct?: number; a1_weight?: number
  a2_price?: number; a2_pct?: number; a2_weight?: number
  alerts?: { price: number; direction: string; label: string; pct?: number }[]
}

interface MemoEntry {
  text: string
  created_at: string
}

interface WatchData {
  exit_plan?: ExitPlanData
  memos?: MemoEntry[]
  [key: string]: unknown
}

interface TradeNote {
  id: number
  symbol: string
  stock_name: string
  trade_date: string
  trade_type: string
  price: number | null
  quantity: number | null
  portfolio_pct: number | null
  buy_reason: string | null
  target_price: number | null
  stop_loss: number | null
  add_buy_plan: string | null
  market_context: string | null
  review: string | null
  psychology: string | null
  result_summary: string | null
  status: string
  profit_pct: number | null
  watch_data: WatchData | null
  created_at: string
  updated_at: string
}

const TYPE_LABELS: Record<string, string> = { buy: '매수', sell: '매도', watch: '관심' }
const STATUS_LABELS: Record<string, string> = { hold: '보유중', closed: '완료', watch: '관심' }
const STATUS_COLORS: Record<string, string> = {
  hold: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  closed: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  watch: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
}
const PRESET_LABELS: Record<string, string> = {
  momentum: '🚀 고성장 주도주', growth: '📈 성장주',
  value: '💎 가치주', trend: '〰️ 추세추종', swing: '⚡ 스윙',
}

const fmt = (n?: number | null) => n ? `₩${Number(n).toLocaleString()}` : '-'
const fmtPct = (n?: number | null, sign = true) =>
  n != null ? `${sign && n > 0 ? '+' : ''}${n}%` : '-'

export default function NoteDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [note, setNote] = useState<TradeNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<TradeNote>>({})
  const [memoText, setMemoText] = useState('')
  const [memoSaving, setMemoSaving] = useState(false)
  const memoRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const loadNote = async () => {
      try {
        const res = await fetch(`${API}/api/notes/${params.id}`)
        if (!res.ok) throw new Error('Not found')
        const data = await res.json()
        // watch_data가 string으로 올 경우 파싱
        if (typeof data.watch_data === 'string') {
          try { data.watch_data = JSON.parse(data.watch_data) } catch { data.watch_data = null }
        }
        setNote(data)
        setForm(data)
      } catch {
        router.push('/notes')
      } finally {
        setLoading(false)
      }
    }
    loadNote()
  }, [params.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/notes/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (typeof data.watch_data === 'string') {
        try { data.watch_data = JSON.parse(data.watch_data) } catch { data.watch_data = null }
      }
      setNote(data)
      setEditing(false)
    } catch {
      alert('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleAddMemo = async () => {
    if (!memoText.trim() || !note) return
    setMemoSaving(true)
    try {
      const newMemo: MemoEntry = { text: memoText.trim(), created_at: new Date().toISOString() }
      const prevMemos = note.watch_data?.memos || []
      const updatedWatchData: WatchData = { ...(note.watch_data || {}), memos: [...prevMemos, newMemo] }
      const res = await fetch(`${API}/api/notes/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watch_data: updatedWatchData }),
      })
      const data = await res.json()
      if (typeof data.watch_data === 'string') {
        try { data.watch_data = JSON.parse(data.watch_data) } catch { data.watch_data = null }
      }
      setNote(data)
      setMemoText('')
    } catch {
      alert('메모 저장 실패')
    } finally {
      setMemoSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('이 노트를 삭제할까요?')) return
    await fetch(`${API}/api/notes/${params.id}`, { method: 'DELETE' })
    router.push('/notes')
  }

  const update = (k: string, v: unknown) => setForm(prev => ({ ...prev, [k]: v }))
  const updateEP = (k: string, v: unknown) => setForm(prev => ({
    ...prev,
    watch_data: {
      ...(prev.watch_data || {}),
      exit_plan: { ...((prev.watch_data as WatchData)?.exit_plan || {}), [k]: v }
    }
  }))

  if (loading) return <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">불러오는 중...</div>
  if (!note) return null

  const n = editing ? form : note
  const ep = n.watch_data?.exit_plan
  const memos = note.watch_data?.memos || []

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/notes" className="text-slate-400 hover:text-slate-200">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">{note.stock_name || note.symbol}</h1>
            <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[note.status] || ''}`}>
              {STATUS_LABELS[note.status] || note.status}
            </span>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="p-1.5 text-slate-400 hover:text-slate-200"><X size={16} /></button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded">
                  <Save size={14} />{saving ? '저장 중...' : '저장'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors"><Edit2 size={16} /></button>
                <button onClick={handleDelete} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* 기본 정보 */}
          <Card title="기본 정보">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="종목" value={`${n.stock_name} ${n.symbol ? `(${n.symbol})` : ''}`} editing={editing} onEdit={v => update('stock_name', v)} />
              <InfoRow label="날짜" value={n.trade_date || ''} editing={editing} onEdit={v => update('trade_date', v)} type="date" />
              <InfoRow label="유형" value={TYPE_LABELS[n.trade_type || ''] || n.trade_type || ''} editing={editing} onEdit={v => update('trade_type', v)} type="select" options={[{ v: 'buy', l: '매수' }, { v: 'sell', l: '매도' }, { v: 'watch', l: '관심' }]} rawValue={n.trade_type || ''} />
              <InfoRow label="상태" value={STATUS_LABELS[n.status || ''] || n.status || ''} editing={editing} onEdit={v => update('status', v)} type="select" options={[{ v: 'hold', l: '보유중' }, { v: 'closed', l: '완료' }, { v: 'watch', l: '관심' }]} rawValue={n.status || ''} />
              {(n.price || editing) && <InfoRow label="평균 매수가" value={fmt(n.price as number)} editing={editing} onEdit={v => update('price', parseFloat(v) || null)} type="number" rawValue={String(n.price || '')} />}
              {(n.quantity || editing) && <InfoRow label="수량" value={n.quantity ? `${n.quantity}주` : ''} editing={editing} onEdit={v => update('quantity', parseInt(v) || null)} type="number" rawValue={String(n.quantity || '')} />}
              {(n.portfolio_pct || editing) && <InfoRow label="비중" value={n.portfolio_pct ? `${n.portfolio_pct}%` : ''} editing={editing} onEdit={v => update('portfolio_pct', parseFloat(v) || null)} type="number" rawValue={String(n.portfolio_pct || '')} />}
              {n.profit_pct != null && (
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">수익률</p>
                  <p className={`font-bold flex items-center gap-1 ${(n.profit_pct || 0) > 0 ? 'text-red-400' : (n.profit_pct || 0) < 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                    {(n.profit_pct || 0) > 0 ? <TrendingUp size={14} /> : (n.profit_pct || 0) < 0 ? <TrendingDown size={14} /> : null}
                    {fmtPct(n.profit_pct)}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* 매도 계획 (exit_plan이 있으면 상세, 없으면 기존 심플) */}
          {ep ? (
            <Card title={`매도 계획${ep.preset ? ` — ${PRESET_LABELS[ep.preset] || ep.preset}` : ''}`}>
              {/* 기준가 / 목표가 */}
              {(ep.base_price || ep.target_price) && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {(ep.base_price || editing) && (
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">기준 주가</p>
                      {editing ? <input type="number" defaultValue={ep.base_price || ''} onChange={e => updateEP('base_price', parseFloat(e.target.value) || null)}
                        className="w-full px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 outline-none focus:border-amber-500 font-mono" />
                      : <p className="text-sm text-slate-300 font-mono">{fmt(ep.base_price)}</p>}
                    </div>
                  )}
                  {(ep.target_price || editing) && (
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">목표 주가</p>
                      {editing ? <input type="number" defaultValue={ep.target_price || ''} onChange={e => updateEP('target_price', parseFloat(e.target.value) || null)}
                        className="w-full px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-sm text-emerald-400 outline-none focus:border-amber-500 font-mono font-bold" />
                      : <p className="text-sm font-bold text-emerald-400 font-mono">
                          {fmt(ep.target_price)}
                          {ep.target_pct != null && <span className="text-xs ml-1 text-emerald-500">+{ep.target_pct}%</span>}
                        </p>}
                    </div>
                  )}
                </div>
              )}

              {/* 익절 계획 */}
              {(ep.p1_price || ep.p2_price) && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-2">📈 익절 계획</p>
                  <div className="space-y-1.5">
                    {ep.p1_price && (
                      <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">1차 익절</span>
                          {ep.p1_sell && <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">매도 {ep.p1_sell}%</span>}
                        </div>
                        <div className="text-right">
                          {editing ? <input type="number" defaultValue={ep.p1_price || ''} onChange={e => updateEP('p1_price', parseFloat(e.target.value) || null)}
                            className="w-24 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sm text-emerald-400 outline-none focus:border-amber-500 font-mono text-right" />
                          : <><span className="text-sm font-mono font-medium text-emerald-400">{fmt(ep.p1_price)}</span>
                            {ep.p1_pct != null && <span className="text-xs text-emerald-600 ml-1.5">+{ep.p1_pct}%</span>}</>}
                        </div>
                      </div>
                    )}
                    {ep.p2_price && (
                      <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">2차 익절</span>
                          {ep.p2_sell && <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">매도 {ep.p2_sell}%</span>}
                        </div>
                        <div className="text-right">
                          {editing ? <input type="number" defaultValue={ep.p2_price || ''} onChange={e => updateEP('p2_price', parseFloat(e.target.value) || null)}
                            className="w-24 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sm text-emerald-400 outline-none focus:border-amber-500 font-mono text-right" />
                          : <><span className="text-sm font-mono font-medium text-emerald-400">{fmt(ep.p2_price)}</span>
                            {ep.p2_pct != null && <span className="text-xs text-emerald-600 ml-1.5">+{ep.p2_pct}%</span>}</>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 손절 계획 */}
              {ep.sl_price && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">🛑 손절 계획</p>
                  <div className="flex items-center justify-between bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-400">손절가</span>
                    <div className="text-right">
                      {editing ? <input type="number" defaultValue={ep.sl_price || ''} onChange={e => updateEP('sl_price', parseFloat(e.target.value) || null)}
                        className="w-24 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sm text-red-400 outline-none focus:border-amber-500 font-mono text-right" />
                      : <><span className="text-sm font-mono font-medium text-red-400">{fmt(ep.sl_price)}</span>
                        {ep.sl_pct != null && <span className="text-xs text-red-600 ml-1.5">{ep.sl_pct}%</span>}</>}
                    </div>
                  </div>
                  {ep.sl_note && <p className="text-xs text-slate-500 mt-1.5 pl-1">{ep.sl_note}</p>}
                </div>
              )}

              {/* 추가 매수 계획 */}
              {(ep.a1_price || ep.a2_price) && (
                <div>
                  <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-2">🔄 추가 매수 계획</p>
                  <div className="space-y-1.5">
                    {ep.a1_price && (
                      <div className="flex items-center justify-between bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">1차 추가매수</span>
                          {ep.a1_weight && <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">비중 {ep.a1_weight}%</span>}
                        </div>
                        <div className="text-right">
                          {editing ? <input type="number" defaultValue={ep.a1_price || ''} onChange={e => updateEP('a1_price', parseFloat(e.target.value) || null)}
                            className="w-24 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sm text-amber-400 outline-none focus:border-amber-500 font-mono text-right" />
                          : <><span className="text-sm font-mono font-medium text-amber-400">{fmt(ep.a1_price)}</span>
                            {ep.a1_pct != null && <span className="text-xs text-amber-600 ml-1.5">{ep.a1_pct}%</span>}</>}
                        </div>
                      </div>
                    )}
                    {ep.a2_price && (
                      <div className="flex items-center justify-between bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">2차 추가매수</span>
                          {ep.a2_weight && <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">비중 {ep.a2_weight}%</span>}
                        </div>
                        <div className="text-right">
                          {editing ? <input type="number" defaultValue={ep.a2_price || ''} onChange={e => updateEP('a2_price', parseFloat(e.target.value) || null)}
                            className="w-24 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sm text-amber-400 outline-none focus:border-amber-500 font-mono text-right" />
                          : <><span className="text-sm font-mono font-medium text-amber-400">{fmt(ep.a2_price)}</span>
                            {ep.a2_pct != null && <span className="text-xs text-amber-600 ml-1.5">{ep.a2_pct}%</span>}</>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ) : (n.target_price || n.stop_loss) ? (
            <Card title="시나리오">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {n.target_price && <InfoRow label="목표가" value={fmt(n.target_price as number)} editing={editing} onEdit={v => update('target_price', parseFloat(v) || null)} type="number" rawValue={String(n.target_price || '')} />}
                {n.stop_loss && <InfoRow label="손절가" value={fmt(n.stop_loss as number)} editing={editing} onEdit={v => update('stop_loss', parseFloat(v) || null)} type="number" rawValue={String(n.stop_loss || '')} />}
              </div>
            </Card>
          ) : null}

          {/* 매수 이유 */}
          {(n.buy_reason || editing) && (
            <Card title="매수 이유">
              <TextBlock label="" value={n.buy_reason || ''} editing={editing} onEdit={v => update('buy_reason', v)} rows={5} />
            </Card>
          )}

          {/* 시장 상황 */}
          {(n.market_context || editing) && (
            <Card title="시장 상황">
              <TextBlock label="" value={n.market_context || ''} editing={editing} onEdit={v => update('market_context', v)} rows={4} />
            </Card>
          )}

          {/* 복기 */}
          {(n.review || n.psychology || n.result_summary || editing) && (
            <Card title="복기">
              {(n.review || editing) && <TextBlock label="잘한 점 / 아쉬운 점" value={n.review || ''} editing={editing} onEdit={v => update('review', v)} rows={4} />}
              {(n.psychology || editing) && <TextBlock label="심리 상태" value={n.psychology || ''} editing={editing} onEdit={v => update('psychology', v)} rows={3} />}
              {(n.result_summary || editing) && <TextBlock label="한 줄 요약" value={n.result_summary || ''} editing={editing} onEdit={v => update('result_summary', v)} rows={1} />}
            </Card>
          )}

          {/* ─── 메모 섹션 ─── */}
          <Card title="메모">
            {/* 기존 메모 목록 */}
            {memos.length > 0 && (
              <div className="space-y-2 mb-4">
                {[...memos].reverse().map((m, i) => (
                  <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5">
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{m.text}</p>
                    <p className="text-[11px] text-slate-600 mt-1.5">
                      {new Date(m.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* 새 메모 입력 */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <MessageSquarePlus size={12} />
                <span>새 메모 추가</span>
              </div>
              <textarea
                ref={memoRef}
                value={memoText}
                onChange={e => setMemoText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddMemo() }}
                rows={3}
                placeholder="종목 관련 메모를 남겨주세요. (Cmd+Enter 저장)"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100 outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600 resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleAddMemo}
                  disabled={!memoText.trim() || memoSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-medium rounded transition-colors"
                >
                  <Send size={12} />
                  {memoSaving ? '저장 중...' : '메모 추가'}
                </button>
              </div>
            </div>
          </Card>

          <p className="text-xs text-slate-600 text-right">작성: {note.created_at?.split('T')[0]}</p>
        </div>
      </div>
    </main>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      {title && <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h2>}
      {children}
    </div>
  )
}

function InfoRow({ label, value, editing, onEdit, type = 'text', options, rawValue }: {
  label: string; value: string; editing: boolean; onEdit: (v: string) => void;
  type?: string; options?: { v: string; l: string }[]; rawValue?: string;
}) {
  const inputCls = "w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 outline-none focus:border-amber-500"
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      {editing ? (
        type === 'select' && options ? (
          <select defaultValue={rawValue} onChange={e => onEdit(e.target.value)} className={inputCls}>
            {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ) : (
          <input type={type} defaultValue={rawValue || value} onChange={e => onEdit(e.target.value)} className={inputCls} />
        )
      ) : (
        <p className="text-slate-200 text-sm">{value || '-'}</p>
      )}
    </div>
  )
}

function TextBlock({ label, value, editing, onEdit, rows = 3 }: {
  label: string; value: string; editing: boolean; onEdit: (v: string) => void; rows?: number;
}) {
  return (
    <div className={label ? 'mt-3' : ''}>
      {label && <p className="text-xs text-slate-500 mb-1">{label}</p>}
      {editing ? (
        <textarea defaultValue={value} onChange={e => onEdit(e.target.value)} rows={rows}
          className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 outline-none focus:border-amber-600 resize-none" />
      ) : (
        <p className="text-sm text-slate-300 whitespace-pre-wrap">{value || '-'}</p>
      )}
    </div>
  )
}
