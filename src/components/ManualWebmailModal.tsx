import React, { useState } from 'react';
import {
  ExternalLink,
  Download,
  Copy,
  Check,
  AlertCircle,
  FileText,
  Mail,
  X,
  Send,
  CheckCircle2,
} from 'lucide-react';
import { MonthlySheet, EmployeeProfile, PecSettings } from '../types';
import { downloadPdf } from '../utils/pdfGenerator';

interface ManualWebmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheet: MonthlySheet;
  profile: EmployeeProfile;
  pecSettings: PecSettings;
  onMarkAsSent?: (dateIso: string) => void;
}

export const ManualWebmailModal: React.FC<ManualWebmailModalProps> = ({
  isOpen,
  onClose,
  sheet,
  profile,
  pecSettings,
  onMarkAsSent,
}) => {
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedRecipient, setCopiedRecipient] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [sentConfirmed, setSentConfirmed] = useState(false);

  if (!isOpen) return null;

  const recipient = pecSettings.pecUfficioPersonale || '118centrale@sanitaserviceaslta.it';
  const ccRecipient = pecSettings.pecCopiaConoscenza || 'coordinamento118@sanitaserviceaslta.it';
  const subject = `[S.E.T. 118] Trasmissione Prospetto Straordinari ${sheet.nomeMese} - Matr. ${profile.matricola} ${profile.cognome} ${profile.nome}`;

  const mailBody = `Spett.le Ufficio Personale Sanitaservice ASL TA s.r.l. Unipersonale,

Si trasmette in allegato il prospetto ufficiale delle ore di straordinario ed eventuale monte ore effettuate per il servizio di emergenza-urgenza territoriale S.E.T. 118 nel mese di ${sheet.nomeMese}.

DATI DEL DIPENDENTE:
- Nominativo: ${profile.cognome} ${profile.nome}
- Matricola: ${profile.matricola}
- Postazione 118: ${profile.postazione}
- Qualifica: ${profile.qualifica}

RIASSUNTO ORE EFFETTUATE:
- Totale Ore Monte Ore: ${sheet.totaleOreMonteOreFormatted || '0h 00m'}
- Totale Ore Straordinario: ${sheet.totaleOreStraordinarioFormatted || '0h 00m'}
- Totale Complessivo: ${sheet.totaleOreComplessivoFormatted || '0h 00m'}
- Numero Turni con Straordinario: ${sheet.entries ? sheet.entries.length : 0}

Si resta a disposizione per eventuali chiarimenti.

Distinti saluti,
${profile.nome} ${profile.cognome}
Operatore S.E.T. 118 - Sanitaservice ASL TA`;

  const copyToClipboard = (text: string, type: 'sub' | 'body' | 'rec') => {
    navigator.clipboard.writeText(text);
    if (type === 'sub') {
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2000);
    } else if (type === 'body') {
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
    } else {
      setCopiedRecipient(true);
      setTimeout(() => setCopiedRecipient(false), 2000);
    }
  };

  const handleDownload = () => {
    downloadPdf(sheet);
    setPdfDownloaded(true);
  };

  const handleConfirmSent = () => {
    if (onMarkAsSent) {
      onMarkAsSent(new Date().toISOString());
    }
    setSentConfirmed(true);
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                Procedura Manuale Guidata
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Invio da Webmail Aruba PEC
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-bold">
              AVVISO DI TRASPARENZA: L&apos;apertura della Webmail NON invia automaticamente la PEC.
            </p>
            <p>
              Segui i passaggi numerati qui sotto: scarica il documento PDF firmato, copia con un clic l&apos;oggetto e il testo precompilati, quindi apri il portale Aruba Webmail per completare la spedizione.
            </p>
          </div>
        </div>

        {/* Passaggi */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-700 dark:text-slate-300">
          {/* Step 1 */}
          <div className="space-y-2 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">
                  1
                </span>
                <span>Scarica il Prospetto Ufficiale PDF compilato</span>
              </div>
              {pdfDownloaded && (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Scaricato
                </span>
              )}
            </div>
            <p className="text-slate-500">
              Salva sul tuo computer o smartphone il documento PDF ufficiale per il mese di {sheet.nomeMese}.
            </p>
            <button
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Scarica Prospetto PDF ({sheet.nomeMese})</span>
            </button>
          </div>

          {/* Step 2 */}
          <div className="space-y-2 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">
                2
              </span>
              <span>Destinatari Ufficiali Sanitaservice</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Destinatario (A:):</span>
                  <span className="font-mono text-slate-900 dark:text-white">{recipient}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(recipient, 'rec')}
                  className="px-2 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded cursor-pointer flex items-center gap-1"
                >
                  {copiedRecipient ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedRecipient ? 'Copiato' : 'Copia'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-2 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">
                  3
                </span>
                <span>Oggetto e Testo Ufficiali</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="truncate mr-2">
                  <span className="text-[10px] text-slate-400 block font-semibold">Oggetto PEC:</span>
                  <span className="font-mono text-[11px] truncate block text-slate-900 dark:text-white">{subject}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(subject, 'sub')}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded cursor-pointer shrink-0 flex items-center gap-1"
                >
                  {copiedSubject ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSubject ? 'Copiato' : 'Copia Oggetto'}</span>
                </button>
              </div>

              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold">Corpo del Messaggio:</span>
                  <button
                    onClick={() => copyToClipboard(mailBody, 'body')}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded cursor-pointer flex items-center gap-1"
                  >
                    {copiedBody ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedBody ? 'Testo Copiato' : 'Copia Testo'}</span>
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap max-h-24 overflow-y-auto bg-slate-50 dark:bg-slate-800/60 p-2 rounded">
                  {mailBody}
                </pre>
              </div>
            </div>
          </div>

          {/* Step 4: Apertura Webmail */}
          <div className="space-y-2 border border-blue-200 dark:border-blue-800/60 p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20">
            <div className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                4
              </span>
              <span>Apri Aruba Webmail PEC e completa la trasmissione</span>
            </div>
            <p className="text-blue-950 dark:text-blue-300">
              Accedi alla Webmail Aruba, fai clic su &quot;Nuovo Messaggio&quot;, incolla l&apos;oggetto, il testo e allega il PDF scaricato al Passaggio 1.
            </p>
            <a
              href="https://webmail.pec.it"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
            >
              <span>Accedi alla Webmail Aruba (webmail.pec.it)</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
          >
            Chiudi finestra
          </button>

          <button
            onClick={handleConfirmSent}
            disabled={sentConfirmed}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              sentConfirmed
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600'
            }`}
          >
            {sentConfirmed ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Invio manuale registrato con successo!</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Ho completato l&apos;invio: registra nei log</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
