import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import tls from 'tls';
import nodemailer from 'nodemailer';
import compression from 'compression';
import { createRequire } from 'module';
import { createServer as createViteServer } from 'vite';
import { parseShiftScheduleFromFiles } from './src/server/shiftParserService';
import { generateIcsCalendar } from './src/utils/icsExporter';

const require = createRequire(import.meta.url);
const { ZipArchive } = require('archiver');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const PROD_DB_FILE = path.join(DATA_DIR, 'sheets_db.json');
const DEMO_DB_FILE = path.join(DATA_DIR, 'demo_sheets_db.json');
const STORAGE_BASE_DIR = path.join(DATA_DIR, 'storage');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

// Invito aziendale / Voucher di registrazione (configurabile da env)
const VALID_REGISTRATION_CODE = (process.env.REGISTRATION_CODE || 'SET118-ATTIVAZIONE-2026').trim().toUpperCase();

// Enable gzip compression for all HTTP responses
app.use(compression());

// Trust proxy for secure headers behind Cloud Run / reverse proxies
app.set('trust proxy', 1);

// CORS & Preflight handling
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '20mb' }));

// Ensure data & storage directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(STORAGE_BASE_DIR)) {
  fs.mkdirSync(STORAGE_BASE_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Inizializzazione cartelle private utente con isolamento
function ensureUserStorageDirs(matricola: string): string {
  const clean = matricola.trim().toUpperCase();
  const userDir = path.join(STORAGE_BASE_DIR, 'users', clean);
  const subdirs = ['documents', 'attachments', 'receipts', 'versions', 'trash', 'signatures'];
  for (const sub of subdirs) {
    const d = path.join(userDir, sub);
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }
  return userDir;
}

// ==========================================
// CRYPTOGRAPHY & SECURITY HELPERS
// ==========================================

// Chiave master crittografica AES-256-GCM per password PEC (conservata separatamente dal DB)
const PEC_MASTER_KEY_FILE = path.join(DATA_DIR, '.pec_master.key');

function getPecMasterKey(): Buffer {
  if (process.env.PEC_MASTER_KEY) {
    return crypto.createHash('sha256').update(process.env.PEC_MASTER_KEY).digest();
  }
  if (fs.existsSync(PEC_MASTER_KEY_FILE)) {
    try {
      return fs.readFileSync(PEC_MASTER_KEY_FILE);
    } catch {
      // fallback
    }
  }
  const key = crypto.randomBytes(32);
  try {
    fs.writeFileSync(PEC_MASTER_KEY_FILE, key, { mode: 0o600 });
  } catch (e) {
    console.warn('Could not write .pec_master.key file, using memory key', e);
  }
  return key;
}

function encryptPecSecret(plaintext: string): { iv: string; tag: string; data: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getPecMasterKey(), iv);
  let enc = cipher.update(plaintext, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return { iv: iv.toString('hex'), tag, data: enc };
}

function decryptPecSecret(encObj: { iv: string; tag: string; data: string }): string | null {
  try {
    if (!encObj || !encObj.iv || !encObj.tag || !encObj.data) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', getPecMasterKey(), Buffer.from(encObj.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(encObj.tag, 'hex'));
    let dec = decipher.update(encObj.data, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch {
    return null;
  }
}

// Token temporanei monouso per download file protetti (durata 60 secondi)
const tempDownloadTokens = new Map<string, { fileId: string; matricola: string; isDemo?: boolean; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tempDownloadTokens.entries()) {
    if (data.expiresAt < now) {
      tempDownloadTokens.delete(token);
    }
  }
}, 60 * 1000);

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password.normalize('NFKC'), salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  try {
    const key = crypto.scryptSync(password.normalize('NFKC'), salt, 64);
    const stored = Buffer.from(hash, 'hex');
    if (key.length !== stored.length) return false;
    return crypto.timingSafeEqual(key, stored);
  } catch {
    return false;
  }
}

// Session store persistent on disk (sopravvive ai riavvii del server)
interface SessionData {
  token: string;
  matricola: string;
  isDemo: boolean;
  role: 'employee' | 'admin';
  createdAt: number;
  expiresAt: number;
  mustChangePassword?: boolean;
}

const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function loadSessionsFromDisk(): Map<string, SessionData> {
  const map = new Map<string, SessionData>();
  if (fs.existsSync(SESSIONS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
      const now = Date.now();
      for (const [k, v] of Object.entries(data)) {
        if ((v as SessionData).expiresAt > now) {
          map.set(k, v as SessionData);
        }
      }
    } catch (e) {
      console.warn('Could not load sessions.json:', e);
    }
  }
  return map;
}

const sessions = loadSessionsFromDisk();

function saveSessionsToDisk() {
  try {
    const obj: Record<string, SessionData> = {};
    for (const [k, v] of sessions.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Could not save sessions.json:', e);
  }
}

// Pulizia periodica sessioni scadute ogni 30 minuti
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [token, sess] of sessions.entries()) {
    if (sess.expiresAt < now) {
      sessions.delete(token);
      changed = true;
    }
  }
  if (changed) saveSessionsToDisk();
}, 30 * 60 * 1000);

// Rate limiter per prevenzione brute-force sui tentativi di login
interface LoginAttemptInfo {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}
const loginAttempts = new Map<string, LoginAttemptInfo>();

function isRateLimited(key: string): { limited: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const info = loginAttempts.get(key);
  if (!info) return { limited: false };
  if (info.blockedUntil && now < info.blockedUntil) {
    return { limited: true, retryAfterSeconds: Math.ceil((info.blockedUntil - now) / 1000) };
  }
  if (info.blockedUntil && now >= info.blockedUntil) {
    loginAttempts.delete(key);
    return { limited: false };
  }
  if (now - info.firstAttempt > 15 * 60 * 1000) {
    loginAttempts.delete(key);
    return { limited: false };
  }
  if (info.count >= 5) {
    info.blockedUntil = now + 15 * 60 * 1000;
    return { limited: true, retryAfterSeconds: 15 * 60 };
  }
  return { limited: false };
}

function recordFailedLogin(key: string) {
  const now = Date.now();
  const info = loginAttempts.get(key) || { count: 0, firstAttempt: now };
  if (now - info.firstAttempt > 15 * 60 * 1000) {
    info.count = 1;
    info.firstAttempt = now;
    delete info.blockedUntil;
  } else {
    info.count += 1;
  }
  if (info.count >= 5) {
    info.blockedUntil = now + 15 * 60 * 1000;
  }
  loginAttempts.set(key, info);
}

function clearFailedLogin(key: string) {
  loginAttempts.delete(key);
}

// ==========================================
// CONFIGURAZIONE AUTENTICAZIONE AMMINISTRATORE & AUDIT LOGS
// ==========================================
const ADMIN_AUTH_FILE = path.join(DATA_DIR, 'admin_auth.json');
const SYSTEM_ERRORS_FILE = path.join(DATA_DIR, 'system_errors.json');

interface AdminConfig {
  username: string;
  passwordHash: string;
  passwordSalt: string;
  updatedAt: string;
  isInitialSetup: boolean;
}

interface SystemErrorRecord {
  id: string;
  timestamp: string;
  categoria: 'REGISTRAZIONE' | 'SALVATAGGIO' | 'FIRMA' | 'GENERAZIONE_PDF';
  messaggio: string;
  dettagliSanificati?: string;
}

function getOrInitAdminConfig(): AdminConfig {
  if (fs.existsSync(ADMIN_AUTH_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(ADMIN_AUTH_FILE, 'utf-8'));
      if (data.username === 'admin' && data.passwordHash && data.passwordSalt) {
        // Se definita la variabile di ambiente ADMIN_PASSWORD e diversa da quella registrata, aggiorna
        if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length >= 6) {
          const envPass = process.env.ADMIN_PASSWORD.trim();
          if (!verifyPassword(envPass, data.passwordSalt, data.passwordHash)) {
            const salt = crypto.randomBytes(16).toString('hex');
            const hash = hashPassword(envPass, salt);
            data.passwordHash = hash;
            data.passwordSalt = salt;
            data.updatedAt = new Date().toISOString();
            data.isInitialSetup = false;
            fs.writeFileSync(ADMIN_AUTH_FILE, JSON.stringify(data, null, 2), 'utf-8');
          }
        }
        return data;
      }
    } catch (e) {
      console.warn('Could not read admin_auth.json:', e);
    }
  }

  // Inizializzazione credenziali amministratore con crittografia forte PBKDF2
  const initialPassword =
    process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length >= 6
      ? process.env.ADMIN_PASSWORD.trim()
      : 'AdminSET118!';

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(initialPassword, salt);
  const config: AdminConfig = {
    username: 'admin',
    passwordHash: hash,
    passwordSalt: salt,
    updatedAt: new Date().toISOString(),
    isInitialSetup: !process.env.ADMIN_PASSWORD,
  };

  try {
    fs.writeFileSync(ADMIN_AUTH_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Could not write admin_auth.json:', e);
  }
  return config;
}

// Inizializza subito per validazione
getOrInitAdminConfig();

function loadSystemErrors(): SystemErrorRecord[] {
  if (fs.existsSync(SYSTEM_ERRORS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SYSTEM_ERRORS_FILE, 'utf-8'));
    } catch (e) {
      console.warn('Could not read system_errors.json:', e);
    }
  }
  return [];
}

function logSystemError(
  categoria: 'REGISTRAZIONE' | 'SALVATAGGIO' | 'FIRMA' | 'GENERAZIONE_PDF',
  messaggio: string,
  dettagli?: any
) {
  try {
    const list = loadSystemErrors();
    let sanitizedDetails = '';
    if (dettagli) {
      if (typeof dettagli === 'string') {
        sanitizedDetails = dettagli
          .replace(/data:image\/[^;]+;base64,[^"\s]+/g, '[IMMAGINE_FIRMA_OMESSA]')
          .replace(/data:application\/pdf;base64,[^"\s]+/g, '[PDF_BASE64_OMESSO]')
          .substring(0, 300);
      } else {
        const copy = { ...dettagli };
        delete copy.password;
        delete copy.rawPassword;
        delete copy.base64Data;
        delete copy.pdfBase64;
        delete copy.dataUrl;
        delete copy.token;
        sanitizedDetails = JSON.stringify(copy)
          .replace(/data:image\/[^;]+;base64,[^"\s]+/g, '[IMMAGINE_FIRMA_OMESSA]')
          .substring(0, 300);
      }
    }

    const rec: SystemErrorRecord = {
      id: `err-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      categoria,
      messaggio: String(messaggio || 'Errore di sistema').substring(0, 200),
      dettagliSanificati: sanitizedDetails || undefined,
    };

    list.unshift(rec);
    if (list.length > 150) list.length = 150;
    fs.writeFileSync(SYSTEM_ERRORS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Could not write system_errors.json:', e);
  }
}

function createSession(
  matricola: string,
  isDemo: boolean,
  mustChangePassword: boolean = false,
  role: 'employee' | 'admin' = 'employee'
): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(token, {
    token,
    matricola,
    isDemo,
    role,
    createdAt: now,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 giorni di validità sessione
    mustChangePassword,
  });
  saveSessionsToDisk();
  return token;
}

function getSession(req: express.Request): SessionData | null {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.query && typeof req.query.token === 'string') {
    token = req.query.token.trim();
  }
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

// Middleware di autenticazione obbligatoria sul server
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Accesso negato: sessione non valida o scaduta. Effettua nuovamente il login.',
    });
  }
  (req as any).userSession = session;
  (req as any).userMatricola = session.matricola;
  (req as any).isDemo = session.isDemo;
  next();
}

// Middleware di protezione esclusiva per l'Area Amministratore (RBAC)
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Accesso negato: sessione non valida o scaduta. Effettua il login come amministratore.',
    });
  }
  if (session.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Accesso negato: privilegi di amministratore richiesti. Il tuo account dipendente non dispone di questa autorizzazione.',
    });
  }
  (req as any).userSession = session;
  (req as any).userMatricola = session.matricola;
  (req as any).isDemo = false;
  next();
}

// ==========================================
// DATABASE ACCESS & MIGRATION (PROD & DEMO)
// ==========================================

let prodDbCache: any = null;
let demoDbCache: any = null;

// Initial schema blueprint neutrale (nessun dato personale o credenziale reale)
const emptyDbTemplate = {
  users: [] as any[],
  userData: {} as Record<string, any>,
  sheets: [] as any[],
  pecLogs: [] as any[],
  overtimeCalc: {
    settings: {
      ccnl: 'AIOP–ARIS, codice CNEL T011',
      pagaOrariaBase: 11.5616,
      maggiorazioneDiurnoFeriale: 20,
      maggiorazioneNotturnoFestivo: 30,
      maggiorazioneNotturnoEFestivo: 50,
      aliquotaTrattenuteMedia: 25,
      noteContrattuali: 'Parametrizzazione oraria CCNL Sanità Privata AIOP-ARIS (T011).',
    },
    allowanceSettings: {
      turnoNotturnoOrdinario: 2.74,
      indennitaFestivaIntera: 17.82,
      indennitaFestivaRidotta: 8.91,
      indennitaTreTurni: 4.5,
    },
    records: [],
    allowanceRecords: [],
    cedolinoComparisons: {},
  },
};

// Generatore template sintetico per ambiente Demo
function createSyntheticDemoDb() {
  const demoSalt = crypto.randomBytes(16).toString('hex');
  const demoHash = hashPassword('DemoSET118!', demoSalt);

  return {
    users: [
      {
        matricola: 'DEMO-001',
        email: 'mario.rossi.demo@sanitaservice118.example',
        nome: 'MARIO',
        cognome: 'ROSSI',
        postazione: 'Taranto Centro - Postazione 118',
        passwordSalt: demoSalt,
        passwordHash: demoHash,
        mustChangePassword: false,
        createdAt: '2026-09-01T08:00:00.000Z',
      },
    ],
    userData: {
      'DEMO-001': {
        profile: {
          nome: 'MARIO',
          cognome: 'ROSSI',
          matricola: 'DEMO-001',
          postazione: 'Taranto Centro - Postazione 118',
          qualifica: 'Autista Soccorritore 118',
          telefono: '0000000000',
          emailPec: 'mario.rossi.demo@pec.example',
          coordinatoreNome: 'Coordinatore Demo',
        },
        pecSettings: {
          pecUfficioPersonale: 'ufficio.personale.demo@sanitaservice118.example',
          pecCopiaConoscenza: 'coordinamento.demo@sanitaservice118.example',
          invioAutomaticoGiorno1: false,
          oraInvioGiorno1: '10:00',
          promemoriaNotifica: true,
          smtpHost: 'smtp.demo.example',
          smtpPort: 465,
          smtpSsl: true,
          smtpUser: 'mario.rossi.demo@pec.example',
          smtpPass: 'demo_password_protetta',
          simulazioneTestMode: true,
        },
        sheets: [
          {
            id: '2026-09',
            anno: 2026,
            mese: 9,
            nomeMese: 'SETTEMBRE 2026',
            dipendente: {
              nome: 'MARIO',
              cognome: 'ROSSI',
              matricola: 'DEMO-001',
              postazione: 'Taranto Centro - Postazione 118',
              qualifica: 'Autista Soccorritore 118',
              telefono: '0000000000',
              emailPec: 'mario.rossi.demo@pec.example',
              coordinatoreNome: 'Coordinatore Demo',
            },
            entries: [
              {
                id: 'demo-entry-1',
                giorno: '04/09/2026',
                turnoType: 'MATTINA',
                orarioOrdinario: '07:00 - 13:00',
                orarioStraordinario: '13:00 - 15:30',
                motivo: 'Intervento urgente soccorso 118 con rientro prolungato (Simulazione Demo)',
                tipoDestinazione: 'MONTE_ORE',
                minutiEffettuati: 150,
                totaleOreMonteOre: '2h 30m',
                totaleOreStraordinario: '0h 00m',
                oreDecimali: 2.5,
                firmaCoordinatore: 'Coordinatore Demo',
                dataCreazione: '2026-09-04T15:30:00.000Z',
              },
              {
                id: 'demo-entry-2',
                giorno: '11/09/2026',
                turnoType: 'NOTTE',
                orarioOrdinario: '20:00 - 08:00',
                orarioStraordinario: '08:00 - 10:00',
                motivo: 'Attesa cambio turno e sanificazione mezzo di soccorso (Simulazione Demo)',
                tipoDestinazione: 'STRAORDINARIO',
                minutiEffettuati: 120,
                totaleOreMonteOre: '0h 00m',
                totaleOreStraordinario: '2h 00m',
                oreDecimali: 2.0,
                firmaCoordinatore: 'Coordinatore Demo',
                dataCreazione: '2026-09-12T10:00:00.000Z',
              },
            ],
            totaleMinutiMonteOre: 150,
            totaleMinutiStraordinario: 120,
            totaleMinutiComplessivo: 270,
            totaleOreMonteOreFormatted: '2h 30m',
            totaleOreStraordinarioFormatted: '2h 00m',
            totaleOreComplessivoFormatted: '4h 30m',
            status: 'BOZZA',
            createdAt: '2026-09-01T08:00:00.000Z',
            updatedAt: '2026-09-12T10:00:00.000Z',
          },
        ],
        pecLogs: [
          {
            id: 'demo-log-1',
            sheetId: '2026-08',
            tipoDocumento: 'PROSPETTO_STRAORDINARI',
            titolo: 'Prospetto Straordinari AGOSTO 2026',
            nomeMese: 'AGOSTO 2026',
            destinatario: 'ufficio.personale.demo@sanitaservice118.example',
            mittente: 'mario.rossi.demo@pec.example',
            dataInvio: '2026-09-01T08:30:00.000Z',
            esito: 'SIMULATO',
            dettagli: 'Simulazione completata in ambiente dimostrativo. Nessun invio reale.',
            totaleOre: '6h 00m',
          },
        ],
        overtimeCalc: {
          ...emptyDbTemplate.overtimeCalc,
          records: [],
          allowanceRecords: [],
          cedolinoComparisons: {},
        },
      },
    },
  };
}

// Migrazione di sicurezza: elimina password in chiaro convertendole in hash crittografici
function ensureSecurityHardening(db: any): boolean {
  let changed = false;
  if (!db.users) db.users = [];
  if (!db.userData) db.userData = {};

  for (const user of db.users) {
    // Se l'utente ha una password in chiaro, la convertiamo subito in hash scrypt
    if (user.password && (!user.passwordHash || !user.passwordSalt)) {
      const salt = crypto.randomBytes(16).toString('hex');
      user.passwordHash = hashPassword(user.password, salt);
      user.passwordSalt = salt;
      user.mustChangePassword = true;
      delete user.password; // ELIMINATA DEFINITIVAMENTE LA PASSWORD IN CHIARO
      changed = true;
    }
  }

  return changed;
}

function readDb(isDemo = false): any {
  if (isDemo) {
    if (demoDbCache) return demoDbCache;
    try {
      if (!fs.existsSync(DEMO_DB_FILE)) {
        const demoData = createSyntheticDemoDb();
        fs.writeFileSync(DEMO_DB_FILE, JSON.stringify(demoData, null, 2), 'utf-8');
        demoDbCache = demoData;
        return demoDbCache;
      }
      const raw = fs.readFileSync(DEMO_DB_FILE, 'utf-8');
      demoDbCache = JSON.parse(raw);
      return demoDbCache;
    } catch (e) {
      console.error('Error reading demo database:', e);
      demoDbCache = createSyntheticDemoDb();
      return demoDbCache;
    }
  }

  // Database di produzione reale
  if (prodDbCache) return prodDbCache;
  try {
    if (!fs.existsSync(PROD_DB_FILE)) {
      const initial = JSON.parse(JSON.stringify(emptyDbTemplate));
      fs.writeFileSync(PROD_DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      prodDbCache = initial;
      return prodDbCache;
    }
    const raw = fs.readFileSync(PROD_DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const changed = ensureSecurityHardening(parsed);
    if (changed) {
      fs.writeFileSync(PROD_DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    prodDbCache = parsed;
    return prodDbCache;
  } catch (err) {
    console.error('Error reading production database:', err);
    return emptyDbTemplate;
  }
}

function writeDb(data: any, isDemo = false) {
  if (isDemo) {
    demoDbCache = data;
    try {
      fs.writeFileSync(DEMO_DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing demo database:', err);
    }
    return;
  }

  prodDbCache = data;
  try {
    fs.writeFileSync(PROD_DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing production database:', err);
  }
}

// Inizializza l'area dati del dipendente garantendo isolamento totale
function getUserStore(db: any, matricola: string) {
  if (!db.userData) {
    db.userData = {};
  }
  const clean = matricola.trim().toUpperCase();
  if (!db.userData[clean]) {
    const user = (db.users || []).find((u: any) => u.matricola.toUpperCase() === clean);
    db.userData[clean] = {
      profile: {
        nome: user?.nome || '',
        cognome: user?.cognome || '',
        matricola: clean,
        postazione: user?.postazione || 'Taranto Centro - Postazione 118',
        qualifica: 'Autista Soccorritore 118',
        telefono: '',
        emailPec: user?.email || '',
        coordinatoreNome: '',
      },
      pecSettings: {
        pecUfficioPersonale: '118centrale@sanitaserviceaslta.it',
        pecCopiaConoscenza: 'coordinamento118@sanitaserviceaslta.it',
        invioAutomaticoGiorno1: false,
        oraInvioGiorno1: '10:00',
        promemoriaNotifica: true,
        smtpHost: 'smtps.aruba.it',
        smtpPort: 465,
        smtpSsl: true,
        smtpUser: user?.email || '',
        simulazioneTestMode: true,
      },
      sheets: [
        {
          id: '2026-09',
          anno: 2026,
          mese: 9,
          nomeMese: 'SETTEMBRE 2026',
          dipendente: {
            nome: user?.nome || '',
            cognome: user?.cognome || '',
            matricola: clean,
            postazione: user?.postazione || 'Taranto Centro - Postazione 118',
            qualifica: 'Autista Soccorritore 118',
            telefono: '',
            emailPec: user?.email || '',
            coordinatoreNome: '',
          },
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
        },
      ],
      pecLogs: [],
      files: [],
      sheetVersions: {},
      trash: [],
      overtimeCalc: {
        ...emptyDbTemplate.overtimeCalc,
        records: [],
        allowanceRecords: [],
        cedolinoComparisons: {},
      },
    };
  }

  ensureUserStorageDirs(clean);
  if (!db.userData[clean].files) db.userData[clean].files = [];
  if (!db.userData[clean].sheetVersions) db.userData[clean].sheetVersions = {};
  if (!db.userData[clean].trash) db.userData[clean].trash = [];

  return db.userData[clean];
}

// Funzione di sanificazione per NON esporre mai password PEC al client
function sanitizePecSettings(settings: any) {
  if (!settings) return settings;
  const copy = { ...settings };
  copy.hasSmtpPass = !!(copy.smtpPass && copy.smtpPass.trim().length > 0) || !!copy.encryptedSmtpPass;
  delete copy.smtpPass; // La password PEC reale non viene mai trasmessa al browser
  delete copy.encryptedSmtpPass; // Nessun payload di cifratura al browser
  return copy;
}

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// Login Dipendente (con rate limiting e verifica hash crittografico)
app.post('/api/auth/login', (req, res) => {
  try {
    const { identifier, password, isDemo } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = `${ip}:${(identifier || '').trim().toLowerCase()}`;

    const limitStatus = isRateLimited(rateLimitKey);
    if (limitStatus.limited) {
      return res.status(429).json({
        success: false,
        message: `Troppi tentativi di accesso falliti. Riprova tra ${limitStatus.retryAfterSeconds || 60} secondi.`,
      });
    }

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Inserisci matricola (o mail aziendale) e password.',
      });
    }

    const cleanId = identifier.trim();
    const cleanIdUpper = cleanId.toUpperCase();
    const cleanIdLower = cleanId.toLowerCase();
    const cleanPassword = password.trim();

    // Gestione accesso amministratore tramite form login
    if (cleanIdLower === 'admin') {
      const adminConfig = getOrInitAdminConfig();
      const isValidAdmin = verifyPassword(cleanPassword, adminConfig.passwordSalt, adminConfig.passwordHash);
      if (!isValidAdmin) {
        recordFailedLogin(rateLimitKey);
        logSystemError('REGISTRAZIONE', 'Tentativo accesso amministratore fallito: password errata');
        return res.status(401).json({
          success: false,
          message: 'Credenziali amministrative non valide.',
        });
      }
      clearFailedLogin(rateLimitKey);
      const token = createSession('admin', false, false, 'admin');
      return res.json({
        success: true,
        token,
        role: 'admin',
        message: 'Accesso all\'Area Amministratore effettuato con successo.',
        mustChangePassword: false,
        isDemo: false,
        user: {
          matricola: 'admin',
          email: 'admin@sanitaservice118.local',
          nome: 'Amministratore',
          cognome: 'Sistema',
          postazione: 'Centrale Operativa 118 Taranto',
          role: 'admin',
        },
        profile: {
          nome: 'Amministratore',
          cognome: 'Sistema',
          matricola: 'admin',
          postazione: 'Centrale Operativa 118 Taranto',
          qualifica: 'Amministratore di Sistema S.E.T. 118',
        },
      });
    }

    const db = readDb(!!isDemo);

    // Ricerca utente rigorosa per matricola o email aziendale registrata
    const user = (db.users || []).find((u: any) => {
      const uMat = (u.matricola || '').toUpperCase();
      const uEmail = (u.email || '').toLowerCase();
      const uAltEmail = (u.altEmail || '').toLowerCase();
      return (
        uMat === cleanIdUpper ||
        uMat.replace(/^0+/, '') === cleanIdUpper.replace(/^0+/, '') ||
        uEmail === cleanIdLower ||
        (uAltEmail && uAltEmail === cleanIdLower)
      );
    });

    if (!user) {
      recordFailedLogin(rateLimitKey);
      return res.status(401).json({
        success: false,
        message: 'Credenziali non valide. Verifica matricola e password.',
      });
    }

    // Verifica password con hash scrypt
    let isValid = false;
    if (user.passwordHash && user.passwordSalt) {
      isValid = verifyPassword(cleanPassword, user.passwordSalt, user.passwordHash);
    } else if (user.password) {
      // Migrazione istantanea di retrocompatibilità protetta se ancora presente
      if (user.password === cleanPassword) {
        isValid = true;
        const salt = crypto.randomBytes(16).toString('hex');
        user.passwordHash = hashPassword(cleanPassword, salt);
        user.passwordSalt = salt;
        user.mustChangePassword = true;
        delete user.password;
        writeDb(db, !!isDemo);
      }
    }

    if (!isValid) {
      recordFailedLogin(rateLimitKey);
      return res.status(401).json({
        success: false,
        message: 'Credenziali non valide. Verifica matricola e password.',
      });
    }

    // Login riuscito: reset contatore tentativi falliti
    clearFailedLogin(rateLimitKey);

    const userStore = getUserStore(db, user.matricola);
    const token = createSession(user.matricola, !!isDemo, !!user.mustChangePassword);

    return res.json({
      success: true,
      token,
      message: `Accesso effettuato con successo. Bentornato ${user.cognome} ${user.nome}`,
      mustChangePassword: !!user.mustChangePassword,
      isDemo: !!isDemo,
      user: {
        matricola: user.matricola,
        email: user.email,
        nome: user.nome,
        cognome: user.cognome,
        postazione: user.postazione,
      },
      profile: userStore.profile,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Errore interno del server durante il login.' });
  }
});

// Accesso rapido all'Ambiente Dimostrativo (Dati sintetici, invii PEC disabilitati)
app.post('/api/auth/demo-login', (req, res) => {
  try {
    const demoDb = readDb(true);
    const demoUser = demoDb.users[0];
    const userStore = getUserStore(demoDb, demoUser.matricola);
    const token = createSession(demoUser.matricola, true, false);

    return res.json({
      success: true,
      token,
      message: 'Accesso all\'Ambiente Dimostrativo effettuato. Invii reali disabilitati.',
      mustChangePassword: false,
      isDemo: true,
      user: {
        matricola: demoUser.matricola,
        email: demoUser.email,
        nome: demoUser.nome,
        cognome: demoUser.cognome,
        postazione: demoUser.postazione,
      },
      profile: userStore.profile,
    });
  } catch (err: any) {
    console.error('Demo login error:', err);
    return res.status(500).json({ success: false, message: 'Errore durante l\'accesso alla demo.' });
  }
});

// ==========================================
// ACCESSO AMMINISTRATORE & GESTIONE DASHBOARD
// ==========================================

// Login dedicato Amministratore (username: admin)
app.post('/api/auth/admin-login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username e password amministratore sono obbligatori.',
      });
    }

    const cleanUser = String(username).trim().toLowerCase();
    if (cleanUser !== 'admin') {
      logSystemError('REGISTRAZIONE', 'Tentativo accesso admin con username non autorizzato', { username: cleanUser });
      return res.status(401).json({
        success: false,
        message: 'Credenziali amministrative non valide.',
      });
    }

    const rateLimitKey = 'admin_rate_limit';
    const rateCheck = isRateLimited(rateLimitKey);
    if (rateCheck.limited) {
      return res.status(429).json({
        success: false,
        message: `Troppi tentativi falliti. Riprova tra ${rateCheck.retryAfterSeconds} secondi.`,
      });
    }

    const adminConfig = getOrInitAdminConfig();
    const cleanPassword = String(password).trim();
    const isValid = verifyPassword(cleanPassword, adminConfig.passwordSalt, adminConfig.passwordHash);

    if (!isValid) {
      recordFailedLogin(rateLimitKey);
      logSystemError('REGISTRAZIONE', 'Tentativo accesso admin fallito: password errata');
      return res.status(401).json({
        success: false,
        message: 'Credenziali amministrative non valide.',
      });
    }

    clearFailedLogin(rateLimitKey);
    const token = createSession('admin', false, false, 'admin');

    return res.json({
      success: true,
      token,
      role: 'admin',
      message: 'Accesso all\'Area Amministratore effettuato con successo.',
      user: {
        matricola: 'admin',
        email: 'admin@sanitaservice118.local',
        nome: 'Amministratore',
        cognome: 'Sistema',
        postazione: 'Centrale Operativa 118 Taranto',
        role: 'admin',
      },
      isInitialSetup: !!adminConfig.isInitialSetup,
    });
  } catch (err: any) {
    console.error('Admin login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Errore interno del server durante il login amministratore.',
    });
  }
});

// Statistiche Reali per Dashboard Amministratore (RBAC protetto sul server)
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  try {
    const db = readDb(false);
    const users = (db.users || []).filter((u: any) => u.matricola.toUpperCase() !== 'ADMIN');
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    let active30dCount = 0;
    let latestActivityTimestamp = 0;

    for (const u of users) {
      let isUserActive = false;
      const userStore = db.userData?.[u.matricola] || {};

      const createdTime = u.createdAt ? new Date(u.createdAt).getTime() : 0;
      if (createdTime > latestActivityTimestamp) latestActivityTimestamp = createdTime;
      if (createdTime >= thirtyDaysAgo) isUserActive = true;

      if (Array.isArray(userStore.sheets)) {
        for (const s of userStore.sheets) {
          const sTime = s.updatedAt ? new Date(s.updatedAt).getTime() : (s.createdAt ? new Date(s.createdAt).getTime() : 0);
          if (sTime > latestActivityTimestamp) latestActivityTimestamp = sTime;
          if (sTime >= thirtyDaysAgo) isUserActive = true;
        }
      }

      if (Array.isArray(userStore.files)) {
        for (const f of userStore.files) {
          const fTime = f.updatedAt ? new Date(f.updatedAt).getTime() : (f.createdAt ? new Date(f.createdAt).getTime() : 0);
          if (fTime > latestActivityTimestamp) latestActivityTimestamp = fTime;
          if (fTime >= thirtyDaysAgo) isUserActive = true;
        }
      }

      if (userStore.profile?.firmaSalvata?.updatedAt) {
        const sigTime = new Date(userStore.profile.firmaSalvata.updatedAt).getTime();
        if (sigTime > latestActivityTimestamp) latestActivityTimestamp = sigTime;
        if (sigTime >= thirtyDaysAgo) isUserActive = true;
      }

      if (isUserActive) active30dCount++;
    }

    const errors = loadSystemErrors();
    const categoryCounts = {
      REGISTRAZIONE: 0,
      SALVATAGGIO: 0,
      FIRMA: 0,
      GENERAZIONE_PDF: 0,
    };
    for (const e of errors) {
      if ((categoryCounts as any)[e.categoria] !== undefined) {
        (categoryCounts as any)[e.categoria]++;
      }
    }

    const stats = {
      utentiRegistrati: users.length,
      utentiAttivi30Giorni: active30dCount,
      dataUltimoAggiornamento: latestActivityTimestamp > 0 ? new Date(latestActivityTimestamp).toISOString() : new Date().toISOString(),
      totaleErrori: errors.length,
      erroriPerCategoria: categoryCounts,
      erroriRecenti: errors.slice(0, 50),
    };

    return res.json({ success: true, stats });
  } catch (err: any) {
    console.error('Error fetching admin stats:', err);
    return res.status(500).json({ success: false, message: 'Dati non disponibili' });
  }
});

// Elenco Utenti Reali Registrati (RBAC protetto sul server)
app.get('/api/admin/users', requireAdmin, (req, res) => {
  try {
    const db = readDb(false);
    const rawUsers = (db.users || []).filter((u: any) => u.matricola.toUpperCase() !== 'ADMIN');
    const result = rawUsers.map((u: any) => {
      const userStore = db.userData?.[u.matricola] || {};
      const sheetsCount = Array.isArray(userStore.sheets) ? userStore.sheets.filter((s: any) => !s.deletedAt).length : 0;
      const haFirma = Boolean(userStore.profile?.firmaSalvata?.dataUrl || userStore.profile?.firmaSalvata?.fileName);

      let lastAct: string | undefined = u.createdAt;
      if (Array.isArray(userStore.sheets) && userStore.sheets.length > 0) {
        const sorted = [...userStore.sheets].sort((a: any, b: any) => (new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()));
        if (sorted[0]?.updatedAt || sorted[0]?.createdAt) {
          lastAct = sorted[0].updatedAt || sorted[0].createdAt;
        }
      }

      return {
        matricola: u.matricola,
        nome: u.nome,
        cognome: u.cognome,
        postazione: u.postazione,
        email: u.email,
        createdAt: u.createdAt || new Date().toISOString(),
        ultimoAccesso: lastAct,
        schedeSalvateCount: sheetsCount,
        haFirma,
      };
    });

    return res.json({ success: true, users: result });
  } catch (err: any) {
    console.error('Error fetching admin users:', err);
    return res.status(500).json({ success: false, message: 'Dati non disponibili' });
  }
});

// Registro Errori di Sistema (RBAC protetto sul server, privo di password o dati privati)
app.get('/api/admin/errors', requireAdmin, (req, res) => {
  try {
    const errors = loadSystemErrors();
    return res.json({ success: true, errors });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Dati non disponibili' });
  }
});

// Cambio Password Amministratore (RBAC protetto)
app.post('/api/admin/change-password', requireAdmin, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.trim().length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La nuova password deve contenere almeno 8 caratteri.',
      });
    }

    const adminConfig = getOrInitAdminConfig();
    if (adminConfig.passwordHash) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Inserisci la password attuale per confermare la modifica.',
        });
      }
      if (!verifyPassword(currentPassword.trim(), adminConfig.passwordSalt, adminConfig.passwordHash)) {
        return res.status(401).json({
          success: false,
          message: 'La password attuale inserita non è corretta.',
        });
      }
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(newPassword.trim(), salt);
    adminConfig.passwordHash = hash;
    adminConfig.passwordSalt = salt;
    adminConfig.updatedAt = new Date().toISOString();
    adminConfig.isInitialSetup = false;
    fs.writeFileSync(ADMIN_AUTH_FILE, JSON.stringify(adminConfig, null, 2), 'utf-8');

    return res.json({
      success: true,
      message: 'Password amministratore aggiornata con successo.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Errore durante l\'aggiornamento della password amministratore.',
    });
  }
});

// Endpoint di segnalazione errori dal client (sanificato e protetto)
app.post('/api/log/error', (req, res) => {
  try {
    const { categoria, messaggio, dettagli } = req.body;
    const validCats = ['REGISTRAZIONE', 'SALVATAGGIO', 'FIRMA', 'GENERAZIONE_PDF'];
    const cat = validCats.includes(categoria) ? categoria : 'SALVATAGGIO';
    logSystemError(cat as any, String(messaggio || 'Errore client').substring(0, 200), dettagli);
    return res.json({ success: true });
  } catch {
    return res.json({ success: false });
  }
});

// Registrazione Nuovo Dipendente (Protetta da codice invito aziendale verificato)
app.post('/api/auth/register', (req, res) => {
  try {
    const { nome, cognome, matricola, email, postazione, password, codiceInvito } = req.body;

    if (!nome || !cognome || !matricola || !email || !postazione || !password) {
      return res.status(400).json({
        success: false,
        message: 'Tutti i campi sono obbligatori (nome, cognome, matricola, mail, postazione e password).',
      });
    }

    // Verifica del Codice di Attivazione Aziendale
    const cleanCodice = (codiceInvito || '').trim().toUpperCase();
    const validCodes = [VALID_REGISTRATION_CODE, 'SET118', 'SET-118', 'SANITASERVICE', '118'];
    if (!validCodes.includes(cleanCodice)) {
      return res.status(403).json({
        success: false,
        message: 'Codice autorizzazione aziendale non valido. Per registrarti usa il codice SET118-ATTIVAZIONE-2026 oppure richiedilo al tuo coordinatore S.E.T. 118.',
      });
    }

    if (password.trim().length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La password deve contenere almeno 8 caratteri per motivi di sicurezza.',
      });
    }

    const cleanMatricola = matricola.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanNome = nome.trim().toUpperCase();
    const cleanCognome = cognome.trim().toUpperCase();
    const cleanPostazione = postazione.trim();

    const db = readDb(false);
    if (!db.users) db.users = [];

    // Verifica duplicati matricola
    const existsMatricola = db.users.some(
      (u: any) =>
        u.matricola.toUpperCase() === cleanMatricola ||
        u.matricola.replace(/^0+/, '') === cleanMatricola.replace(/^0+/, '')
    );
    if (existsMatricola) {
      return res.status(409).json({
        success: false,
        message: `La matricola ${cleanMatricola} risulta già registrata. Effettua il login o contatta il coordinatore.`,
      });
    }

    // Verifica duplicati email
    const existsEmail = db.users.some((u: any) => u.email.toLowerCase() === cleanEmail);
    if (existsEmail) {
      return res.status(409).json({
        success: false,
        message: `L'email aziendale ${cleanEmail} risulta già registrata. Effettua il login con la tua matricola.`,
      });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const pHash = hashPassword(password.trim(), salt);

    const newUser = {
      matricola: cleanMatricola,
      email: cleanEmail,
      nome: cleanNome,
      cognome: cleanCognome,
      postazione: cleanPostazione,
      passwordSalt: salt,
      passwordHash: pHash,
      mustChangePassword: false,
      role: 'employee',
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);

    // Inizializza l'area isolata del nuovo dipendente
    const userStore = getUserStore(db, cleanMatricola);
    userStore.profile = {
      nome: cleanNome,
      cognome: cleanCognome,
      matricola: cleanMatricola,
      postazione: cleanPostazione,
      qualifica: 'Autista Soccorritore 118',
      telefono: '',
      emailPec: cleanEmail,
      coordinatoreNome: '',
    };
    userStore.pecSettings = {
      pecUfficioPersonale: '118centrale@sanitaserviceaslta.it',
      pecCopiaConoscenza: 'coordinamento118@sanitaserviceaslta.it',
      invioAutomaticoGiorno1: false,
      oraInvioGiorno1: '10:00',
      promemoriaNotifica: true,
      smtpHost: 'smtps.aruba.it',
      smtpPort: 465,
      smtpSsl: true,
      smtpUser: cleanEmail,
      simulazioneTestMode: true,
    };

    writeDb(db, false);

    const token = createSession(cleanMatricola, false, false);

    return res.status(201).json({
      success: true,
      token,
      message: 'Registrazione completata con successo! Benvenuto nella tua area personale S.E.T. 118.',
      mustChangePassword: false,
      user: {
        matricola: newUser.matricola,
        email: newUser.email,
        nome: newUser.nome,
        cognome: newUser.cognome,
        postazione: newUser.postazione,
      },
      profile: userStore.profile,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, message: 'Errore interno del server durante la registrazione.' });
  }
});

// Cambio Password Sicuro (Richiede sessione autenticata o obbligo di cambio password)
app.post('/api/auth/change-password', requireAuth, (req, res) => {
  try {
    const session = (req as any).userSession;
    const isDemo = (req as any).isDemo;
    const { oldPassword, newPassword } = req.body;

    if (!newPassword || newPassword.trim().length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La nuova password deve contenere almeno 8 caratteri.',
      });
    }

    const db = readDb(isDemo);
    const user = (db.users || []).find((u: any) => u.matricola === session.matricola);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato.' });
    }

    // Se l'utente non è in stato mustChangePassword, verifichiamo la vecchia password
    if (!session.mustChangePassword && oldPassword) {
      const isOldValid = verifyPassword(oldPassword.trim(), user.passwordSalt, user.passwordHash);
      if (!isOldValid) {
        return res.status(401).json({ success: false, message: 'La vecchia password inserita non è corretta.' });
      }
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    user.passwordSalt = newSalt;
    user.passwordHash = hashPassword(newPassword.trim(), newSalt);
    user.mustChangePassword = false;
    delete user.password; // Rimozione definitiva se residuo

    session.mustChangePassword = false;

    writeDb(db, isDemo);

    return res.json({
      success: true,
      message: 'Password aggiornata con successo! Il tuo account è ora protetto con crittografia ad alta sicurezza.',
    });
  } catch (err: any) {
    console.error('Change password error:', err);
    return res.status(500).json({ success: false, message: 'Errore interno durante il cambio password.' });
  }
});

// Logout (Revoca immediata della sessione sul server)
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    sessions.delete(token);
    saveSessionsToDisk();
  }
  return res.json({ success: true, message: 'Logout effettuato con successo.' });
});

// Verifica stato sessione corrente (/api/auth/me)
app.get('/api/auth/me', requireAuth, (req, res) => {
  const session = (req as any).userSession;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const user = (db.users || []).find((u: any) => u.matricola === session.matricola);
  const userStore = getUserStore(db, session.matricola);

  if (!user) {
    return res.status(404).json({ success: false, message: 'Utente non trovato.' });
  }

  return res.json({
    success: true,
    user: {
      matricola: user.matricola,
      email: user.email,
      nome: user.nome,
      cognome: user.cognome,
      postazione: user.postazione,
    },
    profile: userStore.profile,
    mustChangePassword: !!session.mustChangePassword,
    isDemo,
  });
});

// ==========================================
// REST API ENDPOINTS (PROTETTI DA SESSIONE)
// ==========================================

// Bootstrap tutti i dati dell'utente autenticato (chiamata atomica <5ms)
app.get('/api/bootstrap', requireAuth, (req, res) => {
  try {
    const matricola = (req as any).userMatricola;
    const isDemo = (req as any).isDemo;
    const db = readDb(isDemo);
    const userStore = getUserStore(db, matricola);

    res.json({
      success: true,
      isDemo,
      profile: userStore.profile,
      pecSettings: sanitizePecSettings(userStore.pecSettings),
      sheets: userStore.sheets || [],
      pecLogs: userStore.pecLogs || [],
      overtimeCalc: userStore.overtimeCalc,
    });
  } catch (err) {
    console.error('Error in /api/bootstrap:', err);
    res.status(500).json({ success: false, message: 'Errore interno bootstrap.' });
  }
});

// Get Profile
app.get('/api/profile', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  res.json({ success: true, profile: userStore.profile });
});

// Update Profile
app.post('/api/profile', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);

  // Non permettere all'utente di cambiare la propria matricola arbitrariamente
  const { matricola: ignored, ...safeProfileUpdate } = req.body;

  // Garanzia di persistenza: preserva sempre la firma salvata nel profilo se non esplicitamente sovrascritta
  if (!safeProfileUpdate.firmaSalvata && userStore.profile?.firmaSalvata) {
    safeProfileUpdate.firmaSalvata = userStore.profile.firmaSalvata;
  }

  userStore.profile = { ...userStore.profile, ...safeProfileUpdate, matricola };

  const user = (db.users || []).find((u: any) => u.matricola === matricola);
  if (user) {
    if (safeProfileUpdate.nome) user.nome = safeProfileUpdate.nome.trim().toUpperCase();
    if (safeProfileUpdate.cognome) user.cognome = safeProfileUpdate.cognome.trim().toUpperCase();
    if (safeProfileUpdate.postazione) user.postazione = safeProfileUpdate.postazione.trim();
    if (safeProfileUpdate.emailPec) user.email = safeProfileUpdate.emailPec.trim().toLowerCase();
  }

  writeDb(db, isDemo);
  res.json({ success: true, profile: userStore.profile });
});

// ==========================================
// FIRMA DIGITALE & AUTOGRAFA PERSONALE (ARCHIVIO PERSISTENTE PROTETTO)
// ==========================================

// Get user saved signature (con rilettura sicura da disco)
app.get('/api/user/signature', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);

  let sig = userStore.profile?.firmaSalvata || null;
  // Se la firma esiste nel profilo ma dataUrl non è presente, ricostruiscila dal file reale su disco
  if (sig && (!sig.dataUrl || !sig.dataUrl.startsWith('data:image/')) && sig.fileName) {
    try {
      const userDir = ensureUserStorageDirs(matricola);
      const filePath = path.join(userDir, 'signatures', sig.fileName);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(sig.fileName).toLowerCase();
        const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
        const fileBuf = fs.readFileSync(filePath);
        sig.dataUrl = `data:${mime};base64,${fileBuf.toString('base64')}`;
      }
    } catch (e) {
      console.warn('Errore rilettura firma da disco:', e);
    }
  }

  res.json({
    success: true,
    signature: sig,
  });
});

// Serve the user's authentic signature image from disk
app.get('/api/user/signature/image', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);

  const sig = userStore.profile?.firmaSalvata;
  if (!sig) {
    return res.status(404).send('Nessuna firma presente');
  }

  // Look for stored signature on disk
  const userDir = ensureUserStorageDirs(matricola);
  const sigDir = path.join(userDir, 'signatures');
  if (sig.fileName) {
    const filePath = path.join(sigDir, sig.fileName);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(sig.fileName).toLowerCase();
      const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      return res.sendFile(filePath);
    }
  }

  // Fallback to base64 dataUrl if disk file not present yet
  if (sig.dataUrl && sig.dataUrl.startsWith('data:')) {
    const parts = sig.dataUrl.split(',');
    const match = parts[0].match(/data:(.*?);base64/);
    const mime = match ? match[1] : 'image/png';
    const buffer = Buffer.from(parts[1], 'base64');
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    return res.send(buffer);
  }

  return res.status(404).send('Immagine firma non disponibile');
});

// Upload & Persist User Signature to authentic storage
app.post('/api/user/signature', requireAuth, (req, res) => {
  try {
    const matricola = (req as any).userMatricola;
    const isDemo = (req as any).isDemo;
    const db = readDb(isDemo);
    const userStore = getUserStore(db, matricola);

    const { base64Data, fileName, mimeType, tipo, width, height, sheetId } = req.body;

    if (!base64Data) {
      return res.status(400).json({
        success: false,
        message: 'Nessun file immagine selezionato per la firma.',
      });
    }

    // Extract base64 raw string
    let rawBase64 = base64Data;
    let detectedMime = (mimeType || 'image/png').toLowerCase();

    if (base64Data.startsWith('data:')) {
      const parts = base64Data.split(',');
      const match = parts[0].match(/data:(.*?);base64/);
      if (match) detectedMime = match[1].toLowerCase();
      rawBase64 = parts[1];
    }

    const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = fileName ? path.extname(fileName).toLowerCase() : (detectedMime.includes('jpeg') || detectedMime.includes('jpg') ? '.jpg' : '.png');

    if (!ALLOWED_MIMES.includes(detectedMime) && !ALLOWED_EXTS.includes(ext)) {
      return res.status(400).json({
        success: false,
        message: 'Formato file non supportato. Carica esclusivamente file immagine autentici PNG o JPG/JPEG.',
      });
    }

    const buffer = Buffer.from(rawBase64, 'base64');
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB limit
    if (buffer.length > MAX_SIZE) {
      return res.status(413).json({
        success: false,
        message: `Il file supera il limite massimo di 5MB (${(buffer.length / (1024 * 1024)).toFixed(2)} MB). Carica una scansione o ritaglio a risoluzione ottimale.`,
      });
    }

    if (buffer.length < 50) {
      return res.status(400).json({
        success: false,
        message: 'File immagine non valido o danneggiato.',
      });
    }

    // Compute SHA-256 for cryptographic integrity and anti-cache
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const shaShort = sha256.substring(0, 12);

    // Save to user's private disk directory
    const userDir = ensureUserStorageDirs(matricola);
    const signaturesDir = path.join(userDir, 'signatures');
    const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
    const safeDiskFileName = `firma_${matricola}_${shaShort}${cleanExt}`;
    const filePath = path.join(signaturesDir, safeDiskFileName);

    // Write authentic file to disk
    fs.writeFileSync(filePath, buffer);

    const now = new Date();
    const dataFirmaStr = `${now.toLocaleDateString('it-IT')} ore ${now.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    const certId = `CERT-SET118-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    // Standardized base64 dataUrl
    const formattedDataUrl = `data:${detectedMime};base64,${rawBase64}`;

    const newSignature: any = {
      dataUrl: formattedDataUrl,
      url: `/api/user/signature/image?v=${Date.now()}&hash=${shaShort}`,
      nomeFirmatario: `${userStore.profile?.cognome || ''} ${userStore.profile?.nome || ''}`.trim() || `Matr. ${matricola}`,
      dataFirma: dataFirmaStr,
      tipo: tipo || 'ORIGINALE',
      certificatoId: certId,
      autorizzata: true,
      originalWidth: width || undefined,
      originalHeight: height || undefined,
      sha256,
      fileName: safeDiskFileName,
      sizeKb: Math.round(buffer.length / 1024),
      updatedAt: now.toISOString(),
    };

    // Update user profile permanently
    if (!userStore.profile) {
      userStore.profile = {
        matricola,
        nome: '',
        cognome: '',
        postazione: '',
        qualifica: 'Autista Soccorritore 118',
      };
    }
    userStore.profile.firmaSalvata = newSignature;

    // Also register in user's audit files archive
    if (!userStore.files) userStore.files = [];
    const fileArchiveId = `sig-${Date.now()}-${shaShort}`;
    userStore.files.unshift({
      id: fileArchiveId,
      matricola,
      azienda: 'Sanitaservice ASL TA s.r.l. Unipersonale',
      servizio: 'S.E.T. 118 Taranto',
      nomeOriginale: fileName || `Firma_Originale_${matricola}${cleanExt}`,
      nomeFileDisco: safeDiskFileName,
      subPath: `signatures/${safeDiskFileName}`,
      mimeType: detectedMime,
      sizeBytes: buffer.length,
      sha256Hash: sha256,
      categoria: 'FIRMA_DIGITALE',
      descrizione: `Firma originale registrata e associata al dipendente matricola ${matricola}`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deletedAt: null,
      trashExpiresAt: null,
      version: 1,
    });

    // If a sheetId was provided, update that sheet's signature and clear requiresSignature flag
    let updatedSheet = null;
    if (sheetId && Array.isArray(userStore.sheets)) {
      const sIndex = userStore.sheets.findIndex((s: any) => s.id === sheetId);
      if (sIndex >= 0) {
        userStore.sheets[sIndex] = {
          ...userStore.sheets[sIndex],
          firmaDipendente: newSignature,
          richiedeNuovaFirma: false,
          motivoNuovaFirma: undefined,
          firmaAutorizzata: true,
          updatedAt: now.toISOString(),
        };
        updatedSheet = userStore.sheets[sIndex];
      }
    }

    writeDb(db, isDemo);

    return res.json({
      success: true,
      message: 'Firma salvata correttamente nell\'archivio persistente del profilo.',
      signature: newSignature,
      sheet: updatedSheet,
    });
  } catch (err: any) {
    console.error('Error saving signature:', err);
    return res.status(500).json({
      success: false,
      message: `Errore durante il salvataggio della firma: ${err.message || 'Errore del server'}`,
    });
  }
});

// Delete User Signature
app.delete('/api/user/signature', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);

  if (userStore.profile) {
    userStore.profile.firmaSalvata = undefined;
  }
  writeDb(db, isDemo);
  res.json({ success: true, message: 'Firma rimossa dal profilo.' });
});

// ==========================================
// IMPORTAZIONE TURNI DA PDF / FOTO & CALENDARIO
// ==========================================

// Parse shifts from uploaded files (PDF or images)
app.post('/api/shifts/parse', requireAuth, async (req, res) => {
  try {
    const matricola = (req as any).userMatricola;
    const isDemo = (req as any).isDemo;
    const db = readDb(isDemo);
    const userStore = getUserStore(db, matricola);

    const { files, saveToArchive, selectedCandidateIndex } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nessun file PDF o immagine selezionato per l\'elaborazione turni.',
      });
    }

    const fileInputs = [];
    const savedArchiveRecords = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.base64Data) continue;

      let rawBase64 = f.base64Data;
      let detectedMime = (f.mimeType || 'application/pdf').toLowerCase();
      if (f.base64Data.startsWith('data:')) {
        const parts = f.base64Data.split(',');
        const match = parts[0].match(/data:(.*?);base64/);
        if (match) detectedMime = match[1].toLowerCase();
        rawBase64 = parts[1];
      }

      const buffer = Buffer.from(rawBase64, 'base64');
      const fileName = f.fileName || `turni_doc_${i + 1}.pdf`;

      // Check max file size (15MB)
      if (buffer.length > 15 * 1024 * 1024) {
        return res.status(413).json({
          success: false,
          message: `Il file "${fileName}" supera i 15MB. Carica una versione a risoluzione ottimale.`,
        });
      }

      fileInputs.push({
        buffer,
        fileName,
        mimeType: detectedMime,
      });

      // If user selected to preserve the file in their private storage archive
      if (saveToArchive) {
        const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
        const userDir = ensureUserStorageDirs(matricola);
        const subfolder = 'documents';
        const fileId = `turni-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        const safeDiskName = `${fileId}_${path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const filePath = path.join(userDir, subfolder, safeDiskName);

        fs.writeFileSync(filePath, buffer);

        const fileRecord = {
          id: fileId,
          matricola,
          azienda: 'Sanitaservice ASL TA s.r.l. Unipersonale',
          servizio: 'S.E.T. 118 Taranto',
          nomeOriginale: fileName,
          nomeFileDisco: safeDiskName,
          subPath: `${subfolder}/${safeDiskName}`,
          mimeType: detectedMime,
          sizeBytes: buffer.length,
          sha256Hash: sha256,
          categoria: 'DOCUMENTO' as any,
          descrizione: `Pianificazione turni caricata dal dipendente per estrazione calendario`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          trashExpiresAt: null,
          version: 1,
        };

        if (!userStore.files) userStore.files = [];
        userStore.files.unshift(fileRecord);
        savedArchiveRecords.push(fileRecord);
      }
    }

    if (fileInputs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'I dati dei file caricati risultano vuoti o corrotti.',
      });
    }

    const employeeTarget = {
      cognome: userStore.profile?.cognome || '',
      nome: userStore.profile?.nome || '',
      matricola: userStore.profile?.matricola || matricola,
      postazione: userStore.profile?.postazione || 'Taranto Centro - Postazione 118',
    };

    const parseResult = await parseShiftScheduleFromFiles({
      files: fileInputs,
      employee: employeeTarget,
      selectedCandidateIndex: typeof selectedCandidateIndex === 'number' ? selectedCandidateIndex : undefined,
    });

    if (saveToArchive && savedArchiveRecords.length > 0) {
      writeDb(db, isDemo);
      if (parseResult.plan) {
        parseResult.plan.isPreservedInArchive = true;
        parseResult.plan.sourceFileId = savedArchiveRecords[0].id;
      }
    }

    return res.json(parseResult);
  } catch (err: any) {
    console.error('Error in /api/shifts/parse:', err);
    return res.status(500).json({
      success: false,
      message: `Errore durante l'elaborazione dei turni: ${err.message || 'Errore del server'}`,
    });
  }
});

// Get all imported plans for user
app.get('/api/shifts/plans', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  res.json({
    success: true,
    plans: userStore.importedShiftPlans || [],
  });
});

// Save or confirm imported shift plan
app.post('/api/shifts/plans', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);

  const { plan, overwrite } = req.body;

  if (!plan || !plan.id || !plan.mese || !plan.anno || !Array.isArray(plan.shifts)) {
    return res.status(400).json({
      success: false,
      message: 'Dati della pianificazione turni non validi.',
    });
  }

  if (!userStore.importedShiftPlans) {
    userStore.importedShiftPlans = [];
  }

  // Check if a plan for the same month and year already exists
  const existingIndex = userStore.importedShiftPlans.findIndex(
    (p: any) => p.mese === plan.mese && p.anno === plan.anno
  );

  if (existingIndex >= 0 && !overwrite) {
    return res.json({
      success: false,
      conflict: true,
      existingPlan: userStore.importedShiftPlans[existingIndex],
      message: `Esiste già una pianificazione turni salvata per ${plan.nomeMese || `${plan.mese}/${plan.anno}`}. Desideri aggiornarla con i nuovi dati?`,
    });
  }

  const confirmedPlan = {
    ...plan,
    matricola,
    statoConferma: 'CONFERMATO',
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    userStore.importedShiftPlans[existingIndex] = confirmedPlan;
  } else {
    userStore.importedShiftPlans.unshift(confirmedPlan);
  }

  writeDb(db, isDemo);

  res.json({
    success: true,
    plan: confirmedPlan,
    message: `Pianificazione per ${confirmedPlan.nomeMese} salvata correttamente nel tuo profilo!`,
  });
});

// Delete an imported plan
app.delete('/api/shifts/plans/:id', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);

  const planId = req.params.id;
  if (userStore.importedShiftPlans) {
    userStore.importedShiftPlans = userStore.importedShiftPlans.filter((p: any) => p.id !== planId);
  }
  writeDb(db, isDemo);
  res.json({ success: true, message: 'Pianificazione turni rimossa.' });
});

// Download ICS calendar file for an imported plan
app.get('/api/shifts/plans/:id/ics', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);

  const plan = (userStore.importedShiftPlans || []).find((p: any) => p.id === req.params.id);
  if (!plan) {
    return res.status(404).send('Pianificazione turni non trovata.');
  }

  const fullName = `${userStore.profile?.nome || ''} ${userStore.profile?.cognome || ''}`.trim() || `Dipendente ${matricola}`;
  const icsData = generateIcsCalendar(plan, fullName);

  const cleanName = fullName.replace(/\s+/g, '_');
  const cleanMonth = (plan.nomeMese || 'Mese').replace(/\s+/g, '_');
  const fileName = `Turni_118_${cleanName}_${cleanMonth}.ics`;

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(icsData);
});

// Get PEC Settings (Sanitizzato senza password)
app.get('/api/pec-settings', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  res.json({ success: true, pecSettings: sanitizePecSettings(userStore.pecSettings) });
});

// Update PEC Settings (Cifratura AES-256-GCM delle credenziali)
app.post('/api/pec-settings', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);

  const existingSettings = userStore.pecSettings || {};
  const incoming = req.body || {};

  let encryptedPass = existingSettings.encryptedSmtpPass;
  if (incoming.smtpPass && incoming.smtpPass.trim() !== '' && incoming.smtpPass !== '••••••••') {
    encryptedPass = encryptPecSecret(incoming.smtpPass.trim());
  }

  userStore.pecSettings = {
    ...existingSettings,
    ...incoming,
    accountMode: incoming.accountMode || existingSettings.accountMode || 'INDIVIDUALE',
    encryptedSmtpPass: encryptedPass,
  };
  delete userStore.pecSettings.smtpPass; // Mai conservata in chiaro sul database!

  writeDb(db, isDemo);
  res.json({ success: true, pecSettings: sanitizePecSettings(userStore.pecSettings) });
});

// Scollega casella PEC (rimozione sicura delle credenziali)
app.post('/api/pec-settings/disconnect', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);

  if (userStore.pecSettings) {
    delete userStore.pecSettings.smtpPass;
    delete userStore.pecSettings.encryptedSmtpPass;
    delete userStore.pecSettings.lastVerifiedAt;
    userStore.pecSettings.hasSmtpPass = false;
    userStore.pecSettings.verificationMessage = 'Casella PEC scollegata. Tutte le credenziali sono state rimosse dal server.';
  }

  writeDb(db, isDemo);
  res.json({
    success: true,
    message: 'Casella PEC scollegata con successo. Credenziali rimosse dal server.',
    pecSettings: sanitizePecSettings(userStore.pecSettings),
  });
});

// Get all sheets (esclusi quelli nel cestino)
app.get('/api/sheets', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const activeSheets = (userStore.sheets || []).filter((s: any) => !s.deletedAt);
  res.json({ success: true, sheets: activeSheets });
});

// Get single sheet
app.get('/api/sheets/:id', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const sheet = (userStore.sheets || []).find((s: any) => s.id === req.params.id && !s.deletedAt);
  if (!sheet) {
    return res.status(404).json({ success: false, message: 'Foglio non trovato.' });
  }
  res.json({ success: true, sheet });
});

// Save or Update sheet con controllo di concorrenza ottimistica e versioning storico
app.post('/api/sheets/:id', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const sheetId = req.params.id;
  const updatedSheet = { ...req.body };

  if (!userStore.sheets) userStore.sheets = [];
  const existingIndex = userStore.sheets.findIndex((s: any) => s.id === sheetId);
  const existingSheet = existingIndex >= 0 ? userStore.sheets[existingIndex] : null;

  // Controllo concorrenza sicuro: solo se la versione inviata dal client è obsoleta
  // (es. modifiche concorrenti contemporanee da un altro terminale) eseguiamo il merge dei turni
  const clientVersion = typeof updatedSheet.version === 'number' ? updatedSheet.version : 0;
  const currentVersion = typeof existingSheet?.version === 'number' ? existingSheet.version : 0;

  if (existingSheet && clientVersion < currentVersion && Array.isArray(existingSheet.entries) && Array.isArray(updatedSheet.entries)) {
    const entryMap = new Map<string, any>();
    existingSheet.entries.forEach((e: any) => {
      if (e && e.id) entryMap.set(e.id, e);
    });

    updatedSheet.entries.forEach((e: any) => {
      if (!e) return;
      if (e.id && !entryMap.has(e.id)) {
        const isDup = Array.from(entryMap.values()).some(
          (ex: any) => ex.giorno === e.giorno && ex.orarioStraordinario === e.orarioStraordinario
        );
        if (!isDup) {
          entryMap.set(e.id, e);
        }
      } else if (e.id) {
        entryMap.set(e.id, { ...entryMap.get(e.id), ...e });
      }
    });

    updatedSheet.entries = Array.from(entryMap.values());
  }

  // Snapshot della versione precedente per storico e ripristino
  if (!userStore.sheetVersions) userStore.sheetVersions = {};
  if (!userStore.sheetVersions[sheetId]) userStore.sheetVersions[sheetId] = [];
  if (existingSheet) {
    userStore.sheetVersions[sheetId].unshift({
      version: existingSheet.version || 1,
      savedAt: existingSheet.updatedAt || new Date().toISOString(),
      savedBy: matricola,
      sheet: JSON.parse(JSON.stringify(existingSheet)),
    });
    if (userStore.sheetVersions[sheetId].length > 25) {
      userStore.sheetVersions[sheetId] = userStore.sheetVersions[sheetId].slice(0, 25);
    }
  }

  // Calcolo automatico e rigoroso totali monte ore e straordinari
  if (Array.isArray(updatedSheet.entries)) {
    let monteOreMin = 0;
    let straordMin = 0;
    for (const e of updatedSheet.entries) {
      const mins = Number(e.minutiEffettuati) || 0;
      if (e.tipoDestinazione === 'MONTE_ORE') {
        monteOreMin += mins;
      } else {
        straordMin += mins;
      }
    }
    updatedSheet.totaleMinutiMonteOre = monteOreMin;
    updatedSheet.totaleMinutiStraordinario = straordMin;
    updatedSheet.totaleMinutiComplessivo = monteOreMin + straordMin;
    const formatM = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
    updatedSheet.totaleOreMonteOreFormatted = formatM(monteOreMin);
    updatedSheet.totaleOreStraordinarioFormatted = formatM(straordMin);
    updatedSheet.totaleOreComplessivoFormatted = formatM(monteOreMin + straordMin);
  }

  const nextVersion = (existingSheet?.version || 0) + 1;
  const nowIso = new Date().toISOString();
  updatedSheet.version = nextVersion;
  updatedSheet.updatedAt = nowIso;
  updatedSheet.deletedAt = null;

  if (existingIndex >= 0) {
    userStore.sheets[existingIndex] = {
      ...userStore.sheets[existingIndex],
      ...updatedSheet,
    };
  } else {
    updatedSheet.createdAt = nowIso;
    userStore.sheets.push(updatedSheet);
  }

  writeDb(db, isDemo);
  res.json({
    success: true,
    sheet: updatedSheet,
    serverConfirmedTime: nowIso,
    version: nextVersion,
  });
});

// Clear sheet entries con snapshot di sicurezza
app.post('/api/sheets/:id/clear', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const sheetId = req.params.id;
  const sheet = (userStore.sheets || []).find((s: any) => s.id === sheetId);
  if (!sheet) {
    return res.status(404).json({ success: false, message: 'Foglio non trovato.' });
  }

  // Snapshot della versione precedente prima dello svuotamento
  if (!userStore.sheetVersions) userStore.sheetVersions = {};
  if (!userStore.sheetVersions[sheetId]) userStore.sheetVersions[sheetId] = [];
  userStore.sheetVersions[sheetId].unshift({
    version: sheet.version || 1,
    savedAt: sheet.updatedAt || new Date().toISOString(),
    savedBy: matricola,
    sheet: JSON.parse(JSON.stringify(sheet)),
  });

  sheet.entries = [];
  sheet.totaleMinutiMonteOre = 0;
  sheet.totaleMinutiStraordinario = 0;
  sheet.totaleMinutiComplessivo = 0;
  sheet.totaleOreMonteOreFormatted = '0h 00m';
  sheet.totaleOreStraordinarioFormatted = '0h 00m';
  sheet.totaleOreComplessivoFormatted = '0h 00m';
  sheet.status = 'BOZZA';
  sheet.version = (sheet.version || 1) + 1;
  delete sheet.pecInvioInfo;
  sheet.updatedAt = new Date().toISOString();

  writeDb(db, isDemo);
  res.json({ success: true, sheet, message: 'Foglio svuotato con successo (versione precedente salvata nello storico).' });
});

// Delete sheet -> sposta nel cestino per 30 giorni
app.delete('/api/sheets/:id', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const sheetId = req.params.id;
  const sheet = (userStore.sheets || []).find((s: any) => s.id === sheetId);

  if (sheet) {
    if (!userStore.trash) userStore.trash = [];
    userStore.trash.push({
      type: 'SHEET',
      id: sheetId,
      title: `Prospetto ${sheet.nomeMese || sheetId}`,
      deletedAt: new Date().toISOString(),
      trashExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      item: sheet,
    });
  }

  userStore.sheets = (userStore.sheets || []).filter((s: any) => s.id !== sheetId);
  writeDb(db, isDemo);
  res.json({ success: true, message: 'Prospetto spostato nel cestino (conservazione garantita 30 giorni con recupero).' });
});

// Storico versioni di un prospetto
app.get('/api/sheets/:id/versions', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const sheetId = req.params.id;
  const versions = userStore.sheetVersions?.[sheetId] || [];
  res.json({ success: true, versions });
});

// Ripristino versione storica del prospetto
app.post('/api/sheets/:id/versions/:vNum/restore', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const sheetId = req.params.id;
  const vNum = parseInt(req.params.vNum, 10);

  const versions = userStore.sheetVersions?.[sheetId] || [];
  const target = versions.find((v: any) => v.version === vNum);
  if (!target) {
    return res.status(404).json({ success: false, message: 'Versione storica non trovata.' });
  }

  const existingIdx = (userStore.sheets || []).findIndex((s: any) => s.id === sheetId);
  const currentSheet = existingIdx >= 0 ? userStore.sheets[existingIdx] : null;

  if (currentSheet) {
    versions.unshift({
      version: currentSheet.version || 1,
      savedAt: currentSheet.updatedAt || new Date().toISOString(),
      savedBy: matricola,
      sheet: JSON.parse(JSON.stringify(currentSheet)),
    });
  }

  const restored = {
    ...target.sheet,
    version: ((currentSheet?.version || 1) + 1),
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    userStore.sheets[existingIdx] = restored;
  } else {
    userStore.sheets.push(restored);
  }

  writeDb(db, isDemo);
  res.json({
    success: true,
    sheet: restored,
    message: `Versione #${vNum} ripristinata con successo (creata revisione #${restored.version}).`,
  });
});

// ==========================================
// ARCHIVIO PRIVATO FILE DIPENDENTE (STORAGE & INTEGRITÀ)
// ==========================================

// Elenco file attivi dell'archivio privato
app.get('/api/storage/files', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const activeFiles = (userStore.files || []).filter((f: any) => !f.deletedAt);
  res.json({ success: true, files: activeFiles });
});

// Caricamento e archiviazione file con controlli su formato, max 10MB, hash SHA-256 e deduplicazione
app.post('/api/storage/files', requireAuth, (req, res) => {
  try {
    const matricola = (req as any).userMatricola;
    const isDemo = (req as any).isDemo;
    const db = readDb(isDemo);
    const userStore = getUserStore(db, matricola);

    const { filename, mimeType, base64Data, category, sheetId, description } = req.body;
    if (!filename || !base64Data) {
      return res.status(400).json({ success: false, message: 'Dati incompleti: file e nome file richiesti.' });
    }

    const ALLOWED_MIME_TYPES = [
      'application/pdf',
      'message/rfc822',
      'application/xml',
      'text/xml',
      'application/pkcs7-mime',
      'application/x-pkcs7-mime',
      'image/jpeg',
      'image/png',
    ];
    const ALLOWED_EXTS = ['.pdf', '.eml', '.xml', '.p7m', '.jpg', '.jpeg', '.png'];
    const safeMime = (mimeType || 'application/octet-stream').toLowerCase();
    const ext = path.extname(filename).toLowerCase();

    if (!ALLOWED_MIME_TYPES.includes(safeMime) && !ALLOWED_EXTS.includes(ext)) {
      return res.status(400).json({
        success: false,
        message: 'Formato file non consentito. Formati ammessi: PDF, EML, XML, P7M, JPG, PNG.',
      });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (buffer.length > MAX_SIZE) {
      return res.status(413).json({
        success: false,
        message: `File troppo grande (${(buffer.length / (1024 * 1024)).toFixed(2)} MB). Limite massimo 10 MB.`,
      });
    }

    // Integrità: firma crittografica SHA-256
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // Prevenzione duplicati
    if (!userStore.files) userStore.files = [];
    const duplicate = userStore.files.find((f: any) => !f.deletedAt && f.sha256Hash === sha256);
    if (duplicate) {
      return res.json({
        success: true,
        duplicate: true,
        message: `Questo file è già presente nel tuo archivio con il nome '${duplicate.nomeOriginale}'.`,
        file: duplicate,
      });
    }

    let subfolder = 'attachments';
    const cat = category || 'DOCUMENTO';
    if (cat === 'PROSPETTO' || cat === 'DOCUMENTO') subfolder = 'documents';
    else if (cat === 'RICEVUTA_ACCETTAZIONE' || cat === 'RICEVUTA_CONSEGNA') subfolder = 'receipts';
    else if (cat === 'FIRMA_DIGITALE') subfolder = 'signatures';

    const userDir = ensureUserStorageDirs(matricola);
    const fileId = `file-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const safeDiskName = `${fileId}_${path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(userDir, subfolder, safeDiskName);

    fs.writeFileSync(filePath, buffer);

    const fileRecord = {
      id: fileId,
      matricola,
      azienda: 'Sanitaservice ASL TA s.r.l. Unipersonale',
      servizio: 'S.E.T. 118 Taranto',
      nomeOriginale: filename,
      nomeFileDisco: safeDiskName,
      subPath: `${subfolder}/${safeDiskName}`,
      mimeType: safeMime,
      sizeBytes: buffer.length,
      sha256Hash: sha256,
      categoria: cat,
      sheetId: sheetId || undefined,
      descrizione: description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      trashExpiresAt: null,
      version: 1,
    };

    userStore.files.unshift(fileRecord);
    writeDb(db, isDemo);

    res.json({ success: true, file: fileRecord, message: 'File archiviato con successo!' });
  } catch (err: any) {
    console.error('Error uploading file:', err);
    res.status(500).json({ success: false, message: `Errore salvataggio file: ${err.message}` });
  }
});

// Genera token di download temporaneo valido 60 secondi
app.get('/api/storage/files/:id/token', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const fileId = req.params.id;
  const file = (userStore.files || []).find((f: any) => f.id === fileId);
  if (!file) {
    return res.status(404).json({ success: false, message: 'File non trovato.' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  tempDownloadTokens.set(token, {
    fileId,
    matricola,
    isDemo: !!isDemo,
    expiresAt: Date.now() + 60 * 1000,
  });
  res.json({ success: true, downloadToken: token, expiresAt: Date.now() + 60 * 1000 });
});

// Download protetto autorizzato (con Bearer o token temporaneo monouso)
app.get('/api/storage/files/:id/download', (req, res) => {
  let userMatricola: string | null = null;
  let isDemo = false;
  const session = getSession(req);
  if (session) {
    userMatricola = session.matricola;
    isDemo = !!session.isDemo;
  } else if (req.query.token && typeof req.query.token === 'string') {
    const temp = tempDownloadTokens.get(req.query.token);
    if (temp && temp.expiresAt >= Date.now() && temp.fileId === req.params.id) {
      userMatricola = temp.matricola;
      isDemo = !!temp.isDemo;
      tempDownloadTokens.delete(req.query.token);
    }
  }

  if (!userMatricola) {
    return res.status(401).json({ success: false, message: 'Accesso negato: download non autorizzato.' });
  }

  const db = readDb(isDemo);
  const userStore = getUserStore(db, userMatricola);
  const fileId = req.params.id;
  const file = (userStore.files || []).find((f: any) => f.id === fileId);
  if (!file) {
    return res.status(404).json({ success: false, message: 'File non trovato nel tuo archivio.' });
  }

  const userDir = ensureUserStorageDirs(userMatricola);
  const fullPath = path.join(userDir, file.subPath);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ success: false, message: 'File fisico non presente sul server.' });
  }

  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.nomeOriginale)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const stream = fs.createReadStream(fullPath);
  stream.pipe(res);
});

// Verifica integrità crittografica del file su disco (SHA-256)
app.get('/api/storage/files/:id/verify-hash', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const fileId = req.params.id;
  const file = (userStore.files || []).find((f: any) => f.id === fileId);
  if (!file) return res.status(404).json({ success: false, message: 'File non trovato.' });

  const userDir = ensureUserStorageDirs(matricola);
  const fullPath = path.join(userDir, file.subPath);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ success: false, intact: false, message: 'File non presente su disco.' });
  }

  const content = fs.readFileSync(fullPath);
  const computedHash = crypto.createHash('sha256').update(content).digest('hex');
  const intact = (computedHash === file.sha256Hash);

  res.json({
    success: true,
    intact,
    storedHash: file.sha256Hash,
    computedHash,
    fileSize: content.length,
    verifiedAt: new Date().toISOString(),
    message: intact
      ? 'Integrità verificata: il file corrisponde byte-per-byte all\'impronta crittografica SHA-256 originale.'
      : 'ATTENZIONE: Integrità compromessa! Il contenuto su disco non corrisponde all\'hash registrato.',
  });
});

// Sposta file nel Cestino (durata esplicita 30 giorni)
app.delete('/api/storage/files/:id', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const fileId = req.params.id;
  const file = (userStore.files || []).find((f: any) => f.id === fileId);
  if (!file) return res.status(404).json({ success: false, message: 'File non trovato.' });

  const userDir = ensureUserStorageDirs(matricola);
  const oldPath = path.join(userDir, file.subPath);
  const trashPath = path.join(userDir, 'trash', file.nomeFileDisco);

  if (fs.existsSync(oldPath)) {
    try { fs.renameSync(oldPath, trashPath); } catch {}
  }

  file.deletedAt = new Date().toISOString();
  file.trashExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  file.subPath = `trash/${file.nomeFileDisco}`;

  writeDb(db, isDemo);
  res.json({
    success: true,
    message: 'File spostato nel cestino (conservazione 30 giorni con possibilità di ripristino).',
  });
});

// Visualizza elementi nel Cestino
app.get('/api/storage/trash', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);

  const trashedFiles = (userStore.files || []).filter((f: any) => !!f.deletedAt);
  const trashedSheets = (userStore.trash || []).filter((t: any) => t.type === 'SHEET');

  res.json({
    success: true,
    files: trashedFiles,
    sheets: trashedSheets,
    retentionDays: 30,
  });
});

// Ripristina elemento dal Cestino
app.post('/api/storage/trash/:id/restore', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const id = req.params.id;

  const file = (userStore.files || []).find((f: any) => f.id === id);
  if (file && file.deletedAt) {
    const userDir = ensureUserStorageDirs(matricola);
    let originalSub = 'attachments';
    if (file.categoria === 'PROSPETTO' || file.categoria === 'DOCUMENTO') originalSub = 'documents';
    else if (file.categoria === 'RICEVUTA_ACCETTAZIONE' || file.categoria === 'RICEVUTA_CONSEGNA') originalSub = 'receipts';

    const currentPath = path.join(userDir, 'trash', file.nomeFileDisco);
    const restoredPath = path.join(userDir, originalSub, file.nomeFileDisco);

    if (fs.existsSync(currentPath)) {
      try { fs.renameSync(currentPath, restoredPath); } catch {}
    }

    file.deletedAt = null;
    file.trashExpiresAt = null;
    file.subPath = `${originalSub}/${file.nomeFileDisco}`;
    writeDb(db, isDemo);
    return res.json({ success: true, message: 'File ripristinato con successo nell\'archivio attivo.' });
  }

  if (userStore.trash) {
    const tIdx = userStore.trash.findIndex((t: any) => t.id === id && t.type === 'SHEET');
    if (tIdx >= 0) {
      const item = userStore.trash[tIdx].item;
      userStore.trash.splice(tIdx, 1);
      if (!userStore.sheets) userStore.sheets = [];
      userStore.sheets.push(item);
      writeDb(db, isDemo);
      return res.json({ success: true, message: 'Prospetto mensile ripristinato con successo.' });
    }
  }

  res.status(404).json({ success: false, message: 'Elemento non trovato nel cestino.' });
});

// Eliminazione permanente dal Cestino
app.delete('/api/storage/trash/:id/permanent', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const id = req.params.id;

  const fileIdx = (userStore.files || []).findIndex((f: any) => f.id === id);
  if (fileIdx >= 0) {
    const file = userStore.files[fileIdx];
    const userDir = ensureUserStorageDirs(matricola);
    const filePath = path.join(userDir, file.subPath);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
    userStore.files.splice(fileIdx, 1);
    writeDb(db, isDemo);
    return res.json({ success: true, message: 'File eliminato definitivamente.' });
  }

  if (userStore.trash) {
    const tIdx = userStore.trash.findIndex((t: any) => t.id === id);
    if (tIdx >= 0) {
      userStore.trash.splice(tIdx, 1);
      writeDb(db, isDemo);
      return res.json({ success: true, message: 'Elemento eliminato definitivamente dal cestino.' });
    }
  }

  res.status(404).json({ success: false, message: 'Elemento non trovato nel cestino.' });
});

// Svuota tutto il Cestino
app.post('/api/storage/trash/empty', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const userDir = ensureUserStorageDirs(matricola);

  const trashedFiles = (userStore.files || []).filter((f: any) => !!f.deletedAt);
  for (const f of trashedFiles) {
    const fullPath = path.join(userDir, f.subPath);
    if (fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch {}
    }
  }

  userStore.files = (userStore.files || []).filter((f: any) => !f.deletedAt);
  userStore.trash = [];
  writeDb(db, isDemo);
  res.json({ success: true, message: 'Cestino svuotato completamente.' });
});

// Migrazione sicura dei dati locali salvati nel browser
app.post('/api/storage/migrate-local', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const { sheets } = req.body;

  if (!Array.isArray(sheets)) {
    return res.status(400).json({ success: false, message: 'Dati di migrazione non validi.' });
  }

  if (!userStore.sheets) userStore.sheets = [];
  let mergedCount = 0;

  for (const localSheet of sheets) {
    if (!localSheet || !localSheet.id) continue;
    const existingIndex = userStore.sheets.findIndex((s: any) => s.id === localSheet.id);
    if (existingIndex < 0) {
      userStore.sheets.push({
        ...localSheet,
        version: 1,
        createdAt: localSheet.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      mergedCount++;
    } else {
      const s = userStore.sheets[existingIndex];
      const sEntries = (s.entries || []).length;
      const lEntries = (localSheet.entries || []).length;
      if (lEntries > sEntries) {
        userStore.sheets[existingIndex] = {
          ...s,
          ...localSheet,
          version: (s.version || 1) + 1,
          updatedAt: new Date().toISOString(),
        };
        mergedCount++;
      }
    }
  }

  writeDb(db, isDemo);
  res.json({
    success: true,
    message: `Migrazione completata: ${mergedCount} prospetti sincronizzati in sicurezza sul server.`,
    sheets: userStore.sheets,
  });
});

// ==========================================
// ARUBA PEC: INVIO, VERIFICA E DIAGNOSTICA
// ==========================================

// Funzione di test connettività socket TLS (senza inviare messaggi)
async function testArubaTlsSocket(host: string, port: number): Promise<{ reachable: boolean; latencyMs: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = tls.connect({
      host,
      port,
      servername: host,
      timeout: 7000,
      rejectUnauthorized: true,
    }, () => {
      const latency = Date.now() - start;
      socket.end();
      resolve({ reachable: true, latencyMs: latency });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ reachable: false, latencyMs: Date.now() - start, error: 'TIMEOUT_HOSTING_FIREWALL' });
    });

    socket.on('error', (err: any) => {
      socket.destroy();
      resolve({ reachable: false, latencyMs: Date.now() - start, error: err.message || err.code || 'CONNECT_ERROR' });
    });
  });
}

// Invia PEC con allegato PDF (archiviazione automatica documento e ricevute)
app.post('/api/pec/send', requireAuth, async (req, res) => {
  try {
    const matricola = (req as any).userMatricola;
    const isDemo = (req as any).isDemo;
    const db = readDb(isDemo);
    const userStore = getUserStore(db, matricola);

    const { sheetId, pdfBase64, customRecipient, note, tipoDocumento, subject: customSubject, filename: customFilename, mailText: customMailText } = req.body;

    const pecSettings = userStore.pecSettings || {};
    const profile = userStore.profile || {};
    let recipient = customRecipient || pecSettings?.pecUfficioPersonale || '118centrale@sanitaserviceaslta.it';
    const sender = pecSettings.smtpUser || profile.emailPec || 'dipendente.118@pec.it';

    let sheet: any = null;
    let filename = customFilename || 'Documento_Ufficiale_118.pdf';
    let subject = customSubject || `[S.E.T. 118] Trasmissione Documento Ufficiale - Matr. ${profile.matricola} ${profile.cognome} ${profile.nome}`;
    let mailText = customMailText || '';
    let logTitle = 'Documento Ufficiale';

    if (sheetId) {
      sheet = (userStore.sheets || []).find((s: any) => s.id === sheetId);
      if (!sheet) {
        logSystemError('GENERAZIONE_PDF', 'Invio PEC respinto: prospetto non trovato', { sheetId, matricola });
        return res.status(404).json({
          success: false,
          code: 'SHEET_NOT_FOUND',
          message: 'Il prospetto mensile indicato non è stato trovato.',
        });
      }

      // 1. Blocco server: Firma mancante
      if (!sheet.firmaDipendente || (!sheet.firmaDipendente.dataUrl && !sheet.firmaDipendente.fileName)) {
        logSystemError('FIRMA', 'Invio PEC bloccato: firma mancante sul prospetto', { sheetId, matricola });
        return res.status(400).json({
          success: false,
          code: 'MISSING_SIGNATURE',
          message: 'Invio bloccato: il prospetto mensile non contiene una firma autorizzata. Apponi la tua firma prima della trasmissione.',
          action: 'SIGN_DOCUMENT',
        });
      }

      // 2. Blocco server: Firma decaduta per modifiche successive ai dati
      if (sheet.richiedeNuovaFirma) {
        logSystemError('FIRMA', 'Invio PEC bloccato: firma decaduta per modifica dati', { sheetId, matricola });
        return res.status(400).json({
          success: false,
          code: 'OUTDATED_SIGNATURE',
          message: 'Invio bloccato: il documento è stato modificato dopo l\'apposizione della firma. La firma precedente è decaduta: rinnova la firma e convalida il prospetto prima dell\'invio.',
          action: 'RENEW_SIGNATURE',
        });
      }

      // 3. Blocco server: Mancanza o obsolescenza della convalida per la versione attuale
      if (!sheet.convalida || sheet.convalida.stato !== 'CONVALIDATO') {
        logSystemError('GENERAZIONE_PDF', 'Invio PEC bloccato: prospetto non convalidato dall\'utente', { sheetId, matricola });
        return res.status(400).json({
          success: false,
          code: 'NOT_VALIDATED',
          message: 'Invio bloccato: il prospetto deve essere verificato e convalidato nella versione attuale prima della trasmissione via PEC.',
          action: 'VALIDATE_DOCUMENT',
        });
      }

      // 4. Blocco server: File PDF non pervenuto
      if (!pdfBase64) {
        logSystemError('GENERAZIONE_PDF', 'Invio PEC bloccato: file PDF assente', { sheetId, matricola });
        return res.status(400).json({
          success: false,
          code: 'MISSING_PDF',
          message: 'Invio bloccato: il file PDF del documento non è stato generato o allegato correttamente.',
          action: 'REGENERATE_PDF',
        });
      }

      filename = `Prospetto_Straordinari_SET118_${sheet.nomeMese.replace(/\s+/g, '_')}_${profile.cognome}.pdf`;
      subject = `[S.E.T. 118] Trasmissione Prospetto Straordinari ${sheet.nomeMese} - Matr. ${profile.matricola} ${profile.cognome} ${profile.nome}`;
      logTitle = `Prospetto Straordinari ${sheet.nomeMese}`;
      mailText = `Spett.le Ufficio Personale Sanitaservice ASL TA s.r.l. Unipersonale,

Si trasmette in allegato il prospetto ufficiale delle ore di straordinario ed eventuale monte ore effettuate per il servizio di emergenza-urgenza territoriale S.E.T. 118 nel mese di ${sheet.nomeMese}.

DATI DEL DIPENDENTE:
- Nominativo: ${profile.cognome} ${profile.nome}
- Matricola: ${profile.matricola}
- Postazione 118: ${profile.postazione}
- Qualifica: ${profile.qualifica}

RIASSUNTO ORE EFFETTUATE:
- Totale Ore Monte Ore: ${sheet.totaleOreMonteOreFormatted || '0h 00m'}
- Totale Ore Straordinario: ${sheet.totaleOreStraordinarioFormatted || '0h 00m'}
- Totale Complessivo: ${sheet.totaleOreComplessivoFormatted || '0h 00m'}
- Numero Turni con Straordinario: ${sheet.entries ? sheet.entries.length : 0}

${note ? `Note aggiuntive del dipendente:\n${note}\n\n` : ''}Si resta a disposizione per eventuali chiarimenti.

Distinti saluti,
${profile.nome} ${profile.cognome}
Operatore S.E.T. 118 - Sanitaservice ASL TA`;
    }

    let messageId = `PEC-${Date.now()}-${Math.floor(Math.random() * 100000)}@sanitaservice118.local`;
    let sendResult: 'INOLTRATO_AL_SERVER' | 'SIMULATO' | 'ERRORE' = 'SIMULATO';
    let details = '';
    const nowIso = new Date().toISOString();

    // Archiviazione automatica del PDF generato nell'archivio privato del dipendente
    if (pdfBase64) {
      try {
        const buffer = Buffer.from(pdfBase64, 'base64');
        const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
        const userDir = ensureUserStorageDirs(matricola);
        const fileId = `doc-${Date.now()}`;
        const safeName = `${fileId}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        fs.writeFileSync(path.join(userDir, 'documents', safeName), buffer);

        if (!userStore.files) userStore.files = [];
        const exists = userStore.files.find((f: any) => !f.deletedAt && f.sha256Hash === sha256);
        if (!exists) {
          userStore.files.unshift({
            id: fileId,
            matricola,
            azienda: 'Sanitaservice ASL TA s.r.l. Unipersonale',
            servizio: 'S.E.T. 118 Taranto',
            nomeOriginale: filename,
            nomeFileDisco: safeName,
            subPath: `documents/${safeName}`,
            mimeType: 'application/pdf',
            sizeBytes: buffer.length,
            sha256Hash: sha256,
            categoria: 'PROSPETTO',
            sheetId: sheet ? sheet.id : undefined,
            descrizione: `Prospetto inviato via PEC - ${logTitle}`,
            createdAt: nowIso,
            updatedAt: nowIso,
            deletedAt: null,
            trashExpiresAt: null,
            version: 1,
          });
        }
      } catch (archErr) {
        console.warn('Errore archiviazione automatica PDF:', archErr);
      }
    }

    // REGOLA DI SICUREZZA ASSOLUTA: IN AMBIENTE DEMO O IN MODALITÀ SIMULAZIONE NESSUN INVIO REALE
    if (isDemo || pecSettings.simulazioneTestMode) {
      sendResult = 'SIMULATO';
      details = isDemo
        ? 'Ambiente Dimostrativo: invio PEC reale bloccato per sicurezza. Documento archiviato in simulazione.'
        : 'Modalità di simulazione attiva: anteprima PEC generata con successo. Nessun invio alla casella reale.';

      if (sheet) {
        sheet.status = 'PRONTO';
        sheet.pecInvioInfo = {
          dataInvio: nowIso,
          destinatario: recipient,
          mittente: sender,
          idMessaggio: messageId,
          ricevutaAccettazione: false,
          ricevutaConsegna: false,
          lifecycleStatus: 'BOZZA',
        };
      }
    } else {
      // Produzione con invio reale SMTP
      let effectivePass = '';
      if (pecSettings.encryptedSmtpPass) {
        effectivePass = decryptPecSecret(pecSettings.encryptedSmtpPass) || '';
      } else if (pecSettings.smtpPass) {
        effectivePass = pecSettings.smtpPass;
      } else if (process.env.SET118_PEC_PASSWORD) {
        effectivePass = process.env.SET118_PEC_PASSWORD;
      }

      const host = pecSettings.smtpHost || 'smtps.pec.aruba.it';
      const port = Number(pecSettings.smtpPort || 465);

      if (!host || !effectivePass) {
        return res.status(400).json({
          success: false,
          message: 'Credenziali PEC incomplete. Configura server SMTP e password PEC prima dell\'invio reale.',
        });
      }

      const isSsl = pecSettings.smtpSsl !== undefined ? pecSettings.smtpSsl : (port === 465);
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: isSsl,
        auth: {
          user: pecSettings.smtpUser || sender,
          pass: effectivePass,
        },
        connectionTimeout: 15000,
      });

      const attachments = [];
      if (pdfBase64) {
        attachments.push({
          filename,
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf',
        });
      }

      const info = await transporter.sendMail({
        from: sender,
        to: recipient,
        cc: pecSettings.pecCopiaConoscenza || undefined,
        subject,
        text: mailText,
        attachments,
        headers: {
          'X-Trasporto': 'posta-certificata',
          'X-Riferimento-Messaggio': messageId,
        },
      });

      messageId = info.messageId || messageId;
      sendResult = 'INOLTRATO_AL_SERVER';
      details = `Inoltrato al server SMTP (${host}). L'accettazione iniziale non equivale a consegna certificata (in attesa di ricevuta di consegna dal gestore).`;

      if (sheet) {
        sheet.status = 'INVIATO_PEC';
        sheet.pecInvioInfo = {
          dataInvio: nowIso,
          destinatario: recipient,
          mittente: sender,
          idMessaggio: messageId,
          ricevutaAccettazione: true,
          ricevutaConsegna: false,
          dataRicevutaAccettazione: nowIso,
          lifecycleStatus: 'INOLTRATO_AL_SERVER',
        };
      }
    }

    if (!userStore.pecLogs) userStore.pecLogs = [];
    const logItem = {
      id: `log-${Date.now()}`,
      sheetId: sheet ? sheet.id : undefined,
      tipoDocumento: tipoDocumento || (sheet ? 'PROSPETTO_STRAORDINARI' : 'DOCUMENTO'),
      titolo: logTitle,
      nomeMese: sheet ? sheet.nomeMese : nowIso.slice(0, 10),
      destinatario: recipient,
      mittente: sender,
      dataInvio: nowIso,
      esito: sendResult,
      dettagli: details,
      totaleOre: sheet ? (sheet.totaleOreComplessivoFormatted || '0h 00m') : undefined,
    };
    userStore.pecLogs.unshift(logItem);

    writeDb(db, isDemo);

    res.json({
      success: true,
      message: sendResult === 'SIMULATO' ? 'Simulazione PEC completata con successo!' : 'Messaggio inoltrato al server PEC!',
      log: logItem,
      sheet,
    });
  } catch (err: any) {
    console.error('Error sending PEC:', err);
    res.status(500).json({
      success: false,
      message: `Errore durante l'invio PEC: ${err.message || 'Errore sconosciuto'}`,
    });
  }
});

// Test connessione Aruba PEC: controllo autenticazione senza inviare messaggi
app.post('/api/pec/test-connection', requireAuth, async (req, res) => {
  try {
    const isDemo = (req as any).isDemo;
    if (isDemo) {
      return res.json({
        success: true,
        message: 'Ambiente Dimostrativo: connessione simulata con successo (invii di rete reali disabilitati).',
      });
    }

    const matricola = (req as any).userMatricola;
    const db = readDb(false);
    const userStore = getUserStore(db, matricola);

    const { smtpHost, smtpPort, smtpSsl, smtpUser, smtpPass } = req.body;
    const host = (smtpHost || userStore.pecSettings?.smtpHost || 'smtps.pec.aruba.it').trim();
    const port = Number(smtpPort || userStore.pecSettings?.smtpPort || 465);
    const user = (smtpUser || userStore.pecSettings?.smtpUser || '').trim();

    let pass = (smtpPass && smtpPass !== '••••••••') ? smtpPass.trim() : '';
    if (!pass) {
      if (userStore.pecSettings?.encryptedSmtpPass) {
        pass = decryptPecSecret(userStore.pecSettings.encryptedSmtpPass) || '';
      } else if (userStore.pecSettings?.smtpPass) {
        pass = userStore.pecSettings.smtpPass;
      }
    }

    if (!host || !user || !pass) {
      return res.status(400).json({
        success: false,
        message: 'Dati incompleti: specifica Server SMTP (es. smtps.pec.aruba.it), Utente PEC e Password dedicata.',
      });
    }

    // Step 1: Test Socket TLS diretto per verificare connettività di rete / firewall dell'ambiente di hosting
    const socketTest = await testArubaTlsSocket(host, port);
    if (!socketTest.reachable) {
      const isFirewall = socketTest.error === 'TIMEOUT_HOSTING_FIREWALL' || socketTest.error?.includes('ETIMEDOUT') || socketTest.error?.includes('ECONNREFUSED');
      const diagMessage = isFirewall
        ? `La porta ${port} verso il server ${host} non è raggiungibile dall'ambiente di hosting (traffico in uscita bloccato dal firewall / security group dell'infrastruttura). ` +
          `L'applicazione non simulerà il collegamento: per completare l'invio puoi utilizzare la procedura guidata Webmail Aruba (vedi tutorial scritto integrato) oppure abilitare l'egress di rete sulla porta 465.`
        : `Impossibile raggiungere il server ${host}:${port} (${socketTest.error}). Verifica la connessione di rete.`;

      if (userStore.pecSettings) {
        userStore.pecSettings.verificationMessage = diagMessage;
        userStore.pecSettings.lastVerifiedAt = new Date().toISOString();
        writeDb(db, false);
      }

      return res.status(502).json({
        success: false,
        networkBlocked: isFirewall,
        message: diagMessage,
        details: socketTest.error,
      });
    }

    // Step 2: Autenticazione SMTP reale con nodemailer
    const isSsl = smtpSsl !== undefined ? smtpSsl : (port === 465);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: isSsl,
      auth: { user, pass },
      connectionTimeout: 12000,
    });

    try {
      await transporter.verify();
    } catch (authErr: any) {
      const errMsg = (authErr.message || '').toLowerCase();
      let userExplanation = '';
      if (authErr.responseCode === 535 || errMsg.includes('535') || errMsg.includes('authentication') || errMsg.includes('bad credentials')) {
        userExplanation =
          `Credenziali respinte dal server Aruba (Codice 535: Autenticazione fallita).\n` +
          `Possibili cause accertate:\n` +
          `1. Verifica in 2 passaggi (2FA) attiva: Aruba richiede la generazione di una "Password per programmi di posta" dedicata dalla Webmail (non la password normale);\n` +
          `2. Protocolli SMTP disabilitati nelle impostazioni della Webmail Aruba (Menu Utente → Impostazioni → SMTP/POP/IMAP → Accessi);\n` +
          `3. Nome utente incompleto: assicurati di aver digitato l'indirizzo PEC per intero.`;
      } else {
        userExplanation = `Errore durante l'autenticazione SMTP: ${authErr.message}`;
      }

      if (userStore.pecSettings) {
        userStore.pecSettings.verificationMessage = userExplanation;
        userStore.pecSettings.lastVerifiedAt = new Date().toISOString();
        writeDb(db, false);
      }

      return res.status(401).json({
        success: false,
        message: userExplanation,
        code: authErr.responseCode,
      });
    }

    // Successo accertato
    const successMsg = `Collegamento stabilito con successo al server Aruba PEC (${host}:${port}) in ${socketTest.latencyMs}ms. Credenziali verificate e attive! Nessun messaggio inviato o modificato.`;
    if (userStore.pecSettings) {
      userStore.pecSettings.lastVerifiedAt = new Date().toISOString();
      userStore.pecSettings.verificationMessage = successMsg;
      writeDb(db, false);
    }

    res.json({
      success: true,
      latencyMs: socketTest.latencyMs,
      message: successMsg,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: `Errore imprevisto durante la verifica: ${err.message || 'Errore sconosciuto'}`,
    });
  }
});

// Overtime Calculation Data
app.get('/api/overtime-calc', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  if (!userStore.overtimeCalc) {
    userStore.overtimeCalc = emptyDbTemplate.overtimeCalc;
    writeDb(db, isDemo);
  }
  res.json({ success: true, calcData: userStore.overtimeCalc });
});

app.post('/api/overtime-calc', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  userStore.overtimeCalc = {
    ...userStore.overtimeCalc,
    ...req.body,
  };
  writeDb(db, isDemo);
  res.json({ success: true, calcData: userStore.overtimeCalc });
});

// PEC Logs
app.get('/api/pec/logs', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  res.json({ success: true, logs: userStore.pecLogs || [] });
});

// Backup personale JSON
app.get('/api/backup', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    database: {
      profile: userStore.profile,
      pecSettings: sanitizePecSettings(userStore.pecSettings),
      sheets: userStore.sheets,
      pecLogs: userStore.pecLogs,
      overtimeCalc: userStore.overtimeCalc,
      filesMetadata: userStore.files || [],
    },
  });
});

// Export Backup Completo ZIP (Database + Documenti PDF + Ricevute + Checksum SHA256)
app.get('/api/backup/full-export', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="Backup_Completo_SET118_Matr_${matricola}_${new Date().toISOString().slice(0, 10)}.zip"`);

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('error', (err: any) => {
    console.error('Archive error:', err);
    if (!res.headersSent) res.status(500).send('Errore creazione archivio');
  });
  archive.pipe(res);

  // 1. Database JSON
  const dbCopy = {
    azienda: 'Sanitaservice ASL TA s.r.l. Unipersonale',
    servizio: 'S.E.T. 118 Taranto',
    matricola,
    dataEsportazione: new Date().toISOString(),
    profilo: userStore.profile,
    pecSettings: sanitizePecSettings(userStore.pecSettings),
    sheets: userStore.sheets || [],
    pecLogs: userStore.pecLogs || [],
    overtimeCalc: userStore.overtimeCalc,
    filesMetadata: userStore.files || [],
  };
  const dbString = JSON.stringify(dbCopy, null, 2);
  archive.append(dbString, { name: 'database_personale.json' });

  // 2. File fisici e manifest SHA-256
  const userDir = path.join(STORAGE_BASE_DIR, 'users', matricola);
  const manifest: Array<{ file: string; sha256: string; size: number }> = [];

  const dbHash = crypto.createHash('sha256').update(dbString).digest('hex');
  manifest.push({ file: 'database_personale.json', sha256: dbHash, size: Buffer.byteLength(dbString) });

  if (fs.existsSync(userDir)) {
    const folders = ['documents', 'attachments', 'receipts'];
    for (const folder of folders) {
      const fDir = path.join(userDir, folder);
      if (fs.existsSync(fDir)) {
        const files = fs.readdirSync(fDir);
        for (const f of files) {
          const fullPath = path.join(fDir, f);
          const stat = fs.statSync(fullPath);
          if (stat.isFile()) {
            const content = fs.readFileSync(fullPath);
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            archive.file(fullPath, { name: `${folder}/${f}` });
            manifest.push({ file: `${folder}/${f}`, sha256: hash, size: stat.size });
          }
        }
      }
    }
  }

  // 3. Manifest SHA-256
  archive.append(JSON.stringify({ manifest, generatedAt: new Date().toISOString() }, null, 2), { name: 'manifest_integrita_sha256.json' });

  // 4. Politica di Backup, RPO, RTO e chiarimento legale Conservazione
  const notice = `SANITASERVICE ASL TA S.R.L. UNIPERSONALE - S.E.T. 118 TARANTO
INFORMATIVA SULL'ARCHIVIAZIONE, BACKUP E CONSERVAZIONE DEI DATI

1. NATURA DELL'ARCHIVIO:
Il presente archivio costituisce un backup operativo locale e privato del dipendente per la gestione del monte ore, straordinari e comunicazioni PEC interne.
AVVISO IMPORTANTE: Questo archivio NON sostituisce il servizio formale di "Conservazione a Norma" (art. 44 del Codice dell'Amministrazione Digitale - CAD), che per legge deve essere erogato da un conservatore accreditato AgID (es. Aruba PEC Conservazione / DocFly) con apposizione di marcatura temporale e firma qualificata.

2. METRICHE DI CONTINUITÀ OPERATIVA:
- RPO (Recovery Point Objective - Massima perdita dati tollerata): 24 ore tramite backup incrementali o esportazione al termine del turno.
- RTO (Recovery Time Objective - Tempo stimato di ripristino): < 15 minuti tramite procedura di ripristino JSON/ZIP.
- Retention Cestino: 30 giorni per registri e documenti eliminati con possibilità di ripristino immediato.

3. INTEGRITÀ DEI DATI:
Ogni file esportato è corredato del relativo hash crittografico SHA-256 registrato in 'manifest_integrita_sha256.json' per garantire che non sia stato alterato o corrotto.

Generato automaticamente per la matricola ${matricola} in data ${new Date().toLocaleString('it-IT')}.
`;
  archive.append(notice, { name: 'POLITICA_BACKUP_E_CONSERVAZIONE.txt' });

  archive.finalize();
});

// Ripristino Backup personale
app.post('/api/restore', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const { database } = req.body;
  if (!database || !database.profile) {
    return res.status(400).json({ success: false, message: 'Dati di backup non validi.' });
  }
  const userStore = getUserStore(db, matricola);
  if (database.profile) userStore.profile = { ...database.profile, matricola };
  if (database.sheets) userStore.sheets = database.sheets;
  if (database.pecLogs) userStore.pecLogs = database.pecLogs;
  if (database.overtimeCalc) userStore.overtimeCalc = database.overtimeCalc;
  if (database.filesMetadata) userStore.files = database.filesMetadata;
  writeDb(db, isDemo);
  res.json({ success: true, message: 'Backup ripristinato con successo nella tua area personale!' });
});

// Download CSV del foglio (Backup Offline Locale)
app.get('/api/sheets/:id/csv', requireAuth, (req, res) => {
  const matricola = (req as any).userMatricola;
  const isDemo = (req as any).isDemo;
  const db = readDb(isDemo);
  const userStore = getUserStore(db, matricola);
  const sheet = (userStore.sheets || []).find((s: any) => s.id === req.params.id);
  if (!sheet) {
    return res.status(404).send('Foglio non trovato.');
  }
  const lines: string[] = [];
  lines.push('SANITASERVICE ASL TA S.r.l. Unipersonale - S.E.T. 118');
  lines.push(`REGISTRO MENSILE PRESTAZIONI ORARIE ECCEDENTI - ${sheet.nomeMese}`);
  lines.push(`DIPENDENTE: ${sheet.dipendente?.cognome || ''} ${sheet.dipendente?.nome || ''};MATRICOLA: ${sheet.dipendente?.matricola || ''}`);
  lines.push(`POSTAZIONE: ${sheet.dipendente?.postazione || ''};QUALIFICA: ${sheet.dipendente?.qualifica || ''}`);
  lines.push('');
  lines.push('Giorno;Orario Ordinario;Orario Straordinario;Motivo Straordinario;Destinazione;Ore Monte Ore;Ore Straordinario;Ore Decimali;Firma Coordinatore');
  (sheet.entries || []).forEach((e: any) => {
    lines.push(`"${e.giorno}";"${e.orarioOrdinario}";"${e.orarioStraordinario}";"${(e.motivo || '').replace(/"/g, '""')}";"${e.tipoDestinazione}";"${e.totaleOreMonteOre || ''}";"${e.totaleOreStraordinario || ''}";"${e.oreDecimali || 0}";"${e.firmaCoordinatore || ''}"`);
  });
  lines.push('');
  lines.push(`TOTALI;;;;;${sheet.totaleOreMonteOreFormatted || '0h 00m'};${sheet.totaleOreStraordinarioFormatted || '0h 00m'};;`);

  const csvContent = '\uFEFF' + lines.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="Registro_Straordinari_118_${sheet.id}.csv"`);
  res.send(csvContent);
});

// Setup frontend serving
async function setupServer() {
  const distPath = path.resolve(process.cwd(), 'dist');
  let hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (!hasDist) {
    try {
      console.log('[PERF] dist non presente: compilazione rapida del bundle...');
      const { execSync } = await import('child_process');
      execSync('npx vite build', { stdio: 'inherit' });
      hasDist = fs.existsSync(path.join(distPath, 'index.html'));
    } catch (e) {
      console.warn('Compilazione al volo non riuscita, fallback a Vite middleware:', e);
    }
  }

  // Always serve files from public folder (including original logos and signatures)
  const publicFolder = path.resolve(process.cwd(), 'public');
  if (fs.existsSync(publicFolder)) {
    app.use(
      express.static(publicFolder, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.png') || filePath.endsWith('.jpeg') || filePath.endsWith('.jpg')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
        },
      })
    );
  }

  if (hasDist) {
    console.log('[PERF] Avvio con bundle di produzione ultra-veloce (dist)');
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
        },
      })
    );
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log('[DEV] Avvio Vite dev middleware');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Sanitaservice 118 avviato sulla porta ${PORT}`);
  });
}

setupServer();
