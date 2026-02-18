'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

type Tab = 'basic' | 'reason' | 'plan' | 'market' | 'review'

const TABS: { id: Tab; label: string; required?: boolean }[] = [
  { id: 'basic', label: '기본 정보', required: true },
  { id: 'reason', label: '매수 이유', required: true },
  { id: 'plan', label: '시나리오' },
  { id: 'market', label: '시장 상황' },
  { id: 'review', label: '복기' },
]

export default function NewNotePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>('basic')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    symbol: searchParams.get('symbol') || '',
    stock_name: searchParams.get('name') || '',
    trade_date: new Date().toISOString().split('T')[0],
    trade_type: 'buy',
    price: '',
    quantity: '',
    portfolio_pct: '',
    buy_reason: '',
    target_price: '',
    stop_loss: '',
    add_buy_plan: '',
    market_context: '',
    review: '',
    psychology: '',
    result_summary: '',
    status: 'hold',
  })

  const update = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    if (!form.stock_name && !form.symbol) {
      alert('종목명 또는 종목 코드를 입력해주세요.')
      return
    }
    if (!form.buy_reason) {
      alert('매수 이유를 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        ...form,
        price: form.price ? parseFloat(form.price) : null,
        quantity: form.quantity ? parseInt(form.quantity) : null,
        portfolio_pct: form.portfolio_pct ? parseFloat(form.portfolio_pct) : null,
        target_price: form.target_price ? parseFloat(form.target_price) : null,
        stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
      }

      const res = await fetch(`${API}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('저장 실패')
      const data = await res.json()
      router.push(`/notes/${data.id}`)
    } catch (e) {
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/notes" className="text-slate-400 hover:text-slate-200">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">새 매매 노트</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
          >
            <Save size={14} />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-800 mb-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
              {tab.required && <span className="ml-1 text-red-400 text-xs">*</span>}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === 'basic' && (
            <>
              <p className="text-xs text-slate-500">* 표시 항목은 필수입니다.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="종목명 *">
                  <input
                    type="text"
                    value={form.stock_name}
                    onChange={e => update('stock_name', e.target.value)}
                    placeholder="삼성전자"
                    className="input-base"
                  />
                </Field>
                <Field label="종목 코드">
                  <input
                    type="text"
                    value={form.symbol}
                    onChange={e => update('symbol', e.target.value)}
                    placeholder="005930"
                    className="input-base"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="매매 날짜">
                  <input
                    type="date"
                    value={form.trade_date}
                    onChange={e => update('trade_date', e.target.value)}
                    className="input-base"
                  />
                </Field>
                <Field label="유형">
                  <select value={form.trade_type} onChange={e => update('trade_type', e.target.value)} className="input-base">
                    <option value="buy">매수</option>
                    <option value="sell">매도</option>
                    <option value="watch">관심</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="매수/매도가 (원)">
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => update('price', e.target.value)}
                    placeholder="75000"
                    className="input-base"
                  />
                </Field>
                <Field label="수량">
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={e => update('quantity', e.target.value)}
                    placeholder="100"
                    className="input-base"
                  />
                </Field>
                <Field label="포트폴리오 비중 (%)">
                  <input
                    type="number"
                    value={form.portfolio_pct}
                    onChange={e => update('portfolio_pct', e.target.value)}
                    placeholder="10"
                    className="input-base"
                  />
                </Field>
              </div>
              <Field label="현재 상태">
                <div className="flex gap-2">
                  {[
                    { v: 'hold', label: '보유중' },
                    { v: 'closed', label: '완료' },
                    { v: 'watch', label: '관심' },
                  ].map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => update('status', opt.v)}
                      className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                        form.status === opt.v
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          {activeTab === 'reason' && (
            <>
              <Field label="매수 이유 *">
                <textarea
                  value={form.buy_reason}
                  onChange={e => update('buy_reason', e.target.value)}
                  rows={6}
                  placeholder="재무 상태, 차트 분석, 테마/모멘텀 등 매수 근거를 적어주세요."
                  className="input-base resize-none"
                />
              </Field>
            </>
          )}

          {activeTab === 'plan' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="목표가 (원)">
                  <input
                    type="number"
                    value={form.target_price}
                    onChange={e => update('target_price', e.target.value)}
                    placeholder="90000"
                    className="input-base"
                  />
                </Field>
                <Field label="손절가 (원)">
                  <input
                    type="number"
                    value={form.stop_loss}
                    onChange={e => update('stop_loss', e.target.value)}
                    placeholder="68000"
                    className="input-base"
                  />
                </Field>
              </div>
              <Field label="추가 매수 계획">
                <textarea
                  value={form.add_buy_plan}
                  onChange={e => update('add_buy_plan', e.target.value)}
                  rows={4}
                  placeholder="하락 시 비중을 늘릴 계획이 있다면 작성해주세요."
                  className="input-base resize-none"
                />
              </Field>
            </>
          )}

          {activeTab === 'market' && (
            <Field label="매수 당시 시장 상황">
              <textarea
                value={form.market_context}
                onChange={e => update('market_context', e.target.value)}
                rows={8}
                placeholder="지수 흐름, 금리/환율, 주도 섹터 등 거시적 상황을 기록해주세요."
                className="input-base resize-none"
              />
            </Field>
          )}

          {activeTab === 'review' && (
            <>
              <Field label="복기 (잘한 점 / 아쉬운 점)">
                <textarea
                  value={form.review}
                  onChange={e => update('review', e.target.value)}
                  rows={4}
                  placeholder="계획대로 실행했는가? 다시 돌아간다면 어떤 결정을 내릴 것인가?"
                  className="input-base resize-none"
                />
              </Field>
              <Field label="심리 상태">
                <textarea
                  value={form.psychology}
                  onChange={e => update('psychology', e.target.value)}
                  rows={3}
                  placeholder="뇌동매매 여부, 공포/탐욕 상태, 인내심 등을 기록해주세요."
                  className="input-base resize-none"
                />
              </Field>
              <Field label="한 줄 요약">
                <input
                  type="text"
                  value={form.result_summary}
                  onChange={e => update('result_summary', e.target.value)}
                  placeholder="수익/손실의 핵심 이유를 한 문장으로"
                  className="input-base"
                />
              </Field>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => {
              const idx = TABS.findIndex(t => t.id === activeTab)
              if (idx > 0) setActiveTab(TABS[idx - 1].id)
            }}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← 이전
          </button>
          {activeTab !== 'review' ? (
            <button
              onClick={() => {
                const idx = TABS.findIndex(t => t.id === activeTab)
                setActiveTab(TABS[idx + 1].id)
              }}
              className="px-4 py-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              다음 →
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded transition-colors"
            >
              {saving ? '저장 중...' : '저장하기'}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .input-base {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 0.375rem;
          color: #f1f5f9;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-base:focus {
          border-color: #d97706;
        }
        .input-base::placeholder {
          color: #475569;
        }
      `}</style>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
