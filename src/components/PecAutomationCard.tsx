import React, { useState } from 'react';
import {
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Mail,
  FileCheck,
  Settings,
  RefreshCw,
  ExternalLink,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  X,
  BookOpen,
  HelpCircle,
  FileText,
  AlertTriangle,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { MonthlySheet, PecSettings, PecLogEntry, PecLifecycleStatus } from '../types';
import { getNextMonthFirstDay } from '../utils/timeCalculations';
import { getPdfBase64, downloadPdf } from '../utils/pdfGenerator';
import { downloadSheetCsv } from '../utils/csvExporter';
import { sendPecRequest } from '../services/apiService';
import { ArubaPecTutorialModal } from './ArubaPecTutorialModal';
import { ArubaPecWizardModal } from './ArubaPecWizardModal';
import { ManualWebmailModal } from './ManualWebmailModal';

interface PecAutomationCardProps {
  sheet: MonthlySheet;
  pecSettings: PecSettings;
  pecLogs: PecLogEntry[];
  onUpdateSheet: (updatedSheet: MonthlySheet) => void;
  onRefreshLogs: () => void;
  onOpenSettings: () => void;
}

export const PecAutomationCard: React.FC<PecAutomationCardProps> = ({
  sheet,
  pecSettings,
  pecLogs,
  onUpdateSheet,
  onRefreshLogs,
  onOpenSettings,
}) => {
  const [isSending, setIsSending] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [customNote, setCustomNote] = useState<string>('');

  // Modals
  const [showPreSendModal, setShowPreSendModal] = useState<boolean>(false);
  const [showWebmailModal, setShowWebmailModal] = useState<boolean>(false);
  const [showTutorialModal, setShowTutorialModal] = useState<boolean>(false);
  const [showWizardModal, setShowWizardModal] = useState<boolean>(false);

  // Pre-send calculations
  const [computedPdfBase64, setComputedPdfBase64] = useState<string | null>(null);
  const [computedPdfSize, setComputedPdfSize] = useState<number>(0);
  const [computedSha256, setComputedSha256] = useState<string>('');
  const [isPreparingPdf, setIsPreparingPdf] = useState<boolean>(false);

  const nextDay1 = getNextMonthFirstDay(sheet.anno, sheet.mese);
  const today = new Date();
  const diffTime = nextDay1.date.getTime() - today.getTime();
  const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const sender = pecSettings.smtpUser || sheet.dipendente?.emailPec || 'dipendente.118@pec.it';
  const recipient = pecSettings.pecUfficioPersonale || '118centrale@sanitaserviceaslta.it';
  const ccRecipient = pecSettings.pecCopiaConoscenza;
  const mailSubject = `[S.E.T. 118] Trasmissione Prospetto Straordinari ${sheet.nomeMese} - Matr. ${sheet.dipendente?.matricola} ${sheet.dipendente?.cognome} ${sheet.dipendente?.nome}`;
  const pdfFilename = `Prospetto_Straordinari_SET118_${sheet.nomeMese.replace(/\s+/g, '_')}_${sheet.dipendente?.cognome}.pdf`;

  const mailBody = `Spett.le Ufficio Personale Sanitaservice ASL TA s.r.l. Unipersonale,

Si trasmette in allegato il prospetto ufficiale delle ore di straordinario ed eventuale monte ore effettuate per il servizio di emergenza-urgenza territoriale S.E.T. 118 nel mese di ${sheet.nomeMese}.

DATI DEL DIPENDENTE:
- Nominativo: ${sheet.dipendente?.cognome} ${sheet.dipendente?.nome}
- Matricola: ${sheet.dipendente?.matricola}
- Postazione 118: ${sheet.dipendente?.postazione}
- Qualifica: ${sheet.dipendente?.qualifica}

RIASSUNTO ORE EFFETTUATE:
- Totale Ore Monte Ore: ${sheet.totaleOreMonteOreFormatted || '0h 00m'}
- Totale Ore Straordinario: ${sheet.totaleOreStraordinarioFormatted || '0h 00m'}
- Totale Complessivo: ${sheet.totaleOreComplessivoFormatted || '0h 00m'}
- Numero Turni con Straordinario: ${sheet.entries ? sheet.entries.length : 0}

${customNote ? `Note aggiuntive del dipendente:\n${customNote}\n\n` : ''}Si resta a disposizione per eventuali chiarimenti.

Distinti saluti,
${sheet.dipendente?.nome} ${sheet.dipendente?.cognome}
Operatore S.E.T. 118 - Sanitaservice ASL TA`;

  // Calcolo SHA-256 per trasparenza pre-invio
  const handleOpenPreSendConfirm = async () => {
    if (!sheet.entries || sheet.entries.length === 0) {
      alert('Il prospetto non ha turni con straordinario registrati. Inserisci almeno un turno prima dell\'invio.');
      return;
    }

    if (sheet.status === 'INVIATO_PEC') {
      const confirmResend = confirm(
        'Attenzione: questo prospetto risulta GIÀ trasmesso in precedenza.\nVuoi preparare un nuovo invio PEC di rettifica/aggiornamento?'
      );
      if (!confirmResend) return;
    }

    setIsPreparingPdf(true);
    try {
      const b64 = await getPdfBase64(sheet);
      setComputedPdfBase64(b64);
      const binary = atob(b64);
      setComputedPdfSize(binary.length);

      // Calcolo hash SHA-256 client-side con Web Crypto API
      const uint8 = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) uint8[i] = binary.charCodeAt(i);
      const hashBuf = await crypto.subtle.digest('SHA-256', uint8);
      const hashArr = Array.from(new Uint8Array(hashBuf));
      const hashHex = hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
      setComputedSha256(hashHex);

      setShowPreSendModal(true);
    } catch (err: any) {
      alert(`Errore generazione PDF: ${err.message}`);
    } finally {
      setIsPreparingPdf(false);
    }
  };

  const handleConfirmAndSend = async () => {
    if (!computedPdfBase64) return;
    setShowPreSendModal(false);
    setIsSending(true);
    setFeedback(null);

    try {
      const result = await sendPecRequest({
        sheetId: sheet.id,
        pdfBase64: computedPdfBase64,
        note: customNote,
        filename: pdfFilename,
        subject: mailSubject,
        mailText: mailBody,
      });

      if (result.success) {
        const isSimulated = result.message?.includes('Simulazione') || pecSettings.simulazioneTestMode;
        setFeedback({
          type: 'success',
          message: isSimulated
            ? 'Anteprima PEC generata ed archiviata con successo in modalità simulazione. Nessun invio reale alla casella PEC.'
            : 'Messaggio inoltrato con successo al server SMTP! Ricevuta di accettazione iniziale generata. In attesa di ricevuta di consegna dal gestore del destinatario.',
        });

        const updatedSheet: MonthlySheet = {
          ...sheet,
          status: isSimulated ? 'PRONTO' : 'INVIATO_PEC',
          pecInvioInfo: {
            dataInvio: new Date().toISOString(),
            destinatario: recipient,
            mittente: sender,
            idMessaggio: result.log?.id || `SET118-${Date.now()}`,
            ricevutaAccettazione: !isSimulated,
            ricevutaConsegna: false, // Trasparenza rigorosa: non equiparare SMTP a consegna certificata!
            dataRicevutaAccettazione: !isSimulated ? new Date().toISOString() : undefined,
            lifecycleStatus: isSimulated ? 'BOZZA' : 'INOLTRATO_AL_SERVER',
          },
        };
        onUpdateSheet(updatedSheet);
        onRefreshLogs();
      } else {
        setFeedback({
          type: 'error',
          message: `Errore durante l'invio PEC: ${result.message}`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Errore: ${err.message || 'Impossibile completare la trasmissione'}`,
      });
    } finally {
      setIsSending(false);
    }
  };

  // Determine current lifecycle state
  const currentLifecycle = sheet.pecInvioInfo?.lifecycleStatus || (sheet.status === 'INVIATO_PEC' ? 'INOLTRATO_AL_SERVER' : 'BOZZA');

  return (
    <div className="space-y-6">
      {/* Banner Programmato & Promessa Operativa */}
      <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden transition-colors">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Trasmissione Certificata PEC S.E.T. 118</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Prospetto Straordinari Mensile — {sheet.nomeMese}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Trascrizione fedele sul modello ufficiale Sanitaservice ASL TA ed inoltro certificato all&apos;Ufficio Personale entro le ore {pecSettings.oraInvioGiorno1} del{' '}
              <strong className="text-emerald-400">{nextDay1.formatted}</strong>.
            </p>
          </div>

          {/* Widget Countdown & Stato */}
          <div className="bg-slate-800/80 dark:bg-slate-900 border border-slate-700 rounded-xl p-4 text-center min-w-[240px] shrink-0">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">
              Scadenza Invio Turni
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400">
              {nextDay1.formatted}
            </div>
            <div className="text-xs text-slate-300 mt-1 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tra circa {diffDays} giorni</span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700/80 flex items-center justify-between text-xs text-slate-300">
              <span>Stato Prospetto:</span>
              <span
                className={`font-bold ${
                  sheet.status === 'INVIATO_PEC'
                    ? 'text-emerald-400'
                    : sheet.entries.length > 0
                    ? 'text-amber-400'
                    : 'text-slate-400'
                }`}
              >
                {sheet.status === 'INVIATO_PEC'
                  ? 'INVIATO AL SERVER'
                  : sheet.entries.length > 0
                  ? 'PRONTO PER TRASMISSIONE'
                  : 'VUOTO (0 TURNI)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="text-xs sm:text-sm font-medium">{feedback.message}</div>
        </div>
      )}

      {/* Ciclo di Vita della PEC (6 Stati Chiaramente Distinti) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-600" />
            Ciclo di Vita Certificato del Messaggio PEC
          </span>
          <span className="text-[11px] text-slate-400">
            Trasparenza normativa: L&apos;inoltro SMTP non equivale alla consegna certificata
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
          {/* Step 1: Bozza */}
          <div
            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${
              currentLifecycle === 'BOZZA'
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 font-bold text-amber-900 dark:text-amber-200'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500'
            }`}
          >
            <span className="text-[10px] font-mono">1</span>
            <span className="font-semibold text-[11px]">Bozza</span>
            <span className="text-[10px] text-slate-400">Compilazione</span>
          </div>

          {/* Step 2: Invio in corso */}
          <div
            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${
              isSending
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40 font-bold text-blue-900 dark:text-blue-200'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500'
            }`}
          >
            <span className="text-[10px] font-mono">2</span>
            <span className="font-semibold text-[11px]">Invio in corso</span>
            <span className="text-[10px] text-slate-400">Socket TLS</span>
          </div>

          {/* Step 3: Inoltrato al server */}
          <div
            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${
              currentLifecycle === 'INOLTRATO_AL_SERVER' || sheet.status === 'INVIATO_PEC'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 font-bold text-emerald-900 dark:text-emerald-200'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500'
            }`}
          >
            <span className="text-[10px] font-mono">3</span>
            <span className="font-semibold text-[11px]">Inoltrato al Server</span>
            <span className="text-[10px] text-slate-400">SMTP OK</span>
          </div>

          {/* Step 4: Ricevuta di accettazione */}
          <div
            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${
              sheet.pecInvioInfo?.ricevutaAccettazione
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 font-bold text-emerald-900 dark:text-emerald-200'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500'
            }`}
          >
            <span className="text-[10px] font-mono">4</span>
            <span className="font-semibold text-[11px]">Accettazione</span>
            <span className="text-[10px] text-slate-400">Gestore Aruba</span>
          </div>

          {/* Step 5: Ricevuta di consegna */}
          <div
            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${
              sheet.pecInvioInfo?.ricevutaConsegna
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 font-bold text-emerald-900 dark:text-emerald-200'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500'
            }`}
          >
            <span className="text-[10px] font-mono">5</span>
            <span className="font-semibold text-[11px]">Consegna</span>
            <span className="text-[10px] text-slate-400">Casella Ricevente</span>
          </div>

          {/* Step 6: Esito Finale */}
          <div
            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${
              sheet.status === 'INVIATO_PEC'
                ? 'border-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 font-bold text-emerald-950 dark:text-emerald-100'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500'
            }`}
          >
            <span className="text-[10px] font-mono">6</span>
            <span className="font-semibold text-[11px]">Certificato</span>
            <span className="text-[10px] text-slate-400">Valore Legale</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Card Invio + Riepilogo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Invio Diretto & Azioni Guidate */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Invio Prospetto Straordinari
                </h3>
                <span className="text-[11px] text-slate-400">
                  Modello Ufficiale S.E.T. 118 ASL Taranto
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTutorialModal(true)}
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Tutorial Aruba</span>
              </button>
              <button
                onClick={() => setShowWizardModal(true)}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:underline flex items-center gap-1 cursor-pointer ml-2"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Configura PEC</span>
              </button>
            </div>
          </div>

          {/* Dati Destinatari & Mittente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 font-semibold block text-[10px]">Destinatario PEC Ufficiale:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white truncate block mt-0.5">
                {recipient}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 font-semibold block text-[10px]">Mittente PEC Dipendente:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white truncate block mt-0.5">
                {sender}
              </span>
            </div>
          </div>

          {/* Anteprima Documento & Oggetto */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span>Oggetto del Messaggio Certificato</span>
              <span className="text-[10px] font-mono text-slate-500">Standard S.E.T. 118</span>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 font-mono text-slate-800 dark:text-slate-200 space-y-2">
              <p className="font-bold text-slate-900 dark:text-white text-[11px] leading-relaxed">
                {mailSubject}
              </p>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                <span>Allegato: </span>
                <button
                  type="button"
                  onClick={() => downloadPdf(sheet)}
                  className="font-bold text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  {pdfFilename}
                </button>
              </div>
            </div>
          </div>

          {/* Note Opzionali */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Note aggiuntive per l&apos;Ufficio Personale (opzionale)
            </label>
            <input
              type="text"
              placeholder="Es. Straordinario autorizzato dal Coordinatore per prolungamento soccorso..."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          {/* Bottoni Azione */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {sheet.entries && sheet.entries.length > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pronto: {sheet.entries.length} turni registrati
                </span>
              ) : (
                <span className="text-amber-600 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Nessun turno registrato in questo mese
                </span>
              )}
            </span>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowWebmailModal(true)}
                className="w-full sm:w-auto px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer flex items-center justify-center gap-1.5"
                title="Procedura manuale Webmail Aruba"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Procedura Webmail</span>
              </button>

              <button
                type="button"
                disabled={isSending || isPreparingPdf}
                onClick={handleOpenPreSendConfirm}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                {isSending || isPreparingPdf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Preparazione...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Invia PEC Ufficiale</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Riepilogo & Ricevute */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
              <FileCheck className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Riepilogo Ore del Mese</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Mese:</span>
              <span className="font-bold text-slate-900 dark:text-white">{sheet.nomeMese}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Monte Ore:</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {sheet.totaleOreMonteOreFormatted || '0h 00m'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Straordinario:</span>
              <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                {sheet.totaleOreStraordinarioFormatted || '0h 00m'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Totale Complessivo:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {sheet.totaleOreComplessivoFormatted || '0h 00m'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Turni inseriti:</span>
              <span className="font-mono font-bold">{sheet.entries ? sheet.entries.length : 0}</span>
            </div>
          </div>

          {sheet.pecInvioInfo && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Trasmissione Registrata</span>
              </div>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                Data: {new Date(sheet.pecInvioInfo.dataInvio).toLocaleString('it-IT')}
              </p>
              <p className="text-[10px] font-mono truncate text-slate-500">
                ID: {sheet.pecInvioInfo.idMessaggio}
              </p>
            </div>
          )}

          <div className="pt-2 space-y-2">
            <button
              onClick={() => downloadSheetCsv(sheet)}
              className="w-full py-2 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Esporta Dati Mese (CSV)</span>
            </button>

            <button
              onClick={() => downloadPdf(sheet)}
              className="w-full py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Scarica Documento PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODALE CONFERMA ESPLICITA PRE-INVIO PEC (REQUISITO DI TRASPARENZA) */}
      {showPreSendModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Conferma Trasmissione PEC
                </h3>
              </div>
              <button
                onClick={() => setShowPreSendModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Verifica con attenzione i dati prima di procedere. L&apos;operazione genererà una comunicazione con valore legale.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="font-sans text-slate-500 font-semibold">Mittente PEC:</span>
                <span className="font-bold text-slate-900 dark:text-white">{sender}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-500 font-semibold">Destinatario:</span>
                <span className="font-bold text-slate-900 dark:text-white">{recipient}</span>
              </div>
              {ccRecipient && (
                <div className="flex justify-between">
                  <span className="font-sans text-slate-500 font-semibold">Copia per Conoscenza:</span>
                  <span className="text-slate-700 dark:text-slate-300">{ccRecipient}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-sans text-slate-500 font-semibold">Oggetto:</span>
                <span className="truncate max-w-[280px] font-sans text-slate-900 dark:text-white font-bold">
                  {mailSubject}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center font-sans">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    Allegato: {pdfFilename}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Dimensione: {(computedPdfSize / 1024).toFixed(1)} KB · SHA-256: {computedSha256.slice(0, 16)}...
                  </span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200">
              <span className="font-bold block">Avviso:</span>
              La conferma invierà il messaggio al server PEC e archivierà automaticamente il file originale nell&apos;archivio privato del tuo account.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPreSendModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Annulla
              </button>

              <button
                type="button"
                onClick={handleConfirmAndSend}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Conferma e Invia PEC</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Procedura Manuale Webmail Aruba */}
      {showWebmailModal && (
        <ManualWebmailModal
          isOpen={showWebmailModal}
          onClose={() => setShowWebmailModal(false)}
          sheet={sheet}
          profile={sheet.dipendente}
          pecSettings={pecSettings}
          onMarkAsSent={(dateIso) => {
            const updatedSheet: MonthlySheet = {
              ...sheet,
              status: 'INVIATO_PEC',
              pecInvioInfo: {
                dataInvio: dateIso,
                destinatario: recipient,
                mittente: sender,
                idMessaggio: `WEBMAIL-MANUAL-${Date.now()}`,
                ricevutaAccettazione: true,
                ricevutaConsegna: false,
                lifecycleStatus: 'INOLTRATO_AL_SERVER',
              },
            };
            onUpdateSheet(updatedSheet);
            onRefreshLogs();
          }}
        />
      )}

      {/* Modale Tutorial Scritto Aruba PEC */}
      {showTutorialModal && (
        <ArubaPecTutorialModal
          isOpen={showTutorialModal}
          onClose={() => setShowTutorialModal(false)}
        />
      )}

      {/* Modale Procedura Guidata Collega Aruba PEC */}
      {showWizardModal && (
        <ArubaPecWizardModal
          isOpen={showWizardModal}
          onClose={() => setShowWizardModal(false)}
          settings={pecSettings}
          onSave={(updated) => {
            // Callback salvataggio
          }}
          onOpenManualWebmail={() => {
            setShowWizardModal(false);
            setShowWebmailModal(true);
          }}
        />
      )}
    </div>
  );
};
