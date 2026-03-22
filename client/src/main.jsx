import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { GlobalFilterProvider } from './context/GlobalFilterContext'
import ErrorBoundary from './components/ErrorBoundary'

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('[main.jsx] #root element not found! Check index.html.');
} else {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <BrowserRouter>
        <ErrorBoundary>
          <AuthProvider>
            <GlobalFilterProvider>
              <App />
            </GlobalFilterProvider>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </StrictMode>,
  );
}
