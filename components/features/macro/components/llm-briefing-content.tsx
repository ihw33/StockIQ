import { formatTextParts } from '../utils';

interface LlmBriefingContentProps {
    content: string;
}

export function LlmBriefingContent({ content }: LlmBriefingContentProps) {
    return (
        <div className="space-y-1">
            {content.split('\n').map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className="h-2" />;

                if (trimmed.startsWith('### ')) {
                    return (
                        <h4 key={i} className="text-purple-300 font-bold mt-4 mb-1 text-sm flex items-center gap-2">
                            {formatTextParts(trimmed.slice(4))}
                        </h4>
                    );
                }
                if (trimmed.startsWith('## ')) {
                    return (
                        <h3 key={i} className="text-purple-200 font-bold mt-5 mb-2 text-base">
                            {formatTextParts(trimmed.slice(3))}
                        </h3>
                    );
                }
                if (trimmed.startsWith('# ')) {
                    return (
                        <h2 key={i} className="text-purple-100 font-bold mt-5 mb-2 text-lg">
                            {formatTextParts(trimmed.slice(2))}
                        </h2>
                    );
                }
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    return (
                        <div key={i} className="flex gap-2 ml-2">
                            <span className="text-purple-400 shrink-0">·</span>
                            <span className="text-slate-300 text-sm">{formatTextParts(trimmed.slice(2))}</span>
                        </div>
                    );
                }
                if (/^\d+\.\s/.test(trimmed)) {
                    const match = trimmed.match(/^(\d+\.)\s(.*)$/);
                    return (
                        <div key={i} className="flex gap-2 ml-2">
                            <span className="text-purple-400 shrink-0 text-xs font-mono">{match?.[1]}</span>
                            <span className="text-slate-300 text-sm">{formatTextParts(match?.[2] || trimmed)}</span>
                        </div>
                    );
                }
                if (trimmed.startsWith('> ')) {
                    return (
                        <div key={i} className="border-l-2 border-purple-500/50 pl-3 ml-2 text-slate-400 text-sm italic">
                            {formatTextParts(trimmed.slice(2))}
                        </div>
                    );
                }
                if (trimmed.startsWith('---') || trimmed.startsWith('***')) {
                    return <hr key={i} className="border-slate-700/50 my-3" />;
                }
                return (
                    <p key={i} className="text-slate-300 text-sm leading-relaxed">
                        {formatTextParts(trimmed)}
                    </p>
                );
            })}
        </div>
    );
}
