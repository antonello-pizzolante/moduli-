import React, { useState, useEffect } from 'react';
import {
  Shield,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  RotateCcw,
  Sparkles,
  Lock,
  Building2,
  Ticket,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSavedLoginIdentifier } from '../services/apiService';

export const AuthModal: React.FC = () => {
  const { login, loginAdmin, enterDemo, register, changePassword, mustChangePassword, user } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'mandatory_password' | 'recovery_info' | 'admin_login'>('login');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [salvaDatiAccesso, setSalvaDatiAccesso] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Admin login form state
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Mandatory change password state
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [confirmPasswordVal, setConfirmPasswordVal] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Register form state
  const [regNome, setRegNome] = useState('');
  const [regCognome, setRegCognome] = useState('');
  const [regMatricola, setRegMatricola] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPostazione, setRegPostazione] = useState('Taranto Centro - Postazione 118');
  const [regCodiceInvito, setRegCodiceInvito] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfermaPassword, setRegConfermaPassword] = useState('');
  const [regSalvaDatiAccesso, setRegSalvaDatiAccesso] = useState(true);
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Status & feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const postazioniSet118 = [
    'Taranto Centro - Postazione 118',
    'Taranto Sud - Postazione 118',
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

  useEffect(() => {
    if (mustChangePassword) {
      setMode('mandatory_password');
    }
  }, [mustChangePassword]);

  // Carica identificativo precedentemente salvato solo se richiesto dall'utente
  useEffect(() => {
    const saved = getSavedLoginIdentifier();
    if (saved) {
      setLoginIdentifier(saved);
      setSalvaDatiAccesso(true);
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (!loginIdentifier.trim() || !loginPassword.trim()) {
        throw new Error('Inserisci matricola e password');
      }

      await login(loginIdentifier.trim(), loginPassword, salvaDatiAccesso, false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Credenziali non valide o errore di accesso');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoAccess = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      await enterDemo();
    } catch (err: any) {
      setErrorMsg(err.message || "Errore durante l'accesso all'ambiente dimostrativo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      if (!adminPassword.trim()) {
        throw new Error('Inserisci la password amministratore.');
      }
      await loginAdmin(adminPassword.trim());
    } catch (err: any) {
      setErrorMsg(err.message || 'Credenziali amministrative non valide o errore di connessione.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMandatoryPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (!newPasswordVal.trim()) {
        throw new Error('Inserisci la nuova password');
      }
      if (newPasswordVal.length < 8) {
        throw new Error('La nuova password deve contenere almeno 8 caratteri');
      }
      if (newPasswordVal !== confirmPasswordVal) {
        throw new Error('Le due password inserite non coincidono');
      }

      await changePassword('', newPasswordVal.trim());
      setSuccessMsg('Password aggiornata con successo! Accesso in corso...');
    } catch (err: any) {
      setErrorMsg(err.message || 'Errore durante il salvataggio della nuova password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (
        !regNome.trim() ||
        !regCognome.trim() ||
        !regMatricola.trim() ||
        !regEmail.trim() ||
        !regPostazione.trim() ||
        !regPassword.trim() ||
        !regCodiceInvito.trim()
      ) {
        throw new Error('Compila tutti i campi obbligatori contrassegnati con *');
      }

      if (regPassword.length < 8) {
        throw new Error('La password deve contenere almeno 8 caratteri');
      }

      if (regPassword !== regConfermaPassword) {
        throw new Error('Le password inserite non coincidono');
      }

      await register({
        nome: regNome.trim().toUpperCase(),
        cognome: regCognome.trim().toUpperCase(),
        matricola: regMatricola.trim().toUpperCase(),
        email: regEmail.trim().toLowerCase(),
        postazione: regPostazione.trim(),
        password: regPassword,
        codiceInvito: regCodiceInvito.trim().toUpperCase(),
        salvaDatiAccesso: regSalvaDatiAccesso,
      });

      setSuccessMsg('Registrazione completata con successo! Accesso in corso...');
    } catch (err: any) {
      setErrorMsg(err.message || 'Errore durante la registrazione');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Background Institutional Glow */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-rose-600/30 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-blue-600/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 transition-all max-h-[94vh] flex flex-col">
        {/* Header Bar with Official Institutional Branding */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6 border-b border-slate-800 text-center relative shrink-0">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img
              src="/sanitaservice_logo_colori.png?v=2"
              alt="Sanitaservice ASL TA s.r.l. Unipersonale"
              className="h-10 sm:h-12 w-auto object-contain shrink-0 rounded-lg shadow-xs"
            />
            <div className="text-left">
              <div className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                S.E.T. <span className="text-rose-500 font-black">118</span>
                <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/80 ml-1">
                  ASL TA
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] font-medium text-slate-400">
                Portale Riservato Dipendenti S.E.T. 118
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Accesso sicuro per la gestione di registro orari, straordinari e comunicazioni aziendali.
          </p>

          {/* Mode Switcher Tabs (Solo in modalità normale login/register) */}
          {mode !== 'mandatory_password' && mode !== 'admin_login' && (
            <div className="mt-4 sm:mt-5 grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                className={`min-h-[44px] py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'login' || mode === 'recovery_info'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Accedi</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                }}
                className={`min-h-[44px] py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'register'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Nuova Registrazione</span>
              </button>
            </div>
          )}

          {mode === 'admin_login' && (
            <div className="mt-4 sm:mt-5 p-2.5 bg-rose-950/40 rounded-xl border border-rose-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
                <Shield className="w-4 h-4 text-rose-400" />
                <span>Area Riservata Amministrazione</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                ← Torna al login
              </button>
            </div>
          )}
        </div>

        {/* Content Form Body (Scrollable for Mobile Keyboard) */}
        <div className="p-4 sm:p-6 overflow-y-auto touch-scroll flex-1">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-200 text-xs flex items-start gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* VISTA 1: CAMBIO PASSWORD OBBLIGATORIO */}
          {mode === 'mandatory_password' ? (
            <form onSubmit={handleMandatoryPasswordSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/70 text-amber-200 text-xs">
                <div className="flex items-center gap-2 font-bold mb-1 text-amber-300">
                  <Lock className="w-4 h-4" />
                  <span>Aggiornamento di Sicurezza Obbligatorio</span>
                </div>
                <p className="leading-relaxed text-amber-200/90">
                  Per garantire la conformità agli standard di sicurezza e proteggere i tuoi dati orari, è necessario impostare una nuova password sicura (minimo 8 caratteri).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nuova Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPasswordVal}
                    onChange={(e) => setNewPasswordVal(e.target.value)}
                    placeholder="Minimo 8 caratteri"
                    className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Conferma Nuova Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPasswordVal}
                    onChange={(e) => setConfirmPasswordVal(e.target.value)}
                    placeholder="Ripeti la nuova password"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Salvataggio...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Salva Password e Accedi all&apos;Area Personale</span>
                  </>
                )}
              </button>
            </form>
          ) : mode === 'recovery_info' ? (
            /* VISTA 2: INFORMAZIONI RECUPERO ACCOUNT SICURO */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-4 h-4" />
                  Recupero Credenziali Aziendali
                </span>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Torna al login
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-3 leading-relaxed">
                <p>
                  Per proteggere i registri orari e i dati personali dei dipendenti da accessi non autorizzati, il recupero e lo sblocco dell&apos;account vengono effettuati esclusivamente attraverso canali aziendali verificati.
                </p>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-rose-400" />
                    Procedura di Assistenza:
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300">
                    <li>Contatta il coordinatore della tua postazione 118.</li>
                    <li>Oppure rivolgiti all&apos;Ufficio Personale Sanitaservice ASL TA.</li>
                    <li>Fornisci la tua matricola aziendale e il documento di servizio per la reimpostazione sicura.</li>
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Torna alla schermata di accesso
              </button>
            </div>
          ) : mode === 'admin_login' ? (
            /* VISTA: LOGIN AMMINISTRATORE (RBAC PROTETTO) */
            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-800 flex items-center justify-center text-rose-400">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white uppercase tracking-wider">
                      Area Riservata Amministrazione
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Coordinamento & Gestione Portale S.E.T. 118
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setMode('login');
                  }}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  ← Torna al login
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password Amministratore *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Inserisci la password amministratore"
                    className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-slate-400 flex items-start gap-1.5 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Accesso consentito esclusivamente al personale autorizzato. Se si tratta del primo accesso, la credenziale predefinita di sistema è <code className="text-amber-300 font-mono font-bold">AdminSET118!</code> (modificabile nel pannello di sicurezza).
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-rose-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifica credenziali...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Accedi al Pannello Amministratore</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setMode('login');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer underline"
                >
                  Accedi come operatore dipendente
                </button>
              </div>
            </form>
          ) : mode === 'login' ? (
            /* VISTA 3: LOGIN NORMALE */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Matricola o Email Aziendale *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Es. 0000001234 oppure nome.cognome@dominio.it"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('recovery_info');
                      setErrorMsg(null);
                    }}
                    className="text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                  >
                    Password dimenticata?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Inserisci la password di accesso"
                    className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Opzione Mantieni sessione attiva */}
              <div className="pt-1">
                <label
                  htmlFor="salva-dati-accesso"
                  className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-300 hover:text-white select-none"
                >
                  <input
                    type="checkbox"
                    id="salva-dati-accesso"
                    checked={salvaDatiAccesso}
                    onChange={(e) => setSalvaDatiAccesso(e.target.checked)}
                    className="w-4 h-4 text-rose-600 bg-slate-950 border-slate-700 rounded-md focus:ring-rose-500 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <span className="font-semibold text-slate-200">Mantieni la sessione attiva</span>
                </label>
                <p className="text-[11px] text-slate-400 pl-6.5 mt-0.5">
                  Conserva l&apos;autenticazione protetta su questo dispositivo.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-rose-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifica credenziali...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Accedi all&apos;Area Personale</span>
                  </>
                )}
              </button>

              {/* Accesso Amministratore (Discreto ma visibile, utilizzabile da smartphone) */}
              <div className="pt-2 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setMode('admin_login');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 py-1.5 px-3 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  <span>Accesso amministratore</span>
                </button>
              </div>

              {/* SEZIONE AMBIENTE DEMO SEPARATO */}
              <div className="mt-6 pt-5 border-t border-slate-800">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-left">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Ambiente Dimostrativo</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Dati sintetici simulati · Invii PEC reali disabilitati
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDemoAccess}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <span>Entra in Demo</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* VISTA 4: REGISTRAZIONE SICURA CON CODICE AZIENDALE */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    required
                    value={regNome}
                    onChange={(e) => setRegNome(e.target.value)}
                    placeholder="Es. Mario"
                    className="w-full px-3 py-2 text-sm bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Cognome *
                  </label>
                  <input
                    type="text"
                    required
                    value={regCognome}
                    onChange={(e) => setRegCognome(e.target.value)}
                    placeholder="Es. Rossi"
                    className="w-full px-3 py-2 text-sm bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Matricola Aziendale *
                  </label>
                  <input
                    type="text"
                    required
                    value={regMatricola}
                    onChange={(e) => setRegMatricola(e.target.value)}
                    placeholder="Es. 0000001234"
                    className="w-full px-3 py-2 text-sm bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Email Aziendale / PEC *
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="nome.cognome@dominio.it"
                    className="w-full px-3 py-2 text-sm bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Postazione S.E.T. 118 *
                </label>
                <select
                  value={regPostazione}
                  onChange={(e) => setRegPostazione(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-950/70 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                >
                  {postazioniSet118.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Codice Autorizzazione Aziendale */}
              <div>
                <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 text-amber-400" />
                  Codice Invito / Voucher Aziendale *
                </label>
                <input
                  type="text"
                  required
                  value={regCodiceInvito}
                  onChange={(e) => setRegCodiceInvito(e.target.value)}
                  placeholder="Es. SET118-ATTIVAZIONE-2026"
                  className="w-full px-3 py-2 text-sm bg-slate-950/70 border border-amber-600/70 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono uppercase"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>Codice di attivazione aziendale:</span>
                  <button
                    type="button"
                    onClick={() => setRegCodiceInvito('SET118-ATTIVAZIONE-2026')}
                    className="font-mono text-amber-400 hover:text-amber-300 underline font-bold cursor-pointer"
                    title="Clicca per inserire il codice"
                  >
                    SET118-ATTIVAZIONE-2026
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Password Personale *
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min. 8 caratteri"
                      className="w-full px-3 py-2 pr-8 text-sm bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Conferma Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={regConfermaPassword}
                    onChange={(e) => setRegConfermaPassword(e.target.value)}
                    placeholder="Ripeti password"
                    className="w-full px-3 py-2 text-sm bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-rose-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Registrazione in corso...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Verifica Codice &amp; Registra Account</span>
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Sei già registrato?{' '}
                  <span className="text-rose-400 font-semibold underline underline-offset-2">
                    Accedi qui
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
