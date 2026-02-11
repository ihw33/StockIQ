import { CheckCircle, AlertTriangle } from 'lucide-react';
import type { DailyReview } from '../types';

interface DailyReviewCardProps {
    review: DailyReview;
}

export function DailyReviewCard({ review }: DailyReviewCardProps) {
    return (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-base font-bold text-white">📋 전일 리뷰</span>
                <span className="text-xs text-slate-500">({review.date})</span>
                <span className={`ml-auto px-2 py-0.5 rounded text-xs font-bold ${review.evaluation.hit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                    {review.evaluation.label}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Prediction */}
                <div>
                    <div className="text-xs text-slate-500 mb-1">예측</div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-200">
                            {review.prediction.level_label}
                        </span>
                        <span className="text-xs text-slate-400">
                            ({review.prediction.overall_score >= 0 ? '+' : ''}{review.prediction.overall_score.toFixed(2)})
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        {review.prediction.summary}
                    </p>
                </div>

                {/* Actual */}
                <div>
                    <div className="text-xs text-slate-500 mb-1">실제</div>
                    <div className="flex items-center gap-3 mb-1">
                        <span className={`text-sm font-bold ${review.actual.kospi_change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            KOSPI {review.actual.kospi_change >= 0 ? '+' : ''}{review.actual.kospi_change.toFixed(1)}%
                        </span>
                        <span className="text-xs text-slate-400">
                            외국인 {review.actual.foreign_net >= 0 ? '+' : ''}{review.actual.foreign_net.toLocaleString()}억
                        </span>
                    </div>
                </div>
            </div>

            {/* Evaluation */}
            <div className="mt-3 pt-3 border-t border-slate-800">
                <div className="flex items-start gap-2">
                    {review.evaluation.hit
                        ? <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        : <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    }
                    <p className="text-xs text-slate-300 leading-relaxed">{review.evaluation.comment}</p>
                </div>
            </div>
        </div>
    );
}
