import React, { useState } from 'react';
import {
  FileText,
  Download,
  Send,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  PenTool,
  ShieldCheck,
  UserCheck,
  Calendar,
  Clock,
  Printer,
  Sparkles,
} from 'lucide-react';
import { CambioTurnoData, EmployeeProfile, DigitalSignature } from '../types';
import { generateCambioTurnoPdf } from '../utils/pdfFormGenerators';
import { sendPecRequest } from '../services/apiService';
import { DigitalSignatureModal } from './DigitalSignatureModal';

interface CambioTurnoModuleProps {
  profile: EmployeeProfile;
  onBackToHub: () => void;
  onSignatureUpdated?: (sig: DigitalSignature) => void;
}

export const CambioTurnoModule: React.FC<CambioTurnoModuleProps> = ({
  profile,
  onBackToHub,
  onSignatureUpdated,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayFormatted = new Date().toLocaleDateString('it-IT');

  const [formData, setFormData] = useState<CambioTurnoData>({
    dataRichiesta: todayFormatted,
    postazione: profile.postazione || '',
    matricolaRichiedente: profile.matricola || '',
    nomeRichiedente: `${profile.cognome || ''} ${profile.nome || ''}`.trim(),
    collegaAccettante: '',
    qualifica: profile.qualifica?.toUpperCase().includes('AUTISTA')
      ? 'AUTISTA_SOCCORRITORE'
      : 'SOCCORRITORE',
    turnoRichiedenteInizio: '07:00',
    turnoRichiedenteFine: '13:00',
    turnoAccettanteInizio: '13:00',
    turnoAccettanteFine: '19:00',
    giornoCambio: todayFormatted,
    firmaRichiedente: profile.firmaSalvata,
    firmaRichiedenteAutorizzata: false, // Explicit user authorization required per document
    note: '',
  });

  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isSendingPec, setIsSendingPec] = useState(false);
  const [pecResult, setPecResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleDownloadPdf = async () => {
    try {
      const doc = await generateCambioTurnoPdf(formData);
      const fname = `Cambio_Turno_118_${formData.nomeRichiedente.replace(/\s+/g, '_')}_${formData.matricolaRichiedente}.pdf`;
      doc.save(fname);
    } catch (e) {
      console.error('Errore generazione PDF Cambio Turno:', e);
    }
  };

  const handleSendPec = async () => {
    if (!formData.collegaAccettante.trim()) {
      setPecResult({
        success: false,
        message: 'Inserisci il nome del collega accettante prima di trasmettere il cambio turno.',
      });
      return;
    }

    try {
      setIsSendingPec(true);
      setPecResult(null);

      // Generate PDF base64
      const doc = await generateCambioTurnoPdf(formData);
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const filename = `Cambio_Turno_118_${formData.nomeRichiedente.replace(/\s+/g, '_')}_${formData.matricolaRichiedente}.pdf`;

      const res = await sendPecRequest({
        sheetId: '', // not tied to a monthly timesheet
        pdfBase64,
        note: formData.note,
        tipoDocumento: 'CAMBIO_TURNO',
        filename,
        subject: `[S.E.T. 118] Richiesta Cambio Turno - Matr. ${formData.matricolaRichiedente} ${formData.nomeRichiedente}`,
      } as any);

      setPecResult({
        success: true,
        message: res.message || 'Richiesta di Cambio Turno trasmessa con successo via PEC all\'Ufficio Personale!',
      });
    } catch (err: any) {
      setPecResult({
        success: false,
        message: err.message || 'Errore durante la trasmissione PEC del cambio turno.',
      });
    } finally {
      setIsSendingPec(false);
    }
  };

  const handleSaveSignature = (sig: DigitalSignature, saveToProfile: boolean) => {
    setFormData((prev) => ({
      ...prev,
      firmaRichiedente: sig,
      firmaRichiedenteAutorizzata: true,
    }));
    if (saveToProfile && onSignatureUpdated) {
      onSignatureUpdated(sig);
    }
    setIsSignModalOpen(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header / Nav */}
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
                Modello per CAMBI TURNO
              </h2>
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Modulo 118 Ufficiale
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sanitaservice ASL TA s.r.l. Unipersonale – Richiesta cambio turno tra colleghi
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            <span>Scarica PDF</span>
          </button>

          <button
            type="button"
            onClick={handleSendPec}
            disabled={isSendingPec}
            className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isSendingPec ? 'Invio in corso...' : 'Invia via PEC'}</span>
          </button>
        </div>
      </div>

      {/* PEC Notification */}
      {pecResult && (
        <div
          className={`p-4 rounded-xl text-xs flex items-start gap-2.5 border ${
            pecResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300 border-rose-200 dark:border-rose-800'
          }`}
        >
          {pecResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5">
            <span className="font-bold block">
              {pecResult.success ? 'Invio PEC Eseguito con Successo' : 'Attenzione'}
            </span>
            <span>{pecResult.message}</span>
          </div>
        </div>
      )}

      {/* Interactive Form Replica Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
        {/* Top Header Replica with Original Official Logos */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <img
              src="/loghi_originali_pdf.png?v=2"
              alt="Sanitaservice ASL TA s.r.l. Unipersonale · ASL Taranto PugliaSalute"
              className="h-12 sm:h-14 w-auto object-contain"
            />
          </div>

          <div className="text-right space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Matr. N°:</span>
              <input
                type="text"
                required
                value={formData.matricolaRichiedente}
                onChange={(e) => setFormData({ ...formData, matricolaRichiedente: e.target.value })}
                className="px-2 py-1 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md w-32 text-slate-900 dark:text-white"
              />
            </div>
            <span className="text-[10px] text-red-600 dark:text-red-400 font-bold block">
              (campo obbligatorio)
            </span>
          </div>
        </div>

        {/* Taranto & Postazione */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Taranto lì:</span>
            <input
              type="text"
              value={formData.dataRichiesta}
              onChange={(e) => setFormData({ ...formData, dataRichiesta: e.target.value })}
              className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              placeholder="GG/MM/AAAA"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Postazione:</span>
            <input
              type="text"
              value={formData.postazione}
              onChange={(e) => setFormData({ ...formData, postazione: e.target.value })}
              className="flex-1 px-2.5 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              placeholder="TARANTO SUD"
            />
          </div>
        </div>

        {/* Title Center */}
        <div className="text-center py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
            Modello per CAMBI TURNO
          </h3>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            ● Cambio turno tra colleghi
          </span>
        </div>

        {/* Operatori & Colleghi */}
        <div className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            Il cambio turno è richiesto da: <span className="font-bold text-slate-900 dark:text-white">● Collega</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Il/la sottoscritto/a (Operatore Richiedente)
              </label>
              <input
                type="text"
                value={formData.nomeRichiedente}
                onChange={(e) => setFormData({ ...formData, nomeRichiedente: e.target.value })}
                className="w-full px-3 py-2 text-sm font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                placeholder="Cognome e Nome Richiedente"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                chiede e concorda con (Operatore Accettante) *
              </label>
              <input
                type="text"
                required
                value={formData.collegaAccettante}
                onChange={(e) => setFormData({ ...formData, collegaAccettante: e.target.value })}
                className="w-full px-3 py-2 text-sm font-bold bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                placeholder="Cognome e Nome del Collega che accetta il cambio turno"
              />
            </div>
          </div>

          {/* Qualifica Radio */}
          <div className="pt-2">
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Qualifica Servizio 118:
            </span>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="qualifica"
                  checked={formData.qualifica === 'AUTISTA_SOCCORRITORE'}
                  onChange={() => setFormData({ ...formData, qualifica: 'AUTISTA_SOCCORRITORE' })}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  AUTISTA- SOCCORRITORE
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="qualifica"
                  checked={formData.qualifica === 'SOCCORRITORE'}
                  onChange={() => setFormData({ ...formData, qualifica: 'SOCCORRITORE' })}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  SOCCORRITORE
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Turni & Giorno */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Definizione Orari e Giorno del Cambio
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Richiedente */}
            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Il richiedente effettuerà turno:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={formData.turnoRichiedenteInizio}
                  onChange={(e) => setFormData({ ...formData, turnoRichiedenteInizio: e.target.value })}
                  className="px-2 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-white"
                />
                <span className="text-xs text-slate-500">-</span>
                <input
                  type="time"
                  value={formData.turnoRichiedenteFine}
                  onChange={(e) => setFormData({ ...formData, turnoRichiedenteFine: e.target.value })}
                  className="px-2 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Accettante */}
            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                L&apos;accettante effettuerà turno:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={formData.turnoAccettanteInizio}
                  onChange={(e) => setFormData({ ...formData, turnoAccettanteInizio: e.target.value })}
                  className="px-2 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-white"
                />
                <span className="text-xs text-slate-500">-</span>
                <input
                  type="time"
                  value={formData.turnoAccettanteFine}
                  onChange={(e) => setFormData({ ...formData, turnoAccettanteFine: e.target.value })}
                  className="px-2 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">nel giorno:</span>
            <input
              type="text"
              value={formData.giornoCambio}
              onChange={(e) => setFormData({ ...formData, giornoCambio: e.target.value })}
              className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white w-48"
              placeholder="DD/MM/YYYY"
            />
          </div>
        </div>

        {/* Firme Section */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Richiedente */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-center">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase block">
                L&apos;operatore richiedente
              </span>

              <div className="h-16 flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 p-1">
                {formData.firmaRichiedente?.dataUrl && formData.firmaRichiedenteAutorizzata ? (
                  <img
                    src={formData.firmaRichiedente.dataUrl}
                    alt="Firma Richiedente"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-[11px] text-slate-400 italic">
                    {formData.firmaRichiedente?.dataUrl
                      ? 'Firma presente ma non autorizzata per questo foglio'
                      : 'Nessuna firma apposta'}
                  </span>
                )}
              </div>

              {formData.firmaRichiedente?.dataUrl && (
                <div className="flex items-center justify-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="authCambioSig"
                    checked={formData.firmaRichiedenteAutorizzata || false}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        firmaRichiedenteAutorizzata: e.target.checked,
                      }))
                    }
                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label
                    htmlFor="authCambioSig"
                    className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                  >
                    Autorizza firma su questo modulo
                  </label>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsSignModalOpen(true)}
                className="w-full py-1.5 text-[11px] font-bold rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <PenTool className="w-3 h-3" />
                <span>{formData.firmaRichiedente ? 'Gestisci Firma' : 'Apponi Firma'}</span>
              </button>
            </div>

            {/* Accettante */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-center">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase block">
                L&apos;operatore accettante
              </span>
              <div className="h-16 flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900">
                <span className="text-[11px] text-slate-400 italic">Riservato al collega</span>
              </div>
              <span className="text-[10px] text-slate-400 block pt-1">
                Firmato su cartaceo o per accordo
              </span>
            </div>

            {/* Referente */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-center">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase block">
                Il referente
              </span>
              <div className="h-16 flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900">
                <span className="text-[11px] text-slate-400 italic">Visto del Referente / Coord.</span>
              </div>
              <span className="text-[10px] text-slate-400 block pt-1">
                Approvazione servizio
              </span>
            </div>
          </div>
        </div>

        {/* Note Aggiuntive */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Note aggiuntive per l&apos;Ufficio Personale (opzionali):
          </label>
          <textarea
            rows={2}
            value={formData.note || ''}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            placeholder="Eventuali annotazioni o motivazioni relative al cambio turno..."
          />
        </div>

        {/* Official Footer Text in Replica */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center space-y-1 text-[10px] text-slate-400 leading-tight">
          <p>
            Società soggetta a direzione e coordinamento da parte dell’ASL TARANTO ai sensi dell’art. 2497 e ss. Codice Civile
          </p>
          <p>
            Sede Legale: Viale Virgilio, 31 – 74123 Taranto - Sede Operativa: Via Duca di Genova 63/A – 74123 Taranto
          </p>
          <p>
            Tel: 0994585171 – 0994585173 Fax: 0994585172 - C.F./P. IVA 02775310739
          </p>
          <p>
            e-mail: sanitaservice@asl.taranto.it - P.E.C.: sanitaserviceaslta@pec.it – www.housejonicaservice.it
          </p>
        </div>
      </div>

      {/* Signature Modal */}
      {isSignModalOpen && (
        <DigitalSignatureModal
          isOpen={isSignModalOpen}
          onClose={() => setIsSignModalOpen(false)}
          onSaveSignature={handleSaveSignature}
          profile={profile}
          existingSignature={formData.firmaRichiedente}
        />
      )}
    </div>
  );
};
