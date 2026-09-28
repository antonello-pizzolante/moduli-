import { GoogleGenAI } from '@google/genai';
import { ShiftImportPlan, ImportedShiftRecord, CandidateEmployeeMatch, ShiftTypeCategory } from '../types';
import { createRequire } from 'module';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const ai = new GoogleGenAI();

export interface ParseFileInput {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

export interface EmployeeTarget {
  cognome: string;
  nome: string;
  matricola: string;
  postazione?: string;
}

export interface ShiftParseResult {
  success: boolean;
  plan?: ShiftImportPlan;
  needsCandidateSelection?: boolean;
  candidates?: CandidateEmployeeMatch[];
  notFound?: boolean;
  legibilityIssue?: boolean;
  message?: string;
  warning?: string;
}

/**
 * Standard S.E.T. 118 mandatory legend parser
 * Strictly adheres to:
 * 1 = Turno mattina (08:00 - 14:00, 6h)
 * 2 = Turno pomeriggio (14:00 - 20:00, 6h)
 * 3 = Turno notte (20:00 - 08:00, 12h)
 * 12 = Turno di dodici ore (08:00 - 20:00, 12h)
 * S = Smonto (isRiposo: true, durata: 0h)
 * R = Riposo (isRiposo: true, durata: 0h)
 */
export function inferStandard118Times(
  code: string,
  postazione: string = 'Postazione 118'
): {
  tipo: ShiftTypeCategory;
  significatoCodice: string;
  durataOre: number;
  orarioInizio?: string;
  orarioFine?: string;
  orarioFormattato: string;
  titoloCalendario: string;
  isNotturno: boolean;
  isRiposo: boolean;
  daVerificare: boolean;
  statoLettura: 'CONFERMATO' | 'DA_VERIFICARE' | 'CELLA_VUOTA';
} {
  const c = (code || '').trim().toUpperCase();

  // Codice 1 o M: Turno Mattina (08:00 - 14:00)
  if (c === '1' || c === 'M' || c === 'MAT' || c.startsWith('MATT')) {
    return {
      tipo: 'MATTINA',
      significatoCodice: 'Turno mattina',
      durataOre: 6,
      orarioInizio: '08:00',
      orarioFine: '14:00',
      orarioFormattato: '08:00 - 14:00',
      titoloCalendario: `Mattina - ${postazione}`,
      isNotturno: false,
      isRiposo: false,
      daVerificare: false,
      statoLettura: 'CONFERMATO',
    };
  }

  // Codice 2 o P: Turno Pomeriggio (14:00 - 20:00)
  if (c === '2' || c === 'P' || c === 'POM' || c.startsWith('POM')) {
    return {
      tipo: 'POMERIGGIO',
      significatoCodice: 'Turno pomeriggio',
      durataOre: 6,
      orarioInizio: '14:00',
      orarioFine: '20:00',
      orarioFormattato: '14:00 - 20:00',
      titoloCalendario: `Pomeriggio - ${postazione}`,
      isNotturno: false,
      isRiposo: false,
      daVerificare: false,
      statoLettura: 'CONFERMATO',
    };
  }

  // Codice 3 o N: Turno Notte (20:00 - 08:00 giorno successivo)
  if (c === '3' || c === 'N' || c === 'NOT' || c.startsWith('NOT')) {
    return {
      tipo: 'NOTTE',
      significatoCodice: 'Turno notte',
      durataOre: 12,
      orarioInizio: '20:00',
      orarioFine: '08:00',
      orarioFormattato: '20:00 - 08:00 (12h)',
      titoloCalendario: `Notte - ${postazione}`,
      isNotturno: true,
      isRiposo: false,
      daVerificare: false,
      statoLettura: 'CONFERMATO',
    };
  }

  // Codice 12: Turno di dodici ore (08:00 - 20:00)
  if (c === '12' || c === '12H' || c === 'G12') {
    return {
      tipo: 'GIORNALIERO',
      significatoCodice: 'Turno di dodici ore',
      durataOre: 12,
      orarioInizio: '08:00',
      orarioFine: '20:00',
      orarioFormattato: '08:00 - 20:00 (12h)',
      titoloCalendario: `12 ore - 08:00-20:00 - ${postazione}`,
      isNotturno: false,
      isRiposo: false,
      daVerificare: false,
      statoLettura: 'CONFERMATO',
    };
  }

  // Codice S o SM: Smonto notte
  if (c === 'S' || c === 'SM' || c === 'SMN' || c.includes('SMONT')) {
    return {
      tipo: 'SMONTE_NOTTE',
      significatoCodice: 'Smonto',
      durataOre: 0,
      orarioFormattato: 'Smonto notte',
      titoloCalendario: 'Smonto',
      isNotturno: false,
      isRiposo: true,
      daVerificare: false,
      statoLettura: 'CONFERMATO',
    };
  }

  // Codice R: Riposo settimanale
  if (c === 'R' || c === 'RIP' || c.includes('RIPOS')) {
    return {
      tipo: 'RIPOSO',
      significatoCodice: 'Riposo',
      durataOre: 0,
      orarioFormattato: 'Riposo',
      titoloCalendario: 'Riposo',
      isNotturno: false,
      isRiposo: true,
      daVerificare: false,
      statoLettura: 'CONFERMATO',
    };
  }

  // Codice F: Ferie
  if (c === 'F' || c === 'FER' || c.includes('FERI')) {
    return {
      tipo: 'FERIE',
      significatoCodice: 'Ferie',
      durataOre: 0,
      orarioFormattato: 'Ferie',
      titoloCalendario: 'Ferie',
      isNotturno: false,
      isRiposo: true,
      daVerificare: false,
      statoLettura: 'CONFERMATO',
    };
  }

  // Codice VUOTO o Cella vuota
  if (c === '' || c === 'VUOTO' || c === '-' || c === '/') {
    return {
      tipo: 'RIPOSO',
      significatoCodice: 'Cella vuota',
      durataOre: 0,
      orarioFormattato: 'Non pianificato (vuoto)',
      titoloCalendario: 'Non pianificato',
      isNotturno: false,
      isRiposo: true,
      daVerificare: false,
      statoLettura: 'CELLA_VUOTA',
    };
  }

  // Altri codici non configurati esplicitamente: preserva esattamente come letto e imposta DA_VERIFICARE
  return {
    tipo: 'ALTRO',
    significatoCodice: 'Codice da verificare',
    durataOre: 0,
    orarioFormattato: `Codice: ${code}`,
    titoloCalendario: `Turno ${code} - ${postazione}`,
    isNotturno: false,
    isRiposo: false,
    daVerificare: true,
    statoLettura: 'DA_VERIFICARE',
  };
}

/**
 * Extracts raw digital text from PDF buffer using local PDFParse
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const res = await parser.getText();
    return res.text || '';
  } catch (err: any) {
    console.warn('Local PDFParse text extraction error:', err?.message);
    return '';
  }
}

/**
 * Helper to call Gemini with automatic fallback for high-demand spikes
 */
async function callGemini(contents: any[]): Promise<string> {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
      },
    });
    return res.text?.trim() || '';
  } catch (err: any) {
    console.warn('Gemini 3.8-flash spike, trying gemini-3.1-flash-lite fallback...', err?.message);
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents,
      config: {
        responseMimeType: 'application/json',
      },
    });
    return res.text?.trim() || '';
  }
}

/**
 * Parses monthly schedule from PDF or image files
 */
export async function parseShiftScheduleFromFiles(options: {
  files: ParseFileInput[];
  employee: EmployeeTarget;
  selectedCandidateIndex?: number;
}): Promise<ShiftParseResult> {
  const { files, employee, selectedCandidateIndex } = options;

  if (!files || files.length === 0) {
    return {
      success: false,
      message: 'Nessun file fornito per l\'elaborazione turni.',
    };
  }

  // Calculate composite SHA-256 hash
  const hashSum = crypto.createHash('sha256');
  for (const f of files) {
    hashSum.update(f.buffer);
  }
  const sha256Hash = hashSum.digest('hex');

  const primaryFile = files[0];
  const isPdf = primaryFile.fileName.toLowerCase().endsWith('.pdf') || primaryFile.mimeType === 'application/pdf';
  const fileType: 'PDF_DIGITALE' | 'PDF_SCANSIONE' | 'IMMAGINE' = isPdf ? 'PDF_DIGITALE' : 'IMMAGINE';

  // Extract raw text locally if digital PDF
  let localPdfText = '';
  if (isPdf) {
    localPdfText = await extractTextFromPdf(primaryFile.buffer);
  }

  // Prepare Gemini multimodal prompt
  const cleanCognome = employee.cognome.trim().toUpperCase();
  const cleanNome = employee.nome.trim().toUpperCase();
  const cleanMatricola = employee.matricola.trim();
  const cleanPostazione = employee.postazione || 'Taranto Centro - Postazione 118';

  const systemPrompt = `
Sei il motore di elaborazione ufficiale per i prospetti mensili turni S.E.T. 118 Sanitaservice ASL Taranto.
Devi analizzare la tabella del documento caricato (PDF o scansione/immagine) ed estrarre RIGOROSAMENTE e FEDELMENTE i turni del dipendente autenticato.

DIPENDENTE DA INDIVIDUARE:
- Cognome: "${cleanCognome}"
- Nome: "${cleanNome}"
- Matricola: "${cleanMatricola}"
- Postazione predefinita: "${cleanPostazione}"

${
  typeof selectedCandidateIndex === 'number'
    ? `NOTA: L'utente ha selezionato esplicitamente la riga con indice candidato ${selectedCandidateIndex}. Estrai esclusivamente quella riga.`
    : ''
}

STRUTTURA DEL DOCUMENTO DA RISPETTARE:
1. INTESTAZIONE:
   - Contiene il mese, l'anno e la postazione/sede (es. "Mese di Ottobre 2026", postazione indicata in testata).
   - Contiene i giorni del mese (da 1 a 28/29/30/31) e i giorni della settimana (Lun, Mar, Mer, Gio, Ven, Sab, Dom).
2. DUE SEZIONI DISTINTE DI PERSONALE:
   - Il documento organizza il personale in due sezioni distinte (es. "Autisti Soccorritori" e "Soccorritori", o Sezione 1 e Sezione 2).
   - Identifica a quale delle due sezioni appartiene la riga del dipendente cercato e riporta il nome della sezione in "sezionePersonale".
3. RIGA DEL DIPENDENTE:
   - Ciascuna riga contiene il cognome dell'operatore, le celle giornaliere dal giorno 1 alla fine del mese, ed eventuali annotazioni.
   - Leggi TUTTE le celle della riga del dipendente, dalla prima data (1) all'ultima (28, 29, 30 o 31), SENZA SALTARNE NESSUNA.
4. COLONNA FINALE "TOT":
   - Al termine della riga del dipendente è presente una colonna "TOT" che indica il totale ufficiale delle ore previste nel documento per quel lavoratore.
   - Estrai con precisione il numero presente in questa colonna e riportalo nel campo "totaleOrePdf" (es. 168, 156, ecc.). Se non presente o illeggibile, lascia null.

LEGENDA AZIENDALE OBBLIGATORIA:
Applica esclusivamente i seguenti codici standard quando leggibili con certezza:
- "1" = Turno mattina (ordinario, 08:00 - 14:00, durata 6 ore)
- "2" = Turno pomeriggio (ordinario, 14:00 - 20:00, durata 6 ore)
- "3" = Turno notte (ordinario, 20:00 - 08:00 giorno successivo, durata 12 ore)
- "12" = Turno di dodici ore (08:00 - 20:00, durata 12 ore)
- "S" o "SM" = Smonto notte (NON ignorare e NON trasformare in vuoto: è uno smonto a tutti gli effetti, durata 0 ore)
- "R" = Riposo (NON ignorare e NON trasformare in vuoto: è un riposo programmato, durata 0 ore)

ALTRI CODICI, CELLE VUOTE O ANNOTAZIONI:
- Se la cella è realmente vuota/bianca nel foglio, imposta "codiceLetto": "VUOTO", "statoLettura": "CELLA_VUOTA".
- Se la cella contiene altri codici (es. "F" ferie, permessi, congedi, sostituzioni, numeri diversi o testo), estrailo esattamente come scritto in "codiceLetto", imposta "statoLettura": "DA_VERIFICARE" e "daVerificare": true. NON inventare significati non definiti nella legenda.
- Se una cella è colorata, evidenziata o ha una nota, segnala il colore in "coloreCella" e la nota in "annotazione".

REGOLE RIGOROSE:
- PRIVACY ASSOLUTA: Estrai e restituisci SOLO i turni dell'operatore cercato. È tassativamente vietato mostrare o restituire dati o turni degli altri colleghi.
- NESSUNA INVENZIONE: Non ricostruire turni secondo schemi presunti (es. rotazioni teoriche 1-2-3-S-R). Se una cella non è chiaramente leggibile o è tagliata, imposta "daVerificare": true e "motivoVerifica".
- SE IL DOCUMENTO È SFOCATO, TAGLIATO O ILLEGGIBILE: imposta "immagineNonLeggibile": true e spiega il motivo in "motivoIllegibile".

SCHEMA JSON OBBLIGATORIO DA RESTITUIRE:
{
  "immagineNonLeggibile": false,
  "motivoIllegibile": "",
  "dipendenteTrovato": true,
  "haOmonimie": false,
  "candidatiTrovati": [
    {
      "nomeCompleto": "ROSSI MARIO",
      "cognome": "ROSSI",
      "nome": "MARIO",
      "matricola": "0000001850",
      "sezione": "Autisti Soccorritori",
      "rigaIndice": 0,
      "confidenza": "ALTA",
      "dettagli": "Autista Soccorritore - Taranto Centro"
    }
  ],
  "candidatoSelezionato": "ROSSI MARIO",
  "sezionePersonale": "Autisti Soccorritori",
  "motivoNonTrovato": "",
  "mese": 10,
  "anno": 2026,
  "nomeMese": "Ottobre 2026",
  "postazioneGlobale": "Taranto Centro - Postazione 118",
  "totaleOrePdf": 168,
  "turni": [
    {
      "giornoNumero": 1,
      "giornoSettimana": "Gio",
      "codiceLetto": "1",
      "coloreCella": "",
      "annotazione": "",
      "statoLettura": "CONFERMATO",
      "daVerificare": false,
      "motivoVerifica": ""
    }
  ],
  "noteEstrazione": ""
}
`;

  const contents: any[] = [];
  contents.push(systemPrompt);

  if (localPdfText && localPdfText.length > 50) {
    contents.push(`TESTO DIGITALE ESTRATTO DALLA TABELLA DEL PDF:\n${localPdfText.substring(0, 15000)}`);
  }

  // Attach files as inline data
  for (const f of files) {
    const mime = f.mimeType || (f.fileName.endsWith('.pdf') ? 'application/pdf' : 'image/png');
    contents.push({
      inlineData: {
        data: f.buffer.toString('base64'),
        mimeType: mime,
      },
    });
  }

  try {
    const jsonStr = await callGemini(contents);
    if (!jsonStr) {
      throw new Error('Nessuna risposta strutturata dal motore di estrazione.');
    }

    const parsed = JSON.parse(jsonStr);

    // Case 0: Document/Image is blurry, cropped, tilted or illegible
    if (parsed.immagineNonLeggibile) {
      return {
        success: false,
        legibilityIssue: true,
        message:
          parsed.motivoIllegibile ||
          "Il documento o immagine caricata risulta sfocata, tagliata o poco nitida. Scatta una nuova foto a fuoco dall'alto con buona illuminazione oppure carica il file PDF originale.",
      };
    }

    // Case 1: Employee not found in schedule
    if (!parsed.dipendenteTrovato) {
      return {
        success: false,
        notFound: true,
        message:
          parsed.motivoNonTrovato ||
          `Nessun turno individuato per il dipendente "${cleanCognome} ${cleanNome}" (Matr. ${cleanMatricola}). Verifica che il prospetto contenga la tua postazione o che il cognome nel documento non sia abbreviato.`,
      };
    }

    // Case 2: Homonyms detected and no candidate was preselected by user
    if (
      parsed.haOmonimie &&
      Array.isArray(parsed.candidatiTrovati) &&
      parsed.candidatiTrovati.length > 1 &&
      typeof selectedCandidateIndex !== 'number'
    ) {
      return {
        success: true,
        needsCandidateSelection: true,
        candidates: parsed.candidatiTrovati,
        message: `Sono stati individuati ${parsed.candidatiTrovati.length} operatori con cognome "${cleanCognome}". Seleziona la tua riga per confermare l'importazione corretta.`,
      };
    }

    // Normalize shifts and check complete row
    const rawShifts: any[] = Array.isArray(parsed.turni) ? parsed.turni : [];
    const mese = Number(parsed.mese) || new Date().getMonth() + 1;
    const anno = Number(parsed.anno) || new Date().getFullYear();
    const nomeMese = parsed.nomeMese || `${mese}/${anno}`;
    const postazioneRilevata = parsed.postazioneGlobale || cleanPostazione;
    const sezionePersonale = parsed.sezionePersonale || 'Personale S.E.T. 118';

    // Exact days in month (28, 29, 30 or 31)
    const daysInMonth = new Date(anno, mese, 0).getDate();
    const normalizedShifts: ImportedShiftRecord[] = [];

    // Italian weekday names
    const weekdays = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

    let calculatedTotalHours = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const existing = rawShifts.find((s) => Number(s.giornoNumero) === day);

      const dayStr = String(day).padStart(2, '0');
      const monthStr = String(mese).padStart(2, '0');
      const dateIso = `${anno}-${monthStr}-${dayStr}`;
      const dObj = new Date(anno, mese - 1, day);
      const computedWeekday = weekdays[dObj.getDay()];

      if (existing) {
        const rawCode = (existing.codiceLetto || existing.codiceTurno || '').trim();
        const std = inferStandard118Times(rawCode, postazioneRilevata);

        const statoLettura = existing.statoLettura || std.statoLettura;
        const daVerificare = Boolean(existing.daVerificare || std.daVerificare);
        const durataOre = typeof existing.durataOre === 'number' ? existing.durataOre : std.durataOre;

        calculatedTotalHours += durataOre;

        normalizedShifts.push({
          id: `shift-${anno}${monthStr}${dayStr}-${day}`,
          data: dateIso,
          giornoSettimana: existing.giornoSettimana || computedWeekday,
          giornoNumero: day,
          codiceTurno: rawCode || 'R',
          significatoCodice: existing.significatoCodice || std.significatoCodice,
          durataOre,
          tipoCategoria: std.tipo,
          orarioInizio: std.orarioInizio,
          orarioFine: std.orarioFine,
          orarioFormattato: std.orarioFormattato,
          isNotturno: std.isNotturno,
          isRiposo: std.isRiposo,
          isReperibilita: false,
          sezionePersonale,
          mansione: sezionePersonale,
          postazione: postazioneRilevata,
          veicolo: existing.veicolo || undefined,
          coloreCella: existing.coloreCella || undefined,
          annotazioni: existing.annotazione || existing.annotazioni || '',
          statoLettura,
          daVerificare,
          motivoVerifica: existing.motivoVerifica || (daVerificare ? 'Codice non standard o incerto' : undefined),
        });
      } else {
        // Missing day in extraction: flag as DA_VERIFICARE so no date remains uninspected!
        normalizedShifts.push({
          id: `shift-${anno}${monthStr}${dayStr}-${day}`,
          data: dateIso,
          giornoSettimana: computedWeekday,
          giornoNumero: day,
          codiceTurno: 'DA_VERIFICARE',
          significatoCodice: 'Cella non letta dal documento',
          durataOre: 0,
          tipoCategoria: 'ALTRO',
          orarioFormattato: 'Da verificare',
          isNotturno: false,
          isRiposo: false,
          isReperibilita: false,
          sezionePersonale,
          mansione: sezionePersonale,
          postazione: postazioneRilevata,
          statoLettura: 'DA_VERIFICARE',
          daVerificare: true,
          motivoVerifica: 'Nessun dato estratto per questo giorno nel PDF: controllare la riga',
        });
      }
    }

    // Totals calculations
    const workingShifts = normalizedShifts.filter((s) => !s.isRiposo && s.tipoCategoria !== 'RIPOSO' && s.tipoCategoria !== 'FERIE' && s.durataOre && s.durataOre > 0);
    const riposi = normalizedShifts.filter((s) => s.isRiposo || s.codiceTurno === 'R' || s.codiceTurno === 'S');

    // Official total hours from PDF column "TOT"
    const totaleOrePdf = typeof parsed.totaleOrePdf === 'number' && !isNaN(parsed.totaleOrePdf) ? parsed.totaleOrePdf : undefined;
    const discrepanzaOre = totaleOrePdf !== undefined && totaleOrePdf !== calculatedTotalHours;
    const differenzaOre = totaleOrePdf !== undefined ? calculatedTotalHours - totaleOrePdf : 0;

    // If there is discrepancy, flag candidate cells that could be responsible
    if (discrepanzaOre) {
      for (const shift of normalizedShifts) {
        if (shift.daVerificare || shift.tipoCategoria === 'ALTRO' || shift.coloreCella) {
          shift.differenzaOrePotenziale = true;
        }
      }
    }

    const planId = `plan-${anno}-${String(mese).padStart(2, '0')}-${employee.matricola}`;

    const plan: ShiftImportPlan = {
      id: planId,
      matricola: employee.matricola,
      mese,
      anno,
      nomeMese,
      sezionePersonale,
      sourceFileName: primaryFile.fileName,
      sourceFileType: fileType,
      isPreservedInArchive: false,
      sha256Hash,
      dataCaricamento: new Date().toISOString(),
      statoConferma: 'BOZZA_DA_CONFERMARE',
      totaleTurniLavorativi: workingShifts.length,
      totaleOreStimate: calculatedTotalHours,
      totaleOrePdfDocumento: totaleOrePdf,
      totaleOreCalcolate: calculatedTotalHours,
      discrepanzaOre,
      differenzaOre,
      totaleRiposi: riposi.length,
      postazioneRilevata,
      shifts: normalizedShifts,
      candidatiOmonimi: parsed.candidatiTrovati,
      candidatoSelezionato: parsed.candidatoSelezionato || `${cleanCognome} ${cleanNome}`,
      regoleOreConfigurate: {
        oreTurno1: 6,
        oreTurno2: 6,
        oreTurno3: 12,
        oreTurno12: 12,
      },
      noteEstrazione: parsed.noteEstrazione || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let msg = `Pianificazione per ${nomeMese} estratta: ${normalizedShifts.length} giorni elaborati (${workingShifts.length} turni lavorativi).`;
    if (discrepanzaOre) {
      msg += ` ATTENZIONE: le ore calcolate (${calculatedTotalHours}h) non coincidono con la colonna TOT del PDF (${totaleOrePdf}h). Verificare le celle evidenziate.`;
    }

    return {
      success: true,
      plan,
      needsCandidateSelection: false,
      message: msg,
      warning: discrepanzaOre ? `Scostamento di ${differenzaOre > 0 ? `+${differenzaOre}` : differenzaOre}h rispetto alla colonna TOT del documento` : undefined,
    };
  } catch (err: any) {
    console.error('Error during schedule AI parsing:', err);
    return {
      success: false,
      message: `Errore durante la lettura del documento turni: ${err?.message || 'Formato non interpretabile'}. Verifica la nitidezza dell'immagine o del PDF.`,
    };
  }
}
