import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      console.log('[PWA] New content available, please refresh');
    },
    onOfflineReady() {
      console.log('[PWA] App ready to work offline');
    },
    immediate: true
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
