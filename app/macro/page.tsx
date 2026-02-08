'use client';

import { MacroDashboard } from '@/components/features/macro/macro-dashboard';
import { ArrowLeft, Globe } from 'lucide-react';

export default function MacroPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-blue-400" />
                    <h1 className="text-lg font-bold text-white">
                        매크로 대시보드
                    </h1>
                    <span className="text-xs text-slate-500 border-l border-slate-700 pl-3">
                        외국인 투자자 스탠스 분석
                    </span>
                </div>
                <button
                    onClick={() => window.location.href = '/'}
                    className="flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 text-sm rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    대시보드로 돌아가기
                </button>
            </header>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto p-6">
                <MacroDashboard />
            </main>
        </div>
    );
}
