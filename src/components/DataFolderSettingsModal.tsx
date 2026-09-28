import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderCheck,
  FolderSync,
  AlertTriangle,
  CheckCircle2,
  Download,
  Upload,
  ShieldCheck,
  HardDrive,
  FileSpreadsheet,
  FileCode,
  X,
  RefreshCw,
  Info,
  Check,
  FileCheck,
  Unlink,
} from 'lucide-react';
import { MonthlySheet } from '../types';
import {
  LocalFolderStatus,
  getLocalFolderStatus,
  selectLocalFolder,
  verifyAndRequestFolderAccess,
  disconnectLocalFolder,
  saveToLocalFolder,
  exportBackupJsonFile,
  validateBackupJson,
  mergeSheets,
  idbSaveAllSheets,
} from '../services/localPersistenceService';
import { downloadAllSheetsCsv } from '../utils/csvExporter';
import { saveSheet } from '../services/apiService';

interface DataFolderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheets: MonthlySheet[];
  matricola: string;
  onSheetsUpdated?: (updatedSheets: MonthlySheet[]) => void;
  profile?: any;
  overtimeCalc?: any;
  pecSettings?: any;
}

export const DataFolderSettingsModal: React.FC<DataFolderSettingsModalProps> = ({
  isOpen,
  onClose,
  sheets,
  matricola,
  onSheetsUpdated,
  profile,
  overtimeCalc,
  pecSettings,
}) => {
  const [folderStatus, setFolderStatus] = useState<LocalFolderStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Import validation dialog
  const [importFileContent, setImportFileContent] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [importMode, setImportMode] = useState<'MERGE' | 'REPLACE'>('MERGE');
  const [isImporting, setIsImporting] = useState(false);

  const refreshStatus = async () => {
    try {
      const s = await getLocalFolderStatus();
      setFolderStatus(s);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshStatus();
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showFeedback = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleSelectFolder = async () => {
    setIsLoading(true);
    try {
      const result = await selectLocalFolder();
      setFolderStatus(result);
      if (result.status === 'CONNECTED') {
        // Immediate initial atomic write to verify folder write access
        const success = await saveToLocalFolder(matricola, sheets, { profile, overtimeCalc, pecSettings });
        if (success) {
          showFeedback(`Cartella "${result.folderName}" collegata! I dati sono stati scritti con copia di sicurezza (.bak).`);
        } else {
          showFeedback(`Cartella "${result.folderName}" collegata, ma il primo salvataggio richiede autorizzazione.`, 'info');
        }
        await refreshStatus();
      }
    } catch (err: any) {
      showFeedback(err.message || 'Selezione cartella annullata o non riuscita.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAccess = async () => {
    setIsLoading(true);
    try {
      const result = await verifyAndRequestFolderAccess();
      setFolderStatus(result);
      if (result.status === 'CONNECTED') {
        const success = await saveToLocalFolder(matricola, sheets, { profile, overtimeCalc, pecSettings });
        if (success) {
          showFeedback('Accesso alla cartella verificato! File aggiornato con successo.');
        } else {
          showFeedback('Accesso verificato. Pronto per il salvataggio automatico.');
        }
        await refreshStatus();
      } else {
        showFeedback('Autorizzazione alla cartella non concessa. Ricollega la cartella per riattivare.', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'Errore durante la verifica dell\'accesso.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Vuoi davvero scollegare la cartella locale? I dati rimarranno comunque protetti nell\'archivio interno dell\'app.')) {
      return;
    }
    await disconnectLocalFolder();
    await refreshStatus();
    showFeedback('Cartella scollegata. I dati continueranno a essere salvati nella memoria interna.', 'info');
  };

  const handleSaveNowToFolder = async () => {
    setIsLoading(true);
    try {
      const ok = await saveToLocalFolder(matricola, sheets, { profile, overtimeCalc, pecSettings });
      if (ok) {
        showFeedback('Salvataggio completato nella cartella locale con copia di sicurezza (.bak.json)!');
        await refreshStatus();
      } else {
        showFeedback('Impossibile salvare nella cartella. Clicca su "Verifica accesso" per rinnovare le autorizzazioni.', 'error');
      }
    } catch (err: any) {
      showFeedback(`Errore di salvataggio: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportJson = () => {
    const filename = exportBackupJsonFile(matricola, sheets, { profile, overtimeCalc, pecSettings });
    showFeedback(`Backup esportato con successo nel file: ${filename}`);
  };

  const handleExportCsv = () => {
    downloadAllSheetsCsv(sheets);
    showFeedback('Registro straordinari esportato in formato CSV (apribile con Excel o Fogli)');
  };

  const handleFilePickedForImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportFileContent(text);
      const val = validateBackupJson(text);
      setValidationResult(val);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!validationResult || !validationResult.valid || !validationResult.payload) return;
    setIsImporting(true);

    try {
      const incomingSheets: MonthlySheet[] = validationResult.payload.sheets;
      let finalSheets: MonthlySheet[] = [];

      if (importMode === 'MERGE') {
        const mergeResult = mergeSheets(sheets, incomingSheets);
        finalSheets = mergeResult.merged;
      } else {
        if (!confirm('ATTENZIONE: Stai per sostituire tutti i dati attuali con quelli del backup. Confermi la sostituzione?')) {
          setIsImporting(false);
          return;
        }
        finalSheets = incomingSheets;
      }

      // Persist to IndexedDB
      await idbSaveAllSheets(matricola, finalSheets);

      // Persist to each sheet and try syncing to server
      for (const s of finalSheets) {
        await saveSheet(s);
      }

      if (onSheetsUpdated) {
        onSheetsUpdated(finalSheets);
      }

      showFeedback(
        `Ripristino completato! ${finalSheets.length} mesi importati e salvati in modo persistente.`
      );
      setImportFileContent(null);
      setValidationResult(null);
    } catch (err: any) {
      showFeedback(`Errore durante l'importazione: ${err.message}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const formatLastSave = (isoStr: string | null) => {
    if (!isoStr) return 'Nessun salvataggio recente';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <FolderSync className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                Salvataggio in Cartella Locale & Backup
              </h2>
              <p className="text-xs text-slate-300">
                Conserva i tuoi straordinari sul tuo smartphone o PC in sicurezza
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
          {/* Notification feedback */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-200'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-200'
                  : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/80 text-blue-800 dark:text-blue-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : statusMessage.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-medium">{statusMessage.text}</div>
            </div>
          )}

          {/* Section 1: Cartella Locale Automatica */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Folder className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Cartella Locale sul Dispositivo (Salvataggio Automatico)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Seleziona una cartella sul telefono o computer: ogni turno inserito o modificato viene salvato automaticamente in questa posizione.
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              {folderStatus && (
                <div>
                  {folderStatus.status === 'CONNECTED' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                      <span>Attiva</span>
                    </span>
                  )}
                  {folderStatus.status === 'PERMISSION_NEEDED' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                      <span>Richiede Permesso</span>
                    </span>
                  )}
                  {folderStatus.status === 'DISCONNECTED' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <span>Non collegata</span>
                    </span>
                  )}
                  {folderStatus.status === 'UNSUPPORTED' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                      <span>Modalità File Protetti</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Folder Details / State Box */}
            {folderStatus?.isSupported ? (
              <div className="space-y-3 pt-1">
                {folderStatus.folderName ? (
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="text-slate-500">Cartella selezionata:</span>
                      <span className="font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1">
                        📁 {folderStatus.folderName}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                      <span className="text-slate-500">Ultimo salvataggio riuscito:</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                        {formatLastSave(folderStatus.lastSaveTime)}
                      </span>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={handleVerifyAccess}
                        disabled={isLoading}
                        className="px-3 py-1.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Verifica accesso</span>
                      </button>

                      <button
                        onClick={handleSaveNowToFolder}
                        disabled={isLoading}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <FolderCheck className="w-3.5 h-3.5" />
                        <span>Salva adesso nella cartella</span>
                      </button>

                      <button
                        onClick={handleSelectFolder}
                        disabled={isLoading}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                      >
                        Cambia cartella
                      </button>

                      <button
                        onClick={handleDisconnect}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer font-bold flex items-center gap-1 ml-auto"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>Scollega</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-slate-600 dark:text-slate-400">
                      Nessuna cartella collegata attualmente. Clicca su &quot;Seleziona cartella dati&quot; per scegliere o creare una cartella dedicata (es. <em>Documenti/118_Straordinari</em>).
                    </p>
                    <button
                      onClick={handleSelectFolder}
                      disabled={isLoading}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl cursor-pointer flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
                    >
                      <Folder className="w-4 h-4" />
                      <span>Seleziona cartella dati</span>
                    </button>
                  </div>
                )}

                {/* Atomic write guarantee notice */}
                <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 rounded-xl space-y-1 text-[11px] text-emerald-900 dark:text-emerald-200">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Garanzia di Scrittura Atomica e Copia di Recupero (.bak)</span>
                  </div>
                  <p>
                    Prima di aggiornare il file, l&apos;applicazione scrive su un file temporaneo <code>dati_straordinari_118.tmp.json</code>, ne verifica l&apos;integrità, conserva la copia precedente come <code>dati_straordinari_118.bak.json</code> e infine sostituisce il file principale. In caso di interruzione, la versione precedente è sempre recuperabile.
                  </p>
                </div>
              </div>
            ) : (
              /* Unsupported Browser / iOS Notice */
              <div className="space-y-3 p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-blue-950 dark:text-blue-200">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span>Nota sulla piattaforma iOS / Safari / WebKit</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  I dispositivi Apple iOS (iPhone/iPad) e alcuni browser non consentono alle applicazioni web l&apos;accesso automatico continuativo a cartelle arbitrarie del file system per motivi di sandbox di sicurezza.
                </p>
                <p className="text-[11px] leading-relaxed">
                  <strong>I tuoi dati sono comunque al 100% protetti e salvati in modo permanente</strong> nell&apos;archivio interno del dispositivo (IndexedDB + Storage locale persistente). Puoi salvare copie su file in qualunque momento usando il comando <strong>&quot;Esporta backup in File&quot;</strong> qui sotto.
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Backup Manuale in File Esterno (Esporta / Importa) */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Backup Esterno in File (JSON con Data e Ora)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  L&apos;archivio interno del browser può essere cancellato con la cronologia: crea regolarmente una copia esterna sul telefono.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={handleExportJson}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer flex items-center gap-2 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Esporta backup (.JSON)</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-2"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Esporta registro (.CSV)</span>
              </button>

              <label className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>Importa backup da File</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFilePickedForImport}
                  className="hidden"
                />
              </label>
            </div>

            {/* Validation & Import Confirmation Box */}
            {validationResult && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span>Verifica File di Backup</span>
                  </div>
                  <button
                    onClick={() => {
                      setValidationResult(null);
                      setImportFileContent(null);
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>

                {validationResult.valid ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-900 dark:text-emerald-200 border border-emerald-200 text-[11px] space-y-1">
                      <div className="font-bold">{validationResult.message}</div>
                      <div>Matricola registrata nel backup: <strong>{validationResult.matricola}</strong></div>
                      <div>Data esportazione backup: <strong>{validationResult.exportedAt}</strong></div>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                        Modalità di ripristino:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label
                          className={`p-3 rounded-lg border cursor-pointer flex items-start gap-2 ${
                            importMode === 'MERGE'
                              ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'MERGE'}
                            onChange={() => setImportMode('MERGE')}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="font-bold block text-slate-900 dark:text-white">Unisci ai dati attuali</span>
                            <span className="text-[10px] text-slate-500">
                              Consigliato: conserva tutti i turni attuali e aggiunge quelli del file senza duplicati.
                            </span>
                          </div>
                        </label>

                        <label
                          className={`p-3 rounded-lg border cursor-pointer flex items-start gap-2 ${
                            importMode === 'REPLACE'
                              ? 'border-rose-600 bg-rose-50/50 dark:bg-rose-950/30'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'REPLACE'}
                            onChange={() => setImportMode('REPLACE')}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="font-bold block text-rose-700 dark:text-rose-300">Sostituisci tutto</span>
                            <span className="text-[10px] text-slate-500">
                              Sostituisce completamente i registri attuali con quelli del file.
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => {
                          setValidationResult(null);
                          setImportFileContent(null);
                        }}
                        className="px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={handleConfirmImport}
                        disabled={isImporting}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5"
                      >
                        {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>Conferma e Ripristina Backup</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-lg text-rose-800 dark:text-rose-200 border border-rose-200 text-[11px]">
                    <div className="font-bold">File non valido:</div>
                    <p>{validationResult.message}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            S.E.T. 118 Taranto · Protezione e Conservazione Dati
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
