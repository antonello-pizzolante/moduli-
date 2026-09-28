import {
  MonthlySheet,
  EmployeeProfile,
  DigitalSignature,
  PecSettings,
  PecLogEntry,
  OvertimeCalcState,
  UserSession,
  RegisterFormData,
  RegisteredUserSummary,
  StorageFileRecord,
  FileCategory,
  SheetVersionSnapshot,
  SyncState,
  ShiftImportPlan,
  ImportedShiftRecord,
  CandidateEmployeeMatch,
  AdminStats,
  SystemErrorRecord,
  AdminUserRecord,
} from '../types';
import { formatMinutesToHours } from '../utils/timeCalculations';
import {
  DEFAULT_OVERTIME_RATE_CONFIG,
  DEFAULT_ALLOWANCES_CONFIG,
} from '../utils/overtimeCalculator';
import {
  idbSaveSheet,
  idbGetSheets,
  idbSaveAllSheets,
  saveToLocalFolder,
  loadFromLocalFolder,
  mergeSheets,
} from './localPersistenceService';

// Storage keys
const STORAGE_KEY_AUTH_TOKEN = 'set118_auth_token';
const STORAGE_KEY_AUTH_USER = 'set118_auth_user';
const STORAGE_KEY_REMEMBER = 'set118_remember_login';
const STORAGE_KEY_SAVED_IDENTIFIER = 'set118_saved_identifier';

const BASE_KEY_PROFILE = 'set118_profile';
const BASE_KEY_SHEETS = 'set118_sheets';
const BASE_KEY_PEC = 'set118_pec';
const BASE_KEY_CALC = 'set118_overtime_calc';

// In-memory current user session
let activeToken: string | null = null;
let activeUser: UserSession | null = null;

export function getSessionToken(): string | null {
  if (activeToken) return activeToken;
  try {
    const isRemembered = localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
    activeToken = isRemembered
      ? localStorage.getItem(STORAGE_KEY_AUTH_TOKEN)
      : sessionStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
    return activeToken;
  } catch {
    return null;
  }
}

// Inizializza sessione da storage locale/sessione
function initSessionFromStorage(): UserSession | null {
  try {
    const token = getSessionToken();
    if (!token) return null;

    const isRemembered = localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
    const storedUser = isRemembered
      ? localStorage.getItem(STORAGE_KEY_AUTH_USER)
      : sessionStorage.getItem(STORAGE_KEY_AUTH_USER);

    if (storedUser) {
      activeUser = JSON.parse(storedUser);
      if (activeUser) {
        activeUser.token = token;
      }
      return activeUser;
    }
  } catch (e) {
    console.warn('Error reading saved session:', e);
  }
  return null;
}

initSessionFromStorage();

export function getCurrentUser(): UserSession | null {
  if (!activeUser) {
    initSessionFromStorage();
  }
  return activeUser;
}

export function setCurrentSession(user: UserSession | null, token: string | null, remember: boolean = true) {
  activeUser = user;
  activeToken = token;

  if (user && token) {
    user.token = token;
    if (remember) {
      localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');
      localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, token);
      sessionStorage.removeItem(STORAGE_KEY_AUTH_USER);
      sessionStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    } else {
      localStorage.setItem(STORAGE_KEY_REMEMBER, 'false');
      localStorage.removeItem(STORAGE_KEY_AUTH_USER);
      localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
      sessionStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(user));
      sessionStorage.setItem(STORAGE_KEY_AUTH_TOKEN, token);
    }
  } else {
    localStorage.removeItem(STORAGE_KEY_AUTH_USER);
    localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    sessionStorage.removeItem(STORAGE_KEY_AUTH_USER);
    sessionStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
  }
}

// Salvataggio della SOLA matricola/identificativo (MAI PASSWORD) per comodità operatore
export function getSavedLoginIdentifier(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_SAVED_IDENTIFIER);
  } catch {
    return null;
  }
}

export function setSavedLoginIdentifier(identifier: string, remember: boolean) {
  try {
    if (remember && identifier) {
      localStorage.setItem(STORAGE_KEY_SAVED_IDENTIFIER, identifier.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_SAVED_IDENTIFIER);
    }
  } catch {
    // ignore storage error
  }
}

export function getSavedLoginCredentials(): { identifier: string; remember: boolean } | null {
  const id = getSavedLoginIdentifier();
  if (id) {
    return { identifier: id, remember: true };
  }
  return null;
}

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    ...extraHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function getUserStorageKey(baseKey: string): string {
  const user = getCurrentUser();
  const mat = user?.matricola ? user.matricola.toUpperCase() : 'unauth_session';
  return `${baseKey}_${mat}`;
}

// Synchronous local cache getters for 0ms instantaneous UI render
export function getCachedProfile(): EmployeeProfile | null {
  try {
    const raw = localStorage.getItem(getUserStorageKey(BASE_KEY_PROFILE));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getCachedSheets(): MonthlySheet[] | null {
  try {
    const raw = localStorage.getItem(getUserStorageKey(BASE_KEY_SHEETS));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getCachedPecSettings(): PecSettings | null {
  try {
    const raw = localStorage.getItem(getUserStorageKey(BASE_KEY_PEC));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getCachedCalcState(): OvertimeCalcState | null {
  try {
    const raw = localStorage.getItem(getUserStorageKey(BASE_KEY_CALC));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getCachedPecLogs(): PecLogEntry[] | null {
  try {
    const raw = localStorage.getItem(getUserStorageKey('set118_pec_logs'));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Batched bootstrap call (retrieves all user state in 1 round trip)
export async function fetchBootstrap(): Promise<{
  profile: EmployeeProfile;
  pecSettings: PecSettings;
  sheets: MonthlySheet[];
  pecLogs: PecLogEntry[];
  overtimeCalc: OvertimeCalcState;
}> {
  const user = getCurrentUser();
  const mat = (user?.matricola || '').toUpperCase();

  // 1. Gather all local data first (IndexedDB, local folder, localStorage)
  let localSheets: MonthlySheet[] = [];
  try {
    const cachedRaw = localStorage.getItem(getUserStorageKey(BASE_KEY_SHEETS));
    if (cachedRaw) {
      localSheets = JSON.parse(cachedRaw);
    }
    const idbSheets = await idbGetSheets(mat);
    if (idbSheets && idbSheets.length > 0) {
      localSheets = mergeSheets(localSheets, idbSheets).merged;
    }
    const folderData = await loadFromLocalFolder();
    if (folderData?.sheets && folderData.sheets.length > 0) {
      localSheets = mergeSheets(localSheets, folderData.sheets).merged;
    }
  } catch (err) {
    console.warn('Error reading local persistence before bootstrap:', err);
  }

  try {
    const res = await fetch('/api/bootstrap', {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        if (data.profile) {
          localStorage.setItem(getUserStorageKey(BASE_KEY_PROFILE), JSON.stringify(data.profile));
        }
        if (data.pecSettings) {
          localStorage.setItem(getUserStorageKey(BASE_KEY_PEC), JSON.stringify(data.pecSettings));
        }
        if (data.pecLogs) {
          localStorage.setItem(getUserStorageKey('set118_pec_logs'), JSON.stringify(data.pecLogs));
        }
        if (data.overtimeCalc) {
          localStorage.setItem(getUserStorageKey(BASE_KEY_CALC), JSON.stringify(data.overtimeCalc));
        }

        // Merge remote sheets with local sheets without losing any entry!
        const serverSheets = Array.isArray(data.sheets) ? data.sheets : [];
        const { merged, hasLocalUnsyncedChanges } = mergeSheets(localSheets, serverSheets);

        localStorage.setItem(getUserStorageKey(BASE_KEY_SHEETS), JSON.stringify(merged));
        idbSaveAllSheets(mat, merged).catch(console.warn);

        // If local had unsynced changes, queue or push to server
        if (hasLocalUnsyncedChanges) {
          merged.forEach((s) => pendingSyncIds.add(s.id));
          syncPendingSheets().catch(console.warn);
        }

        updateSyncStatus({
          state: hasLocalUnsyncedChanges ? 'OFFLINE_LOCAL' : 'SAVED_ONLINE',
          lastConfirmedServerTime: new Date().toISOString(),
          message: hasLocalUnsyncedChanges
            ? 'Salvato sul dispositivo (in attesa di connessione)'
            : 'Salvato online',
        });

        return {
          profile: data.profile,
          pecSettings: data.pecSettings,
          sheets: merged,
          pecLogs: data.pecLogs,
          overtimeCalc: data.overtimeCalc,
        };
      }
    }
  } catch (e) {
    console.warn('Network offline or error in /api/bootstrap, using fallback', e);
  }

  // Fallback to separate endpoints or local cache
  const [p, pec, sList, logs, calc] = await Promise.all([
    fetchProfile(),
    fetchPecSettings(),
    fetchSheets(),
    fetchPecLogs(),
    fetchOvertimeCalc(),
  ]);

  const { merged } = mergeSheets(localSheets, sList);
  return { profile: p, pecSettings: pec, sheets: merged, pecLogs: logs, overtimeCalc: calc };
}

// --- AUTH API METHODS ---

export async function loginUser(
  identifier: string,
  password: string,
  rememberMe: boolean = true,
  isDemo: boolean = false
): Promise<{ user: UserSession; profile: EmployeeProfile; mustChangePassword?: boolean; message: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password, isDemo }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Credenziali non valide o errore di accesso');
  }

  const user: UserSession = {
    ...data.user,
    token: data.token,
    mustChangePassword: data.mustChangePassword,
    isDemo: data.isDemo,
  };
  setCurrentSession(user, data.token, rememberMe);
  setSavedLoginIdentifier(identifier, rememberMe);

  if (data.profile) {
    localStorage.setItem(getUserStorageKey(BASE_KEY_PROFILE), JSON.stringify(data.profile));
  }

  return {
    user,
    profile: data.profile,
    mustChangePassword: data.mustChangePassword,
    message: data.message,
  };
}

export async function demoLoginUser(): Promise<{ user: UserSession; profile: EmployeeProfile; message: string }> {
  const res = await fetch('/api/auth/demo-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Errore durante l'accesso all'ambiente dimostrativo");
  }

  const user: UserSession = {
    ...data.user,
    token: data.token,
    mustChangePassword: false,
    isDemo: true,
  };
  setCurrentSession(user, data.token, false);

  if (data.profile) {
    localStorage.setItem(getUserStorageKey(BASE_KEY_PROFILE), JSON.stringify(data.profile));
  }

  return {
    user,
    profile: data.profile,
    message: data.message,
  };
}

export async function registerUser(
  formData: RegisterFormData
): Promise<{ user: UserSession; profile: EmployeeProfile; message: string }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Errore durante la registrazione del dipendente');
  }

  const user: UserSession = {
    ...data.user,
    token: data.token,
    mustChangePassword: false,
    isDemo: false,
  };
  const remember = formData.salvaDatiAccesso !== false;
  setCurrentSession(user, data.token, remember);
  setSavedLoginIdentifier(user.matricola, remember);

  if (data.profile) {
    localStorage.setItem(getUserStorageKey(BASE_KEY_PROFILE), JSON.stringify(data.profile));
  }

  return {
    user,
    profile: data.profile,
    message: data.message,
  };
}

export async function logoutUser() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } catch {
    // Ignore network error on logout
  }
  setCurrentSession(null, null, false);
}

export async function verifyCurrentSession(): Promise<UserSession | null> {
  const token = getSessionToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        const user: UserSession = {
          ...data.user,
          token,
          mustChangePassword: data.mustChangePassword,
          isDemo: data.isDemo,
        };
        const isRemembered = localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
        setCurrentSession(user, token, isRemembered);
        return user;
      }
    }
  } catch (e) {
    console.warn('Session verification offline, using cached session if available', e);
  }
  return getCurrentUser();
}

export async function fetchRegisteredUsers(): Promise<RegisteredUserSummary[]> {
  // Lista pubblica rimossa per riservatezza e conformità tutela dati
  return [];
}

export async function changeUserPassword(
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      oldPassword,
      newPassword,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Errore durante il cambio password');
  }

  if (activeUser) {
    activeUser.mustChangePassword = false;
    const isRemembered = localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
    setCurrentSession(activeUser, activeToken, isRemembered);
  }

  return data;
}

// --- DATA METHODS (PER-USER ISOLATED) ---

export async function fetchProfile(): Promise<EmployeeProfile> {
  const storageKey = getUserStorageKey(BASE_KEY_PROFILE);
  try {
    const res = await fetch('/api/profile', {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.profile) {
        localStorage.setItem(storageKey, JSON.stringify(data.profile));
        return data.profile;
      }
    }
  } catch (err) {
    console.warn('Network offline, using local profile cache', err);
  }
  const cached = localStorage.getItem(storageKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const u = getCurrentUser();
  return {
    nome: u?.nome || '',
    cognome: u?.cognome || '',
    matricola: u?.matricola || '',
    postazione: u?.postazione || 'Taranto Centro - Postazione 118',
    qualifica: 'Autista Soccorritore 118',
    telefono: '',
    emailPec: u?.email || '',
    coordinatoreNome: '',
  };
}

export async function saveProfile(profile: EmployeeProfile): Promise<EmployeeProfile> {
  const storageKey = getUserStorageKey(BASE_KEY_PROFILE);
  localStorage.setItem(storageKey, JSON.stringify(profile));
  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(profile),
    });
    if (res.ok) {
      const data = await res.json();
      return data.profile;
    }
  } catch (err) {
    console.warn('Could not sync profile to network immediately', err);
  }
  return profile;
}

// ==========================================
// DEDICATED AUTHENTIC USER SIGNATURE API
// ==========================================

export async function uploadUserSignature(params: {
  base64Data: string;
  fileName?: string;
  mimeType?: string;
  tipo?: 'ORIGINALE' | 'DISEGNO' | 'DIGITALE';
  width?: number;
  height?: number;
  sheetId?: string;
}): Promise<{ success: boolean; message: string; signature: DigitalSignature; sheet?: MonthlySheet }> {
  const res = await fetch('/api/user/signature', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Errore durante il salvataggio della firma.');
  }

  // Update profile in localStorage and active session
  try {
    const profileKey = getUserStorageKey(BASE_KEY_PROFILE);
    const existing = localStorage.getItem(profileKey);
    if (existing) {
      const parsed = JSON.parse(existing);
      parsed.firmaSalvata = data.signature;
      localStorage.setItem(profileKey, JSON.stringify(parsed));
    }
  } catch (e) {
    console.warn('Could not update profile storage cache with signature', e);
  }

  return data;
}

export async function fetchUserSignature(): Promise<DigitalSignature | null> {
  try {
    const res = await fetch('/api/user/signature', {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      return data.signature || null;
    }
  } catch (e) {
    console.warn('Could not fetch user signature', e);
  }
  return null;
}

export async function deleteUserSignature(): Promise<boolean> {
  try {
    const res = await fetch('/api/user/signature', {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const profileKey = getUserStorageKey(BASE_KEY_PROFILE);
      const existing = localStorage.getItem(profileKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        delete parsed.firmaSalvata;
        localStorage.setItem(profileKey, JSON.stringify(parsed));
      }
      return true;
    }
  } catch (e) {
    console.warn('Could not delete user signature', e);
  }
  return false;
}

export async function fetchPecSettings(): Promise<PecSettings> {
  const storageKey = getUserStorageKey(BASE_KEY_PEC);
  try {
    const res = await fetch('/api/pec-settings', {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.pecSettings) {
        localStorage.setItem(storageKey, JSON.stringify(data.pecSettings));
        return data.pecSettings;
      }
    }
  } catch (err) {
    console.warn('Network offline, using local PEC cache', err);
  }
  const cached = localStorage.getItem(storageKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // fallback
    }
  }

  const u = getCurrentUser();
  return {
    pecUfficioPersonale: '118centrale@sanitaserviceaslta.it',
    pecCopiaConoscenza: 'coordinamento118@sanitaserviceaslta.it',
    invioAutomaticoGiorno1: false,
    oraInvioGiorno1: '08:00',
    promemoriaNotifica: true,
    smtpHost: 'smtps.pec.aruba.it',
    smtpPort: 465,
    smtpUser: u?.email || '',
    simulazioneTestMode: true,
  };
}

export async function savePecSettings(settings: PecSettings): Promise<PecSettings> {
  const storageKey = getUserStorageKey(BASE_KEY_PEC);
  localStorage.setItem(storageKey, JSON.stringify(settings));
  try {
    const res = await fetch('/api/pec-settings', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      const data = await res.json();
      return data.pecSettings;
    }
  } catch (err) {
    console.warn('Could not sync PEC settings to network immediately', err);
  }
  return settings;
}

export async function fetchSheets(): Promise<MonthlySheet[]> {
  const user = getCurrentUser();
  const mat = (user?.matricola || '').toUpperCase();
  const storageKey = getUserStorageKey(BASE_KEY_SHEETS);

  let localSheets: MonthlySheet[] = [];
  try {
    const cached = localStorage.getItem(storageKey);
    if (cached) localSheets = JSON.parse(cached);
    const idbSheets = await idbGetSheets(mat);
    if (idbSheets && idbSheets.length > 0) {
      localSheets = mergeSheets(localSheets, idbSheets).merged;
    }
  } catch (e) {
    // ignore
  }

  try {
    const res = await fetch('/api/sheets', {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.sheets)) {
        const { merged } = mergeSheets(localSheets, data.sheets);
        localStorage.setItem(storageKey, JSON.stringify(merged));
        idbSaveAllSheets(mat, merged).catch(console.warn);
        return merged;
      }
    }
  } catch (err) {
    console.warn('Network offline, using local sheets cache', err);
  }
  return localSheets;
}

// --- REAL-TIME SYNC STATUS TRACKING ---

let currentSyncStatus: {
  state: SyncState;
  lastConfirmedServerTime?: string;
  message?: string;
  conflict?: boolean;
  serverSheet?: MonthlySheet;
} = {
  state: 'SAVED_ONLINE',
  lastConfirmedServerTime: new Date().toISOString(),
  message: 'Salvato online',
};

const syncListeners = new Set<(status: typeof currentSyncStatus) => void>();
const pendingSyncIds = new Set<string>();

export function getSyncStatus() {
  return currentSyncStatus;
}

export function subscribeSyncStatus(listener: (status: typeof currentSyncStatus) => void): () => void {
  syncListeners.add(listener);
  listener(currentSyncStatus);
  return () => {
    syncListeners.delete(listener);
  };
}

export function updateSyncStatus(newStatus: typeof currentSyncStatus) {
  currentSyncStatus = newStatus;
  syncListeners.forEach((l) => {
    try {
      l(newStatus);
    } catch {
      // ignore
    }
  });
}

// Automatic retry of pending local sheets when network is restored
export async function syncPendingSheets(): Promise<void> {
  if (pendingSyncIds.size === 0) return;
  const storageKey = getUserStorageKey(BASE_KEY_SHEETS);
  const cachedRaw = localStorage.getItem(storageKey);
  if (!cachedRaw) return;
  const sheets: MonthlySheet[] = JSON.parse(cachedRaw);

  const idsToSync = Array.from(pendingSyncIds);
  for (const id of idsToSync) {
    const sheet = sheets.find((s) => s.id === id);
    if (!sheet) {
      pendingSyncIds.delete(id);
      continue;
    }
    try {
      const res = await fetch(`/api/sheets/${sheet.id}`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(sheet),
      });
      if (res.ok) {
        pendingSyncIds.delete(id);
        const data = await res.json();
        updateSyncStatus({
          state: 'SAVED_ONLINE',
          lastConfirmedServerTime: data.serverConfirmedTime || new Date().toISOString(),
          message: 'Sincronizzato online',
        });
      }
    } catch {
      // still offline, retry on next online event
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncPendingSheets().catch(console.warn);
  });
}

// Pulizia della sessione di accesso al logout (conservando i dati protetti dell'operatore)
export function clearAllLocalUserData() {
  try {
    localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEY_AUTH_USER);
    localStorage.removeItem(STORAGE_KEY_REMEMBER);
    sessionStorage.clear();
    activeUser = null;
    activeToken = null;
  } catch (err) {
    console.warn('Error clearing local auth session:', err);
  }
}

export async function saveSheet(sheet: MonthlySheet): Promise<MonthlySheet> {
  const user = getCurrentUser();
  const mat = (user?.matricola || sheet.dipendente?.matricola || 'anonymous').toUpperCase();
  const storageKey = getUserStorageKey(BASE_KEY_SHEETS);
  let monteOreMin = 0;
  let straordMin = 0;

  if (sheet.entries && Array.isArray(sheet.entries)) {
    for (const e of sheet.entries) {
      const mins = Number(e.minutiEffettuati) || 0;
      if (e.tipoDestinazione === 'MONTE_ORE') {
        monteOreMin += mins;
      } else {
        straordMin += mins;
      }
    }
  }

  const updatedSheet: MonthlySheet = {
    ...sheet,
    totaleMinutiMonteOre: monteOreMin,
    totaleMinutiStraordinario: straordMin,
    totaleMinutiComplessivo: monteOreMin + straordMin,
    totaleOreMonteOreFormatted: formatMinutesToHours(monteOreMin) || '0h 00m',
    totaleOreStraordinarioFormatted: formatMinutesToHours(straordMin) || '0h 00m',
    totaleOreComplessivoFormatted: formatMinutesToHours(monteOreMin + straordMin) || '0h 00m',
    updatedAt: new Date().toISOString(),
  };

  // Notifica immediata: Salvataggio in corso
  updateSyncStatus({
    state: 'SAVING',
    message: 'Salvataggio in corso...',
  });

  const cachedRaw = localStorage.getItem(storageKey);
  let sheetsList: MonthlySheet[] = cachedRaw ? JSON.parse(cachedRaw) : [];
  const idx = sheetsList.findIndex((s) => s.id === updatedSheet.id);
  if (idx >= 0) {
    sheetsList[idx] = updatedSheet;
  } else {
    sheetsList.push(updatedSheet);
  }

  // 1. Salvataggio immediato in localStorage
  localStorage.setItem(storageKey, JSON.stringify(sheetsList));

  // 2. Salvataggio persistente in IndexedDB
  try {
    await idbSaveSheet(mat, updatedSheet);
  } catch (err) {
    console.warn('idbSaveSheet fallback to localStorage:', err);
  }

  // 3. Salvataggio automatico nella cartella locale se selezionata dall'utente (scrittura atomica con .bak)
  try {
    const prof = getCachedProfile();
    const calc = getCachedCalcState();
    const pec = getCachedPecSettings();
    saveToLocalFolder(mat, sheetsList, { profile: prof, overtimeCalc: calc, pecSettings: pec }).catch((err) => {
      console.warn('saveToLocalFolder background note:', err);
    });
  } catch (err) {
    console.warn('saveToLocalFolder call failed:', err);
  }

  // 4. Sincronizzazione con il server remoto
  try {
    const res = await fetch(`/api/sheets/${updatedSheet.id}`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updatedSheet),
    });

    if (res.status === 409) {
      const conflictData = await res.json();
      updateSyncStatus({
        state: 'SAVE_FAILED',
        conflict: true,
        serverSheet: conflictData.serverSheet,
        message: 'Salvataggio non riuscito — Conflitto di modifiche contemporanee da altro dispositivo',
      });
      return updatedSheet;
    }

    if (res.ok) {
      const data = await res.json();
      const serverSheet = data.sheet || updatedSheet;
      if (idx >= 0) sheetsList[idx] = serverSheet;
      else sheetsList.push(serverSheet);
      localStorage.setItem(storageKey, JSON.stringify(sheetsList));
      idbSaveSheet(mat, serverSheet).catch(console.warn);

      // Rimuovi da eventuali tentativi in coda
      pendingSyncIds.delete(updatedSheet.id);

      // Conferma effettiva ricevuta dal server
      updateSyncStatus({
        state: 'SAVED_ONLINE',
        lastConfirmedServerTime: data.serverConfirmedTime || serverSheet.updatedAt,
        message: 'Salvato online',
      });

      return serverSheet;
    } else {
      pendingSyncIds.add(updatedSheet.id);
      updateSyncStatus({
        state: 'OFFLINE_LOCAL',
        message: 'Salvato sul dispositivo (in attesa di connessione)',
      });
    }
  } catch (err) {
    // Offline / mancata connessione: protetto sul dispositivo locale e IndexedDB
    console.warn('Network offline during saveSheet:', err);
    pendingSyncIds.add(updatedSheet.id);
    updateSyncStatus({
      state: 'OFFLINE_LOCAL',
      message: 'Salvato sul dispositivo (in attesa di connessione)',
    });
  }

  return updatedSheet;
}

// --- PRIVATE STORAGE API METHODS ---

export async function fetchStorageFiles(): Promise<StorageFileRecord[]> {
  try {
    const res = await fetch('/api/storage/files', {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      return data.files || [];
    }
  } catch (err) {
    console.warn('Could not fetch storage files from network', err);
  }
  return [];
}

export async function uploadStorageFile(params: {
  filename: string;
  mimeType: string;
  base64Data: string;
  category: FileCategory;
  sheetId?: string;
  description?: string;
}): Promise<{ file: StorageFileRecord; duplicate?: boolean; message: string }> {
  const res = await fetch('/api/storage/files', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Errore durante il caricamento del file');
  }
  return data;
}

export async function downloadStorageFile(fileId: string, filename: string): Promise<void> {
  const tokenRes = await fetch(`/api/storage/files/${fileId}/token`, {
    headers: getAuthHeaders(),
  });
  if (!tokenRes.ok) {
    throw new Error('Impossibile ottenere autorizzazione al download');
  }
  const tokenData = await tokenRes.json();
  const downloadUrl = `/api/storage/files/${fileId}/download?token=${tokenData.downloadToken}`;

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function verifyStorageFileHash(fileId: string): Promise<{
  intact: boolean;
  storedHash: string;
  computedHash: string;
  verifiedAt: string;
  message: string;
}> {
  const res = await fetch(`/api/storage/files/${fileId}/verify-hash`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Errore verifica integrità');
  return data;
}

export async function deleteStorageFile(fileId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/storage/files/${fileId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Errore eliminazione file');
  return data;
}

export async function fetchTrash(): Promise<{
  files: StorageFileRecord[];
  sheets: Array<{ id: string; title: string; deletedAt: string; trashExpiresAt: string; item: any }>;
  retentionDays: number;
}> {
  const res = await fetch('/api/storage/trash', {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Errore recupero cestino');
  return data;
}

export async function restoreTrashItem(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/storage/trash/${id}/restore`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Errore ripristino elemento');
  return data;
}

export async function deletePermanentTrashItem(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/storage/trash/${id}/permanent`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Errore eliminazione definitiva');
  return data;
}

export async function emptyAllTrash(): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/storage/trash/empty', {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Errore svuotamento cestino');
  return data;
}

export async function fetchSheetVersions(sheetId: string): Promise<SheetVersionSnapshot[]> {
  const res = await fetch(`/api/sheets/${sheetId}/versions`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) return [];
  return data.versions || [];
}

export async function restoreSheetVersion(sheetId: string, versionNum: number): Promise<MonthlySheet> {
  const res = await fetch(`/api/sheets/${sheetId}/versions/${versionNum}/restore`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok || !data.sheet) {
    throw new Error(data.message || 'Errore durante il ripristino della versione');
  }
  return data.sheet;
}

export async function migrateLocalDataToServer(sheets: MonthlySheet[]): Promise<{
  success: boolean;
  message: string;
  sheets: MonthlySheet[];
}> {
  const res = await fetch('/api/storage/migrate-local', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ sheets }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Errore durante la sincronizzazione');
  return data;
}

export async function exportFullBackupZip(): Promise<void> {
  const res = await fetch('/api/backup/full-export', {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Errore durante la generazione dell\'archivio ZIP completo');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Backup_Completo_SET118_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function disconnectPec(): Promise<PecSettings> {
  const res = await fetch('/api/pec-settings/disconnect', {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Errore durante la disconnessione della casella PEC');
  return data.pecSettings;
}

export async function sendPecRequest(params: {
  sheetId: string;
  pdfBase64: string;
  customRecipient?: string;
  note?: string;
  filename?: string;
  subject?: string;
  mailText?: string;
}): Promise<{ success: boolean; message: string; sheet?: MonthlySheet; log?: PecLogEntry }> {
  const res = await fetch('/api/pec/send', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Errore durante invio PEC');
  }
  return data;
}

export async function testPecConnection(params: {
  smtpHost?: string;
  smtpPort?: number;
  smtpSsl?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  imapHost?: string;
  imapPort?: number;
  imapSsl?: boolean;
}): Promise<{ success: boolean; message: string; details?: any; steps?: any }> {
  const res = await fetch('/api/pec/test-connection', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  return data;
}

export async function fetchPecLogs(): Promise<PecLogEntry[]> {
  try {
    const res = await fetch('/api/pec/logs', {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      return data.logs || [];
    }
  } catch (err) {
    console.warn('Could not fetch PEC logs from server', err);
  }
  return [];
}

export async function clearSheet(sheetId: string): Promise<MonthlySheet> {
  const storageKey = getUserStorageKey(BASE_KEY_SHEETS);
  const res = await fetch(`/api/sheets/${sheetId}/clear`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (data.sheet) {
    const cachedRaw = localStorage.getItem(storageKey);
    let sheetsList: MonthlySheet[] = cachedRaw ? JSON.parse(cachedRaw) : [];
    const idx = sheetsList.findIndex((s) => s.id === sheetId);
    if (idx >= 0) {
      sheetsList[idx] = data.sheet;
    } else {
      sheetsList.push(data.sheet);
    }
    localStorage.setItem(storageKey, JSON.stringify(sheetsList));
    return data.sheet;
  }
  throw new Error(data.message || 'Errore durante lo svuotamento del foglio');
}

export async function fetchOvertimeCalc(): Promise<OvertimeCalcState> {
  const storageKey = getUserStorageKey(BASE_KEY_CALC);
  const defaultState: OvertimeCalcState = {
    settings: DEFAULT_OVERTIME_RATE_CONFIG,
    allowanceSettings: DEFAULT_ALLOWANCES_CONFIG,
    records: [],
    allowanceRecords: [],
    cedolinoComparisons: {},
  };

  try {
    const res = await fetch('/api/overtime-calc', {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.calcData) {
        localStorage.setItem(storageKey, JSON.stringify(data.calcData));
        return data.calcData;
      }
    }
  } catch (err) {
    console.warn('Network offline, using local overtime calculation cache', err);
  }

  const cached = localStorage.getItem(storageKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return defaultState;
    }
  }
  return defaultState;
}

export async function saveOvertimeCalc(calcData: OvertimeCalcState): Promise<OvertimeCalcState> {
  const storageKey = getUserStorageKey(BASE_KEY_CALC);
  localStorage.setItem(storageKey, JSON.stringify(calcData));
  try {
    const res = await fetch('/api/overtime-calc', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(calcData),
    });
    if (res.ok) {
      const data = await res.json();
      return data.calcData || calcData;
    }
  } catch (err) {
    console.warn('Could not sync overtime calculation to network immediately', err);
  }
  return calcData;
}

// ==========================================
// IMPORTAZIONE TURNI DA PDF / FOTO & CALENDARIO
// ==========================================

const BASE_KEY_SHIFT_PLANS = 'set118_shift_plans';

export async function parseShiftsFromFiles(params: {
  files: Array<{ base64Data: string; fileName: string; mimeType: string }>;
  saveToArchive: boolean;
  selectedCandidateIndex?: number;
}): Promise<{
  success: boolean;
  plan?: ShiftImportPlan;
  needsCandidateSelection?: boolean;
  candidates?: CandidateEmployeeMatch[];
  notFound?: boolean;
  message?: string;
}> {
  const res = await fetch('/api/shifts/parse', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok && !data.message) {
    throw new Error(`Errore HTTP ${res.status} durante l'estrazione dei turni.`);
  }
  return data;
}

export async function fetchImportedShiftPlans(): Promise<ShiftImportPlan[]> {
  const storageKey = getUserStorageKey(BASE_KEY_SHIFT_PLANS);
  try {
    const res = await fetch('/api/shifts/plans', {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      const plans = data.plans || [];
      localStorage.setItem(storageKey, JSON.stringify(plans));
      return plans;
    }
  } catch (err) {
    console.warn('Could not fetch shift plans from server, using local cache:', err);
  }

  try {
    const cached = localStorage.getItem(storageKey);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

export async function saveImportedShiftPlan(
  plan: ShiftImportPlan,
  overwrite: boolean = false
): Promise<{
  success: boolean;
  conflict?: boolean;
  existingPlan?: ShiftImportPlan;
  plan?: ShiftImportPlan;
  message: string;
}> {
  const res = await fetch('/api/shifts/plans', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ plan, overwrite }),
  });

  const data = await res.json();
  if (data.success && data.plan) {
    const storageKey = getUserStorageKey(BASE_KEY_SHIFT_PLANS);
    try {
      const existing = localStorage.getItem(storageKey);
      let list: ShiftImportPlan[] = existing ? JSON.parse(existing) : [];
      const idx = list.findIndex((p) => p.mese === plan.mese && p.anno === plan.anno);
      if (idx >= 0) {
        list[idx] = data.plan;
      } else {
        list.unshift(data.plan);
      }
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not update shift plans local cache:', e);
    }
  }
  return data;
}

export async function deleteImportedShiftPlan(planId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/shifts/plans/${planId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const storageKey = getUserStorageKey(BASE_KEY_SHIFT_PLANS);
      const existing = localStorage.getItem(storageKey);
      if (existing) {
        const list: ShiftImportPlan[] = JSON.parse(existing);
        const filtered = list.filter((p) => p.id !== planId);
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      }
      return true;
    }
  } catch (err) {
    console.warn('Error deleting shift plan:', err);
  }
  return false;
}

// ==========================================
// METODI AREA AMMINISTRATORE (RBAC PROTETTI)
// ==========================================

export async function adminLogin(password: string): Promise<{
  success: boolean;
  user: UserSession;
  token: string;
  message: string;
  isInitialSetup?: boolean;
}> {
  const res = await fetch('/api/auth/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Accesso amministratore non riuscito.');
  }

  activeToken = data.token;
  activeUser = data.user;
  sessionStorage.setItem(STORAGE_KEY_AUTH_TOKEN, data.token);
  sessionStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(data.user));

  return data;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await fetch('/api/admin/stats', {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Dati non disponibili');
  }
  const data = await res.json();
  if (!data.success || !data.stats) {
    throw new Error(data.message || 'Dati non disponibili');
  }
  return data.stats;
}

export async function fetchAdminUsers(): Promise<AdminUserRecord[]> {
  const res = await fetch('/api/admin/users', {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Dati non disponibili');
  }
  const data = await res.json();
  if (!data.success || !data.users) {
    throw new Error(data.message || 'Dati non disponibili');
  }
  return data.users;
}

export async function fetchAdminErrors(): Promise<SystemErrorRecord[]> {
  const res = await fetch('/api/admin/errors', {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Dati non disponibili');
  }
  const data = await res.json();
  return data.errors || [];
}

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const res = await fetch('/api/admin/change-password', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Errore durante la modifica della password.');
  }
  return true;
}

export async function logClientError(
  categoria: 'REGISTRAZIONE' | 'SALVATAGGIO' | 'FIRMA' | 'GENERAZIONE_PDF',
  messaggio: string,
  dettagli?: any
): Promise<void> {
  try {
    await fetch('/api/log/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria, messaggio, dettagli }),
    });
  } catch (e) {
    console.warn('Could not log client error:', e);
  }
}

// Rilettura e convalida online della firma salvata dal backend
export async function verifySignatureOnline(): Promise<{
  success: boolean;
  signature: DigitalSignature | null;
}> {
  try {
    const res = await fetch('/api/user/signature', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      return { success: false, signature: null };
    }
    const data = await res.json();
    return {
      success: !!data.success && !!data.signature,
      signature: data.signature || null,
    };
  } catch (e) {
    console.warn('Errore verifica online firma:', e);
    return { success: false, signature: null };
  }
}
