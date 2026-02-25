import { TrendingUp, TrendingDown, Clock, Activity } from "lucide-react";

export default function MarketStats({ stats, fallbackDate }) {
    if (!stats) {
        return (
            <div className="bg-brand-primary/5 border-b border-brand-primary/10 py-1.5">
                <div className="container mx-auto px-4 flex justify-between items-center text-[13px]">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-gray-400">上漲 --</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <TrendingDown className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-gray-400">下跌 --</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const upCount = Number(stats.up_count || 0);
    const downCount = Number(stats.down_count || 0);
    const total = upCount + downCount;
    const upRatio = total > 0 ? (upCount / total) * 100 : 0;
    const date = stats.latestDate || stats.latestdate || stats.latest_date || fallbackDate || "-";

    return (
        <div className="bg-brand-primary/5 border-b border-brand-primary/10 py-1.5">
            <div className="container mx-auto px-4 flex flex-wrap justify-between items-center gap-y-2 text-[13px]">
                <div className="flex items-center gap-4 sm:gap-8">
                    <div className="flex items-center gap-1.5 group">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        <span className="font-semibold text-emerald-600">{upCount}</span>
                        <div className="hidden lg:flex w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${upRatio}%` }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 group">
                        <TrendingDown className="w-4 h-4 text-rose-500" />
                        <span className="font-semibold text-rose-600">{downCount}</span>
                    </div>

                    <div className="hidden md:flex items-center gap-1.5 text-gray-500">
                        <Activity className="w-3.5 h-3.5" />
                        <span>多空比：{(upRatio / (100 - upRatio || 1)).toFixed(2)}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-gray-500 bg-white/50 px-2 py-1 rounded border border-gray-100 italic font-medium text-[11px] whitespace-nowrap">
                    <Clock className="w-3 h-3" />
                    <span>資料時間：{date}</span>
                </div>
            </div>
        </div>
    );
}
