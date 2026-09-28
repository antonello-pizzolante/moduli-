/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Header } from './components/Header';
import { TurniDashboard } from './components/TurniDashboard';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ThemeProvider } from './context/ThemeContext';
import {
  MonthlySheet,
  EmployeeProfile,
  PecSettings,
  PecLogEntry,
  OvertimeEntry,
  OvertimeCalcState,
  OvertimeCompensationRecord,
  OvertimeRateType,
} from './types';
import {
  fetchProfile,
  saveProfile,
  fetchPecSettings,
  savePecSettings,
  fetchSheets,
  saveSheet,
  clearSheet,
  fetchPecLogs,
  fetchOvertimeCalc,
  saveOvertimeCalc,
  fetchBootstrap,
  syncPendingSheets,
  getCachedProfile,
  getCachedSheets,
  getCachedPecSettings,
  getCachedCalcState,
  getCachedPecLogs,
} from './services/apiService';
import { getItalianMonthName } from './utils/timeCalculations';
import {
  DEFAULT_OVERTIME_RATE_CONFIG,
  DEFAULT_ALLOWANCES_CONFIG,
  calculateOvertimePay,
  OVERTIME_TYPE_DEFINITIONS,
  getDefaultPaymentMonth,
} from './utils/overtimeCalculator';
import { Plus, RefreshCw } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { ModuleSelectorHub } from './components/ModuleSelectorHub';
import { ActiveAppModule } from './types';
import { BottomSyncStatusBar } from './components/BottomSyncStatusBar';

// Lazy-loaded components for ultra-fast initial page load
const OfficialPdfPreview = lazy(() =>
  import('./components/OfficialPdfPreview').then((m) => ({ default: m.OfficialPdfPreview }))
);
const OvertimeCompensationView = lazy(() =>
  import('./components/OvertimeCompensationView').then((m) => ({ default: m.OvertimeCompensationView }))
);
const PecAutomationCard = lazy(() =>
  import('./components/PecAutomationCard').then((m) => ({ default: m.PecAutomationCard }))
);
const ArchiveView = lazy(() =>
  import('./components/ArchiveView').then((m) => ({ default: m.ArchiveView }))
);
const ProfileModal = lazy(() =>
  import('./components/ProfileModal').then((m) => ({ default: m.ProfileModal }))
);
const PecSettingsModal = lazy(() =>
  import('./components/PecSettingsModal').then((m) => ({ default: m.PecSettingsModal }))
);
const AddOvertimeModal = lazy(() =>
  import('./components/AddOvertimeModal').then((m) => ({ default: m.AddOvertimeModal }))
);
const OnlineAccessModal = lazy(() =>
  import('./components/OnlineAccessModal').then((m) => ({ default: m.OnlineAccessModal }))
);
const DataFolderSettingsModal = lazy(() =>
  import('./components/DataFolderSettingsModal').then((m) => ({ default: m.DataFolderSettingsModal }))
);
const CambioTurnoModule = lazy(() =>
  import('./components/CambioTurnoModule').then((m) => ({ default: m.CambioTurnoModule }))
);
const PermessiTimbraturaModule = lazy(() =>
  import('./components/PermessiTimbraturaModule').then((m) => ({ default: m.PermessiTimbraturaModule }))
);
const ImportTurniModule = lazy(() =>
  import('./components/ImportTurniModule').then((m) => ({ default: m.ImportTurniModule }))
);
const AdminDashboard = lazy(() =>
  import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);

const LazyFallback = () => (
  <div className="flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400">
    <RefreshCw className="w-7 h-7 text-rose-600 animate-spin mb-3" />
    <span className="text-xs font-semibold">Caricamento componente...</span>
  </div>
);

function MainApp() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [activeModule, setActiveModule] = useState<ActiveAppModule>('SELECTOR_HUB');
  const [activeTab, setActiveTab] = useState<'registro' | 'anteprima' | 'calcolo' | 'pec' | 'archivio' | 'profilo'>('registro');

  // Synchronous cache read for 0ms initial render
  const cachedProf = getCachedProfile();
  const cachedPec = getCachedPecSettings();
  const cachedSList = getCachedSheets();
  const cachedCalc = getCachedCalcState();
  const cachedLogs = getCachedPecLogs();

  const [profile, setProfile] = useState<EmployeeProfile | null>(cachedProf);
  const [pecSettings, setPecSettings] = useState<PecSettings | null>(cachedPec);
  const [sheets, setSheets] = useState<MonthlySheet[]>(cachedSList || []);
  const [currentSheetId, setCurrentSheetId] = useState<string>(
    cachedSList && cachedSList.length > 0
      ? cachedSList.find((s) => s.id === '2026-09')
        ? '2026-09'
        : cachedSList[0].id
      : '2026-09'
  );
  const [pecLogs, setPecLogs] = useState<PecLogEntry[]>(cachedLogs || []);
  const [calcState, setCalcState] = useState<OvertimeCalcState>(
    cachedCalc || {
      settings: DEFAULT_OVERTIME_RATE_CONFIG,
      allowanceSettings: DEFAULT_ALLOWANCES_CONFIG,
      records: [],
      allowanceRecords: [],
      cedolinoComparisons: {},
    }
  );
  // If cached data is present, display immediately without blocking spinner
  const [isLoading, setIsLoading] = useState<boolean>(!cachedProf);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isPecSettingsModalOpen, setIsPecSettingsModalOpen] = useState<boolean>(false);
  const [isOnlineModalOpen, setIsOnlineModalOpen] = useState<boolean>(false);
  const [isFolderSettingsModalOpen, setIsFolderSettingsModalOpen] = useState<boolean>(false);

  // Load initial data via batched single round-trip bootstrap call
  const loadInitialData = async () => {
    if (!profile) {
      setIsLoading(true);
    }
    try {
      const data = await fetchBootstrap();

      if (data.profile) setProfile(data.profile);
      if (data.pecSettings) setPecSettings(data.pecSettings);
      if (data.pecLogs) setPecLogs(data.pecLogs);
      if (data.overtimeCalc) setCalcState(data.overtimeCalc);

      if (data.sheets && data.sheets.length > 0) {
        setSheets(data.sheets);
        const storedActive = localStorage.getItem('set118_active_sheet_id');
        const found = storedActive ? data.sheets.find((s) => s.id === storedActive) : null;
        if (found) {
          setCurrentSheetId(found.id);
        } else {
          // Default to most recent month
          const sorted = [...data.sheets].sort((a, b) => b.id.localeCompare(a.id));
          setCurrentSheetId(sorted[0].id);
        }
      } else if (!cachedSList || cachedSList.length === 0) {
        // Create initial sheet for this employee
        const initialSheet: MonthlySheet = {
          id: '2026-09',
          anno: 2026,
          mese: 9,
          nomeMese: 'SETTEMBRE 2026',
          dipendente: data.profile || profile,
          entries: [],
          totaleMinutiMonteOre: 0,
          totaleMinutiStraordinario: 0,
          totaleMinutiComplessivo: 0,
          totaleOreMonteOreFormatted: '0h 00m',
          totaleOreStraordinarioFormatted: '0h 00m',
          totaleOreComplessivoFormatted: '0h 00m',
          status: 'BOZZA',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const saved = await saveSheet(initialSheet);
        setSheets([saved]);
        setCurrentSheetId(saved.id);
        localStorage.setItem('set118_active_sheet_id', saved.id);
      }
    } catch (err) {
      console.error('Error loading bootstrap data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      loadInitialData();
    }
  }, [isAuthenticated, user?.matricola]);

  // If waiting for saved session check
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-sm font-semibold tracking-wide text-slate-300">
          Caricamento sessione S.E.T. 118...
        </div>
      </div>
    );
  }

  // If not authenticated, show Login & Registration screen
  if (!isAuthenticated) {
    return <AuthModal />;
  }

  // If user has administrator role, directly render the dedicated Admin Dashboard
  if (user?.role === 'admin') {
    return (
      <Suspense fallback={<LazyFallback />}>
        <AdminDashboard />
      </Suspense>
    );
  }

  const currentSheet = sheets.find((s) => s.id === currentSheetId) || sheets[0] || null;

  // Handle calcState update
  const handleUpdateCalcState = async (newState: OvertimeCalcState) => {
    try {
      const saved = await saveOvertimeCalc(newState);
      setCalcState(saved);
    } catch (err) {
      console.error('Error updating overtime calculation state:', err);
    }
  };

  // Save new overtime entry with target sheet detection and persistence guarantee
  const handleAddOvertimeEntry = async (newEntry: OvertimeEntry, dateIso?: string): Promise<boolean> => {
    let targetSheetId = currentSheetId;
    if (dateIso && dateIso.includes('-')) {
      targetSheetId = dateIso.substring(0, 7);
    } else if (newEntry.giorno && newEntry.giorno.includes('/')) {
      const parts = newEntry.giorno.split('/');
      if (parts.length === 3) {
        targetSheetId = `${parts[2]}-${parts[1].padStart(2, '0')}`;
      }
    }

    let targetSheet = sheets.find((s) => s.id === targetSheetId);
    if (!targetSheet) {
      const [yearStr, monthStr] = targetSheetId.split('-');
      const y = parseInt(yearStr, 10) || 2026;
      const m = parseInt(monthStr, 10) || 9;
      const monthNames = [
        'GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO',
        'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'
      ];
      targetSheet = {
        id: targetSheetId,
        anno: y,
        mese: m,
        nomeMese: `${monthNames[m - 1] || 'MESE'} ${y}`,
        dipendente: profile || currentSheet?.dipendente,
        entries: [],
        totaleMinutiMonteOre: 0,
        totaleMinutiStraordinario: 0,
        totaleMinutiComplessivo: 0,
        totaleOreMonteOreFormatted: '0h 00m',
        totaleOreStraordinarioFormatted: '0h 00m',
        totaleOreComplessivoFormatted: '0h 00m',
        status: 'BOZZA',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const existingEntries = targetSheet.entries || [];
    const updatedEntries = [...existingEntries, newEntry];

    // Recompute totals
    let totMonteOreMins = 0;
    let totStraordMins = 0;

    updatedEntries.forEach((e) => {
      if (e.tipoDestinazione === 'MONTE_ORE') {
        totMonteOreMins += e.minutiEffettuati || 0;
      } else {
        totStraordMins += e.minutiEffettuati || 0;
      }
    });

    const formatMins = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${String(m).padStart(2, '0')}m`;
    };

    const hadSig = Boolean(targetSheet.firmaDipendente);
    const updatedSheet: MonthlySheet = {
      ...targetSheet,
      entries: updatedEntries,
      totaleMinutiMonteOre: totMonteOreMins,
      totaleMinutiStraordinario: totStraordMins,
      totaleMinutiComplessivo: totMonteOreMins + totStraordMins,
      totaleOreMonteOreFormatted: formatMins(totMonteOreMins),
      totaleOreStraordinarioFormatted: formatMins(totStraordMins),
      totaleOreComplessivoFormatted: formatMins(totMonteOreMins + totStraordMins),
      richiedeNuovaFirma: hadSig ? true : targetSheet.richiedeNuovaFirma,
      motivoNuovaFirma: hadSig ? `Modifica del ${new Date().toLocaleDateString('it-IT')}: aggiunta/aggiornamento turno.` : targetSheet.motivoNuovaFirma,
      firmaDipendente: hadSig ? undefined : targetSheet.firmaDipendente,
      convalida: undefined, // Modifica dati turni: invalida la precedente convalida
      updatedAt: new Date().toISOString(),
    };

    try {
      const saved = await saveSheet(updatedSheet);
      setSheets((prev) => {
        const exists = prev.some((s) => s.id === saved.id);
        if (exists) {
          return prev.map((s) => (s.id === saved.id ? saved : s));
        }
        return [...prev, saved];
      });
      setCurrentSheetId(saved.id);
      localStorage.setItem('set118_active_sheet_id', saved.id);

      // If marked as STRAORDINARIO, automatically sync to overtime calc state without duplicates
      if (newEntry.tipoDestinazione === 'STRAORDINARIO') {
        const isNight =
          newEntry.turnoType.toLowerCase().includes('notte') ||
          newEntry.orarioStraordinario.includes('20:') ||
          newEntry.orarioStraordinario.includes('21:') ||
          newEntry.orarioStraordinario.includes('22:') ||
          newEntry.orarioStraordinario.includes('23:') ||
          newEntry.orarioStraordinario.includes('00:') ||
          newEntry.orarioStraordinario.includes('07:');

        const tipologia: OvertimeRateType = isNight ? 'NOTTURNO_O_FESTIVO' : 'DIURNO_FERIALE';
        const rate =
          tipologia === 'NOTTURNO_O_FESTIVO'
            ? calcState.settings.maggiorazioneNotturnoFestivo
            : calcState.settings.maggiorazioneDiurnoFeriale;

        const oreDec = newEntry.oreDecimali || (newEntry.minutiEffettuati / 60);
        const pay = calculateOvertimePay({
          oreDecimali: oreDec,
          pagaOrariaBase: calcState.settings.pagaOrariaBase,
          maggiorazionePercentuale: rate,
        });

        const workedMonth = targetSheet.id;
        const paymentMonth = getDefaultPaymentMonth(workedMonth);

        let dataIsoCalculated = `${workedMonth}-01`;
        if (newEntry.giorno && newEntry.giorno.includes('/')) {
          const parts = newEntry.giorno.split('/');
          if (parts.length === 3) {
            dataIsoCalculated = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }

        const compRec: OvertimeCompensationRecord = {
          id: `AUTO-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          sheetEntryId: newEntry.id,
          data: dataIsoCalculated,
          meseLavorato: workedMonth,
          mesePrevistoPagamento: paymentMonth,
          ore: Math.floor(newEntry.minutiEffettuati / 60),
          minuti: newEntry.minutiEffettuati % 60,
          oreDecimali: oreDec,
          tipologia,
          tipologiaLabel: OVERTIME_TYPE_DEFINITIONS[tipologia].label,
          maggiorazionePercentuale: rate,
          pagaOrariaBase: calcState.settings.pagaOrariaBase,
          compensoCompletoLordo: pay.compensoCompletoLordo,
          solaMaggiorazioneLordi: pay.solaMaggiorazioneLordi,
          stato: 'DA_PAGARE',
          nota: newEntry.motivo ? `Da registro: ${newEntry.motivo}` : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const newCalcState: OvertimeCalcState = {
          ...calcState,
          records: [compRec, ...calcState.records],
        };
        setCalcState(newCalcState);
        saveOvertimeCalc(newCalcState).catch(console.error);
      }
      return true;
    } catch (err) {
      console.error('Error saving entry:', err);
      return false;
    }
  };

  // Delete overtime entry
  const handleDeleteEntry = async (entryId: string) => {
    if (!currentSheet) return;

    const existingEntries = currentSheet.entries || [];
    const updatedEntries = existingEntries.filter((e) => e.id !== entryId);

    let totMonteOreMins = 0;
    let totStraordMins = 0;

    updatedEntries.forEach((e) => {
      if (e.tipoDestinazione === 'MONTE_ORE') {
        totMonteOreMins += e.minutiEffettuati || 0;
      } else {
        totStraordMins += e.minutiEffettuati || 0;
      }
    });

    const formatMins = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${String(m).padStart(2, '0')}m`;
    };

    const hadSig = Boolean(currentSheet.firmaDipendente);
    const updatedSheet: MonthlySheet = {
      ...currentSheet,
      entries: updatedEntries,
      totaleMinutiMonteOre: totMonteOreMins,
      totaleMinutiStraordinario: totStraordMins,
      totaleMinutiComplessivo: totMonteOreMins + totStraordMins,
      totaleOreMonteOreFormatted: formatMins(totMonteOreMins),
      totaleOreStraordinarioFormatted: formatMins(totStraordMins),
      totaleOreComplessivoFormatted: formatMins(totMonteOreMins + totStraordMins),
      richiedeNuovaFirma: hadSig ? true : currentSheet.richiedeNuovaFirma,
      motivoNuovaFirma: hadSig ? `Modifica del ${new Date().toLocaleDateString('it-IT')}: rimossa riga di turno.` : currentSheet.motivoNuovaFirma,
      firmaDipendente: hadSig ? undefined : currentSheet.firmaDipendente,
      convalida: undefined, // Rimozione turno: invalida la precedente convalida
      updatedAt: new Date().toISOString(),
    };

    try {
      const saved = await saveSheet(updatedSheet);
      setSheets((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));

      // Remove corresponding calc record if linked
      const updatedCalcRecords = calcState.records.filter((r) => r.sheetEntryId !== entryId);
      if (updatedCalcRecords.length !== calcState.records.length) {
        const newCalcState = { ...calcState, records: updatedCalcRecords };
        setCalcState(newCalcState);
        saveOvertimeCalc(newCalcState).catch(console.error);
      }
    } catch (err) {
      console.error('Error deleting entry:', err);
    }
  };

  // Clear sheet completely to clean state
  const handleClearSheet = async (sheetId: string) => {
    try {
      const cleared = await clearSheet(sheetId);
      setSheets((prev) => prev.map((s) => (s.id === cleared.id ? cleared : s)));
    } catch (err) {
      console.error('Error clearing sheet:', err);
    }
  };

  // Create new month in archive
  const handleCreateNewMonth = async (year: number, month: number) => {
    const monthId = `${year}-${String(month).padStart(2, '0')}`;
    const monthName = `${getItalianMonthName(year, month)} ${year}`;

    const defaultProfile: EmployeeProfile = profile || {
      nome: user?.nome || '',
      cognome: user?.cognome || '',
      matricola: user?.matricola || '',
      postazione: user?.postazione || 'Taranto Centro - Postazione 118',
      qualifica: 'Autista Soccorritore 118',
    };

    const newSheet: MonthlySheet = {
      id: monthId,
      anno: year,
      mese: month,
      nomeMese: monthName,
      dipendente: defaultProfile,
      entries: [],
      totaleMinutiMonteOre: 0,
      totaleMinutiStraordinario: 0,
      totaleMinutiComplessivo: 0,
      totaleOreMonteOreFormatted: '0h 00m',
      totaleOreStraordinarioFormatted: '0h 00m',
      totaleOreComplessivoFormatted: '0h 00m',
      status: 'BOZZA',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const saved = await saveSheet(newSheet);
      setSheets((prev) => {
        const filtered = prev.filter((s) => s.id !== saved.id);
        return [saved, ...filtered];
      });
      setCurrentSheetId(saved.id);
      setActiveTab('registro');
    } catch (err) {
      console.error('Error creating new month:', err);
    }
  };

  // Delete an entire monthly sheet
  const handleDeleteSheet = async (sheetId: string) => {
    try {
      await fetch(`/api/sheets/${sheetId}`, { method: 'DELETE' });
      setSheets((prev) => prev.filter((s) => s.id !== sheetId));
      if (currentSheetId === sheetId) {
        const remaining = sheets.filter((s) => s.id !== sheetId);
        if (remaining.length > 0) {
          setCurrentSheetId(remaining[0].id);
        }
      }
    } catch (err) {
      console.error('Error deleting sheet:', err);
    }
  };

  // Save profile updates
  const handleSaveProfile = async (updated: EmployeeProfile) => {
    try {
      const saved = await saveProfile(updated);
      setProfile(saved);

      // Sync with current sheet
      if (currentSheet) {
        const updatedSheet = { ...currentSheet, dipendente: saved };
        const savedSheet = await saveSheet(updatedSheet);
        setSheets((prev) => prev.map((s) => (s.id === savedSheet.id ? savedSheet : s)));
      }
    } catch (err) {
      console.error('Error saving profile:', err);
    }
  };

  // Save PEC settings
  const handleSavePecSettings = async (updated: PecSettings) => {
    try {
      const saved = await savePecSettings(updated);
      setPecSettings(saved);
      setIsPecSettingsModalOpen(false);
    } catch (err) {
      console.error('Error saving PEC settings:', err);
    }
  };

  // Refresh logs
  const handleRefreshLogs = async () => {
    const logs = await fetchPecLogs();
    setPecLogs(logs);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-rose-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Caricamento registro turni Sanitaservice 118...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        currentSheet={currentSheet}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenOnlineModal={() => setIsOnlineModalOpen(true)}
      />

      {/* Offline Status Indicator */}
      <OfflineIndicator />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Suspense fallback={<LazyFallback />}>
          {/* Module 1: Hub di selezione immediata post-login */}
          {activeModule === 'SELECTOR_HUB' && profile && (
            <ModuleSelectorHub
              onSelectModule={(mod) => setActiveModule(mod)}
              profile={profile}
              currentActive={activeModule}
            />
          )}

          {/* Module 2: Modello per Cambi Turno */}
          {activeModule === 'CAMBIO_TURNO' && profile && (
            <CambioTurnoModule
              profile={profile}
              onBackToHub={() => setActiveModule('SELECTOR_HUB')}
              onSignatureUpdated={(sig) => {
                if (profile) {
                  handleSaveProfile({ ...profile, firmaSalvata: sig });
                }
              }}
            />
          )}

          {/* Module 3: Permessi & Mancata Timbratura */}
          {activeModule === 'PERMESSI_TIMBRATURA' && profile && (
            <PermessiTimbraturaModule
              profile={profile}
              onBackToHub={() => setActiveModule('SELECTOR_HUB')}
              onSignatureUpdated={(sig) => {
                if (profile) {
                  handleSaveProfile({ ...profile, firmaSalvata: sig });
                }
              }}
            />
          )}

          {/* Module 5: Importazione & Carica Turni da PDF / Foto */}
          {activeModule === 'IMPORTA_TURNI' && profile && (
            <ImportTurniModule
              profile={profile}
              onBackToHub={() => setActiveModule('SELECTOR_HUB')}
              onOpenProfile={() => {
                setActiveModule('STRAORDINARI');
                setActiveTab('profilo');
              }}
            />
          )}

          {/* Module 4: Prospetto Straordinari S.E.T. 118 (Foglio Firme Mensile) */}
          {activeModule === 'STRAORDINARI' && (
            <>
              {activeTab === 'registro' && currentSheet && (
                <TurniDashboard
                  sheet={currentSheet}
                  allSheets={sheets}
                  onSelectSheetId={(id) => setCurrentSheetId(id)}
                  onOpenAddModal={() => setIsAddModalOpen(true)}
                  onDeleteEntry={handleDeleteEntry}
                  onGoToPdf={() => setActiveTab('anteprima')}
                  onGoToPec={() => setActiveTab('pec')}
                  onGoToCalcolo={() => setActiveTab('calcolo')}
                  onGoToImportTurni={() => setActiveModule('IMPORTA_TURNI')}
                  onClearSheet={() => handleClearSheet(currentSheet.id)}
                  onOpenProfile={() => setActiveTab('profilo')}
                  onSaveSheet={async () => {
                    const saved = await saveSheet(currentSheet);
                    setSheets((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
                  }}
                  onUpdateSheet={async (updated) => {
                    const saved = await saveSheet(updated);
                    setSheets((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
                  }}
                  onSaveProfile={handleSaveProfile}
                />
              )}

              {activeTab === 'anteprima' && currentSheet && (
                <OfficialPdfPreview
                  sheet={currentSheet}
                  onOpenAddModal={() => setIsAddModalOpen(true)}
                  onDeleteEntry={handleDeleteEntry}
                  onGoToPec={() => setActiveTab('pec')}
                  onUpdateSheet={async (updated) => {
                    const saved = await saveSheet(updated);
                    setSheets((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
                  }}
                  onSaveProfile={handleSaveProfile}
                />
              )}

              {activeTab === 'calcolo' && (
                <OvertimeCompensationView
                  currentSheet={currentSheet}
                  calcState={calcState}
                  onUpdateCalcState={handleUpdateCalcState}
                  onNavigateToSheet={() => setActiveTab('registro')}
                />
              )}

              {activeTab === 'pec' && currentSheet && pecSettings && (
                <PecAutomationCard
                  sheet={currentSheet}
                  pecSettings={pecSettings}
                  pecLogs={pecLogs}
                  onUpdateSheet={(updated) => {
                    setSheets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
                  }}
                  onRefreshLogs={handleRefreshLogs}
                  onOpenSettings={() => setIsPecSettingsModalOpen(true)}
                />
              )}

              {activeTab === 'archivio' && (
                <ArchiveView
                  sheets={sheets}
                  currentSheetId={currentSheetId}
                  onSelectSheet={(id) => {
                    setCurrentSheetId(id);
                    setActiveTab('registro');
                  }}
                  onCreateNewMonth={handleCreateNewMonth}
                  onDeleteSheet={handleDeleteSheet}
                  onReloadAll={loadInitialData}
                  onOpenFolderSettings={() => setIsFolderSettingsModalOpen(true)}
                />
              )}

              {activeTab === 'profilo' && profile && (
                <ProfileModal
                  profile={profile}
                  onSave={handleSaveProfile}
                  onOpenFolderSettings={() => setIsFolderSettingsModalOpen(true)}
                />
              )}
            </>
          )}
        </Suspense>
      </main>

      {/* Floating '+' Action Button only when in STRAORDINARI */}
      {activeModule === 'STRAORDINARI' && (
        <div className="fixed bottom-16 right-6 z-40">
          <button
            onClick={() => setIsAddModalOpen(true)}
            title="Inserisci Straordinario (+)"
            className="group flex items-center gap-2.5 px-4 py-3 sm:px-5 sm:py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
            <span className="text-xs sm:text-sm font-extrabold tracking-wide uppercase">
              + Inserisci Straordinario
            </span>
          </button>
        </div>
      )}

      <Suspense fallback={null}>
        {/* Overtime Entry Modal */}
        {isAddModalOpen && (
          <AddOvertimeModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onSave={handleAddOvertimeEntry}
          />
        )}

        {/* Online Access & Smartphone Modal */}
        {isOnlineModalOpen && (
          <OnlineAccessModal
            isOpen={isOnlineModalOpen}
            onClose={() => setIsOnlineModalOpen(false)}
          />
        )}

        {/* PEC Settings Modal */}
        {isPecSettingsModalOpen && pecSettings && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="w-full max-w-3xl">
              <PecSettingsModal
                settings={pecSettings}
                onSave={handleSavePecSettings}
                onClose={() => setIsPecSettingsModalOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Local Data Folder & Backup Modal */}
        {isFolderSettingsModalOpen && (
          <DataFolderSettingsModal
            isOpen={isFolderSettingsModalOpen}
            onClose={() => setIsFolderSettingsModalOpen(false)}
            sheets={sheets}
            matricola={user?.matricola || profile?.matricola || ''}
            onSheetsUpdated={(updated) => setSheets(updated)}
            profile={profile}
            overtimeCalc={calcState}
            pecSettings={pecSettings}
          />
        )}
      </Suspense>

      {/* Bottom Save & Sync Status Bar (Requested: "metti in basso quel salvato online" + folder status) */}
      <BottomSyncStatusBar
        onOpenFolderSettings={() => setIsFolderSettingsModalOpen(true)}
        onRetrySync={syncPendingSheets}
      />

      {/* Footer */}
      <footer className="no-print mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="font-bold text-rose-600 dark:text-rose-400 tracking-wide text-xs px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 shadow-2xs">
              S.E.T. 118 Taranto · Portale Riservato
            </span>
            <span className="hidden sm:inline text-slate-400">·</span>
            <span className="text-slate-600 dark:text-slate-400">
              Sanitaservice ASL TA s.r.l. Unipersonale
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 text-xs">
            <button
              onClick={() => setIsOnlineModalOpen(true)}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              📱 Accedi da Cellulare
            </button>
            <span>·</span>
            <span>Archivio cloud attivo</span>
            <span>·</span>
            <span>Invio PEC giorno 1</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
