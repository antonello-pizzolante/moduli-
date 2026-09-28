import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  WifiOff,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { subscribeSyncStatus, getSyncStatus, updateSyncStatus } from '../services/apiService';
import { MonthlySheet, SyncState } from '../types';

interface SyncStatusBadgeProps {
  onResolveConflict?: (serverSheet: MonthlySheet) => void;
  onRetrySave?: () => void;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  onResolveConflict,
  onRetrySave,
}) => {
  const [status, setStatus] = useState(getSyncStatus());
  const [showConflictModal, setShowConflictModal] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((newStatus) => {
      setStatus(newStatus);
      if (newStatus.conflict) {
        setShowConflictModal(true);
      }
    });
    return unsubscribe;
  }, []);

  const formatServerTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <>
      <div className="inline-flex items-center text-xs font-medium transition-all select-none">
        {status.state === 'SAVING' && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 shadow-2xs">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400" />
            <span className="font-semibold">Salvataggio in corso...</span>
          </div>
        )}

        {status.state === 'SAVED_ONLINE' && (
          <div
            title={`Confermato dal server alle ${formatServerTime(status.lastConfirmedServerTime)}`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 shadow-2xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold">
              Sincronizzato online{' '}
              <span className="font-mono text-[10px] opacity-85">
                ({formatServerTime(status.lastConfirmedServerTime)})
              </span>
            </span>
          </div>
        )}

        {status.state === 'OFFLINE_LOCAL' && (
          <div
            title="Connessione assente o instabile: i dati sono protetti nella memoria interna (IndexedDB) e nella cartella locale, in attesa di sincronizzazione."
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-800 shadow-2xs"
          >
            <WifiOff className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium">Salvato sul dispositivo (in attesa di sincronizzazione)</span>
          </div>
        )}

        {status.state === 'SAVE_FAILED' && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span className="font-semibold">Errore di salvataggio</span>
            {onRetrySave && (
              <button
                onClick={onRetrySave}
                className="ml-1 underline font-bold cursor-pointer hover:text-rose-950 dark:hover:text-white"
              >
                Riprova
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modale Conflitto di Concorrenza (modifiche contemporanee da altro dispositivo) */}
      {showConflictModal && status.serverSheet && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Rilevata modifica contemporanea da un altro dispositivo
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Questo prospetto ({status.serverSheet.nomeMese}) è stato modificato e salvato da un altro terminale o scheda con una versione più recente (Revisione #{status.serverSheet.version}).
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Ultimo salvataggio sul server:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {new Date(status.serverSheet.updatedAt).toLocaleString('it-IT')}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Numero turni sul server:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {status.serverSheet.entries ? status.serverSheet.entries.length : 0} turni
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Totale complessivo ore server:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {status.serverSheet.totaleOreComplessivoFormatted || '0h 00m'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Per evitare sovrascritture accidentali o perdita del lavoro di un collega, ti consigliamo di caricare la versione aggiornata dal server.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowConflictModal(false);
                  updateSyncStatus({
                    state: 'SAVED_ONLINE',
                    lastConfirmedServerTime: new Date().toISOString(),
                    message: 'Bozza locale mantenuta',
                  });
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Mantieni bozza di questo dispositivo
              </button>
              <button
                onClick={() => {
                  if (onResolveConflict && status.serverSheet) {
                    onResolveConflict(status.serverSheet);
                  }
                  setShowConflictModal(false);
                  updateSyncStatus({
                    state: 'SAVED_ONLINE',
                    lastConfirmedServerTime: status.serverSheet?.updatedAt || new Date().toISOString(),
                    message: 'Sincronizzato con il server',
                  });
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Aggiorna con la versione del Server
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
