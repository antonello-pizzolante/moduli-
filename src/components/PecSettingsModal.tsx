import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  Mail,
  Save,
  CheckCircle2,
  Server,
  Key,
  Eye,
  EyeOff,
  Activity,
  AlertCircle,
  Inbox,
  Send,
  Lock,
} from 'lucide-react';
import { PecSettings } from '../types';
import { testPecConnection } from '../services/apiService';

interface PecSettingsModalProps {
  settings: PecSettings;
  onSave: (updated: PecSettings) => void;
  onClose?: () => void;
}

const PEC_PROVIDERS = [
  {
    name: 'Aruba (smtps.aruba.it)',
    host: 'smtps.aruba.it',
    port: 465,
    ssl: true,
    imapHost: 'imaps.aruba.it',
    imapPort: 993,
    imapSsl: true,
  },
  {
    name: 'Aruba PEC (pec.aruba.it)',
    host: 'smtps.pec.aruba.it',
    port: 465,
    ssl: true,
    imapHost: 'imaps.pec.aruba.it',
    imapPort: 993,
    imapSsl: true,
  },
  {
    name: 'PosteCert (Poste Italiane)',
    host: 'mail.postecert.it',
    port: 465,
    ssl: true,
    imapHost: 'mail.postecert.it',
    imapPort: 993,
    imapSsl: true,
  },
  {
    name: 'Legalmail (InfoCert)',
    host: 'mail.legalmail.it',
    port: 465,
    ssl: true,
    imapHost: 'mbox.cert.legalmail.it',
    imapPort: 993,
    imapSsl: true,
  },
  {
    name: 'Register.it PEC',
    host: 'authsmtp.pec.register.it',
    port: 465,
    ssl: true,
    imapHost: 'imap.pec.register.it',
    imapPort: 993,
    imapSsl: true,
  },
  {
    name: 'Namirial PEC',
    host: 'smtp.sicurezzapostale.it',
    port: 465,
    ssl: true,
    imapHost: 'imap.sicurezzapostale.it',
    imapPort: 993,
    imapSsl: true,
  },
];

export const PecSettingsModal: React.FC<PecSettingsModalProps> = ({
  settings,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState<PecSettings>({
    ...settings,
    smtpSsl: settings.smtpSsl ?? true,
    imapHost: settings.imapHost || 'imaps.aruba.it',
    imapPort: settings.imapPort || 993,
    imapSsl: settings.imapSsl ?? true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleApplyProvider = (prov: (typeof PEC_PROVIDERS)[0]) => {
    setFormData((prev) => ({
      ...prev,
      smtpHost: prov.host,
      smtpPort: prov.port,
      smtpSsl: prov.ssl,
      imapHost: prov.imapHost,
      imapPort: prov.imapPort,
      imapSsl: prov.imapSsl,
    }));
  };

  const handleTestConnection = async () => {
    if (!formData.smtpHost || !formData.smtpUser) {
      setTestResult({
        success: false,
        message: 'Per testare la connessione inserisci Server SMTP ed Email PEC mittente.',
      });
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await testPecConnection({
        smtpHost: formData.smtpHost,
        smtpPort: formData.smtpPort || 465,
        smtpSsl: formData.smtpSsl ?? true,
        smtpUser: formData.smtpUser,
        smtpPass: formData.smtpPass,
        imapHost: formData.imapHost,
        imapPort: formData.imapPort,
        imapSsl: formData.imapSsl ?? true,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Errore durante la connessione al server PEC.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs max-w-3xl mx-auto space-y-6 transition-colors">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 dark:bg-emerald-800 flex items-center justify-center text-white shadow-xs">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Parametri PEC Ufficiale & Invio Reale
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configura l&apos;invio effettivo con valore legale all&apos;Ufficio Personale Sanitaservice ASL TA
            </p>
          </div>
        </div>

        {saved && (
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-md flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Configurazione salvata
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Real vs Simulation Mode Banner */}
        <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white block">
                Modalità di Invio PEC
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Scegli se inviare una reale PEC certificata all&apos;ufficio oppure eseguire una simulazione di prova.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!formData.simulazioneTestMode}
                onChange={(e) =>
                  setFormData({ ...formData, simulazioneTestMode: !e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              !formData.simulazioneTestMode
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              {!formData.simulazioneTestMode
                ? '🟢 INVIO REALE ATTIVO: L\'app si collegherà al server SMTP del tuo fornitore PEC e invierà l\'email autentica con allegato il PDF.'
                : '🟡 MODALITÀ PROVA / SIMULAZIONE: L\'invio viene validato internamente senza spedire email reali, ideale per testare l\'applicazione.'}
            </span>
          </div>
        </div>

        {/* Destination Addresses */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Indirizzi di Destinazione Ufficiali
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                PEC Ufficio Personale Sanitaservice *
              </label>
              <input
                type="email"
                required
                value={formData.pecUfficioPersonale}
                onChange={(e) =>
                  setFormData({ ...formData, pecUfficioPersonale: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-white"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Indirizzo PEC istituzionale a cui inviare il prospetto firmato
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email / PEC Coordinatore 118 (CC per conoscenza)
              </label>
              <input
                type="email"
                value={formData.pecCopiaConoscenza || ''}
                onChange={(e) =>
                  setFormData({ ...formData, pecCopiaConoscenza: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-white"
                placeholder="coordinamento118@sanitaserviceaslta.it"
              />
            </div>
          </div>
        </div>

        {/* Schedule settings */}
        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Regole Automazione Autonoma Giorno 1
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ora invio autonomo (Giorno 1 del mese)
              </label>
              <input
                type="time"
                value={formData.oraInvioGiorno1}
                onChange={(e) =>
                  setFormData({ ...formData, oraInvioGiorno1: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer mt-5">
                <input
                  type="checkbox"
                  checked={formData.invioAutomaticoGiorno1}
                  onChange={(e) =>
                    setFormData({ ...formData, invioAutomaticoGiorno1: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Attiva trasmissione autonoma senza intervento manuale
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Quick Preset Buttons */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Profili Server Preconfigurati
            </h3>
            <span className="text-[11px] text-slate-400">
              Clicca per compilare all&apos;istante
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PEC_PROVIDERS.map((prov) => (
              <button
                key={prov.name}
                type="button"
                onClick={() => handleApplyProvider(prov)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                  formData.smtpHost === prov.host
                    ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                }`}
              >
                {prov.name}
              </button>
            ))}
          </div>
        </div>

        {/* POSTA IN USCITA (SMTP) */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Posta in uscita (SMTP)
              </h3>
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Utilizzata per la trasmissione certificata
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Server SMTP
              </label>
              <input
                type="text"
                value={formData.smtpHost || ''}
                onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-white"
                placeholder="smtps.aruba.it"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Porta Server
              </label>
              <input
                type="number"
                value={formData.smtpPort || 465}
                onChange={(e) =>
                  setFormData({ ...formData, smtpPort: parseInt(e.target.value, 10) })
                }
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* SSL Checkbox for SMTP */}
          <div className="flex items-center justify-between py-1 px-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Crittografia SSL / TLS per Posta in Uscita (SMTP)
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.smtpSsl ?? true}
                onChange={(e) =>
                  setFormData({ ...formData, smtpSsl: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              <span className="ml-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                {(formData.smtpSsl ?? true) ? 'Attivo (Porta 465)' : 'Disattivato'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome Utente PEC (Indirizzo Email)
              </label>
              <input
                type="email"
                value={formData.smtpUser || ''}
                onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-white"
                placeholder="dipendente.118@sanitaserviceaslta.it"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password PEC
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.smtpPass || ''}
                  onChange={(e) => setFormData({ ...formData, smtpPass: e.target.value })}
                  className="w-full px-3 py-2 pr-10 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-white"
                  placeholder={formData.hasSmtpPass ? "•••••••• (Configurata sul server - Lascia vuoto per non modificare)" : "Inserisci la password PEC"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                La password PEC viene gestita esclusivamente sul server in modalità protetta. Lascia vuoto per mantenere quella già attiva.
              </p>
            </div>
          </div>
        </div>

        {/* POSTA IN ARRIVO (IMAP) */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Posta in arrivo (IMAP)
              </h3>
            </div>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
              Parametri casella di ricezione
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Server Posta in Arrivo (IMAP)
              </label>
              <input
                type="text"
                value={formData.imapHost || ''}
                onChange={(e) => setFormData({ ...formData, imapHost: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-white"
                placeholder="imaps.aruba.it"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Porta Server (IMAP)
              </label>
              <input
                type="number"
                value={formData.imapPort || 993}
                onChange={(e) =>
                  setFormData({ ...formData, imapPort: parseInt(e.target.value, 10) })
                }
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* SSL Checkbox for IMAP */}
          <div className="flex items-center justify-between py-1 px-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Crittografia SSL per Posta in Arrivo (IMAP)
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.imapSsl ?? true}
                onChange={(e) =>
                  setFormData({ ...formData, imapSsl: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              <span className="ml-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                {(formData.imapSsl ?? true) ? 'Attivo (Porta 993)' : 'Disattivato'}
              </span>
            </label>
          </div>
        </div>

        {/* Test Connection Button & Result */}
        <div className="pt-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 text-indigo-600 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Verifica connessione in corso...' : 'Verifica Connessione PEC'}</span>
            </button>
            <span className="text-[11px] text-slate-500">
              Testa subito la connessione ai server Aruba (smtps.aruba.it / 465)
            </span>
          </div>

          {testResult && (
            <div
              className={`mt-3 p-3 rounded-lg text-xs flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Chiudi
            </button>
          )}

          <button
            type="submit"
            className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            Salva Parametri PEC
          </button>
        </div>
      </form>
    </div>
  );
};
