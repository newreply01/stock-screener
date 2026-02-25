console.log("main.jsx: Execution started");
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'

console.log("main.jsx: About to create root");
const rootElement = document.getElementById('root');
console.log("main.jsx: Root element:", rootElement);

if (!rootElement) {
  console.error("main.jsx: #root element NOT FOUND!");
} else {
  try {
    const root = createRoot(rootElement);
    console.log("main.jsx: Root created, about to render");
    root.render(
      <StrictMode>
        <AuthProvider>
          <App />
        </AuthProvider>
      </StrictMode>,
    );
    console.log("main.jsx: Render call completed");
  } catch (err) {
    console.error("main.jsx: Mounting error:", err);
  }
}
