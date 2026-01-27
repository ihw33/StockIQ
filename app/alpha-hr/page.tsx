"use client";

import { useState } from "react";
import { InvestmentCard } from "@/components/features/alpha-hr/investment-card";
import { ShadowOrgChart } from "@/components/features/alpha-hr/shadow-org-chart";
import { MarketMap } from "@/components/features/alpha-hr/market-map";
import { Button } from "@/components/ui/button";

export default function AlphaHRPage() {
    const [targetCompany, setTargetCompany] = useState("Naver");
    const [analysisData, setAnalysisData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const runAnalysis = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log("Sending request to http://localhost:8000/api/alpha-hr/analyze...");
            const res = await fetch("http://localhost:8000/api/alpha-hr/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ company_name: targetCompany }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Server Error: ${res.status} ${errorText}`);
            }

            const data = await res.json();
            setAnalysisData(data);
        } catch (e: any) {
            console.error("Analysis Failed", e);
            setError(e.message || "Failed to connect to AI Server");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-black text-slate-200 font-sans selection:bg-emerald-500/30">
            {/* Header / Nav */}
            <header className="border-b border-slate-900 bg-black/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-[1920px] mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-500 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-black text-xs">
                            HR
                        </div>
                        <h1 className="text-lg font-bold tracking-tight text-white">
                            Alpha-HR <span className="text-slate-600 font-normal">| Alternative Data Suite</span>
                        </h1>
                    </div>
                    <div>
                        <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => window.location.href = '/'}>
                            Back to War Room
                        </Button>
                    </div>
                </div>
            </header>

            <div className="max-w-[1920px] mx-auto p-6 grid grid-cols-12 gap-6 h-[calc(100vh-3.5rem)]">
                {/* Left Column: Controls & Context (3 cols) */}
                <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
                    {/* Search / Target Input */}
                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                        <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">분석 대상 기업</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={targetCompany}
                                onChange={(e) => setTargetCompany(e.target.value)}
                                className="flex-1 bg-black border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                            <Button
                                onClick={runAnalysis}
                                disabled={loading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            >
                                {loading ? "분석 중..." : "분석 시작"}
                            </Button>
                        </div>
                        {error && (
                            <div className="mt-2 p-2 bg-red-900/50 border border-red-800 rounded text-xs text-red-200">
                                ❌ {error} <br />
                                <span className="opacity-70">Check if backend is running on port 8000</span>
                            </div>
                        )}
                    </div>

                    {/* Market Map (Treemap) */}
                    <div className="flex-1 min-h-0 bg-slate-900/10 rounded-xl overflow-hidden border border-slate-800">
                        <MarketMap />
                    </div>
                </div>

                {/* Middle Column: Analysis Core (5 cols) */}
                <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
                    <div className="flex-1 min-h-0">
                        <InvestmentCard
                            signal={analysisData?.signal}
                            loading={loading}
                        />
                    </div>
                </div>

                {/* Right Column: Evidence (4 cols) */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                    <div className="flex-1 min-h-0">
                        <ShadowOrgChart
                            diffReport={analysisData?.diff_summary}
                            loading={loading}
                        />
                    </div>
                </div>
            </div>
        </main>
    );
}
