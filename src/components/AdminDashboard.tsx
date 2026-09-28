import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  Activity,
  AlertTriangle,
  Clock,
  RefreshCw,
  LogOut,
  KeyRound,
  FileCheck,
  CheckCircle2,
  Filter,
  Eye,
  Check,
  Building2,
  FileSpreadsheet,
  FileSignature,
  Server,
  Lock,
} from 'lucide-react';
import { AdminStats, AdminUserRecord, SystemErrorRecord } from '../types';
import {
  fetchAdminStats,
  fetchAdminUsers,
  fetchAdminErrors,
  changeAdminPassword,
} from '../services/apiService';
import { useAuth } from '../context/AuthContext';

export const AdminDashboard: React.FC = () => {
  const { logout, user } = useAuth();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [errors, setErrors] = useState<SystemErrorRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'PANORAMICA' | 'UTENTI' | 'ERRORI' | 'SICUREZZA'>('PANORAMICA');
  const [errorCategoryFilter, setErrorCategoryFilter] = useState<string>('TUTTI');

  // Change password modal / state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [isSubmittingPass, setIsSubmittingPass] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [fetchedStats, fetchedUsers, fetchedErrors] = await Promise.all([
        fetchAdminStats(),
        fetchAdminUsers(),
        fetchAdminErrors(),
      ]);
      setStats(fetchedStats);
      setUsers(fetchedUsers);
      setErrors(fetchedErrors);
    } catch (err: any) {
      console.error('Error loading admin data:', err);
      setLoadError(err.message || 'Dati non disponibili');
      setStats(null);
      setUsers([]);
      setErrors([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (newPass.length < 8) {
      setPassError('La nuova password deve contenere almeno 8 caratteri.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('La conferma password non coincide con la nuova password inserita.');
      return;
    }

    setIsSubmittingPass(true);
    try {
      await changeAdminPassword(currentPass, newPass);
      setPassSuccess('Password amministratore aggiornata con successo.');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
      setTimeout(() => {
        setIsChangingPassword(false);
        setPassSuccess(null);
      }, 2500);
    } catch (err: any) {
      setPassError(err.message || 'Errore durante la modifica della password.');
    } finally {
      setIsSubmittingPass(false);
    }
  };

  const filteredErrors = errors.filter((err) => {
    if (errorCategoryFilter === 'TUTTI') return true;
    return err.categoria === errorCategoryFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="bg-slate-900 dark:bg-slate-950 text-white p-5 sm:p-6 rounded-2xl shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-600/90 text-white flex items-center justify-center shadow-lg shadow-rose-900/30">
            <ShieldAlert className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                Pannello Amministratore · S.E.T. 118
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800 rounded-md">
                RUOLO: ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Centrale Operativa 118 Taranto · Monitoraggio utenti, audit di sicurezza e tracciamento errori reali
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Ricarica statistiche reali dal database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Aggiorna Dati</span>
          </button>

          <button
            type="button"
            onClick={() => setIsChangingPassword(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Sicurezza Admin</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Esci</span>
          </button>
        </div>
      </div>

      {/* Load error warning */}
      {loadError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-2xl flex items-center justify-between text-xs text-rose-900 dark:text-rose-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold">Attenzione durante il recupero dei dati amministratore:</p>
              <p>{loadError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
          >
            Riprova
          </button>
        </div>
      )}

      {/* Real KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Utenti Registrati */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Utenti Registrati
            </p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {isLoading ? (
                <span className="text-slate-400 text-lg font-normal">Caricamento...</span>
              ) : stats ? (
                stats.utentiRegistrati
              ) : (
                <span className="text-rose-600 text-sm font-semibold">Dati non disponibili</span>
              )}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Operatori S.E.T. 118 attivi a sistema</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        {/* Card 2: Utenti Attivi 30 Giorni */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Attivi Ultimi 30 Giorni
            </p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {isLoading ? (
                <span className="text-slate-400 text-lg font-normal">Caricamento...</span>
              ) : stats ? (
                stats.utentiAttivi30Giorni
              ) : (
                <span className="text-rose-600 text-sm font-semibold">Dati non disponibili</span>
              )}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Con attività registrate nel mese</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        {/* Card 3: Errori Tracciati */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Errori Registrati
            </p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {isLoading ? (
                <span className="text-slate-400 text-lg font-normal">Caricamento...</span>
              ) : stats ? (
                stats.totaleErrori
              ) : (
                <span className="text-rose-600 text-sm font-semibold">Dati non disponibili</span>
              )}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Audit log sanitizzati a norma</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        {/* Card 4: Data Ultimo Aggiornamento */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ultimo Aggiornamento
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-1.5 font-mono">
              {isLoading ? (
                <span className="text-slate-400 font-normal">Caricamento...</span>
              ) : stats ? (
                new Date(stats.dataUltimoAggiornamento).toLocaleString('it-IT')
              ) : (
                <span className="text-rose-600 font-semibold">Dati non disponibili</span>
              )}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Sincronizzazione archivio online</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 stroke-[2]" />
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('PANORAMICA')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'PANORAMICA'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Panoramica Moduli & Sistema</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('UTENTI')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'UTENTI'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Dipendenti Registrati ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ERRORI')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'ERRORI'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Registro Errori ({errors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SICUREZZA')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'SICUREZZA'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Sicurezza & Credenziali</span>
        </button>
      </div>

      {/* TAB 1: PANORAMICA */}
      {activeTab === 'PANORAMICA' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Error distribution summary */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Ripartizione Errori Tracciati per Categoria</span>
              </h3>

              {stats ? (
                <div className="space-y-2.5 pt-1 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Registrazione</span>
                    <span className="font-mono font-bold px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-md">
                      {stats.erroriPerCategoria.REGISTRAZIONE}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Salvataggio Dati & Prospetti</span>
                    <span className="font-mono font-bold px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-md">
                      {stats.erroriPerCategoria.SALVATAGGIO}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Firma Autentica & Convalida</span>
                    <span className="font-mono font-bold px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-md">
                      {stats.erroriPerCategoria.FIRMA}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Generazione PDF & Trasmissione PEC</span>
                    <span className="font-mono font-bold px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-md">
                      {stats.erroriPerCategoria.GENERAZIONE_PDF}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-rose-600 font-semibold italic">Dati non disponibili</p>
              )}
            </div>

            {/* Compliance and Security Information */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-teal-600" />
                <span>Sicurezza & Isolamento dei Dati (RBAC)</span>
              </h3>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                <p>
                  • <strong>Controllo di Accesso Rigido (RBAC):</strong> Gli account dipendente non possono accedere alle rotte amministrative o alle API protette. I token con ruolo dipendente ricevono risposta 403 Forbidden.
                </p>
                <p>
                  • <strong>Protezione Privacy nei Log:</strong> Nessuna password in chiaro, né chiavi di firma o immagini raster vengono memorizzate nei log o esposte nella dashboard.
                </p>
                <p>
                  • <strong>Persistenza e Convalida:</strong> I prospetti e le firme risiedono in archivi isolati per matricola su disco e database protetto.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: UTENTI REGISTRATI */}
      {activeTab === 'UTENTI' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Dipendenti S.E.T. 118 Registrati nel Sistema
              </h3>
              <p className="text-xs text-slate-500">
                Elenco reale ricavato dal database aziendale · Totale: {users.length}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3.5">Matricola</th>
                  <th className="p-3.5">Nominativo</th>
                  <th className="p-3.5">Postazione 118</th>
                  <th className="p-3.5">Email Registrata</th>
                  <th className="p-3.5">Firma Personale</th>
                  <th className="p-3.5">Schede Turni</th>
                  <th className="p-3.5">Data Registrazione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                      {loadError ? 'Dati non disponibili' : 'Nessun utente registrato presente nel database.'}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.matricola} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                        {u.matricola}
                      </td>
                      <td className="p-3.5 font-semibold">
                        {u.cognome} {u.nome}
                      </td>
                      <td className="p-3.5">{u.postazione}</td>
                      <td className="p-3.5 font-mono text-[11px] text-slate-500">{u.email}</td>
                      <td className="p-3.5">
                        {u.haFirma ? (
                          <span className="inline-flex items-center gap-1 text-teal-600 font-bold">
                            <Check className="w-3.5 h-3.5" /> Presente
                          </span>
                        ) : (
                          <span className="text-slate-400">Assente</span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono">{u.schedeSalvateCount}</td>
                      <td className="p-3.5 text-slate-400 text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString('it-IT')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: REGISTRO ERRORI */}
      {activeTab === 'ERRORI' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Registro Errori di Sistema & Audit Log
              </h3>
              <p className="text-xs text-slate-500">
                Tracciamento trasparente degli errori di registrazione, salvataggio, firma e PDF (sanificato)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={errorCategoryFilter}
                onChange={(e) => setErrorCategoryFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="TUTTI">Tutte le categorie</option>
                <option value="REGISTRAZIONE">Registrazione</option>
                <option value="SALVATAGGIO">Salvataggio</option>
                <option value="FIRMA">Firma</option>
                <option value="GENERAZIONE_PDF">Generazione PDF</option>
              </select>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredErrors.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs italic">
                {loadError ? 'Dati non disponibili' : 'Nessun errore registrato nel sistema.'}
              </div>
            ) : (
              filteredErrors.map((err) => (
                <div
                  key={err.id}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        err.categoria === 'REGISTRAZIONE'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : err.categoria === 'FIRMA'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : err.categoria === 'GENERAZIONE_PDF'
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                          : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {err.categoria}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(err.timestamp).toLocaleString('it-IT')}
                    </span>
                  </div>

                  <p className="font-semibold text-slate-900 dark:text-white">
                    {err.messaggio}
                  </p>

                  {err.dettagliSanificati && (
                    <p className="font-mono text-[11px] text-slate-500 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
                      {err.dettagliSanificati}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SICUREZZA & CREDENZIALI ADMIN */}
      {activeTab === 'SICUREZZA' && (
        <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-600" />
              <span>Configurazione Sicurezza Account Amministratore</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Username predefinito: <code className="font-bold text-slate-800 dark:text-slate-200 font-mono">admin</code>
            </p>
          </div>

          <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl text-xs text-teal-900 dark:text-teal-200 space-y-1.5">
            <p className="font-bold">Come configurare la password amministratore:</p>
            <p className="leading-relaxed">
              1. <strong>Variabile di ambiente (Consigliato):</strong> Imposta <code className="font-mono font-bold">ADMIN_PASSWORD=&quot;la_tua_password_sicura&quot;</code> nel pannello Secrets di AI Studio o nel file <code className="font-mono">.env</code>.<br />
              2. <strong>Da questa schermata:</strong> Puoi modificare la password in qualsiasi momento compilando il modulo sottostante. La password verrà salvata con hash PBKDF2 crittograficamente sicuro nel file protetto del server <code className="font-mono">data/admin_auth.json</code>.
            </p>
          </div>

          <form onSubmit={handleChangePasswordSubmit} className="max-w-md space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password Attuale
              </label>
              <input
                type="password"
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                placeholder="Inserisci la password attuale"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nuova Password Amministratore (min. 8 caratteri)
              </label>
              <input
                type="password"
                required
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Nuova password sicura"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Conferma Nuova Password
              </label>
              <input
                type="password"
                required
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Ripeti la nuova password"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            {passError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200">
                {passError}
              </div>
            )}

            {passSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{passSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingPass}
              className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmittingPass ? 'Salvataggio in corso...' : 'Aggiorna Password Amministratore'}
            </button>
          </form>
        </div>
      )}

      {/* Modal for Quick Password Change from Header */}
      {isChangingPassword && activeTab !== 'SICUREZZA' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-rose-600" />
                <span>Modifica Password Amministratore</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsChangingPassword(false)}
                className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password Attuale
                </label>
                <input
                  type="password"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  placeholder="Inserisci password attuale"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nuova Password (min. 8 caratteri)
                </label>
                <input
                  type="password"
                  required
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Nuova password sicura"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Conferma Nuova Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Ripeti la nuova password"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              {passError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200">
                  {passError}
                </div>
              )}

              {passSuccess && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{passSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(false)}
                  className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPass}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingPass ? 'Salvataggio...' : 'Conferma Modifica'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
