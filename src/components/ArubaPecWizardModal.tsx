import React, { useState } from 'react';
import {
  Mail,
  ShieldCheck,
  Server,
  Key,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  BookOpen,
  Activity,
  X,
  Trash2,
  Lock,
  Globe,
  Users,
  Eye,
  EyeOff,
  Send,
  HelpCircle,
} from 'lucide-react';
import { PecSettings, PecAccountMode } from '../types';
import { testPecConnection, savePecSettings, disconnectPec } from '../services/apiService';
import { ArubaPecTutorialModal } from './ArubaPecTutorialModal';

interface ArubaPecWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PecSettings;
  onSave: (updated: PecSettings) => void;
  onOpenManualWebmail?: () => void;
}

export const ArubaPecWizardModal: React.FC<ArubaPecWizardModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  onOpenManualWebmail,
}) => {
  const [formData, setFormData] = useState<PecSettings>({
    ...settings,
    accountMode: settings.accountMode || 'INDIVIDUALE',
    smtpHost: settings.smtpHost || 'smtps.pec.aruba.it',
    smtpPort: settings.smtpPort || 465,
    smtpSsl: settings.smtpSsl ?? true,
    imapHost: settings.imapHost || 'imaps.pec.aruba.it',
    imapPort: settings.imapPort || 993,
    imapSsl: settings.imapSsl ?? true,
    smtpUser: settings.smtpUser || '',
    simulazioneTestMode: settings.simulazioneTestMode ?? false,
  });

  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    networkBlocked?: boolean;
  } | null>(null);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testPecConnection({
        smtpHost: formData.smtpHost,
        smtpPort: formData.smtpPort,
        smtpSsl: formData.smtpSsl,
        smtpUser: formData.smtpUser,
        smtpPass: passwordInput || undefined,
        imapHost: formData.imapHost,
        imapPort: formData.imapPort,
        imapSsl: formData.imapSsl,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Errore durante la verifica del collegamento.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload: PecSettings = {
        ...formData,
        ...(passwordInput.trim() ? { smtpPass: passwordInput.trim() } : {}),
      };
      const updated = await savePecSettings(payload);
      onSave(updated);
      setSaveSuccessMsg('Collegamento salvato con successo sul server protetto!');
      setPasswordInput('');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Errore salvataggio: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Sei sicuro di voler scollegare la casella PEC? Tutte le credenziali salvate sul server verranno eliminate.')) {
      return;
    }
    try {
      const updated = await disconnectPec();
      setFormData(updated);
      onSave(updated);
      setPasswordInput('');
      setTestResult(null);
      setSaveSuccessMsg('Casella PEC scollegata con successo.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Errore durante la disconnessione: ${err.message}`);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                  Configurazione Ufficiale
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Procedura Guidata &quot;Collega Aruba PEC&quot;
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsTutorialOpen(true)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 cursor-pointer flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tutorial Scritto</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* Scelta Modello: PEC Individuale vs PEC Aziendale Condivisa */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                1. Modello di Casella PEC
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, accountMode: 'INDIVIDUALE' })}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    formData.accountMode === 'INDIVIDUALE'
                      ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <Mail className="w-4 h-4 text-emerald-600" />
                    <span>PEC Individuale del Dipendente</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Ciascun operatore utilizza la propria casella PEC personale certificata per trasmettere il prospetto.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, accountMode: 'AZIENDALE_CONDIVISA' })}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    formData.accountMode === 'AZIENDALE_CONDIVISA'
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Casella Aziendale / di Postazione</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Casella centralizzata S.E.T. 118: invio delegato gestito dal server senza distribuire la password ai dipendenti.
                  </p>
                </button>
              </div>
            </div>

            {formData.accountMode === 'AZIENDALE_CONDIVISA' ? (
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-2">
                <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-200">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Configurazione Centralizzata Attiva</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  I parametri e le credenziali di trasmissione sono impostati a livello di coordinamento centrale. Non devi inserire alcuna password: i tuoi prospetti firmati verranno trasmessi all&apos;Ufficio Personale con protocollo aziendale sicuro.
                </p>
              </div>
            ) : (
              <>
                {/* Parametri Precompilati Ufficiali Aruba */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-emerald-600" />
                      Parametri Ufficiali Server Aruba PEC
                    </span>
                    <a
                      href="https://guide.aruba.it/pec/configurazione-programmi-di-posta/client-posta-e-dispositivi-mobili"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-emerald-700 dark:text-emerald-400 underline inline-flex items-center gap-0.5"
                    >
                      Guida Aruba
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Server SMTP (Invio):</span>
                      <input
                        type="text"
                        readOnly
                        value={`${formData.smtpHost} (Porta ${formData.smtpPort}, SSL/TLS)`}
                        className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Server IMAP (Ricevute):</span>
                      <input
                        type="text"
                        readOnly
                        value={`${formData.imapHost} (Porta ${formData.imapPort}, SSL/TLS)`}
                        className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Credenziali Dipendente */}
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                    2. Dati della tua Casella Aruba PEC
                  </h3>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Indirizzo PEC Completo *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="nome.cognome@pec.it oppure la tua pec aziendale"
                      value={formData.smtpUser}
                      onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                    />
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Inserisci l&apos;indirizzo per intero (comprensivo di @pec.it o dominio del gestore).
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Password per Programmi di Posta *</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsTutorialOpen(true)}
                        className="text-[11px] text-emerald-600 underline font-semibold cursor-pointer"
                      >
                        Come generarla con 2FA?
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder={formData.hasSmtpPass ? '•••••••• (Password già salvata e protetta sul server)' : 'Inserisci la password generata su webmail.pec.it'}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full px-3 py-2 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="mt-1.5 p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                      <p>
                        🔒 <strong>Sicurezza garantita:</strong> La password viene cifrata con algoritmo crittografico AES-256-GCM lato server. Non viene memorizzata nel browser, né nei log, né in localStorage.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Verifica Collegamento Test */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs block">
                        Verifica Collegamento
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Controlla connettività di rete e credenziali senza inviare email
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isTesting || (!formData.smtpUser && !passwordInput && !formData.hasSmtpPass)}
                      onClick={handleTestConnection}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isTesting ? (
                        <>
                          <Activity className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifica in corso...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verifica Collegamento</span>
                        </>
                      )}
                    </button>
                  </div>

                  {testResult && (
                    <div
                      className={`p-3 rounded-xl border text-xs leading-relaxed ${
                        testResult.success
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-medium'
                          : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <p className="whitespace-pre-line font-medium">{testResult.message}</p>
                          {testResult.networkBlocked && onOpenManualWebmail && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenManualWebmail();
                              }}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Apri Procedura Manuale Webmail Aruba</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Destinatario Istituzionale S.E.T. 118 */}
            <div className="space-y-2">
              <label className="block font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                3. Destinatario Istituzionale Sanitaservice ASL TA
              </label>
              <input
                type="email"
                required
                value={formData.pecUfficioPersonale}
                onChange={(e) => setFormData({ ...formData, pecUfficioPersonale: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
              <p className="text-[11px] text-slate-400">
                Casella PEC ufficiale dell&apos;Ufficio Personale a cui recapitare i registri firmati.
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                {formData.hasSmtpPass && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="text-rose-600 hover:text-rose-700 dark:hover:text-rose-400 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Scollega Casella PEC</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 rounded-lg transition-all cursor-pointer shadow-xs"
                >
                  {isSaving ? 'Salvataggio...' : 'Salva Configurazione'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Tutorial Scritto Modal */}
      {isTutorialOpen && (
        <ArubaPecTutorialModal
          isOpen={isTutorialOpen}
          onClose={() => setIsTutorialOpen(false)}
        />
      )}
    </>
  );
};
