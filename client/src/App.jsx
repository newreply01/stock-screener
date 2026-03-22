import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import MarketStats from './components/MarketStats'
import ScreenerConfigPage from './components/ScreenerConfigPage'
import PatternAnalysisDashboard from './components/PatternAnalysisDashboard'
import InstitutionalRankView from './components/InstitutionalRankView'
import MarketSentimentView from './components/MarketSentimentView'
import ResultTable from './components/ResultTable'
import NewsBoard from './components/NewsBoard'
import StockDetail from './components/StockDetail'
import WatchlistDashboard from './components/WatchlistDashboard'
import ComparisonChart from './components/ComparisonChart'
import ProfilePage from './components/ProfilePage'
import LoginModal from './components/LoginModal'
import MarketDashboard from './components/MarketDashboard'
import TradingDashboard from './components/TradingDashboard'
import RealtimeExplorer from './components/RealtimeExplorer'
import HealthCheckRanking from './components/HealthCheckRanking'
import MonitorPage from './components/MonitorPage'
import PortfolioDashboard from './components/PortfolioDashboard'
import AdminUserManagement from './components/AdminUserManagement'
import AIPromptManager from './components/AIPromptManager'
import PositionAnalysis from './components/PositionAnalysis'
import { screenStocks, getStats, getWatchlists, addStockToWatchlist, removeStockFromWatchlist } from './utils/api'
import { useAuth } from './context/AuthContext';
import { useGlobalFilters } from './context/GlobalFilterContext'

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { requireLogin, user, showLoginModal, setShowLoginModal } = useAuth()
  const { marketForApi, stockTypesForApi, industryForApi } = useGlobalFilters()
  const [results, setResults] = useState({ data: [], total: 0, page: 1, totalPages: 0, latestDate: null })
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({})
  const [sortBy, setSortBy] = useState('volume')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [mainStock, setMainStock] = useState(() => {
    try {
      const saved = localStorage.getItem('muchstock-main-stock');
      return saved ? JSON.parse(saved) : { symbol: '2330', name: '台積電', industry: '半導體業' };
    } catch { return { symbol: '2330', name: '台積電', industry: '半導體業' }; }
  })
  const [detailStock, setDetailStock] = useState(null)

  useEffect(() => {
    if (mainStock) {
      localStorage.setItem('muchstock-main-stock', JSON.stringify(mainStock));
    }
  }, [mainStock]);
  const [activeCompareSymbols, setActiveCompareSymbols] = useState([])
  const [watchlists, setWatchlists] = useState([])
  const [activePatterns, setActivePatterns] = useState([])

  const fetchUserWatchlists = async () => {
    try {
      const res = await getWatchlists();
      if (res.success && res.data.length > 0) setWatchlists(res.data)
    } catch (e) { console.error('Watchlist fetch error:', e) }
  }

  useEffect(() => { 
    if (user) fetchUserWatchlists() 
  }, [location.pathname, user])

  const toggleWatchlist = async (symbol) => {
    if (!requireLogin()) return;
    if (watchlists.length === 0) return;
    const defaultList = watchlists[0];
    const isWatched = defaultList.items?.some(i => i.symbol === symbol)
    try {
      if (isWatched) await removeStockFromWatchlist(defaultList.id, symbol)
      else await addStockToWatchlist(defaultList.id, symbol)
      fetchUserWatchlists()
    } catch (e) { console.error('Toggle watchlist error:', e) }
  }

  const watchedSymbols = new Set()
  watchlists.forEach(w => w.items?.forEach(i => watchedSymbols.add(i.symbol)))

  useEffect(() => {
    const handleSearch = (e) => {
      setSearchTerm(e.detail)
      setPage(1)
      setMainStock(null)
      if (!location.pathname.startsWith('/stock')) navigate(`/stock/${e.detail?.symbol || '2330'}`)
    }
    const handleSelect = (e) => {
      const stock = e.detail
      setMainStock(stock)
      if (!location.pathname.startsWith('/stock')) navigate(`/stock/${stock?.symbol || '2330'}`)
    }
    const handleSwitchView = (e) => {
      let targetView = e.detail;
      let incomingFilters = null;

      if (typeof e.detail === 'object') {
        targetView = e.detail.view;
        incomingFilters = e.detail.filters;
      }

      console.log('App: Switching view to', targetView, 'with filters', incomingFilters);

      if (['watchlist', 'portfolio'].includes(targetView) && !requireLogin()) {
        return;
      }

      if (incomingFilters) {
        setFilters(prev => ({ ...prev, ...incomingFilters }));
        setPage(1);
      }

      const routesMap = {
        'market-overview': '/',
        'screener-config': '/screener',
        'stock-detail': `/stock/${mainStock?.symbol || '2330'}`,
        'watchlist': '/watchlist',
        'portfolio': '/portfolio',
        'institutional': '/institutional',
        'sentiment': '/sentiment',
        'dashboard': '/dashboard',
        'trading': '/trading',
        'explorer': '/explorer',
        'health-ranking': '/health-ranking',
        'monitor': '/monitor',
        'admin-users': '/admin/users',
        'admin-prompts': '/admin/prompts',
        'position-analysis': '/position-analysis',
        'profile': '/profile',
        'news': '/news'
      };
      
      navigate(routesMap[targetView] || '/');
      window.scrollTo(0, 0)
    }
    window.addEventListener('muchstock-view', handleSwitchView)
    window.addEventListener('muchstock-search', handleSearch)
    window.addEventListener('muchstock-select', handleSelect)
    return () => {
      window.removeEventListener('muchstock-search', handleSearch)
      window.removeEventListener('muchstock-view', handleSwitchView)
      window.removeEventListener('muchstock-select', handleSelect)
    }
  }, [location.pathname, requireLogin, navigate, mainStock])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await screenStocks({
        ...filters,
        market: marketForApi,
        stock_types: stockTypesForApi,
        industry: industryForApi,
        search: searchTerm,
        sort_by: sortBy,
        sort_dir: sortDir,
        page,
        limit: 50
      })
      setResults(data || { data: [], total: 0, page: 1, totalPages: 0, latestDate: null })
    } catch (err) { console.error('Screening error:', err) } finally { setLoading(false) }
  }, [filters, sortBy, sortDir, page, searchTerm, marketForApi, stockTypesForApi, industryForApi])

  useEffect(() => {
    if (results?.data?.length > 0 && !mainStock && !localStorage.getItem('muchstock-main-stock')) {
      setMainStock(results.data[0])
    }
  }, [results, mainStock])

  const fetchStats = useCallback(async () => {
    try {
      const data = await getStats({
        ...filters,
        market: marketForApi,
        stock_types: stockTypesForApi,
        industry: industryForApi
      })
      setStats(data)
    } catch (err) { console.error('Stats error:', err) }
  }, [filters, marketForApi, stockTypesForApi, industryForApi])

  useEffect(() => { fetchStats(); fetchData() }, [fetchData, fetchStats])

  const getActiveView = (path) => {
    if (path === '/') return 'market-overview';
    if (path.startsWith('/screener')) return 'screener-config';
    if (path.startsWith('/stock/')) return 'stock-detail';
    if (path.startsWith('/watchlist')) return 'watchlist';
    if (path.startsWith('/portfolio')) return 'portfolio';
    if (path.startsWith('/institutional')) return 'institutional';
    if (path.startsWith('/sentiment')) return 'sentiment';
    if (path.startsWith('/dashboard')) return 'dashboard';
    if (path.startsWith('/trading')) return 'trading';
    if (path.startsWith('/explorer')) return 'explorer';
    if (path.startsWith('/health-ranking')) return 'health-ranking';
    if (path.startsWith('/monitor')) return 'monitor';
    if (path.startsWith('/admin/users')) return 'admin-users';
    if (path.startsWith('/admin/prompts')) return 'admin-prompts';
    if (path.startsWith('/position-analysis')) return 'position-analysis';
    if (path.startsWith('/profile')) return 'profile';
    if (path.startsWith('/news')) return 'news';
    return 'market-overview';
  };
  const activeViewName = getActiveView(location.pathname);

  return (
    <Layout currentView={activeViewName}>
      <MarketStats stats={stats} fallbackDate={results?.latestDate} />
      <div className="max-w-[1600px] mx-auto px-4 py-8">
        <Routes>
          <Route path="/screener" element={
            <ScreenerConfigPage
              onFilter={(f) => { setFilters(f); setPage(1); }}
              onClear={() => { setFilters({}); setPage(1); setMainStock(null); }}
              filters={filters}
              onBack={() => navigate('/dashboard')}
              results={results}
              loading={loading}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={(c) => {
                if (sortBy === c) setSortDir(p => p === 'desc' ? 'asc' : 'desc');
                else { setSortBy(c); setSortDir('desc'); }
                setPage(1);
              }}
              page={page}
              onPageChange={setPage}
              onStockClick={(s) => { setMainStock(s); setDetailStock(null); navigate(`/stock/\${s.symbol}`); }}
              watchedSymbols={watchedSymbols}
              onToggleWatchlist={toggleWatchlist}
            />
          } />
          <Route path="/watchlist" element={
            <WatchlistDashboard
              onStockClick={(s) => { setMainStock(s); setDetailStock(s); }}
              watchedSymbols={watchedSymbols}
              onToggleWatchlist={toggleWatchlist}
            />
          } />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/portfolio" element={
            <PortfolioDashboard 
              onStockClick={(s) => { setMainStock(s); setDetailStock(s); navigate(`/stock/\${s.symbol}`); }}
            />
          } />
          <Route path="/institutional" element={
            <InstitutionalRankView
              watchedSymbols={watchedSymbols}
              onToggleWatchlist={toggleWatchlist}
            />
          } />
          <Route path="/sentiment" element={<MarketSentimentView />} />
          <Route path="/" element={<MarketDashboard onStockSelect={(s) => { setMainStock(s); setDetailStock(null); navigate(`/stock/\${s.symbol}`); }} />} />
          <Route path="/trading" element={
            <TradingDashboard 
              watchlists={watchlists} 
              watchedSymbols={watchedSymbols} 
            />
          } />
          <Route path="/explorer" element={<RealtimeExplorer onStockSelect={(s) => { setMainStock(s); setDetailStock(null); navigate(`/stock/\${s.symbol}`); }} />} />
          <Route path="/health-ranking" element={<HealthCheckRanking onSelectStock={(s) => { setMainStock(s); setDetailStock(null); navigate(`/stock/\${s.symbol}`); }} />} />
          <Route path="/monitor" element={<MonitorPage />} />
          <Route path="/admin/users" element={<AdminUserManagement />} />
          <Route path="/admin/prompts" element={<AIPromptManager />} />
          <Route path="/position-analysis" element={<PositionAnalysis />} />
          <Route path="/stock/:symbol" element={
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
              <StockDetail stock={mainStock} isInline={true} />
            </div>
          } />
          <Route path="/dashboard" element={
            <PatternAnalysisDashboard
              selectedStock={mainStock}
              symbol={mainStock?.symbol}
              activePatterns={activePatterns}
              onPatternsChange={setActivePatterns}
              onStockSelect={(s) => { setMainStock(s); setDetailStock(null); navigate(`/stock/\${s.symbol}`); }}
            >
              <ResultTable
                results={results}
                loading={loading}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={(c) => {
                  if (sortBy === c) setSortDir(p => p === 'desc' ? 'asc' : 'desc');
                  else { setSortBy(c); setSortDir('desc'); }
                  setPage(1);
                }}
                page={page}
                onPageChange={setPage}
                onStockClick={(s) => { setMainStock(s); setDetailStock(null); navigate(`/stock/\${s.symbol}`); }}
                watchedSymbols={watchedSymbols}
                onToggleWatchlist={toggleWatchlist}
                onCompare={setActiveCompareSymbols}
              />
            </PatternAnalysisDashboard>
          } />
          <Route path="/news" element={<NewsBoard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {detailStock && activeViewName !== 'dashboard' && (
        <StockDetail
          stock={detailStock}
          onClose={() => setDetailStock(null)}
          isWatched={watchedSymbols.has(detailStock.symbol)}
          onToggleWatchlist={() => toggleWatchlist(detailStock.symbol)}
        />
      )}
      {activeCompareSymbols.length > 0 && (
        <ComparisonChart
          symbols={activeCompareSymbols}
          onClose={() => setActiveCompareSymbols([])}
        />
      )}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </Layout>
  )
}
export default App
