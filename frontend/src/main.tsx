import './styles/index.css';
// Initialize i18next before <App /> renders so the first paint already has
// the resolved language. This is a side-effect import — the module's top-level
// i18n.use().init() runs synchronously here.
import '@/i18n';

import * as React from 'react';
import ReactDOM from 'react-dom/client';

import App from '@/app';
import { reloadOnce } from '@/lib/chunk-reload';

// Vite fires this when a code-split chunk fails to load — almost always a redeploy
// that rotated the hashed filenames this document still references. Reload once to
// pull the current build; RouteErrorBoundary is the fallback for failures that
// bypass this event, and both share reloadOnce's debounce so at most one fires.
window.addEventListener('vite:preloadError', () => {
    reloadOnce();
});

ReactDOM.createRoot(document.querySelector('#root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
