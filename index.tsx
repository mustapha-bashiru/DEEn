import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import PwaUpdatePrompt from './components/PwaUpdatePrompt';
import { reportEnvIssues, validateEnv } from './config/env';
import { migrateLegacyStorageKeys } from './config/storage';
import './index.css';

// Both run before mount: configuration problems should surface as one clear
// message at startup rather than as a confusing failure inside a feature, and the
// app must read migrated storage keys on its very first render.
reportEnvIssues(validateEnv());
migrateLegacyStorageKeys();

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found. Ensure <div id="root"></div> exists in index.html');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
    <PwaUpdatePrompt />
  </React.StrictMode>,
);
