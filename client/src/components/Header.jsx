import { useState } from 'react';
import { Search, User, Menu, Bell, Globe, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Header({ currentView = 'dashboard' }) {
    const { user, logout, showLoginModal, setShowLoginModal } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

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
                        onClick={() => dispatchView('market-overview')}
                        className="flex items-center gap-1.5 group"
                    >
                        <div className="bg-brand-primary p-1.5 rounded-sm group-hover:bg-red-500 transition-colors">
                            <div className="text-white font-black text-xl leading-none tracking-tighter">MUCH</div>
                        </div>
                        <div className="text-white font-bold text-xl tracking-tight ml-1 hover:text-brand-primary transition-colors">Stock</div>
                    </button>

                    <nav className="hidden lg:flex items-center gap-8 text-[14px] font-semibold">
                        <button
                            onClick={() => dispatchView('trading')}
                            className={`h-16 flex items-center transition-colors px-1 border-b-2 ${currentView === 'trading' ? 'text-brand-primary font-bold border-brand-primary hover:text-red-400' : 'text-gray-300 hover:text-white border-transparent hover:border-white/20'}`}
                        >
                            即時看盤
                        </button>
                        <button
                            onClick={() => dispatchView('market-overview')}
                            className={`h-16 flex items-center transition-colors px-1 border-b-2 ${currentView === 'market-overview' ? 'text-brand-primary font-bold border-brand-primary hover:text-red-400' : 'text-gray-300 hover:text-white border-transparent hover:border-white/20'}`}
                        >
                            大盤概況
                        </button>
                        <button
                            onClick={() => dispatchView('stock-detail')}
                            className={`h-16 flex items-center transition-colors px-1 border-b-2 ${currentView === 'stock-detail' ? 'text-brand-primary font-bold border-brand-primary hover:text-red-400' : 'text-gray-300 hover:text-white border-transparent hover:border-white/20'}`}
                        >
                            個股資訊
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
                            智能選股
                        </button>
                        <button
                            onClick={() => dispatchView('health-ranking')}
                            className={`h-16 flex items-center transition-colors px-1 border-b-2 ${currentView === 'health-ranking' ? 'text-brand-primary font-bold border-brand-primary hover:text-red-400' : 'text-gray-300 hover:text-white border-transparent hover:border-white/20'}`}
                        >
                            健診排行
                        </button>
                        <button
                            onClick={() => dispatchView('news')}
                            className={`h-16 flex items-center transition-colors px-1 border-b-2 ${currentView === 'news' ? 'text-brand-primary font-bold border-brand-primary hover:text-red-400' : 'text-gray-300 hover:text-white border-transparent hover:border-white/20'}`}
                        >
                            財經新聞
                        </button>
                        <button
                            onClick={() => dispatchView('explorer')}
                            className={`h-16 flex items-center transition-colors px-1 border-b-2 ${currentView === 'explorer' ? 'text-brand-primary font-bold border-brand-primary hover:text-red-400' : 'text-gray-300 hover:text-white border-transparent hover:border-white/20'}`}
                        >
                            歷史交易
                        </button>
                        <button
                            onClick={() => dispatchView('monitor')}
                            className={`h-16 flex items-center transition-colors px-1 border-b-2 ${currentView === 'monitor' ? 'text-brand-primary font-bold border-brand-primary hover:text-red-400' : 'text-gray-300 hover:text-white border-transparent hover:border-white/20'}`}
                        >
                            系統監控
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
                        {user ? (
                            <div className="flex items-center gap-3 relative group/menu">
                                <button className="flex items-center gap-2 pl-2">
                                    <div className="w-8 h-8 rounded-full bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center overflow-hidden">
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-sm font-bold text-brand-primary">{user.name?.[0] || user.email?.[0]}</span>
                                        )}
                                    </div>
                                    <span className="text-sm font-medium hidden sm:block text-gray-300 group-hover/menu:text-white transition-colors">{user.name || user.email.split('@')[0]}</span>
                                </button>

                                {/* Dropdown */}
                                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all transform origin-top-right translate-y-2 group-hover/menu:translate-y-0 z-50 overflow-hidden">
                                    <div className="p-3 border-b border-slate-50">
                                        <p className="text-sm font-bold text-slate-800 truncate">{user.name || 'User'}</p>
                                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                    </div>
                                    <div className="p-1">
                                        <button
                                            onClick={() => dispatchView('profile')}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                                        >
                                            <User className="w-4 h-4" /> 個人設定
                                        </button>
                                        <button
                                            onClick={() => {
                                                logout();
                                                dispatchView('dashboard');
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <LogOut className="w-4 h-4" /> 登出
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setShowLoginModal(true)} className="flex items-center gap-2 pl-2 group">
                                <div className="w-8 h-8 rounded-full bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center group-hover:bg-brand-primary/30 transition-colors">
                                    <User className="w-4 h-4 text-brand-primary" />
                                </div>
                                <span className="text-sm font-medium hidden sm:block text-gray-300 group-hover:text-white transition-colors">會員登入</span>
                            </button>
                        )}
                    </div>

                    <button
                        className="lg:hidden p-2 text-gray-300 hover:text-white transition-colors"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="lg:hidden bg-brand-dark border-t border-white/5 py-4 px-4 space-y-3 animate-in fade-in slide-in-from-top duration-200">
                    <div className="pb-2 border-b border-white/5 mb-2">
                        <div className="flex items-center bg-white/10 rounded-lg px-4 py-2.5">
                            <input
                                type="text"
                                placeholder="搜尋股票代號、名稱..."
                                className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-500"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        window.dispatchEvent(new CustomEvent('muchstock-search', { detail: e.target.value }));
                                        setIsMenuOpen(false);
                                    }
                                }}
                            />
                            <Search className="w-4 h-4 text-gray-400" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => { dispatchView('trading'); setIsMenuOpen(false); }} className={`text-center py-2.5 px-3 rounded-xl font-bold text-xs ${currentView === 'trading' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-300 bg-white/5 hover:bg-white/10'}`}>即時看盤</button>
                        <button onClick={() => { dispatchView('market-overview'); setIsMenuOpen(false); }} className={`text-center py-2.5 px-3 rounded-xl font-bold text-xs ${currentView === 'market-overview' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-300 bg-white/5 hover:bg-white/10'}`}>大盤概況</button>
                        <button onClick={() => { dispatchView('stock-detail'); setIsMenuOpen(false); }} className={`text-center py-2.5 px-3 rounded-xl font-bold text-xs ${currentView === 'stock-detail' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-300 bg-white/5 hover:bg-white/10'}`}>個股資訊</button>
                        <button onClick={() => { dispatchView('institutional'); setIsMenuOpen(false); }} className={`text-center py-2.5 px-3 rounded-xl font-bold text-xs ${currentView === 'institutional' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-300 bg-white/5 hover:bg-white/10'}`}>三大法人</button>
                        <button onClick={() => { dispatchView('sentiment'); setIsMenuOpen(false); }} className={`text-center py-2.5 px-3 rounded-xl font-bold text-xs ${currentView === 'sentiment' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-300 bg-white/5 hover:bg-white/10'}`}>市場情緒</button>
                        <button onClick={() => { dispatchView('screener-config'); setIsMenuOpen(false); }} className={`text-center py-2.5 px-3 rounded-xl font-bold text-xs ${currentView === 'screener-config' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-300 bg-white/5 hover:bg-white/10'}`}>智能選股</button>
                        <button onClick={() => { dispatchView('health-ranking'); setIsMenuOpen(false); }} className={`text-center py-2.5 px-3 rounded-xl font-bold text-xs ${currentView === 'health-ranking' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-300 bg-white/5 hover:bg-white/10'}`}>健診排行</button>
                        <button onClick={() => { dispatchView('news'); setIsMenuOpen(false); }} className={`text-center py-2.5 px-3 rounded-xl font-bold text-xs ${currentView === 'news' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-300 bg-white/5 hover:bg-white/10'}`}>財經新聞</button>
                        <button onClick={() => { dispatchView('explorer'); setIsMenuOpen(false); }} className={`text-center py-2.5 px-3 rounded-xl font-bold text-xs ${currentView === 'explorer' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-300 bg-white/5 hover:bg-white/10'}`}>歷史交易</button>
                        <button onClick={() => { dispatchView('monitor'); setIsMenuOpen(false); }} className={`text-center py-2.5 px-3 rounded-xl font-bold text-xs ${currentView === 'monitor' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-300 bg-white/5 hover:bg-white/10'}`}>系統監控</button>
                    </div>
                </div>
            )}


        </header>
    );
}
