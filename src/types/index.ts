export interface EmployeeProfile {
  nome: string;
  cognome: string;
  matricola: string;
  postazione: string;
  qualifica: string;
  telefono?: string;
  emailPec?: string;
  coordinatoreNome?: string;
  firmaSalvata?: DigitalSignature;
}

export interface UserSession {
  matricola: string;
  email: string;
  nome: string;
  cognome: string;
  postazione: string;
  token?: string;
  mustChangePassword?: boolean;
  isDemo?: boolean;
  role?: 'employee' | 'admin';
}

export interface RegisterFormData {
  nome: string;
  cognome: string;
  matricola: string;
  email: string;
  postazione: string;
  password: string;
  confermaPassword?: string;
  salvaDatiAccesso?: boolean;
  codiceInvito?: string;
}

export interface RegisteredUserSummary {
  matricola: string;
  nome: string;
  cognome: string;
  postazione: string;
  email: string;
}

export interface DigitalSignature {
  dataUrl?: string; // base64 PNG/JPEG of authentic signature or acquired drawing
  url?: string; // permanent URL /api/user/signature/image?v=...
  nomeFirmatario: string;
  dataFirma: string; // DD/MM/YYYY HH:mm
  tipo: 'ORIGINALE' | 'DISEGNO' | 'DIGITALE';
  certificatoId: string;
  autorizzata?: boolean; // Explicit authorization for the specific document
  originalWidth?: number;
  originalHeight?: number;
  sha256?: string;
  fileName?: string;
  sizeKb?: number;
  updatedAt?: string;
}

export type DestinazioneTipo = 'MONTE_ORE' | 'STRAORDINARIO';

export type FileCategory =
  | 'PROSPETTO'
  | 'RICEVUTA_ACCETTAZIONE'
  | 'RICEVUTA_CONSEGNA'
  | 'GIUSTIFICATIVO'
  | 'CAMBIO_TURNO'
  | 'PERMESSI_TIMBRATURA'
  | 'FIRMA_DIGITALE'
  | 'DOCUMENTO';

export interface StorageFileRecord {
  id: string;
  matricola: string;
  azienda: string;
  servizio: string;
  nomeOriginale: string;
  nomeFileDisco: string;
  subPath: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  categoria: FileCategory;
  sheetId?: string;
  descrizione?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  trashExpiresAt?: string | null;
  version: number;
}

export type PecLifecycleStatus =
  | 'BOZZA'
  | 'INVIO_IN_CORSO'
  | 'INOLTRATO_AL_SERVER'
  | 'RICEVUTA_ACCETTAZIONE'
  | 'RICEVUTA_CONSEGNA'
  | 'ERRORE_O_DA_VERIFICARE';

export type SyncState = 'SAVING' | 'SAVED_ONLINE' | 'OFFLINE_LOCAL' | 'SAVE_FAILED';

export interface SyncStatusInfo {
  state: SyncState;
  lastConfirmedServerTime?: string;
  message?: string;
}

export interface SheetVersionSnapshot {
  version: number;
  savedAt: string;
  savedBy: string;
  sheet: MonthlySheet;
}

export interface ShiftPreset {
  id: string;
  label: string;
  nomeTurno: string;
  orarioOrdinario: string;
  oreOrdinarie: number;
  orarioInizio: string;
  orarioFine: string;
}

export interface OvertimeEntry {
  id: string;
  giorno: string; // "DD/MM/YYYY" or "DD"
  turnoType: string;
  orarioOrdinario: string;
  orarioStraordinario: string;
  motivo: string;
  tipoDestinazione: DestinazioneTipo;
  minutiEffettuati: number;
  totaleOreMonteOre: string;
  totaleOreStraordinario: string;
  oreDecimali: number;
  firmaCoordinatore: string;
  dataCreazione: string;
  note?: string;
}

export interface MonthlySheet {
  id: string; // e.g. "2026-09"
  anno: number;
  mese: number;
  nomeMese: string; // e.g. "SETTEMBRE 2026"
  dipendente: EmployeeProfile;
  entries: OvertimeEntry[];
  totaleMinutiMonteOre: number;
  totaleMinutiStraordinario: number;
  totaleMinutiComplessivo: number;
  totaleOreMonteOreFormatted: string;
  totaleOreStraordinarioFormatted: string;
  totaleOreComplessivoFormatted: string;
  status: 'BOZZA' | 'PRONTO' | 'INVIATO_PEC' | 'ARCHIVIATO';
  version?: number;
  firmaDipendente?: DigitalSignature;
  richiedeNuovaFirma?: boolean; // Set to true when sheet is modified after signature was applied
  motivoNuovaFirma?: string; // Reason why a new signature is required
  firmaAutorizzata?: boolean; // Explicit user authorization for this sheet
  convalida?: SheetConvalidaInfo; // Explicit workflow validation tied to exact sheet version
  pecInvioInfo?: {
    dataInvio: string;
    destinatario: string;
    mittente: string;
    idMessaggio: string;
    ricevutaAccettazione?: boolean;
    ricevutaConsegna?: boolean;
    dataRicevutaAccettazione?: string;
    dataRicevutaConsegna?: string;
    lifecycleStatus?: PecLifecycleStatus;
  };
  deletedAt?: string | null;
  trashExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PecAccountMode = 'INDIVIDUALE' | 'AZIENDALE_CONDIVISA';

export interface PecSettings {
  accountMode?: PecAccountMode;
  pecUfficioPersonale: string;
  pecCopiaConoscenza?: string;
  invioAutomaticoGiorno1: boolean;
  oraInvioGiorno1: string;
  promemoriaNotifica: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass?: string;
  hasSmtpPass?: boolean;
  smtpSsl?: boolean;
  imapHost?: string;
  imapPort?: number;
  imapSsl?: boolean;
  simulazioneTestMode: boolean;
  lastVerifiedAt?: string;
  verificationMessage?: string;
}

export interface PecLogEntry {
  id: string;
  sheetId?: string;
  tipoDocumento?: 'PROSPETTO_STRAORDINARI' | 'CAMBIO_TURNO' | 'PERMESSI_TIMBRATURA' | string;
  titolo?: string;
  nomeMese: string;
  destinatario: string;
  mittente: string;
  dataInvio: string;
  esito: 'CONSEGNATO' | 'IN_CODA' | 'ERRORE' | 'SIMULATO';
  dettagli: string;
  totaleOre?: string;
}

export type ActiveAppModule = 'SELECTOR_HUB' | 'STRAORDINARI' | 'CAMBIO_TURNO' | 'PERMESSI_TIMBRATURA' | 'IMPORTA_TURNI';

export interface CambioTurnoData {
  id?: string;
  dataRichiesta: string;
  postazione: string;
  matricolaRichiedente: string;
  nomeRichiedente: string;
  collegaAccettante: string;
  qualifica: 'AUTISTA_SOCCORRITORE' | 'SOCCORRITORE';
  turnoRichiedenteInizio: string;
  turnoRichiedenteFine: string;
  turnoAccettanteInizio: string;
  turnoAccettanteFine: string;
  giornoCambio: string;
  firmaRichiedente?: DigitalSignature;
  firmaRichiedenteAutorizzata?: boolean;
  firmaAccettante?: string;
  firmaReferente?: string;
  note?: string;
  createdAt?: string;
}

export interface PermessiTimbraturaData {
  id?: string;
  dataRichiesta: string;
  postazione: string;
  matricola: string;
  nomeCognome: string;
  
  // Causali Assenza
  richiestaFerie: boolean;
  ferieDal: string;
  ferieAl: string;

  richiestaCongedo: boolean;
  congedoDal: string;
  congedoAl: string;

  recuperoFestivita: boolean;
  festivitaDel: string;
  recuperoFestivitaIl: string;

  permessoPersonale: boolean;
  permessoPersonaleIl: string;

  permessoLutto: boolean;
  luttoDal: string;
  luttoAl: string;

  recuperoPermessoPersonale: boolean;
  recuperoPermessoDel: string;
  recuperoPermessoIl: string;

  permessoLegge104: boolean;
  legge104Giorni: string;

  permessoArt34: boolean;
  art34Dettagli: string;

  // Mancata Timbratura
  mancataTimbratura: boolean;
  omessaEntrata: boolean;
  omessaEntrataOra: string;
  omessaEntrataData: string;
  omessaUscita: boolean;
  omessaUscitaOra: string;
  omessaUscitaData: string;
  motivoMancataTimbratura: string;

  // Firme
  firmaDipendente?: DigitalSignature;
  firmaDipendenteAutorizzata?: boolean;
  createdAt?: string;
}

// ==========================================
// FUNZIONE: CALCOLO COMPENSO STRAORDINARI
// ==========================================

export type OvertimeRateType =
  | 'DIURNO_FERIALE'
  | 'NOTTURNO_O_FESTIVO'
  | 'NOTTURNO_E_FESTIVO'
  | 'PERSONALIZZATO';

export type OvertimePaymentStatus =
  | 'DA_PAGARE'
  | 'PAGATO'
  | 'RECUPERATO_RIPOSO';

export interface OvertimeRateConfig {
  ccnl: string; // "AIOP–ARIS, codice CNEL T011"
  pagaOrariaBase: number; // 11.56160 €
  maggiorazioneDiurnoFeriale: number; // 20%
  maggiorazioneNotturnoFestivo: number; // 30%
  maggiorazioneNotturnoEFestivo: number; // 50%
  aliquotaTrattenuteMedia?: number; // facoltativa, per stima netto (es. 25%)
  noteContrattuali?: string;
}

export interface SeparateAllowancesConfig {
  turnoNotturnoOrdinario: number; // 2.74 €/ora
  indennitaFestivaIntera: number; // 17.82 €/evento
  indennitaFestivaRidotta: number; // 8.91 €/evento
  indennitaTreTurni: number; // 4.50 €/giornata
}

export interface OvertimeCompensationRecord {
  id: string;
  sheetEntryId?: string; // Collegamento facoltativo alla riga nel foglio mensile
  data: string; // "YYYY-MM-DD"
  meseLavorato: string; // "YYYY-MM" (es. "2026-09")
  mesePrevistoPagamento: string; // "YYYY-MM" (es. "2026-10")
  ore: number;
  minuti: number;
  oreDecimali: number; // es. 1h 30m = 1.5 ore
  tipologia: OvertimeRateType;
  tipologiaLabel: string;
  maggiorazionePercentuale: number; // 20, 30, 50, etc.
  pagaOrariaBase: number; // 11.56160
  compensoCompletoLordo: number; // oreDecimali * pagaOrariaBase * (1 + maggiorazione / 100)
  solaMaggiorazioneLordi: number; // oreDecimali * pagaOrariaBase * (maggiorazione / 100)
  stato: OvertimePaymentStatus;
  nota?: string;
  createdAt: string;
  updatedAt: string;
}

export type AllowanceType =
  | 'NOTTURNO_ORDINARIO'
  | 'FESTIVA_INTERA'
  | 'FESTIVA_RIDOTTA'
  | 'TRE_TURNI';

export interface SeparateAllowanceRecord {
  id: string;
  data: string; // YYYY-MM-DD
  tipo: AllowanceType;
  tipoLabel: string;
  unitaMisura: 'ORE' | 'EVENTI' | 'GIORNATE';
  quantita: number;
  tariffaUnitaria: number;
  totaleLordo: number;
  meseCompetenza: string; // YYYY-MM
  mesePagamento: string; // YYYY-MM
  stato: 'DA_PAGARE' | 'PAGATO';
  nota?: string;
  createdAt: string;
}

export interface CedolinoComparisonRecord {
  meseCompetenza: string; // YYYY-MM
  straordinarioLordoCedolino: number;
  dataRegistrazioneCedolino: string;
  noteCedolino?: string;
}

export interface OvertimeCalcState {
  settings: OvertimeRateConfig;
  allowanceSettings: SeparateAllowancesConfig;
  records: OvertimeCompensationRecord[];
  allowanceRecords: SeparateAllowanceRecord[];
  cedolinoComparisons: Record<string, CedolinoComparisonRecord>;
}

// ==========================================
// IMPORTAZIONE TURNI DA PDF / FOTO & CALENDARIO
// ==========================================

export type ShiftTypeCategory =
  | 'MATTINA'
  | 'POMERIGGIO'
  | 'NOTTE'
  | 'GIORNALIERO'
  | 'SMONTE_NOTTE'
  | 'RIPOSO'
  | 'FERIE'
  | 'MALATTIA'
  | 'PERMESSO'
  | 'REPERIBILITA'
  | 'ALTRO';

export interface ImportedShiftRecord {
  id: string; // unique ID
  data: string; // YYYY-MM-DD
  giornoSettimana: string; // Lun, Mar, Mer, Gio, Ven, Sab, Dom
  giornoNumero: number; // 1-31
  codiceTurno: string; // "1", "2", "3", "12", "S", "R", etc.
  significatoCodice?: string; // "Turno mattina", "Turno pomeriggio", "Turno notte", "12 ore", "Smonto", "Riposo", "Codice da verificare"
  durataOre?: number; // 6, 12, 0, etc.
  tipoCategoria: ShiftTypeCategory;
  orarioInizio?: string; // "08:00"
  orarioFine?: string; // "14:00" or "08:00" (next day for night shift)
  orarioFormattato?: string; // "08:00 - 14:00"
  isNotturno?: boolean;
  isRiposo?: boolean;
  isReperibilita?: boolean;
  sezionePersonale?: string; // "Autisti Soccorritori", "Soccorritori", etc.
  mansione?: string; // "Autista Soccorritore", "Soccorritore", etc.
  postazione?: string; // "Taranto Centro - Postazione 118", etc.
  veicolo?: string; // "Mike 1", "India 2", etc.
  coloreCella?: string; // colore cella se presente
  annotazioni?: string;
  statoLettura: 'CONFERMATO' | 'DA_VERIFICARE' | 'CELLA_VUOTA';
  daVerificare?: boolean; // if OCR/table parsing had uncertainty
  motivoVerifica?: string;
  differenzaOrePotenziale?: boolean;
}

export interface CandidateEmployeeMatch {
  nomeCompleto: string;
  cognome: string;
  nome?: string;
  matricola?: string;
  sezione?: string;
  rigaIndice?: number;
  confidenza: 'ALTA' | 'MEDIA' | 'DUBBIO_OMONIMIA';
  dettagli: string;
}

export interface SheetConvalidaInfo {
  stato: 'CONVALIDATO' | 'NON_CONVALIDATO' | 'IN_ATTESA';
  timestamp: string; // ISO date of confirmation
  sheetUpdatedAt: string; // Must match sheet.updatedAt
  signatureSha256?: string;
  pdfSha256?: string;
  operatore: string;
  avvisoConformita: string; // Explaining that this confirms workflow completion, not legal FEQ/SPID
}

export interface SystemErrorRecord {
  id: string;
  timestamp: string;
  categoria: 'REGISTRAZIONE' | 'SALVATAGGIO' | 'FIRMA' | 'GENERAZIONE_PDF';
  messaggio: string;
  dettagliSanificati?: string;
}

export interface AdminStats {
  utentiRegistrati: number;
  utentiAttivi30Giorni: number;
  dataUltimoAggiornamento: string;
  totaleErrori: number;
  erroriPerCategoria: {
    REGISTRAZIONE: number;
    SALVATAGGIO: number;
    FIRMA: number;
    GENERAZIONE_PDF: number;
  };
  erroriRecenti: SystemErrorRecord[];
}

export interface AdminUserRecord {
  matricola: string;
  nome: string;
  cognome: string;
  postazione: string;
  email: string;
  createdAt: string;
  ultimoAccesso?: string;
  schedeSalvateCount: number;
  haFirma: boolean;
}

export interface ShiftImportPlan {
  id: string; // plan ID
  matricola: string;
  mese: number; // 1-12
  anno: number; // 2026
  nomeMese: string; // "Ottobre 2026"
  sezionePersonale?: string;
  sourceFileName: string;
  sourceFileType: 'PDF_DIGITALE' | 'PDF_SCANSIONE' | 'IMMAGINE';
  sourceFileId?: string; // file id in user's private storage archive if preserved
  isPreservedInArchive: boolean; // true if saved to user storage, false if temporary in-memory
  sha256Hash: string;
  dataCaricamento: string;
  statoConferma: 'BOZZA_DA_CONFERMARE' | 'CONFERMATO' | 'AGGIORNATO';
  totaleTurniLavorativi: number;
  totaleOreStimate: number;
  totaleOrePdfDocumento?: number; // Ore lette dalla colonna TOT ufficiale del PDF
  totaleOreCalcolate?: number; // Ore calcolate dalla somma dei turni letti
  discrepanzaOre?: boolean; // true se totaleOrePdfDocumento !== totaleOreCalcolate
  differenzaOre?: number; // scostamento ore (calcolate - da PDF)
  totaleRiposi: number;
  postazioneRilevata: string;
  shifts: ImportedShiftRecord[];
  candidatiOmonimi?: CandidateEmployeeMatch[];
  candidatoSelezionato?: string;
  regoleOreConfigurate?: {
    oreTurno1: number;
    oreTurno2: number;
    oreTurno3: number;
    oreTurno12: number;
  };
  noteEstrazione?: string;
  createdAt: string;
  updatedAt: string;
}

