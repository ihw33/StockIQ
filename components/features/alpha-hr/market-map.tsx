import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState, useEffect } from 'react';

const COLORS = {
    pos: ['#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d'],
    neg: ['#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c']
};

const CustomizedContent = (props: any) => {
    const { root, depth, x, y, width, height, index, payload, colors, rank, name, change } = props;

    if (!payload || typeof payload.change !== 'number') return null;

    const isPositive = payload.change >= 0;
    // Simple color scale logic
    const intensity = Math.min(Math.floor(Math.abs(payload.change) * 2), 6); // Cap at index 6
    const fill = isPositive ? COLORS.pos[intensity] : COLORS.neg[intensity];

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: fill,
                    stroke: '#fff',
                    strokeWidth: 2 / (depth + 1e-10),
                    strokeOpacity: 1 / (depth + 1e-10),
                }}
            />
            {width > 30 && height > 30 && (
                <text x={x + width / 2} y={y + height / 2} textAnchor="middle" fill="#1e293b" fontSize={10} fontWeight="bold">
                    {name}
                </text>
            )}
            {width > 30 && height > 30 && (
                <text x={x + width / 2} y={y + height / 2 + 12} textAnchor="middle" fill="#334155" fontSize={9}>
                    {payload.change?.toFixed(2)}%
                </text>
            )}
        </g>
    );
};

export function MarketMap() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://localhost:8000/api/market/map') // Direct call to Python backend
            .then(res => res.json())
            .then(setData)
            .catch(err => console.error("Market Map Error:", err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="h-48 bg-slate-900 animate-pulse rounded-lg" />;

    return (
        <Card className="bg-slate-950 border-slate-800 text-slate-100 h-full flex flex-col">
            <CardHeader className="py-2 border-b border-slate-800">
                <CardTitle className="text-sm font-bold text-slate-300">S&P 500 맵 (상위 20)</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        width={400}
                        height={200}
                        data={data}
                        dataKey="size"
                        aspectRatio={4 / 3}
                        stroke="#fff"
                        fill="#8884d8"
                        content={<CustomizedContent />}
                    >
                        {/* Tooltip causing issues in Treemap sometimes, keep simple */}
                        <Tooltip />
                    </Treemap>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
