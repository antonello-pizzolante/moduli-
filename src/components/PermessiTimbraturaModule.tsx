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
  Calendar,
  Clock,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import { PermessiTimbraturaData, EmployeeProfile, DigitalSignature } from '../types';
import { generatePermessiTimbraturaPdf } from '../utils/pdfFormGenerators';
import { sendPecRequest } from '../services/apiService';
import { DigitalSignatureModal } from './DigitalSignatureModal';

interface PermessiTimbraturaModuleProps {
  profile: EmployeeProfile;
  onBackToHub: () => void;
  onSignatureUpdated?: (sig: DigitalSignature) => void;
}

export const PermessiTimbraturaModule: React.FC<PermessiTimbraturaModuleProps> = ({
  profile,
  onBackToHub,
  onSignatureUpdated,
}) => {
  const todayFormatted = new Date().toLocaleDateString('it-IT');

  const [formData, setFormData] = useState<PermessiTimbraturaData>({
    dataRichiesta: todayFormatted,
    postazione: profile.postazione || '',
    matricola: profile.matricola || '',
    nomeCognome: `${profile.cognome || ''} ${profile.nome || ''}`.trim(),

    // Causali Assenza
    richiestaFerie: false,
    ferieDal: '',
    ferieAl: '',

    richiestaCongedo: false,
    congedoDal: '',
    congedoAl: '',

    recuperoFestivita: false,
    festivitaDel: '',
    recuperoFestivitaIl: '',

    permessoPersonale: false,
    permessoPersonaleIl: '',

    permessoLutto: false,
    luttoDal: '',
    luttoAl: '',

    recuperoPermessoPersonale: false,
    recuperoPermessoDel: '',
    recuperoPermessoIl: '',

    permessoLegge104: false,
    legge104Giorni: '',

    permessoArt34: false,
    art34Dettagli: '',

    // Mancata Timbratura
    mancataTimbratura: true,
    omessaEntrata: true,
    omessaEntrataOra: '07:00',
    omessaEntrataData: todayFormatted,
    omessaUscita: false,
    omessaUscitaOra: '',
    omessaUscitaData: '',
    motivoMancataTimbratura: 'Mancata timbratura per intervento prolungato / dimenticanza badge aziendale.',

    firmaDipendente: profile.firmaSalvata,
    firmaDipendenteAutorizzata: false, // Explicit user authorization required per document
  });

  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isSendingPec, setIsSendingPec] = useState(false);
  const [pecResult, setPecResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleDownloadPdf = async () => {
    try {
      const doc = await generatePermessiTimbraturaPdf(formData);
      const fname = `Permessi_Mancata_Timbratura_${formData.nomeCognome.replace(/\s+/g, '_')}_${formData.matricola}.pdf`;
      doc.save(fname);
    } catch (e) {
      console.error('Errore generazione PDF Permessi:', e);
    }
  };

  const handleSendPec = async () => {
    try {
      setIsSendingPec(true);
      setPecResult(null);

      // Generate PDF base64
      const doc = await generatePermessiTimbraturaPdf(formData);
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const filename = `Permessi_Mancata_Timbratura_${formData.nomeCognome.replace(/\s+/g, '_')}_${formData.matricola}.pdf`;

      const res = await sendPecRequest({
        sheetId: '', // not tied to a monthly timesheet
        pdfBase64,
        tipoDocumento: 'PERMESSI_TIMBRATURA',
        filename,
        subject: `[S.E.T. 118] Richiesta Autorizzazione Assenza / Omessa Timbratura - Matr. ${formData.matricola} ${formData.nomeCognome}`,
      } as any);

      setPecResult({
        success: true,
        message: res.message || 'Modulo Permessi / Omessa Timbratura trasmesso con successo via PEC all\'Ufficio Personale!',
      });
    } catch (err: any) {
      setPecResult({
        success: false,
        message: err.message || 'Errore durante la trasmissione PEC del modulo.',
      });
    } finally {
      setIsSendingPec(false);
    }
  };

  const handleSaveSignature = (sig: DigitalSignature, saveToProfile: boolean) => {
    setFormData((prev) => ({
      ...prev,
      firmaDipendente: sig,
      firmaDipendenteAutorizzata: true,
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
                Modulo Permessi & Mancata Timbratura
              </h2>
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Modulo Ufficiale Sanitaservice & ASL Taranto
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Richiesta autorizzazione assenza dal servizio o dichiarazione omessa timbratura
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
            className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-amber-700 dark:bg-amber-800 dark:hover:bg-amber-700 text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
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
        {/* Header with Original Sanitaservice ASL TA & PugliaSalute Logos */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <img
            src="/loghi_originali_pdf.png?v=2"
            alt="Sanitaservice ASL TA s.r.l. Unipersonale · ASL Taranto PugliaSalute"
            className="h-12 sm:h-14 w-auto object-contain"
          />
          <div className="text-right">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest border border-slate-200 dark:border-slate-700 px-2 py-1 rounded">
              SET-118 / PERMESSI
            </span>
          </div>
        </div>

        {/* Matr. N° & Taranto lì & Postazione */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Taranto lì:</span>
              <input
                type="text"
                value={formData.dataRichiesta}
                onChange={(e) => setFormData({ ...formData, dataRichiesta: e.target.value })}
                className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white w-36"
                placeholder="GG/MM/AAAA"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                POSTAZIONE:
              </span>
              <input
                type="text"
                value={formData.postazione}
                onChange={(e) => setFormData({ ...formData, postazione: e.target.value })}
                className="px-2.5 py-1 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white flex-1"
                placeholder="TARANTO SUD"
              />
            </div>
          </div>

          <div className="sm:text-right space-y-1">
            <div className="flex items-center sm:justify-end gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Matr. N°:</span>
              <input
                type="text"
                required
                value={formData.matricola}
                onChange={(e) => setFormData({ ...formData, matricola: e.target.value })}
                className="px-2 py-1 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md w-36 text-slate-900 dark:text-white"
              />
            </div>
            <span className="text-[10px] text-red-600 dark:text-red-400 font-bold block">
              (campo obbligatorio)
            </span>
          </div>
        </div>

        {/* Premessa */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-xs text-slate-700 dark:text-slate-300">
              Il/la sottoscritto/a:
            </span>
            <input
              type="text"
              required
              value={formData.nomeCognome}
              onChange={(e) => setFormData({ ...formData, nomeCognome: e.target.value })}
              className="flex-1 px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
              in qualità di dipendente
            </span>
          </div>

          <div className="text-xs font-bold text-slate-900 dark:text-white">
            Sanitaservice Asl Ta Srl Unipersonale
          </div>

          <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400 pt-1">
            chiede l&apos;autorizzazione ad assentarsi dal servizio per:
          </div>
        </div>

        {/* Causali Assenza Checklist */}
        <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Opzioni di Assenza
          </h4>

          {/* 1. Ferie */}
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <input
              type="checkbox"
              id="cb_ferie"
              checked={formData.richiestaFerie}
              onChange={(e) => setFormData({ ...formData, richiestaFerie: e.target.checked })}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="cb_ferie" className="text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
              richiesta ferie (o giorni) dal:
            </label>
            <input
              type="text"
              placeholder="GG/MM/AAAA"
              value={formData.ferieDal}
              onChange={(e) => setFormData({ ...formData, ferieDal: e.target.value, richiestaFerie: true })}
              className="px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded w-28"
            />
            <span className="text-xs text-slate-500">al:</span>
            <input
              type="text"
              placeholder="GG/MM/AAAA"
              value={formData.ferieAl}
              onChange={(e) => setFormData({ ...formData, ferieAl: e.target.value, richiestaFerie: true })}
              className="px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded w-28"
            />
          </div>

          {/* 2. Congedo */}
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <input
              type="checkbox"
              id="cb_congedo"
              checked={formData.richiestaCongedo}
              onChange={(e) => setFormData({ ...formData, richiestaCongedo: e.target.checked })}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="cb_congedo" className="text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
              richiesta congedo maternità/paternità dal:
            </label>
            <input
              type="text"
              placeholder="GG/MM/AAAA"
              value={formData.congedoDal}
              onChange={(e) => setFormData({ ...formData, congedoDal: e.target.value, richiestaCongedo: true })}
              className="px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded w-28"
            />
            <span className="text-xs text-slate-500">al:</span>
            <input
              type="text"
              placeholder="GG/MM/AAAA"
              value={formData.congedoAl}
              onChange={(e) => setFormData({ ...formData, congedoAl: e.target.value, richiestaCongedo: true })}
              className="px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded w-28"
            />
            <span className="text-[11px] text-slate-400 italic">(allegare documentazione)</span>
          </div>

          {/* 3. Recupero festività */}
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <input
              type="checkbox"
              id="cb_festivita"
              checked={formData.recuperoFestivita}
              onChange={(e) => setFormData({ ...formData, recuperoFestivita: e.target.checked })}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="cb_festivita" className="text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
              recupero festività (del:
            </label>
            <input
              type="text"
              placeholder="GG/MM/AAAA"
              value={formData.festivitaDel}
              onChange={(e) => setFormData({ ...formData, festivitaDel: e.target.value, recuperoFestivita: true })}
              className="px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded w-28"
            />
            <span className="text-xs text-slate-500">) il:</span>
            <input
              type="text"
              placeholder="GG/MM/AAAA"
              value={formData.recuperoFestivitaIl}
              onChange={(e) => setFormData({ ...formData, recuperoFestivitaIl: e.target.value, recuperoFestivita: true })}
              className="px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded w-28"
            />
          </div>

          {/* 4. Permesso personale */}
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <input
              type="checkbox"
              id="cb_permesso_pers"
              checked={formData.permessoPersonale}
              onChange={(e) => setFormData({ ...formData, permessoPersonale: e.target.checked })}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="cb_permesso_pers" className="text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
              permesso personale il:
            </label>
            <input
              type="text"
              placeholder="GG/MM/AAAA"
              value={formData.permessoPersonaleIl}
              onChange={(e) => setFormData({ ...formData, permessoPersonaleIl: e.target.value, permessoPersonale: true })}
              className="px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded w-36"
            />
          </div>

          {/* 5. Lutto */}
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <input
              type="checkbox"
              id="cb_lutto"
              checked={formData.permessoLutto}
              onChange={(e) => setFormData({ ...formData, permessoLutto: e.target.checked })}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="cb_lutto" className="text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
              permesso lutto dal:
            </label>
            <input
              type="text"
              placeholder="GG/MM/AAAA"
              value={formData.luttoDal}
              onChange={(e) => setFormData({ ...formData, luttoDal: e.target.value, permessoLutto: true })}
              className="px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded w-28"
            />
            <span className="text-xs text-slate-500">al:</span>
            <input
              type="text"
              placeholder="GG/MM/AAAA"
              value={formData.luttoAl}
              onChange={(e) => setFormData({ ...formData, luttoAl: e.target.value, permessoLutto: true })}
              className="px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded w-28"
            />
            <span className="text-[11px] text-slate-400 italic">(allegare certificazione)</span>
          </div>

          {/* 6. Recupero permesso personale */}
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <input
              type="checkbox"
              id="cb_recup_pers"
              checked={formData.recuperoPermessoPersonale}
              onChange={(e) => setFormData({ ...formData, recuperoPermessoPersonale: e.target.checked })}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="cb_recup_pers" className="text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
              recupero permesso personale del:
            </label>
            <input
              type="text"
              placeholder="GG/MM/AAAA"
              value={formData.recuperoPermessoDel}
              onChange={(e) => setFormData({ ...formData, recuperoPermessoDel: e.target.value, recuperoPermessoPersonale: true })}
              className="px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded w-28"
            />
            <span className="text-xs text-slate-500">il:</span>
            <input
              type="text"
              placeholder="GG/MM/AAAA"
              value={formData.recuperoPermessoIl}
              onChange={(e) => setFormData({ ...formData, recuperoPermessoIl: e.target.value, recuperoPermessoPersonale: true })}
              className="px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded w-28"
            />
          </div>

          {/* 7. Legge 104 */}
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <input
              type="checkbox"
              id="cb_104"
              checked={formData.permessoLegge104}
              onChange={(e) => setFormData({ ...formData, permessoLegge104: e.target.checked })}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="cb_104" className="text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
              permesso legge 104 nei gg.:
            </label>
            <input
              type="text"
              placeholder="Specificare le date..."
              value={formData.legge104Giorni}
              onChange={(e) => setFormData({ ...formData, legge104Giorni: e.target.value, permessoLegge104: true })}
              className="flex-1 min-w-[200px] px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
            />
          </div>

          {/* 8. Art. 34 */}
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <input
              type="checkbox"
              id="cb_art34"
              checked={formData.permessoArt34}
              onChange={(e) => setFormData({ ...formData, permessoArt34: e.target.checked })}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="cb_art34" className="text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
              permesso retribuito art. 34:
            </label>
            <input
              type="text"
              placeholder="Dettagli / motivazione..."
              value={formData.art34Dettagli}
              onChange={(e) => setFormData({ ...formData, art34Dettagli: e.target.value, permessoArt34: true })}
              className="flex-1 min-w-[200px] px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
            />
            <span className="text-[11px] text-slate-400 italic">(allegare documentazione)</span>
          </div>
        </div>

        {/* SEZIONE: MANCATA TIMBRATURA */}
        <div className="p-4 rounded-xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cb_mancata"
              checked={formData.mancataTimbratura}
              onChange={(e) => setFormData({ ...formData, mancataTimbratura: e.target.checked })}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="cb_mancata" className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer">
              ● dichiara di esser stato presente al lavoro e di aver omesso la timbratura :
            </label>
          </div>

          <div className="space-y-3 pl-6">
            {/* In entrata */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                id="cb_entrata"
                checked={formData.omessaEntrata}
                onChange={(e) => setFormData({ ...formData, omessaEntrata: e.target.checked, mancataTimbratura: true })}
                className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="cb_entrata" className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                in entrata alle ore:
              </label>
              <input
                type="time"
                value={formData.omessaEntrataOra}
                onChange={(e) => setFormData({ ...formData, omessaEntrataOra: e.target.value, omessaEntrata: true, mancataTimbratura: true })}
                className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">del:</span>
              <input
                type="text"
                placeholder="GG/MM/AAAA"
                value={formData.omessaEntrataData}
                onChange={(e) => setFormData({ ...formData, omessaEntrataData: e.target.value, omessaEntrata: true, mancataTimbratura: true })}
                className="px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded w-28"
              />
            </div>

            {/* In uscita */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                id="cb_uscita"
                checked={formData.omessaUscita}
                onChange={(e) => setFormData({ ...formData, omessaUscita: e.target.checked, mancataTimbratura: true })}
                className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="cb_uscita" className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                in uscita alle ore:
              </label>
              <input
                type="time"
                value={formData.omessaUscitaOra}
                onChange={(e) => setFormData({ ...formData, omessaUscitaOra: e.target.value, omessaUscita: true, mancataTimbratura: true })}
                className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">del:</span>
              <input
                type="text"
                placeholder="GG/MM/AAAA"
                value={formData.omessaUscitaData}
                onChange={(e) => setFormData({ ...formData, omessaUscitaData: e.target.value, omessaUscita: true, mancataTimbratura: true })}
                className="px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded w-28"
              />
            </div>

            {/* Motivo */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                per il seguente motivo:
              </label>
              <textarea
                rows={2}
                value={formData.motivoMancataTimbratura}
                onChange={(e) => setFormData({ ...formData, motivoMancataTimbratura: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                placeholder="Specificare motivazione (es. guasto orologio timbratore, prolungamento soccorso 118, ecc.)..."
              />
            </div>
          </div>
        </div>

        {/* Firme Section */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Dipendente */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-center">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase block">
                Firma del dipendente
              </span>

              <div className="h-16 flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 p-1">
                {formData.firmaDipendente?.dataUrl && formData.firmaDipendenteAutorizzata ? (
                  <img
                    src={formData.firmaDipendente.dataUrl}
                    alt="Firma Dipendente"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-[11px] text-slate-400 italic">
                    {formData.firmaDipendente?.dataUrl
                      ? 'Firma presente ma non autorizzata per questo foglio'
                      : 'Firma non ancora apposta'}
                  </span>
                )}
              </div>

              {formData.firmaDipendente?.dataUrl && (
                <div className="flex items-center justify-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="authPermessiSig"
                    checked={formData.firmaDipendenteAutorizzata || false}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        firmaDipendenteAutorizzata: e.target.checked,
                      }))
                    }
                    className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <label
                    htmlFor="authPermessiSig"
                    className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                  >
                    Autorizza firma su questo modulo
                  </label>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsSignModalOpen(true)}
                className="w-full py-1.5 text-xs font-bold rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>{formData.firmaDipendente ? 'Gestisci Firma' : 'Apponi Firma'}</span>
              </button>
            </div>

            {/* Amministratore Unico - Firma Raster Autentica Originale */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-center flex flex-col justify-between">
              <div className="flex items-center justify-center py-1">
                <img
                  src="/firma_pulito.png?v=2"
                  alt="L'Amministratore Unico Dott. Giuseppe Pulito - Firma Autentica Originale"
                  className="max-h-20 w-auto object-contain mx-auto"
                />
              </div>
              <span className="text-[10px] text-teal-700 dark:text-teal-400 font-medium block">
                Intestazione e firma originale approvata · Dott. Giuseppe Pulito
              </span>
            </div>
          </div>
        </div>

        {/* Official Footer Text in Replica */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center space-y-1 text-[10px] text-slate-400 leading-tight">
          <p>
            Società soggetta a direzione e coordinamento da parte dell’ASL TARANTO ai sensi dell’art. 2497 e ss. Codice Civile
          </p>
          <p className="font-semibold">
            www.sanitaserviceaslta.it - C.F./P.IVA 02775310739 -
          </p>
          <p>
            sanitaservice@asl.taranto.it | sanitaserviceaslta@pec.it
          </p>
          <p>
            Sede Legale: Viale Virgilio, 31 – 74123 Taranto | Sede Operativa: Via Duca di Genova 63/A – 74123 Taranto
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
          existingSignature={formData.firmaDipendente}
        />
      )}
    </div>
  );
};
