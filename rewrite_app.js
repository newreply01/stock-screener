const fs = require('fs');
const filePath = '/home/xg/stock-screener/client/src/App.jsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add react-router-dom imports
code = code.replace(
  "import { useState, useEffect, useCallback } from 'react'",
  "import { useState, useEffect, useCallback } from 'react'\nimport { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'"
);

// 2. Add hooks inside App function
code = code.replace(
  "function App() {\n  const { requireLogin",
  "function App() {\n  const navigate = useNavigate();\n  const location = useLocation();\n  const { requireLogin"
);

// 3. Remove currentView state and persist logic
code = code.replace(/  const \[currentView, setCurrentView\] = useState\(\(\) => \{[\s\S]*?\}\);\n\n  \/\/ Persist view and stock state\n  useEffect\(\(\) => \{\n    localStorage.setItem\('muchstock-current-view', currentView\);\n  \}, \[currentView\]\);\n/g, "");

// 4. Update window event listeners mapping
const eventListenerLogic = `
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
        'stock-detail': \`/stock/\${mainStock?.symbol || '2330'}\`,
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
      window.scrollTo(0, 0);
    }`;

code = code.replace(/    const handleSwitchView = \(e\) => \{[\s\S]*?window\.scrollTo\(0, 0\)\n    \}/g, eventListenerLogic);

// 5. Replace currentView references in useEffect dependency arrays and logic
code = code.replace(/\[currentView, user\]/g, "[location.pathname, user]");
code = code.replace(/\[currentView, requireLogin\]/g, "[location.pathname, requireLogin]");
code = code.replace(/if \(currentView !== 'stock-detail'\) setCurrentView\('stock-detail'\)/g, "if (!location.pathname.startsWith('/stock')) navigate(`/stock/\${stock?.symbol || e.detail?.symbol || '2330'}`)");

// 6. create getActiveView for Layout
const getActiveViewLogic = `
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
`;
code = code.replace("  return (\n    <Layout", `${getActiveViewLogic}\n  return (\n    <Layout`);

// 7. Update layout currentView prop and routing
code = code.replace(/<Layout currentView=\{currentView\}>/g, "<Layout currentView={activeViewName}>");

// replace the long nested ternary render logic with Routes
const routesJSX = `
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
              onStockClick={(s) => { setMainStock(s); setDetailStock(null); navigate(\`/stock/\${s.symbol}\`); }}
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
              onStockClick={(s) => { setMainStock(s); setDetailStock(s); navigate(\`/stock/\${s.symbol}\`); }}
            />
          } />
          <Route path="/institutional" element={
            <InstitutionalRankView
              watchedSymbols={watchedSymbols}
              onToggleWatchlist={toggleWatchlist}
            />
          } />
          <Route path="/sentiment" element={<MarketSentimentView />} />
          <Route path="/" element={<MarketDashboard onStockSelect={(s) => { setMainStock(s); setDetailStock(null); navigate(\`/stock/\${s.symbol}\`); }} />} />
          <Route path="/trading" element={
            <TradingDashboard 
              watchlists={watchlists} 
              watchedSymbols={watchedSymbols} 
            />
          } />
          <Route path="/explorer" element={<RealtimeExplorer onStockSelect={(s) => { setMainStock(s); setDetailStock(null); navigate(\`/stock/\${s.symbol}\`); }} />} />
          <Route path="/health-ranking" element={<HealthCheckRanking onSelectStock={(s) => { setMainStock(s); setDetailStock(null); navigate(\`/stock/\${s.symbol}\`); }} />} />
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
              onStockSelect={(s) => { setMainStock(s); setDetailStock(null); navigate(\`/stock/\${s.symbol}\`); }}
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
                onStockClick={(s) => { setMainStock(s); setDetailStock(null); navigate(\`/stock/\${s.symbol}\`); }}
                watchedSymbols={watchedSymbols}
                onToggleWatchlist={toggleWatchlist}
                onCompare={setActiveCompareSymbols}
              />
            </PatternAnalysisDashboard>
          } />
          <Route path="/news" element={<NewsBoard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>`;

// Replace the massive ternary block inside <div className="max-w-[1600px] ...
const startIndex = code.indexOf('<div className="max-w-[1600px] mx-auto px-4 py-8">');
const endIndex = code.indexOf('</div>\n      {detailStock && currentView !== \'dashboard\' && (');
if(startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + routesJSX + '\n' + code.substring(endIndex + 6); // +6 to remove the </div> which is included in routesJSX
}

// 8. update {detailStock && activeViewName !== 'dashboard' ...
code = code.replace(/currentView !== 'dashboard'/g, "activeViewName !== 'dashboard'");

fs.writeFileSync('/home/xg/stock-screener/refactor_app_result.jsx', code);
console.log('Done refactoring app to refactor_app_result.jsx');
