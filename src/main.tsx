import React from 'react';
import ReactDOM from 'react-dom/client';
import { StrataThemeProvider } from '@aerovex/strata-ui';
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

import { getMediaServerPort } from './lib/ipc';

const rootEl = document.getElementById('root');
if (rootEl) {
  const mountApp = () => {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <StrataThemeProvider theme="aerovex" preset="vexview">
          <App />
        </StrataThemeProvider>
      </React.StrictMode>,
    );
  };

  // Eagerly resolve media server port so video playback can immediately stream via HTTP without URL switching
  getMediaServerPort()
    .catch(() => {})
    .finally(() => {
      mountApp();
    });
}

