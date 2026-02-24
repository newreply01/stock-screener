import { useState, useEffect, useCallback } from 'react'
import Layout from './components/Layout'
import MarketStats from './components/MarketStats'
import ScreenerConfigPage from './components/ScreenerConfigPage'
import PatternAnalysisDashboard from './components/PatternAnalysisDashboard'
import ResultTable from './components/ResultTable'
import NewsBoard from './components/NewsBoard'
import StockDetail from './components/StockDetail'
import WatchlistDashboard from './components/WatchlistDashboard'
import ComparisonChart from './components/ComparisonChart'
import { screenStocks, getStats, getWatchlists, addStockToWatchlist, removeStockFromWatchlist } from './utils/api'

console.log("App.jsx: Full restoration starting");

function App() {
  console.log("App.jsx: Component function started");
  const [results, setResults] = useState({ data: [], total: 0, page: 1, totalPages: 0, latestDate: null })
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({})
  const [sortBy, setSortBy] = useState('volume')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [mainStock, setMainStock] = useState(null)
  const [detailStock, setDetailStock] = useState(null)
  const [currentView, setCurrentView] = useState('dashboard') // 'dashboard', 'screener-config', 'news', 'watchlist'
  const [activeCompareSymbols, setActiveCompareSymbols] = useState([])

  const [watchlists, setWatchlists] = useState([])

  const fetchUserWatchlists = async () => {
    try {
      const res = await getWatchlists();
      if (res.success && res.data.length > 0) {
        setWatchlists(res.data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchUserWatchlists()
  }, [currentView]) // refresh when view changes, to get latest

  const toggleWatchlist = async (symbol) => {
    if (watchlists.length === 0) return;
    const defaultList = watchlists[0];
    const isWatched = defaultList.items?.some(i => i.symbol === symbol)
    try {
      if (isWatched) {
        await removeStockFromWatchlist(defaultList.id, symbol)
      } else {
        await addStockToWatchlist(defaultList.id, symbol)
      }
      fetchUserWatchlists()
    } catch (e) {
      console.error(e)
    }
  }

  // Get set of watched symbols
  const watchedSymbols = new Set()
  watchlists.forEach(w => w.items?.forEach(i => watchedSymbols.add(i.symbol)))

  console.log("App.jsx: Current view:", currentView);

  useEffect(() => {
    const handleSearch = (e) => {
      setSearchTerm(e.detail)
      setPage(1)
      if (currentView !== 'dashboard') {
        setCurrentView('dashboard')
      }
    }

    const handleSwitchView = (e) => {
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
    console.log("App.jsx: fetchData called");
    setLoading(true)
    try {
      const data = await screenStocks({
        ...filters,
        search: searchTerm,
        sort_by: sortBy,
        sort_dir: sortDir,
        page,
        limit: 50
      })
      console.log("App.jsx: fetchData success, items:", data?.data?.length);
      setResults(data || { data: [], total: 0, page: 1, totalPages: 0, latestDate: null })
    } catch (err) {
      console.error('篩選失敗:', err)
    } finally {
      setLoading(false)
    }
  }, [filters, sortBy, sortDir, page, searchTerm])

  useEffect(() => {
    if (results?.data?.length > 0 && !mainStock) {
      setMainStock(results.data[0])
    }
  }, [results, mainStock])

  const fetchStats = useCallback(async () => {
    console.log("App.jsx: fetchStats called");
    try {
      const data = await getStats(filters)
      console.log("App.jsx: fetchStats success");
      setStats(data)
    } catch (err) {
      console.error('統計失敗:', err)
    }
  }, [filters])

  useEffect(() => {
    fetchStats()
    fetchData()
  }, [fetchData, fetchStats])

  const handleFilter = (newFilters) => {
    setFilters(newFilters)
    setPage(1)
    setCurrentView('dashboard')
  }

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir(prev => prev === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(column)
      setSortDir('desc')
    }
    setPage(1)
  }

  const handleClear = () => {
    setFilters({})
    setSortBy('volume')
    setSortDir('desc')
    setPage(1)
  }

  const [activePatterns, setActivePatterns] = useState([])

  console.log("App.jsx: Returning full JSX tree");

  return (
    <Layout>
      <MarketStats stats={stats} />

      <div className="container mx-auto px-4 py-8">
        {currentView === 'screener-config' ? (
          <ScreenerConfigPage
            onFilter={handleFilter}
            onClear={handleClear}
            filters={filters}
            onBack={() => setCurrentView('dashboard')}
          />
        ) : currentView === 'watchlist' ? (
          <WatchlistDashboard onStockClick={(stock) => {
            setMainStock(stock)
            setDetailStock(stock)
          }}
            watchedSymbols={watchedSymbols}
            onToggleWatchlist={toggleWatchlist} />
        ) : currentView === 'dashboard' ? (
          <PatternAnalysisDashboard
            selectedStock={mainStock}
            activePatterns={activePatterns}
            onPatternsChange={setActivePatterns}
          >
            <ResultTable
              results={results || { data: [] }}
              loading={loading}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              page={page}
              onPageChange={setPage}
              onStockClick={(stock) => {
                setMainStock(stock)
                setDetailStock(stock)
              }}
              watchedSymbols={watchedSymbols}
              onToggleWatchlist={toggleWatchlist}
              onCompare={(symbols) => setActiveCompareSymbols(symbols)}
            />
          </PatternAnalysisDashboard>
        ) : (
          <div className="h-[800px] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <NewsBoard />
          </div>
        )}
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
    </Layout>
  )
}

export default App

