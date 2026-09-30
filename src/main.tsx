import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tokens.css';

window.addEventListener('error', (e) => {
  console.error('Application Error:', e.error || e.message);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled Promise Rejection:', e.reason);
});

// Disable right-click context menu globally across the app
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
