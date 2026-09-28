import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Upload,
  FileText,
  Clock,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Download,
  Share2,
  ShieldCheck,
  Edit3,
  Trash2,
  RotateCcw,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
  MapPin,
  RefreshCw,
  Eye,
  FileCheck,
  ExternalLink,
  HelpCircle,
  X,
  Smartphone,
  CalendarDays,
  List,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import {
  EmployeeProfile,
  ShiftImportPlan,
  ImportedShiftRecord,
  CandidateEmployeeMatch,
  ShiftTypeCategory,
} from '../types';
import {
  parseShiftsFromFiles,
  fetchImportedShiftPlans,
  saveImportedShiftPlan,
  deleteImportedShiftPlan,
} from '../services/apiService';
import { downloadIcsFile, shareIcsFile } from '../utils/icsExporter';

interface ImportTurniModuleProps {
  profile: EmployeeProfile;
  onBackToHub: () => void;
  onOpenProfile?: () => void;
}

export const ImportTurniModule: React.FC<ImportTurniModuleProps> = ({
  profile,
  onBackToHub,
  onOpenProfile,
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'CARICA' | 'PIANI_SALVATI'>('CARICA');

  // File upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<
    Array<{ file: File; base64Data: string; previewUrl?: string }>
  >([]);
  const [saveToArchive, setSaveToArchive] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Candidate disambiguation state
  const [needsDisambiguation, setNeedsDisambiguation] = useState<boolean>(false);
  const [candidatesList, setCandidatesList] = useState<CandidateEmployeeMatch[]>([]);
  const [selectedCandidateIdx, setSelectedCandidateIdx] = useState<number>(0);

  // Active loaded plan (either freshly extracted or loaded from saved)
  const [currentPlan, setCurrentPlan] = useState<ShiftImportPlan | null>(null);
  const [conflictPlan, setConflictPlan] = useState<ShiftImportPlan | null>(null);
  const [viewMode, setViewMode] = useState<'CALENDARIO' | 'ELENCO'>('CALENDARIO');

  // Row editor modal state
  const [editingShift, setEditingShift] = useState<ImportedShiftRecord | null>(null);

  // Saved plans list
  const [savedPlans, setSavedPlans] = useState<ShiftImportPlan[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState<boolean>(false);

  // Toast / feedback messages
  const [feedbackToast, setFeedbackToast] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Calendar Help Modal
  const [showCalendarHelp, setShowCalendarHelp] = useState<boolean>(false);

  const fullName = `${profile.cognome} ${profile.nome}`.trim() || 'Dipendente S.E.T. 118';

  // Load saved plans on mount
  useEffect(() => {
    loadSavedPlans();
  }, []);

  const loadSavedPlans = async () => {
    setIsLoadingSaved(true);
    try {
      const plans = await fetchImportedShiftPlans();
      setSavedPlans(plans);
    } catch (err) {
      console.warn('Error loading saved plans:', err);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedbackToast({ text, type });
    setTimeout(() => setFeedbackToast(null), 4500);
  };

  // Handle file selection (PDF, PNG, JPG, JPEG)
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: Array<{ file: File; base64Data: string; previewUrl?: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const isPdf = file.type === 'application/pdf' || ext === 'pdf';
      const isImg = file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext);

      if (!isPdf && !isImg) {
        setErrorMessage(`Il file "${file.name}" non è supportato. Carica esclusivamente file PDF o immagini (PNG, JPG, JPEG).`);
        continue;
      }

      if (file.size > 15 * 1024 * 1024) {
        setErrorMessage(`Il file "${file.name}" supera i 15MB. Riduci la risoluzione prima di caricare.`);
        continue;
      }

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let previewUrl: string | undefined = undefined;
      if (isImg) {
        previewUrl = base64Data;
      }

      newItems.push({ file, base64Data, previewUrl });
    }

    setSelectedFiles((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleMoveFile = (idx: number, direction: 'UP' | 'DOWN') => {
    setSelectedFiles((prev) => {
      const updated = [...prev];
      const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= updated.length) return prev;
      const temp = updated[idx];
      updated[idx] = updated[targetIdx];
      updated[targetIdx] = temp;
      return updated;
    });
  };

  // Run Extraction
  const handleStartParsing = async (forcedCandidateIndex?: number) => {
    if (selectedFiles.length === 0) {
      setErrorMessage('Seleziona almeno un file PDF o immagine della pianificazione turni.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    setProcessingStep('Preparazione e verifica file...');

    try {
      const payloadFiles = selectedFiles.map((item) => ({
        base64Data: item.base64Data,
        fileName: item.file.name,
        mimeType: item.file.type || (item.file.name.endsWith('.pdf') ? 'application/pdf' : 'image/png'),
      }));

      setProcessingStep('Estrazione tabelle e lettura OCR turni in corso...');

      const result = await parseShiftsFromFiles({
        files: payloadFiles,
        saveToArchive,
        selectedCandidateIndex: typeof forcedCandidateIndex === 'number' ? forcedCandidateIndex : undefined,
      });

      if (!result.success) {
        if (result.notFound) {
          setErrorMessage(
            result.message ||
              `Nessun turno trovato per il cognome "${profile.cognome}". Verifica la postazione o le abbreviazioni nel foglio.`
          );
        } else {
          setErrorMessage(result.message || 'Elaborazione non riuscita.');
        }
        return;
      }

      // Check if candidate disambiguation is needed
      if (result.needsCandidateSelection && result.candidates && result.candidates.length > 1) {
        setNeedsDisambiguation(true);
        setCandidatesList(result.candidates);
        setSelectedCandidateIdx(0);
        showToast(
          `Individuati ${result.candidates.length} operatori con cognome simile: seleziona la tua riga.`,
          'info'
        );
        return;
      }

      // Successful extraction
      if (result.plan) {
        setNeedsDisambiguation(false);
        setCurrentPlan(result.plan);

        // Check if conflict with existing saved plan for the same month/year
        const existing = savedPlans.find(
          (p) => p.mese === result.plan!.mese && p.anno === result.plan!.anno
        );
        if (existing) {
          setConflictPlan(existing);
        } else {
          setConflictPlan(null);
        }

        showToast(
          `Pianificazione estratta: ${result.plan.totaleTurniLavorativi} turni individuati per ${result.plan.nomeMese}!`,
          'success'
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore imprevisto durante l\'elaborazione turni.');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // Disambiguation Confirmation
  const handleConfirmCandidateSelection = () => {
    handleStartParsing(selectedCandidateIdx);
  };

  // Save Plan into Profile
  const handleSaveCurrentPlan = async (overwrite = false) => {
    if (!currentPlan) return;

    try {
      const res = await saveImportedShiftPlan(currentPlan, overwrite);
      if (res.conflict && !overwrite) {
        setConflictPlan(res.existingPlan || null);
        return;
      }

      if (res.success && res.plan) {
        setCurrentPlan(res.plan);
        setConflictPlan(null);
        showToast('Pianificazione turni salvata correttamente nel tuo profilo!', 'success');
        loadSavedPlans();
      }
    } catch (err: any) {
      showToast(err.message || 'Errore durante il salvataggio.', 'error');
    }
  };

  // Calendar Export Handlers
  const handleExportToCalendar = async () => {
    if (!currentPlan) return;
    const workingCount = currentPlan.shifts.filter(
      (s) => !s.isRiposo && s.tipoCategoria !== 'RIPOSO' && s.tipoCategoria !== 'FERIE'
    ).length;

    const res = await shareIcsFile(currentPlan, fullName);
    if (res.success) {
      if (res.method === 'SHARE') {
        showToast(`Finestra di condivisione calendario aperta (${workingCount} turni)!`, 'success');
      } else {
        showToast(`File calendario .ics scaricato con successo (${workingCount} turni)!`, 'success');
      }
    } else if (res.error) {
      showToast(res.error, 'info');
    }
  };

  const handleDownloadIcs = () => {
    if (!currentPlan) return;
    const workingCount = currentPlan.shifts.filter(
      (s) => !s.isRiposo && s.tipoCategoria !== 'RIPOSO' && s.tipoCategoria !== 'FERIE'
    ).length;
    downloadIcsFile(currentPlan, fullName);
    showToast(`File .ics scaricato (${workingCount} eventi con fuso orario Europe/Rome).`, 'success');
  };

  // Inline Shift Editing
  const handleSaveShiftEdit = (updated: ImportedShiftRecord) => {
    if (!currentPlan) return;
    const updatedShifts = currentPlan.shifts.map((s) => (s.id === updated.id ? updated : s));

    const workingShifts = updatedShifts.filter(
      (s) => !s.isRiposo && s.tipoCategoria !== 'RIPOSO' && s.tipoCategoria !== 'FERIE'
    );
    const riposi = updatedShifts.filter(
      (s) => s.isRiposo || s.tipoCategoria === 'RIPOSO' || s.tipoCategoria === 'FERIE'
    );

    let oreStimate = 0;
    for (const ws of workingShifts) {
      if (ws.isNotturno || ws.tipoCategoria === 'NOTTE') oreStimate += 12;
      else if (ws.tipoCategoria === 'GIORNALIERO') oreStimate += 8;
      else oreStimate += 6;
    }

    setCurrentPlan({
      ...currentPlan,
      shifts: updatedShifts,
      totaleTurniLavorativi: workingShifts.length,
      totaleRiposi: riposi.length,
      totaleOreStimate: oreStimate,
      updatedAt: new Date().toISOString(),
    });

    setEditingShift(null);
    showToast('Turno aggiornato.', 'success');
  };

  // Helper color for shift badge
  const getShiftBadgeStyle = (shift: ImportedShiftRecord) => {
    if (shift.daVerificare) {
      return 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700';
    }
    switch (shift.tipoCategoria) {
      case 'MATTINA':
        return 'bg-sky-100 dark:bg-sky-950/80 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-800';
      case 'POMERIGGIO':
        return 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800';
      case 'NOTTE':
        return 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800 font-bold';
      case 'SMONTE_NOTTE':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
      case 'RIPOSO':
        return 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800';
      case 'FERIE':
        return 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800';
      case 'REPERIBILITA':
        return 'bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-800';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title="Torna alla scelta moduli"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Importa i miei turni da PDF / Foto
              </h2>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                Sincronizzazione Calendario
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Carica il prospetto turni mensile del referente. L&apos;app individua esclusivamente i tuoi turni ed esporta il calendario (.ics).
            </p>
          </div>
        </div>

        {/* User identification badge */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <div className="text-right">
            <span className="font-bold text-slate-900 dark:text-white">{fullName}</span>
            <span className="text-slate-400 text-[10px] ml-1.5 font-mono">Matr. {profile.matricola}</span>
          </div>
        </div>
      </div>

      {/* Floating feedback toast */}
      {feedbackToast && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs shadow-md animate-in fade-in duration-200 ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-100 border-emerald-300 dark:border-emerald-700'
              : feedbackToast.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/90 text-rose-900 dark:text-rose-100 border-rose-300 dark:border-rose-700'
              : 'bg-blue-50 dark:bg-blue-950/90 text-blue-900 dark:text-blue-100 border-blue-300 dark:border-blue-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{feedbackToast.text}</span>
          </div>
          <button
            onClick={() => setFeedbackToast(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Primary Tab Switcher */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('CARICA')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'CARICA'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Carica & Elabora File</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('PIANI_SALVATI');
              loadSavedPlans();
            }}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'PIANI_SALVATI'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Pianificazioni Salvate ({savedPlans.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowCalendarHelp(true)}
          className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1.5 cursor-pointer pb-2"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Guida Calendario Android / iPhone</span>
        </button>
      </div>

      {/* TAB 1: UPLOAD & PROCESS */}
      {activeTab === 'CARICA' && (
        <div className="space-y-6">
          {/* Step 1: Upload Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>1. Seleziona Documento Turni (PDF o Foto)</span>
                  <span className="text-[10px] font-mono text-slate-400">PDF, PNG, JPG, JPEG</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Puoi caricare un file PDF digitale o la scansione/foto scattata con lo smartphone.
                </p>
              </div>

              {/* Storage Mode Toggle */}
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <input
                  type="checkbox"
                  id="saveArchiveCheck"
                  checked={saveToArchive}
                  onChange={(e) => setSaveToArchive(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                />
                <label
                  htmlFor="saveArchiveCheck"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                >
                  {saveToArchive ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                      ✓ Salva in archivio privato protetto
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">Elabora solo in memoria temporanea</span>
                  )}
                </label>
              </div>
            </div>

            {/* Dropzone */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
              id="turniFileInput"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-teal-400/60 dark:border-teal-700 hover:border-teal-500 dark:hover:border-teal-500 rounded-2xl p-6 sm:p-8 text-center cursor-pointer bg-teal-50/20 dark:bg-slate-800/40 hover:bg-teal-50/40 transition-colors flex flex-col items-center justify-center space-y-3 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                <Upload className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Fai clic qui per selezionare il PDF o trascina i file
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Accetta PDF digitali, scansioni e foto (supporta anche più pagine/foto per lo stesso mese).
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-teal-300 bg-teal-100/80 dark:bg-teal-950 px-3.5 py-1.5 rounded-lg border border-teal-300 dark:border-teal-800 shadow-2xs">
                <FileText className="w-3.5 h-3.5" />
                Sfoglia file dal dispositivo
              </span>
            </div>

            {/* Selected Files List with multi-page support */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>File selezionati ({selectedFiles.length}):</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFiles([])}
                    className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Rimuovi tutti
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedFiles.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        {item.previewUrl ? (
                          <img
                            src={item.previewUrl}
                            alt="preview"
                            className="w-8 h-8 rounded object-cover border border-slate-300 dark:border-slate-600 shrink-0"
                          />
                        ) : (
                          <FileText className="w-5 h-5 text-teal-600 shrink-0" />
                        )}
                        <div className="truncate">
                          <p className="font-bold text-slate-900 dark:text-white truncate">
                            {item.file.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {(item.file.size / 1024).toFixed(0)} KB · {item.file.type || 'PDF/Doc'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMoveFile(idx, 'UP')}
                            title="Sposta prima"
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                          >
                            ↑
                          </button>
                        )}
                        {idx < selectedFiles.length - 1 && (
                          <button
                            type="button"
                            onClick={() => handleMoveFile(idx, 'DOWN')}
                            title="Sposta dopo"
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                          >
                            ↓
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          title="Rimuovi"
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Attenzione durante la lettura del documento:</p>
                  <p>{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Disambiguation Box for Homonyms */}
            {needsDisambiguation && candidatesList.length > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-400 dark:border-amber-700 rounded-xl space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Possibile omonimia rilevata: seleziona la tua riga specifica</span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Nel documento compaiono più operatori con il cognome &ldquo;{profile.cognome}&rdquo;. Per garantire l&apos;esattezza dei turni, scegli la tua riga:
                </p>

                <div className="space-y-2">
                  {candidatesList.map((cand, cIdx) => (
                    <label
                      key={cIdx}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                        selectedCandidateIdx === cIdx
                          ? 'bg-white dark:bg-slate-900 border-teal-500 shadow-xs'
                          : 'bg-amber-100/50 dark:bg-slate-800/60 border-amber-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="candidateSelect"
                          checked={selectedCandidateIdx === cIdx}
                          onChange={() => setSelectedCandidateIdx(cIdx)}
                          className="w-4 h-4 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {cand.nomeCompleto} {cand.matricola ? `(Matr. ${cand.matricola})` : ''}
                          </p>
                          <p className="text-[11px] text-slate-500">{cand.dettagli || 'Operatore 118'}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 font-bold">
                        Riga {cIdx + 1}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleConfirmCandidateSelection}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    Conferma la mia riga ed estrai i turni
                  </button>
                </div>
              </div>
            )}

            {/* Action Button: Start Processing */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                <span>Nessun dato di colleghi verrà memorizzato. Filtro privacy attivo.</span>
              </div>

              <button
                type="button"
                disabled={isProcessing || selectedFiles.length === 0}
                onClick={() => handleStartParsing()}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white transition-all shadow-sm ${
                  isProcessing || selectedFiles.length === 0
                    ? 'bg-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-teal-600 hover:bg-teal-700 active:scale-98 cursor-pointer'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{processingStep || 'Elaborazione turni in corso...'}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 stroke-[2.2]" />
                    <span>Carica PDF turni & Estrai i Miei Turni</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Conflict Alert Banner if schedule for month already exists */}
          {conflictPlan && currentPlan && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/70 border-2 border-amber-500 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Pianificazione già presente per {currentPlan.nomeMese}</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Esiste già una pianificazione salvata in precedenza per questo mese. Puoi aggiornarla con i nuovi dati appena estratti oppure mantenere quella attuale:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Pianificazione attuale salvata:
                  </p>
                  <p className="text-slate-500">Data caricamento: {new Date(conflictPlan.dataCaricamento).toLocaleDateString('it-IT')}</p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {conflictPlan.totaleTurniLavorativi} turni lavorativi ({conflictPlan.totaleOreStimate}h stimate)
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border-2 border-teal-500">
                  <p className="font-bold text-teal-800 dark:text-teal-300 mb-1">
                    Nuovi turni appena estratti dal PDF:
                  </p>
                  <p className="text-slate-500">File: {currentPlan.sourceFileName}</p>
                  <p className="font-semibold text-teal-700 dark:text-teal-400">
                    {currentPlan.totaleTurniLavorativi} turni lavorativi ({currentPlan.totaleOreStimate}h stimate)
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConflictPlan(null)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-lg cursor-pointer"
                >
                  Mantieni Attuale
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCurrentPlan(true)}
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Aggiorna e Sostituisci con Nuovi Dati
                </button>
              </div>
            </div>
          )}

          {/* Extracted Schedule View & Action Toolbar */}
          {currentPlan && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Summary Card */}
              <div className="bg-gradient-to-r from-slate-900 to-teal-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[11px] font-bold border border-teal-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Pianificazione Mensile Rilevata</span>
                  </div>
                  <h3 className="text-xl font-extrabold tracking-tight">
                    {currentPlan.nomeMese} · {currentPlan.postazioneRilevata}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Operatore: <strong className="text-white">{currentPlan.candidatoSelezionato}</strong> (Matr. {profile.matricola})
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono pt-1">
                    Fonte: {currentPlan.sourceFileName} · {currentPlan.isPreservedInArchive ? '📁 Conservato in archivio privato' : '⚡ Elaborato in memoria'}
                  </p>
                </div>

                {/* Metrics Stats */}
                <div className="grid grid-cols-3 gap-2 text-center shrink-0">
                  <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
                    <div className="text-lg font-bold text-white">{currentPlan.totaleTurniLavorativi}</div>
                    <div className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">Turni</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
                    <div className="text-lg font-bold text-teal-300">{currentPlan.totaleOreStimate}h</div>
                    <div className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">Ore Stimate</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
                    <div className="text-lg font-bold text-slate-300">{currentPlan.totaleRiposi}</div>
                    <div className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">Riposi/Ferie</div>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                {/* View Switcher */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setViewMode('CALENDARIO')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      viewMode === 'CALENDARIO'
                        ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>Vista Calendario</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode('ELENCO')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      viewMode === 'ELENCO'
                        ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Vista Elenco</span>
                  </button>
                </div>

                {/* Calendar Export Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveCurrentPlan(false)}
                    className="px-3.5 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5 text-teal-400" />
                    <span>Salva Turni nel Profilo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportToCalendar}
                    className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Esporta nel Calendario</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadIcs}
                    title="Scarica file standard .ics compatibile con Google Calendar, Apple Calendar, Outlook"
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Scarica File .ics</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCalendarHelp(true)}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl cursor-pointer"
                    title="Istruzioni esportazione"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* View 1: CALENDAR VIEW */}
              {viewMode === 'CALENDARIO' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Calendario Mensile Turni · {currentPlan.nomeMese}
                    </span>
                    <span className="text-[11px] italic">
                      Fai clic su un giorno per modificare manualmente il turno o orario
                    </span>
                  </div>

                  {/* Weekday headers (Lun-Dom) */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-1">
                    <span>Lun</span>
                    <span>Mar</span>
                    <span>Mer</span>
                    <span>Gio</span>
                    <span>Ven</span>
                    <span className="text-rose-600 dark:text-rose-400">Sab</span>
                    <span className="text-rose-600 dark:text-rose-400">Dom</span>
                  </div>

                  {/* Days Grid */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {/* Padding cells for first day of month */}
                    {(() => {
                      const firstDay = new Date(currentPlan.anno, currentPlan.mese - 1, 1).getDay();
                      // Convert Sunday=0 to Monday=0 (Italian week)
                      const offset = firstDay === 0 ? 6 : firstDay - 1;
                      return Array.from({ length: offset }).map((_, i) => (
                        <div key={`empty-${i}`} className="min-h-[70px] sm:min-h-[85px] bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-transparent" />
                      ));
                    })()}

                    {/* Actual days */}
                    {currentPlan.shifts.map((shift) => (
                      <div
                        key={shift.id}
                        onClick={() => setEditingShift(shift)}
                        className={`min-h-[70px] sm:min-h-[85px] p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between hover:scale-[1.02] hover:shadow-sm ${getShiftBadgeStyle(
                          shift
                        )}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs sm:text-sm font-mono">
                            {shift.giornoNumero}
                          </span>
                          {shift.isNotturno && (
                            <span className="text-[10px]" title="Turno notturno">🌙</span>
                          )}
                          {shift.daVerificare && (
                            <span className="text-[10px] text-amber-600 font-bold" title={shift.motivoVerifica || 'Dato da verificare'}>
                              ⚠️
                            </span>
                          )}
                        </div>

                        <div className="space-y-0.5 my-auto">
                          <div className="font-extrabold text-xs sm:text-sm tracking-tight text-center truncate">
                            {shift.codiceTurno || (shift.isRiposo ? 'R' : '118')}
                          </div>
                          {shift.orarioInizio && shift.orarioFine && (
                            <div className="text-[9px] sm:text-[10px] font-mono text-center truncate opacity-85">
                              {shift.orarioInizio}-{shift.orarioFine}
                            </div>
                          )}
                        </div>

                        <div className="text-[8px] sm:text-[9px] text-center truncate opacity-70">
                          {shift.veicolo || (shift.isRiposo ? 'Riposo' : shift.postazione?.split(' - ')[0])}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Legenda:</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-sky-200 border border-sky-400" /> Mattina (08-14)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-amber-200 border border-amber-400" /> Pomeriggio (14-20)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-indigo-200 border border-indigo-400" /> Notte 12h (20-08)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-slate-200 border border-slate-400" /> Smonte / Riposo
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400" /> Ferie
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-amber-100 border border-amber-500" /> ⚠️ Da verificare
                    </span>
                  </div>
                </div>
              )}

              {/* View 2: DETAILED LIST VIEW */}
              {viewMode === 'ELENCO' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Elenco Cronologico Turni Mese ({currentPlan.shifts.length} giorni)
                    </span>
                    <span className="text-[11px]">Tutti gli orari sono convertibili in calendario</span>
                  </div>

                  <div className="space-y-2">
                    {currentPlan.shifts.map((shift) => (
                      <div
                        key={shift.id}
                        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${getShiftBadgeStyle(
                          shift
                        )}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 text-center font-mono font-bold">
                            <span className="text-sm">{shift.giornoNumero}</span>
                            <span className="block text-[10px] uppercase opacity-70">
                              {shift.giornoSettimana}
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">
                                {shift.codiceTurno || (shift.isRiposo ? 'Riposo' : 'Turno 118')}
                              </span>
                              <span className="text-xs font-semibold opacity-90">
                                {shift.orarioFormattato}
                              </span>
                              {shift.isNotturno && (
                                <span className="text-[10px] bg-indigo-950 text-indigo-200 px-1.5 py-0.5 rounded font-bold">
                                  Notte 12h
                                </span>
                              )}
                              {shift.daVerificare && (
                                <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1">
                                  ⚠️ {shift.motivoVerifica || 'Da verificare'}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] opacity-80 flex items-center gap-2">
                              <span>📍 {shift.postazione || currentPlan.postazioneRilevata}</span>
                              {shift.veicolo && <span>· 🚑 {shift.veicolo}</span>}
                              {shift.mansione && <span>· 👤 {shift.mansione}</span>}
                            </p>
                            {shift.annotazioni && (
                              <p className="text-[10px] italic opacity-75">Note: {shift.annotazioni}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => setEditingShift(shift)}
                            className="px-2.5 py-1.5 bg-white/70 dark:bg-slate-800/80 hover:bg-white text-slate-800 dark:text-slate-200 font-bold rounded-lg border border-slate-300 dark:border-slate-600 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Modifica</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SAVED PLANS HISTORY */}
      {activeTab === 'PIANI_SALVATI' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Pianificazioni Mensili Salvate nel tuo Profilo
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  I turni rimangono salvati in modo permanente e accessibili anche dopo cambio telefono.
                </p>
              </div>

              <button
                type="button"
                onClick={loadSavedPlans}
                disabled={isLoadingSaved}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSaved ? 'animate-spin' : ''}`} />
                <span>Aggiorna</span>
              </button>
            </div>

            {savedPlans.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Nessuna pianificazione salvata finora
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Carica il PDF o la foto del tuo mese per visualizzare qui i turni ed esportarli in ogni momento.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('CARICA')}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Carica Ora il Tuo Mese</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
                          {plan.nomeMese}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                          {plan.postazioneRilevata}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Fonte: {plan.sourceFileName} · Salva: {new Date(plan.dataCaricamento).toLocaleDateString('it-IT')}
                        </p>
                      </div>

                      <span className="text-xs font-bold text-teal-600 dark:text-teal-400 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        {plan.totaleTurniLavorativi} turni · {plan.totaleOreStimate}h
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentPlan(plan);
                          setActiveTab('CARICA');
                          showToast(`Visualizzazione aperta per ${plan.nomeMese}`, 'info');
                        }}
                        className="text-teal-600 dark:text-teal-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Apri e visualizza</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => downloadIcsFile(plan, fullName)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg cursor-pointer"
                          title="Scarica file calendario .ics"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => shareIcsFile(plan, fullName)}
                          className="p-1.5 text-slate-500 hover:text-teal-600 rounded-lg cursor-pointer"
                          title="Esporta nel calendario"
                        >
                          <Smartphone className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(`Sei sicuro di voler eliminare la pianificazione di ${plan.nomeMese}?`)) {
                              await deleteImportedShiftPlan(plan.id);
                              loadSavedPlans();
                              if (currentPlan?.id === plan.id) setCurrentPlan(null);
                              showToast('Pianificazione eliminata.', 'info');
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Row Edit Modal */}
      {editingShift && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-teal-400" />
                <h3 className="font-bold text-sm">
                  Modifica Turno: {editingShift.giornoNumero} {editingShift.giornoSettimana} ({editingShift.data})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingShift(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Quick preset selector */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Codice Turno Rapido:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { code: 'M', label: 'Mattina (08-14)', tipo: 'MATTINA', start: '08:00', end: '14:00' },
                    { code: 'P', label: 'Pomeriggio (14-20)', tipo: 'POMERIGGIO', start: '14:00', end: '20:00' },
                    { code: 'N', label: 'Notte (20-08)', tipo: 'NOTTE', start: '20:00', end: '08:00' },
                    { code: 'SM', label: 'Smonte Notte', tipo: 'SMONTE_NOTTE', start: '', end: '' },
                    { code: 'R', label: 'Riposo', tipo: 'RIPOSO', start: '', end: '' },
                    { code: 'F', label: 'Ferie', tipo: 'FERIE', start: '', end: '' },
                    { code: 'REP', label: 'Reperibilità', tipo: 'REPERIBILITA', start: '', end: '' },
                    { code: 'G', label: 'Giornaliero (08-17)', tipo: 'GIORNALIERO', start: '08:00', end: '17:00' },
                  ].map((preset) => (
                    <button
                      key={preset.code}
                      type="button"
                      onClick={() => {
                        const isRiposo = ['SMONTE_NOTTE', 'RIPOSO', 'FERIE'].includes(preset.tipo);
                        const isNotturno = preset.tipo === 'NOTTE';
                        setEditingShift({
                          ...editingShift,
                          codiceTurno: preset.code,
                          tipoCategoria: preset.tipo as ShiftTypeCategory,
                          orarioInizio: preset.start || undefined,
                          orarioFine: preset.end || undefined,
                          orarioFormattato: preset.start && preset.end ? `${preset.start} - ${preset.end}` : preset.label,
                          isNotturno,
                          isRiposo,
                          daVerificare: false,
                        });
                      }}
                      className={`py-1.5 px-2 rounded-lg border text-center font-bold transition-colors cursor-pointer ${
                        editingShift.codiceTurno === preset.code
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {preset.code}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exact times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Orario Inizio:
                  </label>
                  <input
                    type="time"
                    value={editingShift.orarioInizio || ''}
                    onChange={(e) =>
                      setEditingShift({
                        ...editingShift,
                        orarioInizio: e.target.value,
                        orarioFormattato: `${e.target.value} - ${editingShift.orarioFine || ''}`,
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Orario Fine:
                  </label>
                  <input
                    type="time"
                    value={editingShift.orarioFine || ''}
                    onChange={(e) =>
                      setEditingShift({
                        ...editingShift,
                        orarioFine: e.target.value,
                        orarioFormattato: `${editingShift.orarioInizio || ''} - ${e.target.value}`,
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Postazione & Mezzo */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Postazione di Servizio:
                </label>
                <input
                  type="text"
                  value={editingShift.postazione || ''}
                  onChange={(e) => setEditingShift({ ...editingShift, postazione: e.target.value })}
                  placeholder="Es. Taranto Centro - Postazione 118"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mezzo / Postazione:
                  </label>
                  <input
                    type="text"
                    value={editingShift.veicolo || ''}
                    onChange={(e) => setEditingShift({ ...editingShift, veicolo: e.target.value })}
                    placeholder="Es. Mike 1"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mansione:
                  </label>
                  <input
                    type="text"
                    value={editingShift.mansione || ''}
                    onChange={(e) => setEditingShift({ ...editingShift, mansione: e.target.value })}
                    placeholder="Autista Soccorritore"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Note aggiuntive:
                </label>
                <input
                  type="text"
                  value={editingShift.annotazioni || ''}
                  onChange={(e) => setEditingShift({ ...editingShift, annotazioni: e.target.value })}
                  placeholder="Es. Cambio turno concordato..."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Verification flag */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="daVerifCheck"
                  checked={!editingShift.daVerificare}
                  onChange={(e) =>
                    setEditingShift({
                      ...editingShift,
                      daVerificare: !e.target.checked,
                      motivoVerifica: e.target.checked ? undefined : 'Modificato manualmente',
                    })
                  }
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                />
                <label htmlFor="daVerifCheck" className="text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Segna questo turno come <strong>verificato e confermato</strong> (rimuove l&apos;avviso ⚠️)
                </label>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingShift(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => handleSaveShiftEdit(editingShift)}
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg cursor-pointer shadow-xs"
              >
                Salva Modifiche Turno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Help Modal */}
      {showCalendarHelp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-sm sm:text-base">
                  Come importare i turni nel calendario dello smartphone
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCalendarHelp(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <p>
                L&apos;applicazione genera un file standard universale <strong>.ics (iCalendar RFC 5545)</strong> configurato con fuso orario <code>Europe/Rome</code> e identificativi univoci per evitare duplicati.
              </p>

              {/* Android Guide */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>📱 Su Smartphone Android (Google Calendar / Samsung Calendar):</span>
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <li>Tocca il pulsante verde <strong>&ldquo;Esporta nel Calendario&rdquo;</strong>.</li>
                  <li>Il telefono aprirà la finestra di condivisione: seleziona <strong>&ldquo;Google Calendar&rdquo;</strong> o <strong>&ldquo;Samsung Calendar&rdquo;</strong>.</li>
                  <li>In alternativa, tocca <strong>&ldquo;Scarica File .ics&rdquo;</strong>: apri il file scaricato dalla barra notifiche e tocca &ldquo;Aggiungi tutti al calendario&rdquo;.</li>
                </ol>
              </div>

              {/* iPhone Guide */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>🍏 Su iPhone / iPad (Apple Calendar):</span>
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <li>Tocca <strong>&ldquo;Esporta nel Calendario&rdquo;</strong> oppure <strong>&ldquo;Scarica File .ics&rdquo;</strong>.</li>
                  <li>Safari o il browser chiederà se desideri aprire il file in <strong>&ldquo;Calendario&rdquo;</strong>.</li>
                  <li>Tocca &ldquo;Aggiungi tutti&rdquo; per inserire istantaneamente tutti i turni con data, orari e postazione.</li>
                </ol>
              </div>

              <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-200 dark:border-teal-800 text-[11px] text-teal-800 dark:text-teal-200 space-y-1">
                <p className="font-bold">✓ Gestione Turni di Notte:</p>
                <p>
                  I turni notturni (es. dalle 20:00 alle 08:00) sono codificati con cambio giorno automatico (terminano il mattino successivo alle 08:00), per rispecchiare fedelmente l&apos;impegno orario sul calendario.
                </p>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCalendarHelp(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Ho Capito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
