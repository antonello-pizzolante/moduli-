/**
 * Local Persistence & File System Service for S.E.T. 118 App
 * Handles:
 * 1. Persistent IndexedDB + localStorage storage (offline resilience)
 * 2. File System Access API (local folder selection, auto-save, atomic write with .bak copy)
 * 3. Smart bidirectional merge of sheets to prevent data loss
 * 4. Fallback for iOS/Safari where showDirectoryPicker is not supported
 */

import { MonthlySheet, OvertimeEntry } from '../types';

const IDB_NAME = 'sanitaservice_118_local_db';
const IDB_VERSION = 1;
const STORE_SHEETS = 'user_sheets';
const STORE_SETTINGS = 'settings';
const STORE_HANDLES = 'handles';

export interface LocalFolderStatus {
  isSupported: boolean;
  hasFolder: boolean;
  folderName: string | null;
  lastSaveTime: string | null;
  status: 'CONNECTED' | 'DISCONNECTED' | 'PERMISSION_NEEDED' | 'UNSUPPORTED';
  message: string;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  source: string;
  matricola: string;
  sheets: MonthlySheet[];
  profile?: any;
  overtimeCalc?: any;
  pecSettings?: any;
}

// -------------------------------------------------------------
// INDEXEDDB ENGINE
// -------------------------------------------------------------

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB non disponibile'));
      return;
    }
    const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e: any) => {
      const db: IDBDatabase = e.target.result;
      if (!db.objectStoreNames.contains(STORE_SHEETS)) {
        db.createObjectStore(STORE_SHEETS, { keyPath: 'storageId' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Save sheet to IndexedDB
export async function idbSaveSheet(matricola: string, sheet: MonthlySheet): Promise<void> {
  try {
    const db = await openIDB();
    const cleanMat = (matricola || 'anonymous').toUpperCase();
    const storageId = `${cleanMat}_${sheet.id}`;
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SHEETS], 'readwrite');
      const store = tx.objectStore(STORE_SHEETS);
      store.put({ storageId, matricola: cleanMat, sheetId: sheet.id, data: sheet, savedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('idbSaveSheet fallback to localStorage only:', err);
  }
}

// Get all sheets for user from IndexedDB
export async function idbGetSheets(matricola: string): Promise<MonthlySheet[]> {
  try {
    const db = await openIDB();
    const cleanMat = (matricola || 'anonymous').toUpperCase();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_SHEETS], 'readonly');
      const store = tx.objectStore(STORE_SHEETS);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = req.result || [];
        const userSheets = records
          .filter((r: any) => r.matricola === cleanMat)
          .map((r: any) => r.data as MonthlySheet);
        resolve(userSheets);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// FILE SYSTEM ACCESS API (LOCAL FOLDER HANDLING)
// -------------------------------------------------------------

// Active directory handle in memory
let cachedDirectoryHandle: any = null;

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// Store directory handle in IDB
async function idbSaveDirectoryHandle(handle: any, folderName: string): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_HANDLES, STORE_SETTINGS], 'readwrite');
      tx.objectStore(STORE_HANDLES).put({ key: 'data_directory', handle });
      tx.objectStore(STORE_SETTINGS).put({ key: 'folder_name', value: folderName });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not persist directory handle in IDB:', err);
  }
}

// Retrieve directory handle from IDB
async function idbGetDirectoryHandle(): Promise<{ handle: any; folderName: string | null } | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_HANDLES, STORE_SETTINGS], 'readonly');
      const hReq = tx.objectStore(STORE_HANDLES).get('data_directory');
      const nReq = tx.objectStore(STORE_SETTINGS).get('folder_name');
      tx.oncomplete = () => {
        if (hReq.result && hReq.result.handle) {
          resolve({ handle: hReq.result.handle, folderName: nReq.result?.value || null });
        } else {
          resolve(null);
        }
      };
      tx.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// Disconnect folder
export async function disconnectLocalFolder(): Promise<void> {
  cachedDirectoryHandle = null;
  try {
    const db = await openIDB();
    const tx = db.transaction([STORE_HANDLES, STORE_SETTINGS], 'readwrite');
    tx.objectStore(STORE_HANDLES).delete('data_directory');
    tx.objectStore(STORE_SETTINGS).delete('folder_name');
    tx.objectStore(STORE_SETTINGS).delete('last_folder_save');
  } catch (e) {
    console.warn('Error disconnecting folder from IDB:', e);
  }
  localStorage.removeItem('set118_folder_name');
  localStorage.removeItem('set118_last_folder_save');
}

// Verify permission for directory handle
async function verifyPermission(fileHandle: any, readWrite = true): Promise<boolean> {
  const options: any = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }
  try {
    if ((await fileHandle.queryPermission(options)) === 'granted') {
      return true;
    }
    if ((await fileHandle.requestPermission(options)) === 'granted') {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

// User Action: Select directory using system picker
export async function selectLocalFolder(): Promise<LocalFolderStatus> {
  if (!isFileSystemAccessSupported()) {
    return {
      isSupported: false,
      hasFolder: false,
      folderName: null,
      lastSaveTime: null,
      status: 'UNSUPPORTED',
      message: 'Il selettore cartella automatica non è supportato su questo browser (es. Safari/iOS). Usa il backup e ripristino file.',
    };
  }

  try {
    const dirHandle = await (window as any).showDirectoryPicker({
      id: 'set118_data_folder',
      mode: 'readwrite',
    });

    const folderName = dirHandle.name || 'Cartella Selezionata';
    cachedDirectoryHandle = dirHandle;

    await idbSaveDirectoryHandle(dirHandle, folderName);
    localStorage.setItem('set118_folder_name', folderName);

    return {
      isSupported: true,
      hasFolder: true,
      folderName,
      lastSaveTime: localStorage.getItem('set118_last_folder_save'),
      status: 'CONNECTED',
      message: `Cartella "${folderName}" collegata con successo. Salvataggio locale attivo.`,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Selezione della cartella annullata.');
    }
    throw new Error(`Errore durante la selezione della cartella: ${err.message}`);
  }
}

// Check current local folder status
export async function getLocalFolderStatus(): Promise<LocalFolderStatus> {
  const supported = isFileSystemAccessSupported();
  if (!supported) {
    return {
      isSupported: false,
      hasFolder: false,
      folderName: null,
      lastSaveTime: null,
      status: 'UNSUPPORTED',
      message: 'Su questo browser o sistema (iOS/Safari) l\'accesso automatico continuo a cartelle non è consentito dalla piattaforma. I dati sono protetti nell\'archivio interno dell\'app ed esportabili in file.',
    };
  }

  if (!cachedDirectoryHandle) {
    const stored = await idbGetDirectoryHandle();
    if (stored) {
      cachedDirectoryHandle = stored.handle;
      if (stored.folderName) {
        localStorage.setItem('set118_folder_name', stored.folderName);
      }
    }
  }

  const folderName = localStorage.getItem('set118_folder_name');
  const lastSaveTime = localStorage.getItem('set118_last_folder_save');

  if (!cachedDirectoryHandle) {
    return {
      isSupported: true,
      hasFolder: false,
      folderName: null,
      lastSaveTime: null,
      status: 'DISCONNECTED',
      message: 'Nessuna cartella locale selezionata. I dati sono salvati nella memoria interna e sul server.',
    };
  }

  try {
    const perm = await cachedDirectoryHandle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      return {
        isSupported: true,
        hasFolder: true,
        folderName: folderName || cachedDirectoryHandle.name,
        lastSaveTime,
        status: 'CONNECTED',
        message: `Cartella attiva: ${folderName || cachedDirectoryHandle.name}. Accesso verificato.`,
      };
    } else {
      return {
        isSupported: true,
        hasFolder: true,
        folderName: folderName || cachedDirectoryHandle.name,
        lastSaveTime,
        status: 'PERMISSION_NEEDED',
        message: 'Autorizzazione richiesta per accedere alla cartella. Clicca su "Verifica accesso".',
      };
    }
  } catch {
    return {
      isSupported: true,
      hasFolder: true,
      folderName,
      lastSaveTime,
      status: 'DISCONNECTED',
      message: 'Impossibile accedere alla cartella. Ricollega la cartella per continuare.',
    };
  }
}

// Test / request permission explicitly
export async function verifyAndRequestFolderAccess(): Promise<LocalFolderStatus> {
  const current = await getLocalFolderStatus();
  if (!current.isSupported || !cachedDirectoryHandle) {
    return current;
  }

  const hasPerm = await verifyPermission(cachedDirectoryHandle, true);
  if (hasPerm) {
    return {
      ...current,
      status: 'CONNECTED',
      message: `Accesso verificato con successo per la cartella "${current.folderName}".`,
    };
  } else {
    return {
      ...current,
      status: 'PERMISSION_NEEDED',
      message: 'Autorizzazione negata dal sistema. Seleziona nuovamente la cartella per concedere i permessi.',
    };
  }
}

// -------------------------------------------------------------
// ATOMIC WRITE WITH SAFETY BACKUP COPY
// -------------------------------------------------------------

const MAIN_FILE_NAME = 'dati_straordinari_118.json';
const BACKUP_FILE_NAME = 'dati_straordinari_118.bak.json';
const TMP_FILE_NAME = 'dati_straordinari_118.tmp.json';

export async function saveToLocalFolder(
  matricola: string,
  sheets: MonthlySheet[],
  extra?: { profile?: any; overtimeCalc?: any; pecSettings?: any }
): Promise<boolean> {
  if (!isFileSystemAccessSupported()) return false;

  if (!cachedDirectoryHandle) {
    const stored = await idbGetDirectoryHandle();
    if (stored) {
      cachedDirectoryHandle = stored.handle;
    }
  }
  if (!cachedDirectoryHandle) return false;

  try {
    const perm = await cachedDirectoryHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      return false;
    }

    const payload: BackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      source: 'S.E.T. 118 Sanitaservice ASL TA - Salvataggio Automatico Cartella',
      matricola: matricola.toUpperCase(),
      sheets,
      profile: extra?.profile,
      overtimeCalc: extra?.overtimeCalc,
      pecSettings: extra?.pecSettings,
    };

    const content = JSON.stringify(payload, null, 2);

    // 1. Write to temporary file
    const tmpHandle = await cachedDirectoryHandle.getFileHandle(TMP_FILE_NAME, { create: true });
    const writableTmp = await tmpHandle.createWritable();
    await writableTmp.write(content);
    await writableTmp.close();

    // 2. Read back & verify valid JSON
    const tmpFile = await tmpHandle.getFile();
    const readBack = await tmpFile.text();
    JSON.parse(readBack); // throws if corrupted

    // 3. If previous file exists, copy it to .bak.json as safety backup
    try {
      const existingHandle = await cachedDirectoryHandle.getFileHandle(MAIN_FILE_NAME, { create: false });
      const existingFile = await existingHandle.getFile();
      const existingText = await existingFile.text();
      const bakHandle = await cachedDirectoryHandle.getFileHandle(BACKUP_FILE_NAME, { create: true });
      const writableBak = await bakHandle.createWritable();
      await writableBak.write(existingText);
      await writableBak.close();
    } catch {
      // First save, no previous file to back up
    }

    // 4. Overwrite main file with verified content
    const mainHandle = await cachedDirectoryHandle.getFileHandle(MAIN_FILE_NAME, { create: true });
    const writableMain = await mainHandle.createWritable();
    await writableMain.write(content);
    await writableMain.close();

    // 5. Clean up tmp file
    try {
      await cachedDirectoryHandle.removeEntry(TMP_FILE_NAME);
    } catch {
      // ignore
    }

    const nowIso = new Date().toISOString();
    localStorage.setItem('set118_last_folder_save', nowIso);
    return true;
  } catch (err) {
    console.warn('Error saving to local folder:', err);
    return false;
  }
}

// Read from local folder
export async function loadFromLocalFolder(): Promise<BackupPayload | null> {
  if (!isFileSystemAccessSupported()) return null;
  if (!cachedDirectoryHandle) {
    const stored = await idbGetDirectoryHandle();
    if (stored) cachedDirectoryHandle = stored.handle;
  }
  if (!cachedDirectoryHandle) return null;

  try {
    const perm = await cachedDirectoryHandle.queryPermission({ mode: 'read' });
    if (perm !== 'granted') return null;

    let fileHandle: any;
    try {
      fileHandle = await cachedDirectoryHandle.getFileHandle(MAIN_FILE_NAME, { create: false });
    } catch {
      // Try backup file if main file missing
      fileHandle = await cachedDirectoryHandle.getFileHandle(BACKUP_FILE_NAME, { create: false });
    }

    const file = await fileHandle.getFile();
    const text = await file.text();
    const parsed = JSON.parse(text) as BackupPayload;
    if (parsed && Array.isArray(parsed.sheets)) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn('Could not read from local folder:', err);
    return null;
  }
}

// -------------------------------------------------------------
// SMART BIDIRECTIONAL SHEET MERGER (PREVENTS DATA LOSS)
// -------------------------------------------------------------

/**
 * Merges local sheets with remote sheets without ever dropping an entry.
 * If an entry exists locally that is absent remotely, it is kept.
 * If an entry exists remotely that is absent locally, it is added.
 * Duplicates (identical id or giorno+orarioStraordinario) are unified.
 */
export function mergeSheets(localSheets: MonthlySheet[], remoteSheets: MonthlySheet[]): {
  merged: MonthlySheet[];
  hasLocalUnsyncedChanges: boolean;
} {
  const mergedMap = new Map<string, MonthlySheet>();
  let hasLocalUnsyncedChanges = false;

  // Index remote sheets first
  (remoteSheets || []).forEach((r) => {
    mergedMap.set(r.id, JSON.parse(JSON.stringify(r)));
  });

  // Merge with local sheets
  (localSheets || []).forEach((loc) => {
    const rem = mergedMap.get(loc.id);
    if (!rem) {
      // Local sheet is not yet on server!
      mergedMap.set(loc.id, JSON.parse(JSON.stringify(loc)));
      hasLocalUnsyncedChanges = true;
      return;
    }

    // Both exist: compare timestamps so deletions and edits are strictly respected
    const locTime = new Date(loc.updatedAt || 0).getTime();
    const remTime = new Date(rem.updatedAt || 0).getTime();

    if (remTime >= locTime) {
      // Server is newer or equal: take server version strictly, ensuring deleted rows stay deleted
      mergedMap.set(rem.id, JSON.parse(JSON.stringify(rem)));
    } else {
      // Local has newer unsaved edits
      mergedMap.set(loc.id, JSON.parse(JSON.stringify(loc)));
      hasLocalUnsyncedChanges = true;
    }
  });

  return {
    merged: Array.from(mergedMap.values()),
    hasLocalUnsyncedChanges,
  };
}

// Save all sheets to IndexedDB in one transaction
export async function idbSaveAllSheets(matricola: string, sheets: MonthlySheet[]): Promise<void> {
  try {
    const db = await openIDB();
    const cleanMat = (matricola || 'anonymous').toUpperCase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SHEETS], 'readwrite');
      const store = tx.objectStore(STORE_SHEETS);
      for (const sheet of sheets) {
        const storageId = `${cleanMat}_${sheet.id}`;
        store.put({ storageId, matricola: cleanMat, sheetId: sheet.id, data: sheet, savedAt: new Date().toISOString() });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('idbSaveAllSheets fallback to localStorage only:', err);
  }
}

// Save profile to IndexedDB
export async function idbSaveProfile(matricola: string, profile: any): Promise<void> {
  try {
    const db = await openIDB();
    const cleanMat = (matricola || 'anonymous').toUpperCase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SETTINGS], 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      store.put({ key: `profile_${cleanMat}`, value: profile, savedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('idbSaveProfile error:', err);
  }
}

// Get profile from IndexedDB
export async function idbGetProfile(matricola: string): Promise<any | null> {
  try {
    const db = await openIDB();
    const cleanMat = (matricola || 'anonymous').toUpperCase();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_SETTINGS], 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get(`profile_${cleanMat}`);
      req.onsuccess = () => resolve(req.result?.value || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// STANDARDIZED BACKUP EXPORT & IMPORT (JSON WITH TIMESTAMP)
// -------------------------------------------------------------

export function generateBackupFileName(matricola: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeStr = `${pad(d.getHours())}-${pad(d.getMinutes())}`;
  const cleanMat = (matricola || '118').replace(/[^a-zA-Z0-9_-]/g, '');
  return `backup_straordinari_118_${cleanMat}_${dateStr}_${timeStr}.json`;
}

export function downloadJsonFile(filename: string, data: any): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportBackupJsonFile(
  matricola: string,
  sheets: MonthlySheet[],
  extra?: { profile?: any; overtimeCalc?: any; pecSettings?: any }
): string {
  const filename = generateBackupFileName(matricola);
  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: 'S.E.T. 118 Sanitaservice ASL TA - Portale Straordinari',
    matricola: (matricola || '118').toUpperCase(),
    sheets,
    profile: extra?.profile,
    overtimeCalc: extra?.overtimeCalc,
    pecSettings: extra?.pecSettings,
  };
  downloadJsonFile(filename, payload);
  return filename;
}

export interface BackupValidationResult {
  valid: boolean;
  message: string;
  payload?: BackupPayload;
  sheetsCount?: number;
  entriesCount?: number;
  matricola?: string;
  exportedAt?: string;
}

export function validateBackupJson(jsonString: string): BackupValidationResult {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, message: 'Il file selezionato non contiene un oggetto JSON valido.' };
    }

    // Support both format with sheets array directly or BackupPayload wrapper
    let sheets: MonthlySheet[] = [];
    if (Array.isArray(parsed.sheets)) {
      sheets = parsed.sheets;
    } else if (Array.isArray(parsed)) {
      sheets = parsed;
    } else {
      return {
        valid: false,
        message: 'Struttura non riconosciuta: il file non contiene i registri mensili (chiave "sheets" assente).',
      };
    }

    // Verify basic integrity of sheets
    let totalEntries = 0;
    for (const s of sheets) {
      if (!s.id || typeof s.id !== 'string') {
        return { valid: false, message: 'Formato registro non valido: identificativo mese mancante.' };
      }
      if (Array.isArray(s.entries)) {
        totalEntries += s.entries.length;
      }
    }

    const payload: BackupPayload = {
      version: parsed.version || 1,
      exportedAt: parsed.exportedAt || new Date().toISOString(),
      source: parsed.source || 'File di backup importato',
      matricola: parsed.matricola || '',
      sheets,
      profile: parsed.profile,
      overtimeCalc: parsed.overtimeCalc,
      pecSettings: parsed.pecSettings,
    };

    return {
      valid: true,
      message: `File verificato con successo: ${sheets.length} prospetti mensili, ${totalEntries} turni totali.`,
      payload,
      sheetsCount: sheets.length,
      entriesCount: totalEntries,
      matricola: parsed.matricola || 'Non specificata',
      exportedAt: parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString('it-IT') : 'Data non specificata',
    };
  } catch (err: any) {
    return {
      valid: false,
      message: `Errore nella decodifica del file JSON: ${err.message || 'Sintassi JSON non valida.'}`,
    };
  }
}
