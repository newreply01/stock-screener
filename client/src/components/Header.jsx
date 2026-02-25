import { Search, User, Menu, Bell, Globe } from 'lucide-react';

export default function Header({ currentView = 'dashboard' }) {
    const dispatchView = (view) => {
        window.dispatchEvent(new CustomEvent('muchstock-view', { detail: view }));
    };

    return (
        <header className="bg-brand-dark text-white sticky top-0 z-50">
            {/* Top Bar for Global Info */}
            <div className="bg-black/30 border-b border-white/5 py-1 hidden sm:block">
                <div className="container mx-auto px-4 flex justify-between items-center text-[11px] font-medium tracking-wide uppercase text-gray-400">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> 繁體中文</span>
                        <span>市場狀態: <span className="text-brand-success">交易中</span></span>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => dispatchView('watchlist')} className="hover:text-white transition-colors">投資組合</button>
                        <a href="#" className="hover:text-white transition-colors">個人化設定</a>
                    </div>
                </div>
            </div>

            {/* Main Navigation */}
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <button
                        onClick={() => dispatchView('dashboard')}
                        className="flex items-center gap-1.5 group"
                    >
                        <div className="bg-brand-primary p-1.5 rounded-sm group-hover:bg-red-500 transition-colors">
                            <div className="text-white font-black text-xl leading-none tracking-tighter">MUCH</div>
                        </div>
                        <div className="text-white font-bold text-xl tracking-tight ml-1 hover:text-brand-primary transition-colors">Stock</div>
                    </button>

                    <nav className="hidden lg:flex items-center gap-8 text-[14px] font-semibold">
                        <button
                            onClick={() => dispatchView('dashboard')}
                            className={`h-16 flex items-center transition-colors px-1 border-b-2 ${currentView === 'dashboard' ? 'text-brand-primary font-bold border-brand-primary hover:text-red-400' : 'text-gray-300 hover:text-white border-transparent hover:border-white/20'}`}
                        >
                            台股篩選
                        </button>
                        <button
                            onClick={() => dispatchView('institutional')}
                            className={`h-16 flex items-center transition-colors px-1 border-b-2 ${currentView === 'institutional' ? 'text-brand-primary font-bold border-brand-primary hover:text-red-400' : 'text-gray-300 hover:text-white border-transparent hover:border-white/20'}`}
                        >
                            三大法人
                        </button>
                        <button
                            onClick={() => dispatchView('sentiment')}
                            className={`h-16 flex items-center transition-colors px-1 border-b-2 ${currentView === 'sentiment' ? 'text-brand-primary font-bold border-brand-primary hover:text-red-400' : 'text-gray-300 hover:text-white border-transparent hover:border-white/20'}`}
                        >
                            市場情緒
                        </button>
                        <button
                            onClick={() => dispatchView('screener-config')}
                            className={`h-16 flex items-center transition-colors px-1 border-b-2 ${currentView === 'screener-config' ? 'text-brand-primary font-bold border-brand-primary hover:text-red-400' : 'text-gray-300 hover:text-white border-transparent hover:border-white/20'}`}
                        >
                            進階篩選設定
                        </button>
                        <button
                            onClick={() => dispatchView('news')}
                            className={`h-16 flex items-center transition-colors px-1 border-b-2 ${currentView === 'news' ? 'text-brand-primary font-bold border-brand-primary hover:text-red-400' : 'text-gray-300 hover:text-white border-transparent hover:border-white/20'}`}
                        >
                            財經新聞
                        </button>
                    </nav>
                </div>

                <div className="flex items-center gap-5">
                    <div className="hidden md:flex items-center bg-white/10 hover:bg-white/15 border border-white/10 rounded-md px-3 py-1.5 w-72 transition-all">
                        <input
                            type="text"
                            placeholder="搜索股票代號、名稱..."
                            className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-500 font-medium"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    window.dispatchEvent(new CustomEvent('muchstock-search', { detail: e.target.value }));
                                }
                            }}
                        />
                        <button onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling;
                            window.dispatchEvent(new CustomEvent('muchstock-search', { detail: input.value }));
                        }}>
                            <Search className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="p-2 text-gray-400 hover:text-white transition-colors">
                            <Bell className="w-5 h-5" />
                        </button>
                        <div className="h-6 w-px bg-white/10 mx-1"></div>
                        <button className="flex items-center gap-2 pl-2 group">
                            <div className="w-8 h-8 rounded-full bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center group-hover:bg-brand-primary/30 transition-colors">
                                <User className="w-4 h-4 text-brand-primary" />
                            </div>
                            <span className="text-sm font-medium hidden sm:block text-gray-300 group-hover:text-white transition-colors">會員登入</span>
                        </button>
                    </div>

                    <button className="lg:hidden p-2 text-gray-300 hover:text-white transition-colors">
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </header>
    );
}
