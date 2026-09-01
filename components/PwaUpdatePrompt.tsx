import React, { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Update and offline-readiness UX for the service worker.
 *
 * The worker is registered with `registerType: 'prompt'`, so a new build waits
 * until the user accepts it. That matters here: reloading mid-conversation would
 * discard whatever the user is in the middle of asking.
 */
const PwaUpdatePrompt: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);

  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('SebilLink: service worker registration failed.', error);
    },
  });

  if (dismissed || (!needRefresh && !offlineReady)) return null;

  const isUpdate = needRefresh;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 px-4 w-full max-w-md"
    >
      <div className="flex items-center gap-4 px-5 py-4 bg-white/90 dark:bg-neutral-card/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-2xl shadow-2xl">
        <i
          className={`fas ${isUpdate ? 'fa-arrows-rotate' : 'fa-wifi'} text-scholar-gold`}
          aria-hidden="true"
        />

        <p className="flex-1 text-[10px] font-black uppercase tracking-widest text-neutral-900 dark:text-white">
          {isUpdate ? 'A new version is ready' : 'Ready to work offline'}
        </p>

        {isUpdate && (
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="px-4 py-2 bg-scholar-gold text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity"
          >
            Reload
          </button>
        )}

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={isUpdate ? 'Update later' : 'Dismiss'}
          className="px-2 py-2 text-scholar-muted rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity"
        >
          {isUpdate ? 'Later' : <i className="fas fa-xmark" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
};

export default PwaUpdatePrompt;
