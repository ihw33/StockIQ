'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit2, Trash2, Save, X, TrendingUp, TrendingDown } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

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

export default function NoteDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [note, setNote] = useState<TradeNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<TradeNote>>({})

  useEffect(() => {
    const loadNote = async () => {
      try {
        const res = await fetch(`${API}/api/notes/${params.id}`)
        if (!res.ok) throw new Error('Not found')
        const data = await res.json()
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
      setNote(data)
      setEditing(false)
    } catch {
      alert('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('이 노트를 삭제할까요?')) return
    await fetch(`${API}/api/notes/${params.id}`, { method: 'DELETE' })
    router.push('/notes')
  }

  const update = (k: string, v: unknown) => setForm(prev => ({ ...prev, [k]: v }))

  if (loading) return <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">불러오는 중...</div>
  if (!note) return null

  const n = editing ? form : note

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
                <button onClick={() => setEditing(false)} className="p-1.5 text-slate-400 hover:text-slate-200">
                  <X size={16} />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded"
                >
                  <Save size={14} />
                  {saving ? '저장 중...' : '저장'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors">
                  <Edit2 size={16} />
                </button>
                <button onClick={handleDelete} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors">
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* 기본 정보 */}
          <Section title="기본 정보">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="종목" value={`${n.stock_name} ${n.symbol ? `(${n.symbol})` : ''}`} editing={editing} onEdit={v => { update('stock_name', v) }} />
              <InfoRow label="날짜" value={n.trade_date || ''} editing={editing} onEdit={v => update('trade_date', v)} type="date" />
              <InfoRow label="유형" value={TYPE_LABELS[n.trade_type || ''] || n.trade_type || ''} editing={editing} onEdit={v => update('trade_type', v)} type="select" options={[{ v: 'buy', l: '매수' }, { v: 'sell', l: '매도' }, { v: 'watch', l: '관심' }]} />
              <InfoRow label="상태" value={STATUS_LABELS[n.status || ''] || n.status || ''} editing={editing} onEdit={v => update('status', v)} type="select" options={[{ v: 'hold', l: '보유중' }, { v: 'closed', l: '완료' }, { v: 'watch', l: '관심' }]} />
              {(n.price || editing) && <InfoRow label="매수가" value={n.price ? `₩${Number(n.price).toLocaleString()}` : ''} editing={editing} onEdit={v => update('price', parseFloat(v) || null)} type="number" rawValue={String(n.price || '')} />}
              {(n.quantity || editing) && <InfoRow label="수량" value={n.quantity ? `${n.quantity}주` : ''} editing={editing} onEdit={v => update('quantity', parseInt(v) || null)} type="number" rawValue={String(n.quantity || '')} />}
              {(n.portfolio_pct || editing) && <InfoRow label="비중" value={n.portfolio_pct ? `${n.portfolio_pct}%` : ''} editing={editing} onEdit={v => update('portfolio_pct', parseFloat(v) || null)} type="number" rawValue={String(n.portfolio_pct || '')} />}
              {(n.profit_pct !== null || editing) && (
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">수익률</p>
                  {editing ? (
                    <input type="number" step="0.01" defaultValue={n.profit_pct ?? ''} onChange={e => update('profit_pct', parseFloat(e.target.value) || null)} className="input-sm" />
                  ) : (
                    <p className={`font-bold flex items-center gap-1 ${(n.profit_pct || 0) > 0 ? 'text-red-400' : (n.profit_pct || 0) < 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                      {(n.profit_pct || 0) > 0 ? <TrendingUp size={14} /> : (n.profit_pct || 0) < 0 ? <TrendingDown size={14} /> : null}
                      {n.profit_pct !== null ? `${(n.profit_pct || 0) > 0 ? '+' : ''}${n.profit_pct}%` : '-'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* 목표/손절 */}
          {(n.target_price || n.stop_loss || editing) && (
            <Section title="시나리오">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {(n.target_price || editing) && <InfoRow label="목표가" value={n.target_price ? `₩${Number(n.target_price).toLocaleString()}` : ''} editing={editing} onEdit={v => update('target_price', parseFloat(v) || null)} type="number" rawValue={String(n.target_price || '')} />}
                {(n.stop_loss || editing) && <InfoRow label="손절가" value={n.stop_loss ? `₩${Number(n.stop_loss).toLocaleString()}` : ''} editing={editing} onEdit={v => update('stop_loss', parseFloat(v) || null)} type="number" rawValue={String(n.stop_loss || '')} />}
              </div>
              {(n.add_buy_plan || editing) && <TextBlock label="추가 매수 계획" value={n.add_buy_plan || ''} editing={editing} onEdit={v => update('add_buy_plan', v)} />}
            </Section>
          )}

          {/* 매수 이유 */}
          {(n.buy_reason || editing) && (
            <Section title="매수 이유">
              <TextBlock label="" value={n.buy_reason || ''} editing={editing} onEdit={v => update('buy_reason', v)} rows={5} />
            </Section>
          )}

          {/* 시장 상황 */}
          {(n.market_context || editing) && (
            <Section title="시장 상황">
              <TextBlock label="" value={n.market_context || ''} editing={editing} onEdit={v => update('market_context', v)} rows={4} />
            </Section>
          )}

          {/* 복기 */}
          {(n.review || n.psychology || n.result_summary || editing) && (
            <Section title="복기">
              {(n.review || editing) && <TextBlock label="잘한 점 / 아쉬운 점" value={n.review || ''} editing={editing} onEdit={v => update('review', v)} rows={4} />}
              {(n.psychology || editing) && <TextBlock label="심리 상태" value={n.psychology || ''} editing={editing} onEdit={v => update('psychology', v)} rows={3} />}
              {(n.result_summary || editing) && <TextBlock label="한 줄 요약" value={n.result_summary || ''} editing={editing} onEdit={v => update('result_summary', v)} rows={1} />}
            </Section>
          )}

          {/* 메타 */}
          <p className="text-xs text-slate-600 text-right">작성: {note.created_at?.split('T')[0]}</p>
        </div>
      </div>

      <style jsx>{`
        .input-sm {
          width: 100%;
          padding: 0.25rem 0.5rem;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 0.25rem;
          color: #f1f5f9;
          font-size: 0.8rem;
          outline: none;
        }
        .input-sm:focus { border-color: #d97706; }
      `}</style>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      {editing ? (
        type === 'select' && options ? (
          <select defaultValue={rawValue || value} onChange={e => onEdit(e.target.value)} className="input-sm">
            {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ) : (
          <input type={type} defaultValue={rawValue || value} onChange={e => onEdit(e.target.value)} className="input-sm" />
        )
      ) : (
        <p className="text-slate-200">{value || '-'}</p>
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
        <textarea
          defaultValue={value}
          onChange={e => onEdit(e.target.value)}
          rows={rows}
          className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 outline-none focus:border-amber-600 resize-none"
        />
      ) : (
        <p className="text-sm text-slate-300 whitespace-pre-wrap">{value || '-'}</p>
      )}
    </div>
  )
}
