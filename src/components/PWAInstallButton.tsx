import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed standalone PWA, hide button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        title="Installa applicazione S.E.T. 118 sul dispositivo"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
      >
        <Download className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
        <span className="hidden sm:inline">Installa App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          title="Installa su iPhone o iPad"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
        >
          <Smartphone className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          <span className="hidden sm:inline">Installa su iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-rose-600">
                  <Smartphone className="w-5 h-5" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Installa su iPhone / iPad
                  </h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Per consultare e usare comodamente l&apos;app a schermo intero come un&apos;applicazione nativa:
                </p>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-rose-600">1.</span>
                    <span>Tocca l&apos;icona di <strong>Condivisione</strong> in Safari (la freccia verso l&apos;alto).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-rose-600">2.</span>
                    <span>Scorri il menu verso il basso e tocca <strong>&quot;Aggiungi a schermata Home&quot;</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-rose-600">3.</span>
                    <span>Tocca <strong>&quot;Aggiungi&quot;</strong> in alto a destra.</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-slate-900 dark:bg-slate-700 py-2.5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
              >
                Ho Capito
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
