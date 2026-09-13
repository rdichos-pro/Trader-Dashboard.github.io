import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely suppress harmless third-party / cross-origin iframe script errors
window.addEventListener('error', (event) => {
  if (
    event.message === 'Script error.' ||
    (typeof event.filename === 'string' && (event.filename.includes('tradingview') || event.filename.includes('google')))
  ) {
    event.preventDefault();
    return true;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && typeof event.reason.message === 'string' && event.reason.message.includes('Script error.')) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
