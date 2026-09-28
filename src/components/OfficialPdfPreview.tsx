import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  Plus,
  Send,
  Trash2,
  FileSpreadsheet,
  PenTool,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Check,
  RefreshCw,
} from 'lucide-react';
import { MonthlySheet, OvertimeEntry, DigitalSignature, EmployeeProfile } from '../types';
import { downloadPdf, generateOfficialSet118Pdf } from '../utils/pdfGenerator';
import { downloadSheetCsv } from '../utils/csvExporter';
import { DigitalSignatureModal } from './DigitalSignatureModal';

interface OfficialPdfPreviewProps {
  sheet: MonthlySheet;
  onOpenAddModal: () => void;
  onDeleteEntry: (entryId: string) => void;
  onGoToPec: () => void;
  onUpdateSheet?: (updated: MonthlySheet) => void;
  onSaveProfile?: (updatedProfile: EmployeeProfile) => void;
}

export const OfficialPdfPreview: React.FC<OfficialPdfPreviewProps> = ({
  sheet,
  onOpenAddModal,
  onDeleteEntry,
  onGoToPec,
  onUpdateSheet,
  onSaveProfile,
}) => {
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signatureNotice, setSignatureNotice] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationBlockReason, setValidationBlockReason] = useState<string | null>(null);

  const dipendente = sheet.dipendente;
  const entries = sheet.entries || [];

  // Guarantee at least 11 rows to mirror the physical template and leave optimal space for footer
  const totalRowsToShow = Math.max(11, entries.length);
  const rowsArray = Array.from({ length: totalRowsToShow });

  // Convalida formale collegata all'esatta versione del modulo e della firma
  const isCurrentVersionValidated = Boolean(
    sheet.convalida &&
      sheet.convalida.stato === 'CONVALIDATO' &&
      sheet.convalida.sheetUpdatedAt === sheet.updatedAt &&
      !sheet.richiedeNuovaFirma &&
      Boolean(sheet.firmaDipendente?.dataUrl || sheet.firmaDipendente?.fileName)
  );

  const handlePrint = () => {
    window.print();
  };

  const handleSaveSignature = (signature: DigitalSignature, saveToProfile: boolean) => {
    const updatedSheet: MonthlySheet = {
      ...sheet,
      firmaDipendente: signature,
      richiedeNuovaFirma: false,
      motivoNuovaFirma: undefined,
      firmaAutorizzata: true,
      convalida: undefined, // Qualsiasi modifica alla firma invalida la precedente convalida
      updatedAt: new Date().toISOString(),
    };

    if (onUpdateSheet) {
      onUpdateSheet(updatedSheet);
    }

    if (saveToProfile && onSaveProfile && sheet.dipendente) {
      onSaveProfile({
        ...sheet.dipendente,
        firmaSalvata: signature,
      });
    }

    setSignatureNotice('Firma salvata e applicata al prospetto. Procedi alla convalida del modulo per abilitare l\'invio.');
    setTimeout(() => setSignatureNotice(null), 5000);
  };

  const handleApplyProfileSignature = () => {
    if (!dipendente?.firmaSalvata) {
      setIsSignatureModalOpen(true);
      return;
    }
    const updatedSheet: MonthlySheet = {
      ...sheet,
      firmaDipendente: dipendente.firmaSalvata,
      richiedeNuovaFirma: false,
      motivoNuovaFirma: undefined,
      firmaAutorizzata: true,
      convalida: undefined, // Richiede nuova convalida
      updatedAt: new Date().toISOString(),
    };
    if (onUpdateSheet) {
      onUpdateSheet(updatedSheet);
    }
    setSignatureNotice('Firma del profilo applicata al modulo corrente. Convalida la versione attuale per procedere.');
    setTimeout(() => setSignatureNotice(null), 4000);
  };

  const handleRemoveSignature = () => {
    if (confirm('Vuoi rimuovere la firma da questo foglio? Lo spazio firma rimarrà vuoto.')) {
      const updatedSheet: MonthlySheet = {
        ...sheet,
        firmaDipendente: undefined,
        richiedeNuovaFirma: false,
        motivoNuovaFirma: undefined,
        firmaAutorizzata: false,
        convalida: undefined,
        updatedAt: new Date().toISOString(),
      };
      if (onUpdateSheet) {
        onUpdateSheet(updatedSheet);
      }
    }
  };

  const handleValidateDocument = async () => {
    setValidationBlockReason(null);

    if (!sheet.firmaDipendente) {
      setValidationBlockReason('Per convalidare il modulo ufficiale è obbligatorio aver apposto la tua firma autorizzata.');
      return;
    }

    if (sheet.richiedeNuovaFirma) {
      setValidationBlockReason('I dati del prospetto sono stati modificati dopo la firma: la firma precedente è decaduta. Premi "Rinnova Firma" prima di convalidare.');
      return;
    }

    setIsValidating(true);
    try {
      // Genera il PDF reale e calcola hash SHA-256
      const doc = await generateOfficialSet118Pdf(sheet);
      const pdfBase64 = doc.output('datauristring').split(',')[1];

      let pdfSha = 'pdf-ok';
      if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        const bin = atob(pdfBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const hashBuf = await window.crypto.subtle.digest('SHA-256', bytes);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        pdfSha = hashArr.map((b) => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
      }

      const now = new Date().toISOString();
      const updatedSheet: MonthlySheet = {
        ...sheet,
        convalida: {
          stato: 'CONVALIDATO',
          timestamp: now,
          sheetUpdatedAt: sheet.updatedAt || now,
          signatureSha256: sheet.firmaDipendente.sha256,
          pdfSha256: pdfSha,
          operatore: `${dipendente?.cognome || ''} ${dipendente?.nome || ''}`.trim() || `Matr. ${dipendente?.matricola || ''}`,
          avvisoConformita:
            'La presente convalida attesta il completamento del controllo e della compilazione del modulo da parte del dipendente. Non costituisce certificato di firma digitale qualificata (FEQ) o SPID/CIE.',
        },
        status: 'PRONTO',
      };

      if (onUpdateSheet) {
        onUpdateSheet(updatedSheet);
      }
      setSignatureNotice('Modulo convalidato con successo nella versione corrente. Ora puoi inviarlo via PEC o scaricarlo.');
      setTimeout(() => setSignatureNotice(null), 5000);
    } catch (err: any) {
      console.error('Error validating document:', err);
      setValidationBlockReason('Errore durante la generazione e convalida del documento PDF: ' + (err.message || 'Riprova.'));
    } finally {
      setIsValidating(false);
    }
  };

  const handleAttemptSendPec = () => {
    if (!sheet.firmaDipendente) {
      setValidationBlockReason('Invio bloccato: il foglio non contiene una firma autorizzata. Apponi la firma prima di procedere alla trasmissione.');
      return;
    }
    if (sheet.richiedeNuovaFirma) {
      setValidationBlockReason('Invio bloccato: il documento è stato modificato dopo la firma. La firma precedente è decaduta: rinnova la firma e convalida il prospetto prima dell\'invio.');
      return;
    }
    if (!isCurrentVersionValidated) {
      setValidationBlockReason('Invio bloccato: il documento deve essere prima verificato e convalidato nella versione attuale premendo il tasto "Verifica e Convalida Modulo".');
      return;
    }
    onGoToPec();
  };

  return (
    <div className="space-y-6">
      {/* Top Action Toolbar */}
      <div className="no-print bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-700 dark:text-rose-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Modello Originale S.E.T. 118 Sanitaservice ASL TA
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Trascrizione automatica fedele al modulo cartaceo ufficiale · Mese di {sheet.nomeMese}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Firma Originale / Digitale button */}
          <button
            onClick={() => setIsSignatureModalOpen(true)}
            className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-xs ${
              sheet.richiedeNuovaFirma
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                : sheet.firmaDipendente
                ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700 hover:bg-teal-100'
                : 'bg-teal-600 hover:bg-teal-700 text-white'
            }`}
          >
            {sheet.richiedeNuovaFirma ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Rinnova Firma</span>
              </>
            ) : sheet.firmaDipendente ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="truncate">Firma Apposta</span>
              </>
            ) : (
              <>
                <PenTool className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Firma Foglio</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenAddModal}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Aggiungi Riga</span>
          </button>

          {/* Esporta CSV backup */}
          <button
            onClick={() => downloadSheetCsv(sheet)}
            title="Esporta dati in formato CSV per backup offline"
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">Esporta CSV</span>
          </button>

          <button
            onClick={() => downloadPdf(sheet)}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Scarica PDF A4</span>
          </button>

          <button
            onClick={handlePrint}
            className="hidden sm:inline-flex min-h-[44px] items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Stampa</span>
          </button>

          <button
            onClick={handleAttemptSendPec}
            className={`col-span-2 sm:col-span-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer shadow-xs ${
              isCurrentVersionValidated
                ? 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700'
                : 'bg-slate-700/80 hover:bg-slate-700'
            }`}
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
            <span>Invia a PEC</span>
          </button>
        </div>
      </div>

      {/* PANNELLO DI CONVALIDA E FEDELTÀ MODULO: 3 LIVELLI DISTINTI */}
      <div className="no-print bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Stato Convalida e Firma del Modulo
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Versione prospetto: {sheet.updatedAt ? new Date(sheet.updatedAt).toLocaleTimeString('it-IT') : 'Originale'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* LIVELLO 1: Firma salvata nel profilo */}
          <div className="p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                <span>1. Firma nel Profilo</span>
                {dipendente?.firmaSalvata ? (
                  <span className="text-teal-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Presente
                  </span>
                ) : (
                  <span className="text-amber-600 font-semibold">Non impostata</span>
                )}
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed">
                {dipendente?.firmaSalvata
                  ? `Archiviata nel profilo personale (${dipendente.firmaSalvata.dataFirma})`
                  : 'Nessuna firma predefinita memorizzata nel profilo utente.'}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700 flex items-center gap-2">
              {dipendente?.firmaSalvata && !sheet.firmaDipendente && (
                <button
                  type="button"
                  onClick={handleApplyProfileSignature}
                  className="w-full py-1.5 px-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-[11px]"
                >
                  Applica a questo foglio
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsSignatureModalOpen(true)}
                className="text-teal-700 dark:text-teal-400 hover:underline font-semibold text-[11px] cursor-pointer"
              >
                {dipendente?.firmaSalvata ? 'Modifica nel profilo' : 'Carica firma nel profilo'}
              </button>
            </div>
          </div>

          {/* LIVELLO 2: Firma applicata al modulo corrente */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 ${
              sheet.richiedeNuovaFirma
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                : sheet.firmaDipendente
                ? 'bg-teal-50/50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-1">
                <span className="text-slate-500">2. Firma sul Modulo</span>
                {sheet.richiedeNuovaFirma ? (
                  <span className="text-rose-600 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Decaduta
                  </span>
                ) : sheet.firmaDipendente ? (
                  <span className="text-teal-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Applicata
                  </span>
                ) : (
                  <span className="text-amber-600 font-bold">Non applicata</span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed">
                {sheet.richiedeNuovaFirma ? (
                  <span className="text-rose-700 dark:text-rose-300 font-medium">
                    Dati modificati dopo la firma: la firma precedente è decaduta per conformità.
                  </span>
                ) : sheet.firmaDipendente ? (
                  <span className="text-teal-800 dark:text-teal-200">
                    Firma autorizzata per questo foglio ({sheet.firmaDipendente.dataFirma}).
                  </span>
                ) : (
                  <span className="text-amber-800 dark:text-amber-200">
                    Nessuna firma applicata. Il foglio non può essere trasmesso senza firma.
                  </span>
                )}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between">
              {sheet.richiedeNuovaFirma ? (
                <button
                  type="button"
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="w-full py-1.5 px-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-[11px]"
                >
                  Rinnova firma ora
                </button>
              ) : sheet.firmaDipendente ? (
                <div className="flex items-center justify-between w-full">
                  <button
                    type="button"
                    onClick={() => setIsSignatureModalOpen(true)}
                    className="text-teal-700 dark:text-teal-300 hover:underline font-semibold text-[11px] cursor-pointer"
                  >
                    Cambia firma
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveSignature}
                    className="text-rose-600 hover:underline text-[11px] cursor-pointer"
                  >
                    Rimuovi
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="w-full py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-[11px]"
                >
                  Apponi firma sul foglio
                </button>
              )}
            </div>
          </div>

          {/* LIVELLO 3: Convalida PDF per invio */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 ${
              isCurrentVersionValidated
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-1">
                <span className="text-slate-500">3. Convalida Modulo</span>
                {isCurrentVersionValidated ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Convalidato
                  </span>
                ) : (
                  <span className="text-slate-500 font-semibold">Da verificare</span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed">
                {isCurrentVersionValidated ? (
                  <span className="text-emerald-800 dark:text-emerald-200">
                    Verificato il {new Date(sheet.convalida!.timestamp).toLocaleTimeString('it-IT')} · Pronto per trasmissione PEC e download.
                  </span>
                ) : (
                  <span className="text-slate-600 dark:text-slate-400">
                    Controlla i dati del prospetto e convalida la versione attuale per abilitare l&apos;invio.
                  </span>
                )}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700">
              <button
                type="button"
                disabled={isValidating || !sheet.firmaDipendente || sheet.richiedeNuovaFirma}
                onClick={handleValidateDocument}
                className={`w-full py-1.5 px-2 text-center rounded-lg font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isCurrentVersionValidated
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : !sheet.firmaDipendente || sheet.richiedeNuovaFirma
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs'
                }`}
              >
                {isValidating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generazione PDF e verifica...</span>
                  </>
                ) : isCurrentVersionValidated ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Riconvalida versione attuale</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Verifica e Convalida Modulo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Blocking alert notice if attempted to send without validation */}
        {validationBlockReason && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-900 dark:text-rose-200 flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Azione bloccata:</p>
                <p className="text-[11px]">{validationBlockReason}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setValidationBlockReason(null)}
              className="text-xs font-bold text-rose-700 hover:text-rose-900 cursor-pointer"
            >
              Chiudi
            </button>
          </div>
        )}

        <p className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center">
          Nota di conformità: la convalida dell&apos;applicazione attesta il completamento del controllo e della compilazione del modulo da parte del dipendente. Non costituisce certificato di firma digitale qualificata (FEQ) o SPID/CIE.
        </p>
      </div>

      {/* Real Confirmation Banner after successful signature saving */}
      {signatureNotice && (
        <div className="no-print p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-100 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">{signatureNotice}</span>
          </div>
          <button
            onClick={() => setSignatureNotice(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 cursor-pointer font-bold"
          >
            OK
          </button>
        </div>
      )}

      {/* Signature Status Alerts */}
      {sheet.richiedeNuovaFirma ? (
        <div className="no-print p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <p className="font-bold">Attenzione: Documento Modificato dopo la Firma</p>
              <p className="text-[11px] text-rose-700 dark:text-rose-300">
                I dati dei turni sono stati modificati dopo l&apos;apposizione della firma precedente. La firma non è più valida ed è decaduta: è necessaria una nuova autorizzazione/sottoscrizione prima di procedere.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSignatureModalOpen(true)}
            className="px-3 py-1.5 font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-lg shrink-0 cursor-pointer shadow-xs whitespace-nowrap"
          >
            Rinnova Firma Ora
          </button>
        </div>
      ) : !sheet.firmaDipendente ? (
        <div className="no-print p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <PenTool className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              Il foglio non contiene una firma autorizzata. Verrà esportato con lo spazio firma vuoto per sottoscrizione manuale o firma digitale esterna.
            </span>
          </div>
          <button
            onClick={() => setIsSignatureModalOpen(true)}
            className="px-3 py-1.5 font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg shrink-0 cursor-pointer shadow-xs"
          >
            Autorizza Firma
          </button>
        </div>
      ) : null}

      {/* Mobile-only scroll hint */}
      <div className="lg:hidden flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1 py-1">
        <span>👈 Scorri in orizzontale per vedere il foglio intero 👉</span>
        <button
          onClick={() => downloadPdf(sheet)}
          className="text-rose-600 dark:text-rose-400 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
        >
          <Download className="w-3 h-3" />
          Scarica PDF
        </button>
      </div>

      {/* Sheet Container: Exact Replica of the Official Paper Template */}
      <div className="overflow-x-auto pb-6 touch-scroll -mx-2 px-2 sm:mx-0 sm:px-0">
        <div
          id="printable-official-sheet"
          className="bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-xl border border-slate-300 max-w-[1050px] mx-auto min-w-[900px] font-sans selection:bg-rose-200 selection:text-slate-900"
        >
          {/* Header Modulo Originale con Loghi Ufficiali Sanitaservice e ASL Taranto */}
          <div className="flex items-center justify-between border-b border-slate-300 pb-4 mb-6">
            <div className="w-1/3">
              <img
                src="/loghi_originali_pdf.png?v=2"
                alt="Sanitaservice ASL TA s.r.l. Unipersonale · ASL Taranto PugliaSalute"
                className="h-12 sm:h-14 w-auto object-contain"
              />
            </div>
            <div className="w-2/4 text-center space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                S.E.T. 118
              </h2>
              <div className="pt-1">
                <span className="text-sm font-bold uppercase tracking-wider underline">
                  PROSPETTO ORE STRAORDINARIO ED EVENTUALE MONTE ORE
                </span>
              </div>
              <div className="text-xs font-semibold pt-1">
                <span>Mese di: </span>
                <strong className="underline uppercase tracking-wide">
                  {sheet.nomeMese}
                </strong>
              </div>
            </div>
            <div className="w-1/4 text-right">
              <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-widest border border-slate-200 px-2 py-1 rounded-sm">
                MOD. SET-118
              </span>
            </div>
          </div>

          {/* Employee Identification Header Box */}
          <div className="grid grid-cols-12 gap-y-2 gap-x-4 text-xs font-semibold mb-6 pb-2">
            <div className="col-span-5 flex items-center gap-1">
              <span className="font-bold uppercase">COGNOME E NOME:</span>
              <span className="border-b border-dotted border-slate-500 flex-1 px-1 font-bold text-slate-900">
                {dipendente?.cognome} {dipendente?.nome}
              </span>
            </div>

            <div className="col-span-3 flex items-center gap-1">
              <span className="font-bold uppercase">MATR.:</span>
              <span className="border-b border-dotted border-slate-500 flex-1 px-1 font-mono font-bold text-slate-900">
                {dipendente?.matricola || ''}
              </span>
            </div>

            <div className="col-span-4 flex items-center gap-1">
              <span className="font-bold uppercase">POSTAZIONE:</span>
              <span className="border-b border-dotted border-slate-500 flex-1 px-1 font-medium">
                {dipendente?.postazione || 'Taranto Centro - 118'}
              </span>
            </div>

            <div className="col-span-8 flex items-center gap-1 mt-1">
              <span className="font-bold uppercase">QUALIFICA:</span>
              <span className="border-b border-dotted border-slate-500 flex-1 px-1 font-medium">
                {dipendente?.qualifica || 'Autista Soccorritore 118'}
              </span>
            </div>

            <div className="col-span-4 flex items-center gap-1 mt-1 justify-end text-[11px] text-slate-500 font-mono">
              <span>Modello Ufficiale ASL TA</span>
            </div>
          </div>

          {/* Official Form Table Structure */}
          <div className="border-2 border-slate-900 mb-6">
            <table className="w-full text-center border-collapse text-[11px]">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 font-bold uppercase text-slate-800 leading-tight">
                  <th className="border-r border-slate-800 py-2 px-1 w-14">Giorno</th>
                  <th className="border-r border-slate-800 py-2 px-2 w-28">Orario Ordinario</th>
                  <th className="border-r border-slate-800 py-2 px-2 w-32">Orario Straordinario</th>
                  <th className="border-r border-slate-800 py-2 px-3 text-left">Motivo dello Straordinario</th>
                  <th className="border-r border-slate-800 py-2 px-2 w-24">Monte Ore</th>
                  <th className="border-r border-slate-800 py-2 px-2 w-28">Straordinario</th>
                  <th className="border-r border-slate-800 py-2 px-2 w-28">Firma Coordinatore</th>
                  <th className="py-2 px-1 w-8 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {rowsArray.map((_, index) => {
                  const entry: OvertimeEntry | undefined = entries[index];
                  return (
                    <tr
                      key={entry ? entry.id : `empty-${index}`}
                      className="border-b border-slate-400 h-9 transition-colors group"
                    >
                      {/* Giorno */}
                      <td className="border-r border-slate-800 font-mono font-bold text-slate-900 px-1">
                        {entry?.giorno || '\u00A0'}
                      </td>

                      {/* Orario Ordinario */}
                      <td className="border-r border-slate-800 font-mono text-slate-700 px-1">
                        {entry?.orarioOrdinario || '\u00A0'}
                      </td>

                      {/* Orario Straordinario */}
                      <td className="border-r border-slate-800 font-mono font-bold text-slate-900 px-1">
                        {entry?.orarioStraordinario || '\u00A0'}
                      </td>

                      {/* Motivo Straordinario */}
                      <td className="border-r border-slate-800 text-left px-2 text-slate-900 font-medium">
                        {entry?.motivo || '\u00A0'}
                      </td>

                      {/* Monte Ore */}
                      <td className="border-r border-slate-800 font-mono font-bold text-amber-900 px-1 bg-amber-50/20">
                        {entry?.totaleOreMonteOre || '\u00A0'}
                      </td>

                      {/* Straordinario */}
                      <td className="border-r border-slate-800 font-mono font-bold text-teal-950 px-1 bg-teal-50/20">
                        {entry?.totaleOreStraordinario || '\u00A0'}
                      </td>

                      {/* Firma Coordinatore */}
                      <td className="border-r border-slate-800 text-[10px] text-slate-600 px-1 italic">
                        {entry ? (entry.firmaCoordinatore || 'Autorizzato') : '\u00A0'}
                      </td>

                      {/* Delete action button for print/web */}
                      <td className="no-print text-center px-1">
                        {entry && (
                          <button
                            onClick={() => onDeleteEntry(entry.id)}
                            title="Elimina riga"
                            className="text-slate-300 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Totals Row */}
                <tr className="border-t-2 border-slate-900 bg-slate-100 font-bold text-slate-900">
                  <td colSpan={4} className="border-r border-slate-800 py-2 px-3 text-right uppercase tracking-wider text-xs">
                    Totale Complessivo Ore Svolte:{' '}
                    <span className="font-mono text-slate-900 font-extrabold ml-1.5 text-xs bg-white px-2 py-0.5 rounded border border-slate-300">
                      {sheet.totaleOreComplessivoFormatted || '0h 00m'}
                    </span>
                  </td>
                  <td className="border-r border-slate-800 py-2 px-2 font-mono text-xs text-amber-900 bg-amber-100/50 text-center">
                    {sheet.totaleOreMonteOreFormatted || '0h 00m'}
                  </td>
                  <td className="border-r border-slate-800 py-2 px-2 font-mono text-xs text-teal-950 bg-teal-100/50 text-center">
                    {sheet.totaleOreStraordinarioFormatted || '0h 00m'}
                  </td>
                  <td className="border-r border-slate-800 py-2 px-2 text-[10px] text-slate-600 text-center italic">
                    {dipendente?.coordinatoreNome ? `Visto Coord.` : 'Visto Coord.'}
                  </td>
                  <td className="no-print"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer Date and Signatures Area - Perfectly Centered and Symmetrical */}
          <div className="pt-8 border-t border-slate-200 mt-6">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-6 font-mono">
              <div>
                <span>Data emissione documento: </span>
                <strong className="text-slate-800 font-sans font-bold">{new Date().toLocaleDateString('it-IT')}</strong>
              </div>
              <div>
                <span>S.E.T. 118 Taranto · Postazione: </span>
                <strong className="text-slate-800 font-sans font-bold">{dipendente?.postazione || 'Taranto Centro'}</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 text-slate-900">
              {/* Operator Signature Box - Centered in Column 1 */}
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Firma del Dipendente
                  </p>
                  {sheet.firmaDipendente && !sheet.richiedeNuovaFirma && (
                    <button
                      onClick={handleRemoveSignature}
                      className="no-print text-[10px] text-slate-400 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer ml-1"
                      title="Rimuovi firma"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Rimuovi
                    </button>
                  )}
                </div>

                <div
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="border-b-2 border-slate-900 w-full max-w-xs sm:max-w-sm min-h-[72px] flex flex-col items-center justify-center pb-1.5 cursor-pointer hover:bg-slate-50/80 transition-colors rounded-t-sm relative group mx-auto"
                  title="Clicca per autorizzare o aggiornare la firma"
                >
                  {sheet.richiedeNuovaFirma ? (
                    <div className="flex flex-col items-center justify-center py-1 text-rose-600 text-center px-2">
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        Firma Decaduta per Modifica
                      </span>
                      <span className="no-print text-[10px] font-semibold text-rose-600 underline mt-1">
                        Clicca per Apporre Nuova Firma
                      </span>
                    </div>
                  ) : sheet.firmaDipendente?.dataUrl ? (
                    <div className="flex flex-col items-center space-y-1">
                      <img
                        src={sheet.firmaDipendente.dataUrl}
                        alt="Firma Dipendente"
                        className="max-h-12 w-auto object-contain mx-auto"
                      />
                      <div className="flex items-center gap-1 text-[9px] font-mono text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        <ShieldCheck className="w-3 h-3 text-teal-600 shrink-0" />
                        <span>Firma originale autorizzata: {sheet.firmaDipendente.dataFirma}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-1 text-slate-400 group-hover:text-teal-700">
                      <span className="text-[11px] text-slate-400 italic">
                        Spazio vuoto (In attesa di firma)
                      </span>
                      <span className="no-print text-[10px] font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200 flex items-center gap-1 mt-1">
                        <PenTool className="w-2.5 h-2.5" />
                        Clicca per Autorizzare Firma
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1.5 italic">
                  (Firma leggibile dell&apos;Operatore Soccorritore 118)
                </span>
              </div>

              {/* Coordinator Signature Box - Centered in Column 2 */}
              <div className="flex flex-col items-center text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Firma del Coordinatore S.E.T. 118
                </p>
                <div className="border-b-2 border-slate-900 w-full max-w-xs sm:max-w-sm min-h-[72px] flex flex-col items-center justify-center pb-1.5 text-center mx-auto">
                  <span className="text-[11px] text-slate-400 italic">
                    Spazio riservato alla firma autentica del Coordinatore
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1.5 italic">
                  (Visto e autorizzazione del Coordinatore del Servizio)
                </span>
              </div>
            </div>
          </div>

          {/* Official Document Footer (Piè di pagina) */}
          <div className="mt-8 pt-3 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 font-mono gap-1">
            <span className="font-bold text-slate-700">Documento Ufficiale S.E.T. 118</span>
            <span>Sanitaservice ASL TA s.r.l. Unipersonale · S.E.T. 118 Emergenza Territoriale</span>
            <span>{dipendente?.matricola ? `Matr. ${dipendente.matricola}` : ''}</span>
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      {dipendente && (
        <DigitalSignatureModal
          isOpen={isSignatureModalOpen}
          onClose={() => setIsSignatureModalOpen(false)}
          onSaveSignature={handleSaveSignature}
          profile={dipendente}
          existingSignature={sheet.firmaDipendente || dipendente.firmaSalvata}
          sheetId={sheet.id}
        />
      )}
    </div>
  );
};
