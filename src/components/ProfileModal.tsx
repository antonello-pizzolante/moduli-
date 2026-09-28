import React, { useState, useEffect } from 'react';
import {
  User,
  CheckCircle2,
  Building,
  ShieldCheck,
  Phone,
  Mail,
  Palette,
  KeyRound,
  LogOut,
  Folder,
  FolderCheck,
  AlertTriangle,
  FolderSync,
  Check,
  FileSignature,
  PenTool,
  Trash2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { EmployeeProfile, DigitalSignature } from '../types';
import { ThemeSelector } from './ThemeSelector';
import { useAuth } from '../context/AuthContext';
import { changeUserPassword, deleteUserSignature } from '../services/apiService';
import { DigitalSignatureModal } from './DigitalSignatureModal';
import {
  LocalFolderStatus,
  getLocalFolderStatus,
  selectLocalFolder,
  verifyAndRequestFolderAccess,
} from '../services/localPersistenceService';

interface ProfileModalProps {
  profile: EmployeeProfile;
  onSave: (updated: EmployeeProfile) => void;
  onClose?: () => void;
  onOpenFolderSettings?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  profile,
  onSave,
  onClose,
  onOpenFolderSettings,
}) => {
  const { user, logout } = useAuth();
  const [formData, setFormData] = useState<EmployeeProfile>(profile);
  const [saved, setSaved] = useState(false);

  // Folder status state
  const [folderStatus, setFolderStatus] = useState<LocalFolderStatus | null>(null);
  const [isFolderLoading, setIsFolderLoading] = useState(false);
  const [folderMsg, setFolderMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    getLocalFolderStatus().then(setFolderStatus).catch(() => {});
  }, []);

  const handleSelectFolder = async () => {
    setIsFolderLoading(true);
    setFolderMsg(null);
    try {
      const res = await selectLocalFolder();
      setFolderStatus(res);
      setFolderMsg({ text: `Cartella "${res.folderName}" collegata con successo!`, type: 'success' });
    } catch (err: any) {
      setFolderMsg({ text: err.message || 'Selezione cartella non riuscita.', type: 'error' });
    } finally {
      setIsFolderLoading(false);
    }
  };

  const handleVerifyAccess = async () => {
    setIsFolderLoading(true);
    setFolderMsg(null);
    try {
      const res = await verifyAndRequestFolderAccess();
      setFolderStatus(res);
      if (res.status === 'CONNECTED') {
        setFolderMsg({ text: 'Accesso alla cartella verificato con successo!', type: 'success' });
      } else {
        setFolderMsg({ text: 'Autorizzazione richiesta dal browser.', type: 'error' });
      }
    } catch (err: any) {
      setFolderMsg({ text: err.message || 'Verifica non riuscita.', type: 'error' });
    } finally {
      setIsFolderLoading(false);
    }
  };

  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  // Digital Signature state
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [sigSuccessMsg, setSigSuccessMsg] = useState<string | null>(null);
  const [isRemovingSig, setIsRemovingSig] = useState(false);

  const handleRemoveSignature = async () => {
    if (window.confirm('Sei sicuro di voler rimuovere la firma salvata dal tuo profilo?')) {
      setIsRemovingSig(true);
      try {
        await deleteUserSignature();
        const updated = { ...formData, firmaSalvata: undefined };
        setFormData(updated);
        onSave(updated);
        setSigSuccessMsg('Firma rimossa con successo dal profilo.');
        setTimeout(() => setSigSuccessMsg(null), 3000);
      } catch (err: any) {
        setSigSuccessMsg(err.message || 'Errore durante la rimozione della firma.');
      } finally {
        setIsRemovingSig(false);
      }
    }
  };

  const handleSignatureSaved = (signature: DigitalSignature) => {
    const updated = { ...formData, firmaSalvata: signature };
    setFormData(updated);
    onSave(updated);
    setSigSuccessMsg('Firma salvata correttamente nel profilo!');
    setTimeout(() => setSigSuccessMsg(null), 4000);
  };

  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (!newPassword || newPassword.length < 4) {
      setPwdMsg({ type: 'error', text: 'La nuova password deve contenere almeno 4 caratteri' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'La nuova password e la conferma non coincidono' });
      return;
    }
    setIsChangingPwd(true);
    try {
      await changeUserPassword(oldPassword, newPassword);
      setPwdMsg({ type: 'success', text: 'Password aggiornata con successo!' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdMsg({ type: 'error', text: err.message || 'Errore durante l\'aggiornamento della password' });
    } finally {
      setIsChangingPwd(false);
    }
  };

  const postazioniSet118 = [
    'Taranto Sud - Postazione 118',
    'Taranto Centro - Postazione 118',
    'Taranto Nord - Postazione 118',
    'Manduria - Postazione 118',
    'Martina Franca - Postazione 118',
    'Grottaglie - Postazione 118',
    'Massafra - Postazione 118',
    'Castellaneta - Postazione 118',
    'Ginosa - Postazione 118',
    'Mottola - Postazione 118',
    'Avetrana - Postazione 118',
    'Maruggio - Postazione 118',
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs max-w-3xl mx-auto space-y-6 transition-colors">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 flex items-center justify-center text-white">
            <User className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Dati Dipendente & Impostazioni
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Questi dati vengono trascritti automaticamente nell&apos;intestazione del modulo Sanitaservice S.E.T. 118
            </p>
          </div>
        </div>

        {saved && (
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-md flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Salvato con successo
          </span>
        )}
      </div>

      {/* Theme customization box */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-rose-500">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">Tema Visivo Applicazione</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Scegli tra Turno Notte 118 (dark per ambulanza), Clinico o Rosso Soccorso
            </div>
          </div>
        </div>
        <ThemeSelector />
      </div>

      {/* Cartella Dati sul Dispositivo & Salvataggio Locale (Richiesta Utente) */}
      <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <FolderSync className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Cartella Dati sul Dispositivo (Salvataggio Automatico)</span>
                {folderStatus?.status === 'CONNECTED' && (
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                    Attiva
                  </span>
                )}
                {folderStatus?.status === 'PERMISSION_NEEDED' && (
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                    Permesso Richiesto
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Salva automaticamente ogni inserimento e modifica in una cartella locale con copia di sicurezza (.bak).
              </div>
            </div>
          </div>

          {onOpenFolderSettings && (
            <button
              type="button"
              onClick={onOpenFolderSettings}
              className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
            >
              Opzioni Avanzate →
            </button>
          )}
        </div>

        {folderMsg && (
          <div
            className={`p-2.5 rounded-lg text-xs font-medium ${
              folderMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {folderMsg.text}
          </div>
        )}

        {folderStatus?.isSupported ? (
          <div className="pt-1 flex flex-wrap items-center justify-between gap-3 text-xs bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div>
              {folderStatus.folderName ? (
                <div>
                  <span className="text-slate-500">Cartella attiva: </span>
                  <strong className="font-mono text-slate-900 dark:text-white">📁 {folderStatus.folderName}</strong>
                  {folderStatus.lastSaveTime && (
                    <span className="text-[11px] text-slate-400 ml-2">
                      (Ultimo salvataggio: {new Date(folderStatus.lastSaveTime).toLocaleTimeString('it-IT')})
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-600 dark:text-slate-400">Nessuna cartella collegata. I dati sono salvati nella memoria interna e sul server.</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {folderStatus.folderName ? (
                <>
                  <button
                    type="button"
                    onClick={handleVerifyAccess}
                    disabled={isFolderLoading}
                    className="px-3 py-1.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Verifica accesso</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    disabled={isFolderLoading}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    Cambia cartella
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSelectFolder}
                  disabled={isFolderLoading}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Seleziona cartella dati</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900/50 text-[11px] text-blue-900 dark:text-blue-200">
            ℹ️ Su questo dispositivo (iOS / Safari) l&apos;accesso continuo a cartelle non è consentito dalla sandbox Apple. I tuoi dati sono protetti in modo permanente nell&apos;archivio interno e puoi esportare/importare file di backup in qualsiasi momento.
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Cognome Dipendente *
            </label>
            <input
              type="text"
              required
              value={formData.cognome}
              onChange={(e) => setFormData({ ...formData, cognome: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              placeholder="ES. ROSSI"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Nome Dipendente *
            </label>
            <input
              type="text"
              required
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              placeholder="ES. MARIO"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Matricola N° *
            </label>
            <input
              type="text"
              required
              value={formData.matricola}
              onChange={(e) => setFormData({ ...formData, matricola: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              placeholder="ES. 0000001234"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Qualifica Servizio
            </label>
            <input
              type="text"
              value={formData.qualifica}
              onChange={(e) => setFormData({ ...formData, qualifica: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              placeholder="Autista Soccorritore 118"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Postazione di Servizio S.E.T. 118 *
          </label>
          <div className="space-y-2">
            <select
              value={formData.postazione}
              onChange={(e) => setFormData({ ...formData, postazione: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            >
              {postazioniSet118.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
              <option value="Altra Postazione">Altra Postazione (Inserisci sotto)</option>
            </select>

            <input
              type="text"
              value={formData.postazione}
              onChange={(e) => setFormData({ ...formData, postazione: e.target.value })}
              placeholder="Oppure scrivi il nome esatto della postazione..."
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Email PEC Personale (Mittente)
            </label>
            <input
              type="email"
              value={formData.emailPec || ''}
              onChange={(e) => setFormData({ ...formData, emailPec: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-white"
              placeholder="nome.cognome@pec.it"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Recapito Telefonico
            </label>
            <input
              type="tel"
              value={formData.telefono || ''}
              onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              placeholder="340 1234567"
            />
          </div>
        </div>

        {/* Firma Autografa / Digitale Personale (Archivio Privato) */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Firma Autografa / Originale del Dipendente
              </span>
            </div>

            {formData.firmaSalvata ? (
              <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3 stroke-[2.5]" />
                Firma Registrata
              </span>
            ) : (
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                Nessuna firma salvata
              </span>
            )}
          </div>

          {sigSuccessMsg && (
            <div className="p-2.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{sigSuccessMsg}</span>
            </div>
          )}

          {formData.firmaSalvata?.dataUrl ? (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="h-20 sm:h-24 w-full sm:w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center p-2 overflow-hidden shadow-2xs">
                  <img
                    src={formData.firmaSalvata.dataUrl}
                    alt="Firma Dipendente Salvata"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                <div className="flex-1 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                    <span>Firma originale associata a Matr. {formData.matricola}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Registrata: {formData.firmaSalvata.dataFirma}
                  </p>
                  {formData.firmaSalvata.sha256 && (
                    <p className="text-[10px] text-slate-400 font-mono truncate max-w-[280px]">
                      SHA-256: {formData.firmaSalvata.sha256}
                    </p>
                  )}
                  <p className="text-[11px] text-teal-700 dark:text-teal-400 italic pt-1">
                    Questa risorsa viene impiegata automaticamente nei moduli PDF con la tua autorizzazione.
                  </p>
                </div>

                <div className="flex sm:flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsSigModalOpen(true)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 border border-teal-300 dark:border-teal-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Rinnova Firma</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRemoveSignature}
                    disabled={isRemovingSig}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Rimuovi</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Nessuna firma originale memorizzata nel profilo
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Carica un file immagine (PNG o JPG) per apporre la firma istantaneamente su fogli straordinari e moduli.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsSigModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Carica Firma Personale</span>
              </button>
            </div>
          )}
        </div>

        {/* Credenziali di Accesso & Sicurezza */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Credenziali di Accesso Personali
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
            >
              {showPasswordSection ? 'Nascondi cambio password' : 'Cambia la tua password'}
            </button>
          </div>

          {showPasswordSection && (
            <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
              {pwdMsg && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-medium ${
                    pwdMsg.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {pwdMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Vecchia Password
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Opzionale se primo accesso"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Nuova Password *
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nuova password"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Conferma Password *
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ripeti nuova"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isChangingPwd || !newPassword}
                  onClick={handlePasswordChange}
                  className="px-3.5 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  {isChangingPwd ? 'Aggiornamento...' : 'Conferma Nuova Password'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {user && (
              <button
                type="button"
                onClick={logout}
                className="px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-rose-200 dark:border-rose-900/60"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Esci dall&apos;Account</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
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
              className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 dark:bg-rose-600 hover:bg-slate-800 dark:hover:bg-rose-700 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Salva Dati Profilo
            </button>
          </div>
        </div>
      </form>

      {/* Digital Signature Modal */}
      {isSigModalOpen && (
        <DigitalSignatureModal
          isOpen={isSigModalOpen}
          onClose={() => setIsSigModalOpen(false)}
          onSaveSignature={handleSignatureSaved}
          profile={formData}
          existingSignature={formData.firmaSalvata}
          documentTitle="Profilo Personale Dipendente S.E.T. 118"
        />
      )}
    </div>
  );
};
