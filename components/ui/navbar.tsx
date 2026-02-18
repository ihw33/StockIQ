'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Monitor, Filter, BarChart3, Activity,
  Globe, FileText, Zap, BookOpen, GraduationCap,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/terminal', icon: Monitor, label: '종목 분석' },
  { href: '/screener', icon: Filter, label: '종목 탐색' },
  { href: '/sectors/trends', icon: BarChart3, label: '섹터 동향' },
  { href: '/stocks/movers', icon: Activity, label: '종목 동향' },
  { href: '/macro', icon: Globe, label: '매크로' },
  { href: '/reports', icon: FileText, label: '보고서' },
  { href: '/alpha-hr', icon: Zap, label: 'Alpha-HR' },
  { href: '/notes', icon: BookOpen, label: '매매 노트' },
  { href: '/knowledge', icon: GraduationCap, label: '지식' },
]

export default function Navbar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="sticky top-0 z-50 bg-slate-950 border-b border-slate-800">
      <div className="flex items-center h-11 px-4 gap-1">
        {/* 로고 */}
        <Link
          href="/"
          className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 mr-4 shrink-0"
        >
          StockIQ
        </Link>

        {/* 메뉴 */}
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap
              ${isActive(href)
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
              }`}
          >
            <Icon size={13} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
