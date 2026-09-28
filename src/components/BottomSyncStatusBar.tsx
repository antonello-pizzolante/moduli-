import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderCheck,
  AlertTriangle,
  HardDrive,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { SyncStatusBadge } from './SyncStatusBadge';
import { LocalFolderStatus, getLocalFolderStatus } from '../services/localPersistenceService';

interface BottomSyncStatusBarProps {
  onOpenFolderSettings: () => void;
  onRetrySync?: () => void;
}

export const BottomSyncStatusBar: React.FC<BottomSyncStatusBarProps> = ({
  onOpenFolderSettings,
  onRetrySync,
}) => {
  const [folderStatus, setFolderStatus] = useState<LocalFolderStatus | null>(null);

  const refreshStatus = async () => {
    try {
      const s = await getLocalFolderStatus();
      setFolderStatus(s);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const formatShortTime = (isoStr: string | null) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="no-print bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-2 sm:px-4 text-xs transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5">
        {/* Left: Real-time Save & Sync Status (Requested: "metti in basso quel salvato online") */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 w-full md:w-auto">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:inline">
            Stato Dati:
          </span>
          <SyncStatusBadge onRetrySave={onRetrySync} />
        </div>

        {/* Right: Local Folder & External Backup controls */}
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 w-full md:w-auto">
          {folderStatus?.status === 'CONNECTED' ? (
            <button
              onClick={onOpenFolderSettings}
              title={`Cartella locale attiva: ${folderStatus.folderName}. Ultimo salvataggio: ${folderStatus.lastSaveTime || 'recente'}`}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-semibold transition-colors cursor-pointer"
            >
              <FolderCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate max-w-[180px] sm:max-w-xs font-mono font-bold">
                📁 {folderStatus.folderName}
              </span>
              {folderStatus.lastSaveTime && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400/90 font-normal">
                  ({formatShortTime(folderStatus.lastSaveTime)})
                </span>
              )}
            </button>
          ) : folderStatus?.status === 'PERMISSION_NEEDED' ? (
            <button
              onClick={onOpenFolderSettings}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[11px] font-bold transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Cartella: Verifica accesso</span>
            </button>
          ) : (
            <button
              onClick={onOpenFolderSettings}
              title="Configura una cartella sul telefono per il salvataggio automatico o esporta un backup"
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
            >
              <Folder className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Seleziona cartella dati</span>
            </button>
          )}

          {/* Quick Button for Full Backup & Settings */}
          <button
            onClick={onOpenFolderSettings}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold transition-colors cursor-pointer"
            title="Apri pannello salvataggio, cartella dati e backup"
          >
            <HardDrive className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Backup & Cartella</span>
          </button>
        </div>
      </div>
    </div>
  );
};
