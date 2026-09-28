import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Calendar,
  CheckCircle2,
  FileText,
  Upload,
  RefreshCw,
  Plus,
  Trash2,
  ChevronRight,
  ShieldCheck,
  FileSpreadsheet,
  FileCheck,
  History,
  Archive,
  AlertTriangle,
  RotateCcw,
  HardDrive,
  Info,
  Clock,
  Key,
  FolderOpen,
  FileCode,
  FilePlus,
  Check,
} from 'lucide-react';
import {
  MonthlySheet,
  StorageFileRecord,
  SheetVersionSnapshot,
  FileCategory,
} from '../types';
import { downloadPdf } from '../utils/pdfGenerator';
import { downloadSheetCsv, downloadAllSheetsCsv } from '../utils/csvExporter';
import {
  fetchStorageFiles,
  uploadStorageFile,
  downloadStorageFile,
  verifyStorageFileHash,
  deleteStorageFile,
  fetchTrash,
  restoreTrashItem,
  deletePermanentTrashItem,
  emptyAllTrash,
  fetchSheetVersions,
  restoreSheetVersion,
  exportFullBackupZip,
  migrateLocalDataToServer,
  saveSheet,
} from '../services/apiService';
import {
  exportBackupJsonFile,
  validateBackupJson,
  idbSaveAllSheets,
  mergeSheets,
  getLocalFolderStatus,
  selectLocalFolder,
  verifyAndRequestFolderAccess,
  LocalFolderStatus,
} from '../services/localPersistenceService';

interface PrivateArchiveManagerProps {
  sheets: MonthlySheet[];
  currentSheetId: string;
  onSelectSheet: (sheetId: string) => void;
  onCreateNewMonth: (year: number, month: number) => void;
  onDeleteSheet: (sheetId: string) => void;
  onReloadAll: () => void;
  onOpenFolderSettings?: () => void;
}

type TabType = 'sheets' | 'files' | 'trash' | 'backup';

export const PrivateArchiveManager: React.FC<PrivateArchiveManagerProps> = ({
  sheets,
  currentSheetId,
  onSelectSheet,
  onCreateNewMonth,
  onDeleteSheet,
  onReloadAll,
  onOpenFolderSettings,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('sheets');
  const [files, setFiles] = useState<StorageFileRecord[]>([]);
  const [trashData, setTrashData] = useState<{
    files: StorageFileRecord[];
    sheets: Array<{ id: string; title: string; deletedAt: string; trashExpiresAt: string; item: any }>;
  }>({ files: [], sheets: [] });
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Folder status
  const [folderStatus, setFolderStatus] = useState<LocalFolderStatus | null>(null);
  useEffect(() => {
    getLocalFolderStatus().then(setFolderStatus).catch(() => {});
  }, [activeTab]);

  // New month modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(10);

  // History / Versioning modal
  const [versionModalSheetId, setVersionModalSheetId] = useState<string | null>(null);
  const [sheetVersions, setSheetVersions] = useState<SheetVersionSnapshot[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // Hash verification feedback
  const [hashResult, setHashResult] = useState<{ fileId: string; intact: boolean; hash: string } | null>(null);

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<FileCategory>('DOCUMENTO');
  const [uploadDesc, setUploadDesc] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const showMsg = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const flist = await fetchStorageFiles();
      setFiles(flist);
    } catch {
      // ignore
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const loadTrash = async () => {
    try {
      const t = await fetchTrash();
      setTrashData({ files: t.files || [], sheets: t.sheets || [] });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (activeTab === 'files') {
      loadFiles();
    } else if (activeTab === 'trash') {
      loadTrash();
    }
  }, [activeTab]);

  const handleOpenVersions = async (sheetId: string) => {
    setVersionModalSheetId(sheetId);
    setIsLoadingVersions(true);
    try {
      const v = await fetchSheetVersions(sheetId);
      setSheetVersions(v);
    } catch {
      setSheetVersions([]);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleRestoreVersion = async (sheetId: string, vNum: number) => {
    if (!confirm(`Sei sicuro di voler ripristinare la Revisione #${vNum}? Una copia della versione attuale verrà comunque conservata nello storico.`)) {
      return;
    }
    try {
      await restoreSheetVersion(sheetId, vNum);
      showMsg(`Versione #${vNum} ripristinata con successo!`);
      setVersionModalSheetId(null);
      onReloadAll();
    } catch (err: any) {
      showMsg(err.message || 'Errore ripristino versione', 'error');
    }
  };

  const handleVerifyHash = async (file: StorageFileRecord) => {
    try {
      const res = await verifyStorageFileHash(file.id);
      setHashResult({ fileId: file.id, intact: res.intact, hash: res.storedHash });
      showMsg(res.message, res.intact ? 'success' : 'error');
    } catch (err: any) {
      showMsg(err.message, 'error');
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Vuoi spostare questo file nel Cestino? Potrai ripristinarlo entro 30 giorni.')) return;
    try {
      await deleteStorageFile(fileId);
      showMsg('File spostato nel Cestino (conservazione 30 giorni).');
      loadFiles();
    } catch (err: any) {
      showMsg(err.message, 'error');
    }
  };

  const handleRestoreTrash = async (id: string) => {
    try {
      await restoreTrashItem(id);
      showMsg('Elemento ripristinato con successo nell\'archivio operativo!');
      loadTrash();
      onReloadAll();
    } catch (err: any) {
      showMsg(err.message, 'error');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm('ATTENZIONE: Eliminazione definitiva e irreversibile. Confermi?')) return;
    try {
      await deletePermanentTrashItem(id);
      showMsg('Elemento eliminato definitivamente.');
      loadTrash();
    } catch (err: any) {
      showMsg(err.message, 'error');
    }
  };

  const handleEmptyAllTrash = async () => {
    if (!confirm('ATTENZIONE: Stai per svuotare l\'intero cestino eliminando definitivamente tutti i file e i prospetti presenti. Continuare?')) return;
    try {
      await emptyAllTrash();
      showMsg('Cestino svuotato.');
      loadTrash();
    } catch (err: any) {
      showMsg(err.message, 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Il file supera la dimensione massima consentita di 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsUploading(true);
        const base64Data = (event.target?.result as string).split(',')[1];
        const res = await uploadStorageFile({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data,
          category: uploadCategory,
          description: uploadDesc,
        });
        showMsg(res.message);
        setShowUploadModal(false);
        setUploadDesc('');
        loadFiles();
      } catch (err: any) {
        showMsg(err.message, 'error');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExportFullZip = async () => {
    try {
      showMsg('Generazione archivio ZIP con database, documenti e checksums in corso...', 'info');
      await exportFullBackupZip();
      showMsg('Archivio ZIP completo scaricato con successo!');
    } catch (err: any) {
      showMsg(err.message, 'error');
    }
  };

  const handleExportJson = () => {
    try {
      const filename = exportBackupJsonFile(currentSheetId || '118', sheets);
      showMsg(`Backup JSON esportato con successo nel file: ${filename}`);
    } catch {
      showMsg('Errore esportazione backup JSON', 'error');
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const val = validateBackupJson(text);
        if (!val.valid || !val.payload) {
          showMsg(val.message, 'error');
          return;
        }

        const confirmMsg = `File di backup verificato (${val.sheetsCount} mesi, ${val.entriesCount} turni totali).\n\nVuoi unire questi registri ai dati attuali senza duplicati e senza perdere turni?`;
        if (!confirm(confirmMsg)) {
          return;
        }

        const mergedResult = mergeSheets(sheets, val.payload.sheets);
        await idbSaveAllSheets(val.matricola || '118', mergedResult.merged);
        for (const s of mergedResult.merged) {
          await saveSheet(s);
        }
        showMsg(`Ripristino completato con successo! ${mergedResult.merged.length} prospetti mensili aggiornati.`);
        onReloadAll();
      } catch (err: any) {
        showMsg(`Errore lettura file di backup: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateNewMonth(selectedYear, selectedMonth);
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Banner Notifica */}
      {message && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : message.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
          }`}
        >
          {message.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          {message.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
          {message.type === 'info' && <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Header Archivio Privato */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-slate-800 border border-slate-700 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Archive className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Sanitaservice ASL TA · S.E.T. 118
              </span>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 font-mono">
                Isolamento Utente Attivo
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
              Archivio Privato Dipendente & Backup
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Conservazione persistente sul server di registri turni, PDF ufficiali, ricevute PEC e allegati giustificativi
            </p>
          </div>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('sheets')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'sheets'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Prospetti ({sheets.length})
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'files'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            File & Ricevute PEC
          </button>
          <button
            onClick={() => setActiveTab('trash')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'trash'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Cestino (30gg)
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'backup'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Backup & Ripristino
          </button>
        </div>
      </div>

      {/* TAB 1: PROSPETTI MENSILI */}
      {activeTab === 'sheets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-slate-500">
              Tutti i prospetti sono sincronizzati e accessibili accedendo da qualsiasi altro dispositivo con la tua matricola.
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-lg cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuovo Mese</span>
              </button>
              <button
                onClick={() => downloadAllSheetsCsv(sheets)}
                title="Esporta tutti i prospetti mensili in CSV"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded-lg border border-emerald-200 dark:border-emerald-800 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Backup Tutti (CSV)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sheets.map((s) => {
              const isCurrent = s.id === currentSheetId;
              const entriesCount = s.entries ? s.entries.length : 0;
              const ver = s.version || 1;

              return (
                <div
                  key={s.id}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 transition-all shadow-xs relative flex flex-col justify-between ${
                    isCurrent
                      ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-md'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{s.nomeMese}</h3>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          v{ver}
                        </span>

                        {s.status === 'INVIATO_PEC' ? (
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            Inviato PEC
                          </span>
                        ) : entriesCount > 0 ? (
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                            Pronto ({entriesCount})
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400">Vuoto</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mb-3 font-mono">
                      <div className="flex justify-between">
                        <span className="font-sans text-slate-500">Monte Ore:</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {s.totaleOreMonteOreFormatted || '0h 00m'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-sans text-slate-500">Straordinario:</span>
                        <span className="font-bold text-teal-600 dark:text-teal-400">
                          {s.totaleOreStraordinarioFormatted || '0h 00m'}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1 font-sans font-bold text-slate-900 dark:text-white">
                        <span>Totale:</span>
                        <span className="font-mono">{s.totaleOreComplessivoFormatted || '0h 00m'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <button
                      onClick={() => onSelectSheet(s.id)}
                      className={`px-3 py-1.5 font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                        isCurrent
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <span>{isCurrent ? 'Attivo' : 'Apri'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenVersions(s.id)}
                        title="Storico versioni e ripristino revisioni precedenti"
                        className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                      >
                        <History className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => downloadSheetCsv(s)}
                        title="Esporta CSV di questo mese"
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => downloadPdf(s)}
                        title="Scarica PDF compilato"
                        className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onDeleteSheet(s.id)}
                        title="Sposta nel Cestino (conservazione 30 giorni)"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: FILE & RICEVUTE PEC */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-xs text-slate-600 dark:text-slate-400 block font-medium">
                Archivio protetto sul server per PDF generati, ricevute PEC originali (.eml, .xml, .pdf) e allegati.
              </span>
              <span className="text-[11px] text-slate-400">
                Nessun link pubblico permanente: ogni download richiede token temporaneo autorizzato.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadFiles}
                className="p-2 text-slate-500 hover:text-slate-700 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                title="Ricarica elenco file"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 rounded-lg cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Carica Allegato / Ricevuta</span>
              </button>
            </div>
          </div>

          {files.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <FolderOpen className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nessun file archiviato</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Quando invii una PEC o carichi un giustificativo di turno, i file PDF e le ricevute verranno memorizzati automaticamente qui con la loro firma crittografica SHA-256.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Documento</th>
                      <th className="px-4 py-3">Categoria</th>
                      <th className="px-4 py-3">Dimensione</th>
                      <th className="px-4 py-3">Firma SHA-256</th>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {files.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {f.nomeOriginale}
                              </span>
                              {f.descrizione && (
                                <span className="text-[10px] text-slate-400 block">{f.descrizione}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {f.categoria}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {(f.sizeBytes / 1024).toFixed(1)} KB
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-mono text-[10px]">
                            <span title={f.sha256Hash} className="truncate max-w-[120px] inline-block">
                              {f.sha256Hash.slice(0, 12)}...
                            </span>
                            <button
                              onClick={() => handleVerifyHash(f)}
                              title="Verifica integrità SHA-256 su disco"
                              className="text-emerald-600 hover:text-emerald-700 cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {new Date(f.createdAt).toLocaleDateString('it-IT')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => downloadStorageFile(f.id, f.nomeOriginale)}
                              title="Download protetto autorizzato"
                              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteFile(f.id)}
                              title="Sposta nel Cestino (30 giorni)"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CESTINO (RETENTION 30 GIORNI) */}
      {activeTab === 'trash' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                Gli elementi rimangono nel cestino per <strong>30 giorni</strong> con possibilità di ripristino prima dell&apos;eliminazione definitiva.
              </span>
            </div>

            {(trashData.files.length > 0 || trashData.sheets.length > 0) && (
              <button
                onClick={handleEmptyAllTrash}
                className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-800 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Svuota Cestino</span>
              </button>
            )}
          </div>

          {trashData.files.length === 0 && trashData.sheets.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Il cestino è vuoto</p>
              <p className="text-xs text-slate-400">Nessun documento o prospetto eliminato di recente.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {trashData.sheets.map((ts) => (
                <div key={ts.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{ts.title}</span>
                      <span className="text-[10px] text-slate-400">
                        Eliminato il {new Date(ts.deletedAt).toLocaleDateString('it-IT')} · Scadenza:{' '}
                        {new Date(ts.trashExpiresAt).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestoreTrash(ts.id)}
                      className="px-3 py-1.5 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Ripristina</span>
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(ts.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                      title="Elimina definitivamente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {trashData.files.map((tf) => (
                <div key={tf.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{tf.nomeOriginale}</span>
                      <span className="text-[10px] text-slate-400">
                        Eliminato il {new Date(tf.deletedAt!).toLocaleDateString('it-IT')} · Conservazione garantita 30 giorni
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestoreTrash(tf.id)}
                      className="px-3 py-1.5 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Ripristina</span>
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(tf.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                      title="Elimina definitivamente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BACKUP, ESPORTAZIONE & TRASPARENZA */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Box Cartella Locale Automatica */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Cartella Locale sul Dispositivo (Salvataggio Continuo)</span>
                    {folderStatus?.status === 'CONNECTED' && (
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        Attiva
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Salva automaticamente ogni modifica in una cartella scelta sul tuo telefono o PC, con scrittura atomica e copia di sicurezza (.bak).
                  </p>
                </div>
              </div>

              {onOpenFolderSettings && (
                <button
                  type="button"
                  onClick={onOpenFolderSettings}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl font-bold text-xs border border-emerald-300 dark:border-emerald-800 cursor-pointer"
                >
                  Gestisci Cartella →
                </button>
              )}
            </div>

            {folderStatus?.folderName && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>Cartella attiva: <strong className="font-mono text-slate-900 dark:text-white">📁 {folderStatus.folderName}</strong></span>
                <span className="text-slate-500 text-[11px]">
                  Ultimo salvataggio: {folderStatus.lastSaveTime ? new Date(folderStatus.lastSaveTime).toLocaleString('it-IT') : 'recente'}
                </span>
              </div>
            )}
          </div>

          {/* Box Esportazione Completa ZIP */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Backup Completo (Database + File PDF + Checksums SHA-256)
                </h3>
                <p className="text-xs text-slate-500">
                  Un backup del solo database non è sufficiente se i documenti sono archiviati sul server: questo pacchetto ZIP include tutti i file originali e le ricevute.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap pt-2">
              <button
                onClick={handleExportFullZip}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Scarica Backup Completo (.ZIP)</span>
              </button>

              <button
                onClick={handleExportJson}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-2"
              >
                <FileCode className="w-4 h-4" />
                <span>Esporta Solo Database (.JSON)</span>
              </button>

              <label className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <span>Ripristina da Backup (.JSON)</span>
                <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
              </label>
            </div>
          </div>

          {/* Scheda di Trasparenza sulle Politiche di Backup e Conservazione */}
          <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Informativa Trasparente su Backup, RPO, RTO e Conservazione</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block">RPO (Perdita Dati Max)</span>
                <span className="text-emerald-600 font-mono font-bold text-sm block">24 Ore</span>
                <p className="text-[11px] text-slate-500">
                  Consigliata l&apos;esportazione o sincronizzazione al termine di ogni turno lavorativo 118.
                </p>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block">RTO (Tempo di Ripristino)</span>
                <span className="text-blue-600 font-mono font-bold text-sm block">&lt; 15 Minuti</span>
                <p className="text-[11px] text-slate-500">
                  Ripristino immediato tramite l&apos;endpoint collaudato `/api/restore` e archivio ZIP.
                </p>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block">Durata Cestino</span>
                <span className="text-amber-600 font-mono font-bold text-sm block">30 Giorni</span>
                <p className="text-[11px] text-slate-500">
                  I registri e i documenti cancellati rimangono recuperabili per un mese intero.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-1.5 text-amber-950 dark:text-amber-200/90 text-xs">
              <p className="font-bold">⚠️ CHIARIMENTO GIURIDICO IMPORTANTE:</p>
              <p>
                Questo archivio garantisce backup operativo, integrità crittografica e sincronizzazione tra dispositivi, ma <strong>NON costituisce un servizio di &quot;Conservazione a Norma&quot; accreditata AgID</strong> (art. 44 del Codice dell&apos;Amministrazione Digitale).
                <br />
                La conservazione sostitutiva a norma di legge con marca temporale e firma qualificata richiede l&apos;attivazione di un servizio conservatore esterno certificato (es. Aruba PEC Conservazione / DocFly).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Storico Versioni Prospetto */}
      {versionModalSheetId && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Storico Revisioni ({versionModalSheetId})
                </h3>
              </div>
              <button
                onClick={() => setVersionModalSheetId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 text-xs">
              {isLoadingVersions ? (
                <div className="p-8 text-center text-slate-400">Caricamento revisioni...</div>
              ) : sheetVersions.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  Nessuna versione precedente registrata per questo prospetto.
                </div>
              ) : (
                sheetVersions.map((v, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block font-mono">
                        Revisione #{v.version}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Salvata il {new Date(v.savedAt).toLocaleString('it-IT')} · Turni: {v.sheet.entries?.length || 0}
                      </span>
                    </div>

                    <button
                      onClick={() => handleRestoreVersion(versionModalSheetId, v.version)}
                      className="px-3 py-1.5 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                    >
                      Ripristina
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Upload File */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Archivia File o Ricevuta PEC
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="p-1 rounded-lg text-slate-400">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Categoria File</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as FileCategory)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                >
                  <option value="DOCUMENTO">Documento Ufficiale</option>
                  <option value="RICEVUTA_ACCETTAZIONE">Ricevuta di Accettazione PEC</option>
                  <option value="RICEVUTA_CONSEGNA">Ricevuta di Consegna PEC</option>
                  <option value="GIUSTIFICATIVO">Giustificativo di Turno / Ordine di Servizio</option>
                  <option value="CAMBIO_TURNO">Modulo Cambio Turno Firmato</option>
                  <option value="PERMESSI_TIMBRATURA">Richiesta Permesso / Timbratura</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Descrizione / Note (opzionale)</label>
                <input
                  type="text"
                  placeholder="Es. Ricevuta consegna invio settembre 2026"
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                >
                </input>
              </div>

              <div>
                <label className="block font-semibold mb-1">Seleziona File (Max 10 MB - PDF, EML, XML, P7M, JPG)</label>
                <input
                  type="file"
                  accept=".pdf,.eml,.xml,.p7m,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
                />
              </div>

              {isUploading && <p className="text-center font-bold text-emerald-600">Caricamento e calcolo hash SHA-256...</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuovo Mese */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Crea Prospetto per un Nuovo Mese</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Anno</label>
                <input
                  type="number"
                  min="2020"
                  max="2035"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Mese</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                >
                  {[
                    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
                  ].map((mName, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {mName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-2 text-slate-500 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg cursor-pointer"
                >
                  Crea Mese
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
