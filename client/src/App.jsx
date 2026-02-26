import { useState, useEffect, useCallback } from 'react'
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
import { screenStocks, getStats, getWatchlists, addStockToWatchlist, removeStockFromWatchlist } from './utils/api'
import { useAuth } from './context/AuthContext'

function App() {
  const { requireLogin, user, showLoginModal, setShowLoginModal } = useAuth()
  const [results, setResults] = useState({ data: [], total: 0, page: 1, totalPages: 0, latestDate: null })
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({})
  const [sortBy, setSortBy] = useState('volume')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [mainStock, setMainStock] = useState({ symbol: '2330', name: '台積電', industry: '半導體業' })
  const [detailStock, setDetailStock] = useState(null)
  const [currentView, setCurrentView] = useState('market-overview')
  const [activeCompareSymbols, setActiveCompareSymbols] = useState([])
  const [watchlists, setWatchlists] = useState([])
  const [activePatterns, setActivePatterns] = useState([])

  const fetchUserWatchlists = async () => {
    try {
      const res = await getWatchlists();
      if (res.success && res.data.length > 0) setWatchlists(res.data)
    } catch (e) { console.error('Watchlist fetch error:', e) }
  }

  useEffect(() => { fetchUserWatchlists() }, [currentView])

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
      if (currentView !== 'dashboard') setCurrentView('dashboard')
    }
    const handleSwitchView = (e) => {
      console.log('App: Switching view to', e.detail);

      // 未登入不可進入自選股
      if (e.detail === 'watchlist' && !requireLogin()) {
        return;
      }

      setCurrentView(e.detail)
      window.scrollTo(0, 0)
    }
    window.addEventListener('muchstock-view', handleSwitchView)
    window.addEventListener('muchstock-search', handleSearch)
    return () => {
      window.removeEventListener('muchstock-search', handleSearch)
      window.removeEventListener('muchstock-view', handleSwitchView)
    }
  }, [currentView])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await screenStocks({ ...filters, search: searchTerm, sort_by: sortBy, sort_dir: sortDir, page, limit: 50 })
      setResults(data || { data: [], total: 0, page: 1, totalPages: 0, latestDate: null })
    } catch (err) { console.error('Screening error:', err) } finally { setLoading(false) }
  }, [filters, sortBy, sortDir, page, searchTerm])

  useEffect(() => {
    if (results?.data?.length > 0 && !mainStock) setMainStock(results.data[0])
  }, [results, mainStock])

  const fetchStats = useCallback(async () => {
    try {
      const data = await getStats(filters)
      setStats(data)
    } catch (err) { console.error('Stats error:', err) }
  }, [filters])

  useEffect(() => { fetchStats(); fetchData() }, [fetchData, fetchStats])

  return (
    <Layout currentView={currentView}>
      <MarketStats stats={stats} fallbackDate={results?.latestDate} />
      <div className="container mx-auto px-4 py-8">
        {currentView === 'screener-config' ? (
          <ScreenerConfigPage
            onFilter={(f) => { setFilters(f); setPage(1); setMainStock(null); setCurrentView('dashboard') }}
            onClear={() => { setFilters({}); setPage(1); setMainStock(null); }}
            filters={filters}
            onBack={() => setCurrentView('dashboard')}
          />
        ) : currentView === 'watchlist' ? (
          <WatchlistDashboard
            onStockClick={(s) => { setMainStock(s); setDetailStock(s) }}
            watchedSymbols={watchedSymbols}
            onToggleWatchlist={toggleWatchlist}
          />
        ) : currentView === 'profile' ? (
          <ProfilePage />
        ) : currentView === 'institutional' ? (
          <InstitutionalRankView
            watchedSymbols={watchedSymbols}
            onToggleWatchlist={toggleWatchlist}
          />
        ) : currentView === 'sentiment' ? (
          <MarketSentimentView />
        ) : currentView === 'market-overview' ? (
          <MarketDashboard onStockSelect={(s) => { setMainStock(s); setDetailStock(null); setCurrentView('dashboard'); }} />
        ) : currentView === 'dashboard' ? (
          <PatternAnalysisDashboard
            selectedStock={mainStock}
            symbol={mainStock?.symbol}
            activePatterns={activePatterns}
            onPatternsChange={setActivePatterns}
            onStockSelect={(s) => { setMainStock(s); setDetailStock(null); setSearchTerm(s.symbol); setPage(1); }}
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
              onStockClick={(s) => { setMainStock(s); setDetailStock(s) }}
              watchedSymbols={watchedSymbols}
              onToggleWatchlist={toggleWatchlist}
              onCompare={setActiveCompareSymbols}
            />
          </PatternAnalysisDashboard>
        ) : <NewsBoard />}
      </div>
      {detailStock && (
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
