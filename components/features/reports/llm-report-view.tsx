"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface LlmReportViewProps {
    analysis: string;
}

export function LlmReportView({ analysis }: LlmReportViewProps) {
    return (
        <div className="bg-white">
            {/* Header - Document Style */}
            <div className="border-b-2 border-gray-900 pb-3 mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                    종합 분석 보고서
                </h2>
            </div>

            {/* Report Content */}
            <div className="prose prose-gray max-w-none">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        h1: ({ node, ...props }) => (
                            <h1 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-400" {...props} />
                        ),
                        h2: ({ node, ...props }) => (
                            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3 border-b border-gray-400 pb-2" {...props} />
                        ),
                        h3: ({ node, ...props }) => (
                            <h3 className="text-lg font-semibold text-gray-800 mt-5 mb-2" {...props} />
                        ),
                        p: ({ node, ...props }) => (
                            <p className="text-gray-700 leading-relaxed mb-3" {...props} />
                        ),
                        ul: ({ node, ...props }) => (
                            <ul className="list-disc list-inside text-gray-700 space-y-1.5 mb-4 ml-2" {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                            <ol className="list-decimal list-inside text-gray-700 space-y-1.5 mb-4 ml-2" {...props} />
                        ),
                        li: ({ node, ...props }) => (
                            <li className="text-gray-700" {...props} />
                        ),
                        blockquote: ({ node, ...props }) => (
                            <blockquote className="border-l-4 border-gray-400 pl-4 italic text-gray-600 my-4 bg-gray-50 py-2 rounded-r" {...props} />
                        ),
                        code: ({ node, inline, ...props }: any) =>
                            inline ? (
                                <code className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
                            ) : (
                                <code className="block bg-gray-50 text-gray-800 p-4 rounded my-4 overflow-x-auto border border-gray-300 font-mono text-sm" {...props} />
                            ),
                        table: ({ node, ...props }) => (
                            <table className="w-full border-collapse text-sm my-4" {...props} />
                        ),
                        thead: ({ node, ...props }) => (
                            <thead {...props} />
                        ),
                        tbody: ({ node, ...props }) => (
                            <tbody className="divide-y divide-gray-200" {...props} />
                        ),
                        th: ({ node, ...props }) => (
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b-2 border-gray-400" {...props} />
                        ),
                        td: ({ node, ...props }) => (
                            <td className="px-3 py-2 text-gray-800" {...props} />
                        ),
                        hr: ({ node, ...props }) => (
                            <hr className="border-gray-300 my-6" {...props} />
                        ),
                        strong: ({ node, ...props }) => (
                            <strong className="text-gray-900 font-bold" {...props} />
                        ),
                    }}
                >
                    {analysis}
                </ReactMarkdown>
            </div>
        </div>
    );
}
