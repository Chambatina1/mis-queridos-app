'use client';

import { useEffect, useState } from 'react';

export default function PWARegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Register SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!localStorage.getItem('mis-queridos-install-dismissed')) {
        setShowBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setShowBanner(false);
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setShowBanner(false);
    localStorage.setItem('mis-queridos-install-dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t-2 border-orange-300 shadow-2xl">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        <div className="flex-1">
          <p className="text-lg font-bold text-[#9A3412]">Instalar App</p>
          <p className="text-sm text-[#9A3412]/60">
            Agrega a tu pantalla de inicio. Se abre como app real.
          </p>
        </div>
        <button onClick={dismiss} className="px-4 py-3 text-sm text-[#9A3412]/50 font-semibold">
          Despues
        </button>
        <button
          onClick={handleInstall}
          className="px-5 py-3 bg-orange-500 text-white rounded-2xl font-bold text-base shadow-lg active:scale-95 transition-transform"
        >
          Instalar
        </button>
      </div>
    </div>
  );
}
