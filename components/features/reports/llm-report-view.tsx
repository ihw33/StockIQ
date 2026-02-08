"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';

interface LlmReportViewProps {
    analysis: string;
}

export function LlmReportView({ analysis }: LlmReportViewProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">
                🧠 AI 심층 분석
            </h2>
            <div className="prose prose-gray max-w-none">
                <ReactMarkdown
                    components={{
                        h1: ({ node, ...props }) => (
                            <h1 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-indigo-200" {...props} />
                        ),
                        h2: ({ node, ...props }) => (
                            <h2 className="text-xl font-bold text-indigo-900 mt-8 mb-3" {...props} />
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
                            <blockquote className="border-l-4 border-indigo-400 pl-4 italic text-gray-600 my-4 bg-indigo-50 py-2 rounded-r" {...props} />
                        ),
                        code: ({ node, inline, ...props }: any) =>
                            inline ? (
                                <code className="bg-gray-100 text-indigo-700 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
                            ) : (
                                <code className="block bg-gray-50 text-gray-800 p-4 rounded-lg my-4 overflow-x-auto border border-gray-200 font-mono text-sm" {...props} />
                            ),
                        table: ({ node, ...props }) => (
                            <div className="overflow-x-auto my-4">
                                <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden" {...props} />
                            </div>
                        ),
                        thead: ({ node, ...props }) => (
                            <thead className="bg-gray-50" {...props} />
                        ),
                        th: ({ node, ...props }) => (
                            <th className="text-gray-700 px-4 py-2.5 text-left text-sm font-semibold border-b border-gray-200" {...props} />
                        ),
                        td: ({ node, ...props }) => (
                            <td className="px-4 py-2 border-b border-gray-100 text-gray-700 text-sm" {...props} />
                        ),
                        hr: ({ node, ...props }) => (
                            <hr className="border-gray-200 my-6" {...props} />
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
