import React, { useState } from 'react';
import {
  Plus,
  Clock,
  Briefcase,
  Layers,
  FileText,
  Send,
  Calendar,
  Filter,
  Trash2,
  CheckCircle2,
  ChevronDown,
  Download,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  User,
  FileSpreadsheet,
  ShieldCheck,
  PenTool,
  Calculator,
  Save,
  RefreshCw,
  AlertTriangle,
  Upload,
} from 'lucide-react';
import { MonthlySheet, OvertimeEntry, DigitalSignature, EmployeeProfile } from '../types';
import { downloadSheetCsv } from '../utils/csvExporter';
import { getNextMonthFirstDay } from '../utils/timeCalculations';
import { DigitalSignatureModal } from './DigitalSignatureModal';

const MonthlyHoursComparisonChart = React.lazy(() =>
  import('./MonthlyHoursComparisonChart').then((m) => ({ default: m.MonthlyHoursComparisonChart }))
);

interface TurniDashboardProps {
  sheet: MonthlySheet;
  allSheets: MonthlySheet[];
  onSelectSheetId: (id: string) => void;
  onOpenAddModal: () => void;
  onDeleteEntry: (entryId: string) => void;
  onGoToPdf: () => void;
  onGoToPec: () => void;
  onGoToCalcolo?: () => void;
  onClearSheet?: () => void;
  onOpenProfile?: () => void;
  onGoToImportTurni?: () => void;
  onSaveSheet?: () => Promise<boolean | void> | void;
  onUpdateSheet?: (updated: MonthlySheet) => void;
  onSaveProfile?: (profile: EmployeeProfile) => void;
}

export const TurniDashboard: React.FC<TurniDashboardProps> = ({
  sheet,
  allSheets,
  onSelectSheetId,
  onOpenAddModal,
  onDeleteEntry,
  onGoToPdf,
  onGoToPec,
  onGoToCalcolo,
  onClearSheet,
  onOpenProfile,
  onGoToImportTurni,
  onSaveSheet,
  onUpdateSheet,
  onSaveProfile,
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'STRAORDINARIO' | 'MONTE_ORE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [csvDownloadedMessage, setCsvDownloadedMessage] = useState(false);
  const [isManualSaving, setIsManualSaving] = useState(false);
  const [manualSaveSuccess, setManualSaveSuccess] = useState(false);
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [sigToast, setSigToast] = useState<string | null>(null);

  const handleSaveSignature = (sig: DigitalSignature, saveToProfile: boolean) => {
    const updatedSheet: MonthlySheet = {
      ...sheet,
      firmaDipendente: sig,
      richiedeNuovaFirma: false,
      motivoNuovaFirma: undefined,
      firmaAutorizzata: true,
      updatedAt: new Date().toISOString(),
    };
    if (onUpdateSheet) onUpdateSheet(updatedSheet);
    if (saveToProfile && onSaveProfile && sheet.dipendente) {
      onSaveProfile({ ...sheet.dipendente, firmaSalvata: sig });
    }
    setSigToast('Firma salvata correttamente nel foglio e nel profilo!');
    setTimeout(() => setSigToast(null), 4000);
  };

  const handleManualSave = async () => {
    if (!onSaveSheet) return;
    setIsManualSaving(true);
    try {
      await onSaveSheet();
      setManualSaveSuccess(true);
      setTimeout(() => setManualSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Error during manual save:', err);
    } finally {
      setIsManualSaving(false);
    }
  };

  const entries = sheet.entries || [];
  const nextDay1 = getNextMonthFirstDay(sheet.anno, sheet.mese);

  const hasProfile = Boolean(sheet.dipendente?.cognome && sheet.dipendente?.nome);

  const handleCsvExport = () => {
    downloadSheetCsv(sheet);
    setCsvDownloadedMessage(true);
    setTimeout(() => setCsvDownloadedMessage(false), 3500);
  };

  const filteredEntries = entries.filter((e) => {
    if (filterType === 'STRAORDINARIO' && e.tipoDestinazione !== 'STRAORDINARIO') return false;
    if (filterType === 'MONTE_ORE' && e.tipoDestinazione !== 'MONTE_ORE') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.motivo.toLowerCase().includes(q) ||
        e.giorno.includes(q) ||
        e.orarioOrdinario.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* CSV Export Success Banner */}
      {csvDownloadedMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>File CSV esportato con successo! Salvato come backup offline locale per {sheet.nomeMese}.</span>
          </div>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
            Separatore ';' (Excel Italia)
          </span>
        </div>
      )}

      {/* Profile Notice if not configured */}
      {!hasProfile && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold">
                Configura i tuoi dati personali dipendente
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Inserisci Nome, Cognome, Matricola e Postazione 118 per personalizzare e firmare i tuoi fogli.
              </p>
            </div>
          </div>
          {onOpenProfile && (
            <button
              onClick={onOpenProfile}
              className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Imposta Dati Personali
            </button>
          )}
        </div>
      )}

      {/* Top Banner: Active Month + Switcher + Quick Actions */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <img
                src="/sanitaservice_logo_colori.png?v=2"
                alt="Sanitaservice ASL TA"
                className="h-6 sm:h-7 w-auto inline-block object-contain rounded"
              />
              <span>Sanitaservice ASL TA · S.E.T. 118</span>
            </span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {hasProfile ? (
                <>
                  {sheet.dipendente?.cognome} {sheet.dipendente?.nome}{' '}
                  {sheet.dipendente?.matricola && `(Matr. ${sheet.dipendente?.matricola})`}
                </>
              ) : (
                <span className="text-amber-700 dark:text-amber-400 font-semibold">Foglio Personale Pronto</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {sheet.nomeMese}
            </h1>

            {allSheets.length > 1 && (
              <div className="relative inline-block">
                <select
                  value={sheet.id}
                  onChange={(e) => onSelectSheetId(e.target.value)}
                  className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 cursor-pointer pr-7 appearance-none"
                >
                  {allSheets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nomeMese}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Postazione di servizio:{' '}
            <strong className="text-slate-700 dark:text-slate-300">{sheet.dipendente?.postazione || 'Taranto Centro - Postazione 118'}</strong>
          </p>

          {sigToast && (
            <div className="mt-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-lg flex items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-100 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold">{sigToast}</span>
              </div>
              <button
                onClick={() => setSigToast(null)}
                className="font-bold text-xs text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                OK
              </button>
            </div>
          )}
        </div>

        <div className="w-full md:w-auto flex flex-col gap-2">
          {/* Primary CTA for Mobile & Desktop */}
          <button
            onClick={onOpenAddModal}
            className="w-full min-h-[48px] md:min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-98 shadow-sm rounded-xl transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Inserisci Straordinario</span>
          </button>

          {/* Action Grid on Mobile (2 cols), Flex on Desktop */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full">
            {/* Digital Signature Action / Status Badge */}
            {sheet.richiedeNuovaFirma ? (
              <button
                onClick={() => setIsSigModalOpen(true)}
                title="Il foglio è stato modificato dopo la firma: clicca per rinnovare la firma subito"
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 border border-rose-300 dark:border-rose-800 rounded-lg transition-colors cursor-pointer animate-pulse"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="truncate">Rinnova Firma</span>
              </button>
            ) : sheet.firmaDipendente ? (
              <button
                onClick={() => setIsSigModalOpen(true)}
                title={`Firma originale apposta da ${sheet.firmaDipendente.nomeFirmatario} il ${sheet.firmaDipendente.dataFirma}. Clicca per visualizzare o rinnovare.`}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 border border-teal-200 dark:border-teal-800 rounded-lg transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="truncate">Firma Apposta</span>
              </button>
            ) : (
              <button
                onClick={() => setIsSigModalOpen(true)}
                title="Autorizza e apponi la tua firma originale sul foglio"
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors cursor-pointer"
              >
                <PenTool className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">Firma Foglio</span>
              </button>
            )}

            <button
              onClick={onGoToPdf}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Vedi Modello</span>
            </button>

            <button
              onClick={async () => {
                const { downloadPdf } = await import('../utils/pdfGenerator');
                downloadPdf(sheet);
              }}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Scarica PDF</span>
            </button>

            {onGoToImportTurni && (
              <button
                onClick={onGoToImportTurni}
                title="Carica il prospetto turni mensile in PDF o foto ed estrai i turni per il calendario"
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 border border-teal-200 dark:border-teal-800 rounded-lg transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="truncate">Carica turni</span>
              </button>
            )}

            {onGoToCalcolo && (
              <button
                onClick={onGoToCalcolo}
                title="Calcola compenso economico straordinari CCNL AIOP-ARIS"
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Compensi</span>
              </button>
            )}

            {/* Esporta CSV Backup Locale */}
            <button
              onClick={handleCsvExport}
              title="Esporta i dati del mese corrente in formato CSV per backup locale offline"
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">Esporta CSV</span>
            </button>

            {/* Pulsante Salva Manuale */}
            {onSaveSheet && (
              <button
                onClick={handleManualSave}
                disabled={isManualSaving}
                title="Salva manualmente il foglio corrente sul dispositivo e sincronizza con il server"
                className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-2xs ${
                  manualSaveSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white'
                } disabled:opacity-60`}
              >
                {isManualSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvataggio...</span>
                  </>
                ) : manualSaveSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Salvato!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Salva</span>
                  </>
                )}
              </button>
            )}

            {entries.length > 0 && onClearSheet && (
              <button
                onClick={() => setShowClearConfirm(true)}
                title="Svuota tutte le righe del foglio"
                className="col-span-2 sm:col-span-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Svuota Foglio</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Section: Section 2 Tabular Numerals & High Density Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Totale Straordinario */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Straordinario Mese</span>
            <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-teal-800 dark:text-teal-300 tabular-nums">
            {sheet.totaleOreStraordinarioFormatted || '0h 00m'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Liquidazione economica busta paga
          </div>
        </div>

        {/* Metric 2: Totale Monte Ore */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Monte Ore (Banca Ore)</span>
            <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-amber-800 dark:text-amber-300 tabular-nums">
            {sheet.totaleOreMonteOreFormatted || '0h 00m'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Ore accumulate per riposi compensativi
          </div>
        </div>

        {/* Metric 3: Totale Complessivo */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Totale Ore Eccedenti</span>
            <Briefcase className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
            {sheet.totaleOreComplessivoFormatted || '0h 00m'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Su {entries.length} turni registrati nel mese
          </div>
        </div>

        {/* Metric 4: PEC Scheduled Dispatch Status */}
        <div
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
          onClick={onGoToPec}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Invio PEC Giorno 1</span>
            <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg font-bold font-mono tracking-tight text-emerald-700 dark:text-emerald-400 truncate">
            {sheet.status === 'INVIATO_PEC' ? 'Trasmesso con Ricevuta' : nextDay1.formatted}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Programmato in autonomia ore 08:00</span>
          </div>
        </div>
      </div>

      {/* SUMMARY PANEL WITH RECHARTS BAR CHART */}
      <React.Suspense fallback={<div className="h-44 bg-slate-100 dark:bg-slate-850 animate-pulse rounded-xl border border-slate-200 dark:border-slate-800" />}>
        <MonthlyHoursComparisonChart sheet={sheet} />
      </React.Suspense>

      {/* Filter and Search Bar + Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3 transition-colors">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Filter tabs: functional button segmented controls */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                filterType === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tutte le Righe ({entries.length})
            </button>
            <button
              onClick={() => setFilterType('STRAORDINARIO')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                filterType === 'STRAORDINARIO'
                  ? 'bg-white dark:bg-slate-700 text-teal-900 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Solo Straordinario
            </button>
            <button
              onClick={() => setFilterType('MONTE_ORE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                filterType === 'MONTE_ORE'
                  ? 'bg-white dark:bg-slate-700 text-amber-900 dark:text-amber-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Solo Monte Ore
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Cerca per data o motivo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-200 w-full sm:w-64 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Data Grid Table (Desktop + Mobile) */}
        {filteredEntries.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {entries.length === 0
                ? 'Foglio pulito · Nessun turno inserito'
                : 'Nessun turno corrisponde al filtro'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {entries.length === 0
                ? 'Fai clic sul pulsante "+ Inserisci Straordinario" per inserire il primo turno reale del mese. L\'app calcolerà i totali e aggiornerà il grafico.'
                : 'Prova a modificare i filtri o la ricerca per visualizzare i turni registrati.'}
            </p>
            <button
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              + Inserisci Straordinario
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Vertical Cards (< 768px): Clear, structured and thumb-friendly */}
            <div className="block md:hidden space-y-3">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5"
                >
                  {/* Card Header: Giorno + Badge Tipo + Tasto Elimina */}
                  <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                        {entry.giorno}
                      </span>
                      {entry.totaleOreStraordinario && entry.totaleOreStraordinario !== '—' && (
                        <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800">
                          {entry.totaleOreStraordinario} Straord.
                        </span>
                      )}
                      {entry.totaleOreMonteOre && entry.totaleOreMonteOre !== '—' && (
                        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                          {entry.totaleOreMonteOre} Monte Ore
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => onDeleteEntry(entry.id)}
                      title="Elimina questo turno"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Orari Turno */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Orario Ordinario</span>
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{entry.orarioOrdinario}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-rose-500 dark:text-rose-400 block mb-0.5">Straordinario</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{entry.orarioStraordinario}</span>
                    </div>
                  </div>

                  {/* Motivo */}
                  <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Motivo Straordinario</span>
                    <p className="leading-snug">{entry.motivo}</p>
                  </div>

                  {/* Firma Coordinatore se presente */}
                  {entry.firmaCoordinatore && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-0.5">
                      <span>Firma Coordinatore:</span>
                      <span className="font-semibold italic text-slate-700 dark:text-slate-300">{entry.firmaCoordinatore}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Mobile Month Totals Summary Card */}
              <div className="bg-slate-900 text-white rounded-xl p-4 space-y-2 mt-4 shadow-md">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Totali Mese Calcolati
                </span>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-xs text-teal-300 block">Straordinario:</span>
                    <span className="font-mono font-black text-lg text-teal-400">{sheet.totaleOreStraordinarioFormatted || '0h 00m'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-amber-300 block">Monte Ore:</span>
                    <span className="font-mono font-black text-lg text-amber-400">{sheet.totaleOreMonteOreFormatted || '0h 00m'}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-300">Totale Ore Eccedenti:</span>
                  <span className="font-mono font-bold text-base text-white">{sheet.totaleOreComplessivoFormatted || '0h 00m'}</span>
                </div>
              </div>
            </div>

            {/* Desktop Table (>= 768px): Exact unchanged 8-column layout */}
            <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3 text-center w-24">Giorno</th>
                    <th className="py-3 px-3 text-center w-36">Orario Ordinario</th>
                    <th className="py-3 px-3 text-center w-36">Orario Straordinario</th>
                    <th className="py-3 px-4">Motivo dello Straordinario</th>
                    <th className="py-3 px-3 text-center w-28">Monte Ore</th>
                    <th className="py-3 px-3 text-center w-28">Straordinario</th>
                    <th className="py-3 px-3 text-center w-28">Firma Coord.</th>
                    <th className="py-3 px-2 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                        {entry.giorno}
                      </td>

                      <td className="py-3 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                        {entry.orarioOrdinario}
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                        {entry.orarioStraordinario}
                      </td>

                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                        <div className="font-medium">{entry.motivo}</div>
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-700 dark:text-amber-400">
                        {entry.totaleOreMonteOre || '—'}
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-teal-800 dark:text-teal-300">
                        {entry.totaleOreStraordinario || '—'}
                      </td>

                      <td className="py-3 px-3 text-center text-[11px] text-slate-500 dark:text-slate-400 italic">
                        {entry.firmaCoordinatore}
                      </td>

                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => onDeleteEntry(entry.id)}
                          title="Elimina questo turno"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Table Totals Row */}
                  <tr className="bg-slate-100 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs">
                    <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider">
                      Totali Calcolati nel Mese:
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-sm text-amber-800 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
                      {sheet.totaleOreMonteOreFormatted || '0h 00m'}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-sm text-teal-900 dark:text-teal-200 bg-teal-50/50 dark:bg-teal-950/20">
                      {sheet.totaleOreStraordinarioFormatted || '0h 00m'}
                    </td>
                    <td colSpan={2} className="py-3 px-3 text-center font-mono text-slate-700 dark:text-slate-300">
                      Tot: {sheet.totaleOreComplessivoFormatted || '0h 00m'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Confirmation Modal to Clear Sheet */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Svuotare tutte le righe del foglio?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {sheet.nomeMese}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Questa azione cancellerà tutti i {entries.length} turni inseriti in questo foglio e azzererà i totali di straordinario e monte ore. Il foglio tornerà pulito e pronto per nuovi inserimenti.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  setShowClearConfirm(false);
                  if (onClearSheet) onClearSheet();
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
              >
                Svuota Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick info note on how it works */}
      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
        <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            Automazione autonoma per Sanitaservice ASL TA · Uso personale & Backup Locale:
          </p>
          <p>
            1. Fai clic su <strong className="text-slate-900 dark:text-white">+ Inserisci Straordinario</strong>: seleziona il turno (l'applicazione conosce gli orari ufficiali) e inserisci i minuti o le ore svolte.
          </p>
          <p>
            2. Fai clic su <strong className="text-emerald-700 dark:text-emerald-400">Esporta CSV</strong> in qualsiasi momento per scaricare una copia di backup offline locale del foglio mensile sul tuo dispositivo.
          </p>
          <p>
            3. Entro il <strong>giorno 1 del mese successivo</strong>, l'app genera il PDF e trasmette in autonomia il prospetto alla PEC dell'Ufficio Personale, salvando le ricevute nella memoria protetta.
          </p>
        </div>
      </div>

      {/* Digital Signature Modal */}
      {isSigModalOpen && sheet.dipendente && (
        <DigitalSignatureModal
          isOpen={isSigModalOpen}
          onClose={() => setIsSigModalOpen(false)}
          onSaveSignature={handleSaveSignature}
          profile={sheet.dipendente}
          existingSignature={sheet.firmaDipendente || sheet.dipendente.firmaSalvata}
          documentTitle={`Foglio Turni ${sheet.nomeMese}`}
          sheetId={sheet.id}
        />
      )}
    </div>
  );
};
