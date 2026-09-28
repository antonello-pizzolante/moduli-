import { MonthlySheet, OvertimeEntry } from '../types';

/**
 * Utility per l'esportazione dei dati del registro in formato CSV (RFC 4180 compatibile)
 * Utilizza il separatore punto e virgola ';' (standard europeo / Excel Italia)
 * e include il Byte Order Mark (BOM) UTF-8 per la perfetta visualizzazione
 * di caratteri accentati (es. "Straordinario", "ASL Taranto", "Accettazione")
 * su Microsoft Excel, LibreOffice Calc, Apple Numbers e Google Sheets.
 */

function escapeCsvField(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const stringVal = String(val).trim();
  // Se contiene ';' o '"' o caratteri di a capo, racchiudi tra virgolette doppie e raddoppia le virgolette interne
  if (stringVal.includes(';') || stringVal.includes('"') || stringVal.includes('\n') || stringVal.includes('\r')) {
    return `"${stringVal.replace(/"/g, '""')}"`;
  }
  return stringVal;
}

/**
 * Genera il contenuto CSV completo per un singolo foglio mensile
 */
export function generateSheetCsvContent(sheet: MonthlySheet): string {
  const dip = sheet.dipendente || {
    nome: '',
    cognome: '',
    matricola: '',
    postazione: '',
    qualifica: '',
  };

  const lines: string[] = [];

  // Intestazione Amministrativa Metadati
  lines.push('# =========================================================================');
  lines.push('# REGISTRO PRESTAZIONI ORARIE ECCEDENTI E MONTE ORE - S.E.T. 118');
  lines.push('# Sanitaservice ASL TA s.r.l. Unipersonale');
  lines.push('# Modello Ufficiale Trasmissione Mensile');
  lines.push('# =========================================================================');
  lines.push(`# Dipendente;${escapeCsvField(`${dip.cognome || ''} ${dip.nome || ''}`.trim())}`);
  lines.push(`# Matricola;${escapeCsvField(dip.matricola || '')}`);
  lines.push(`# Qualifica;${escapeCsvField(dip.qualifica || 'Autista Soccorritore 118')}`);
  lines.push(`# Postazione di Servizio;${escapeCsvField(dip.postazione || 'Taranto Sud - Postazione 118')}`);
  lines.push(`# Mese e Anno di Riferimento;${escapeCsvField(sheet.nomeMese)}`);
  lines.push(`# Totale Straordinario (Busta Paga);${escapeCsvField(sheet.totaleOreStraordinarioFormatted || '0h 00m')} (${((sheet.totaleMinutiStraordinario || 0) / 60).toFixed(2)} ore decimali)`);
  lines.push(`# Totale Monte Ore (Riposi Compensativi);${escapeCsvField(sheet.totaleOreMonteOreFormatted || '0h 00m')} (${((sheet.totaleMinutiMonteOre || 0) / 60).toFixed(2)} ore decimali)`);
  lines.push(`# Totale Ore Complessivo Mese;${escapeCsvField(sheet.totaleOreComplessivoFormatted || '0h 00m')} (${((sheet.totaleMinutiComplessivo || 0) / 60).toFixed(2)} ore decimali)`);
  lines.push(`# Stato Foglio;${escapeCsvField(sheet.status === 'INVIATO_PEC' ? 'INVIATO TRAMITE PEC' : sheet.status)}`);
  lines.push(`# Data Generazione Backup CSV;${escapeCsvField(new Date().toLocaleString('it-IT'))}`);
  lines.push('# =========================================================================');
  lines.push('');

  // Intestazione Colonne Dati
  const headers = [
    'Giorno',
    'Data Completa',
    'Tipo Turno Ordinario',
    'Orario Servizio Ordinario',
    'Orario Prestazione Straordinaria',
    'Minuti Effettuati',
    'Ore Decimali',
    'Ore Monte Ore',
    'Ore Straordinario',
    'Destinazione Eccedenza',
    'Motivo Dettagliato dello Straordinario / Emergenza 118',
    'Firma / Stato Autorizzazione',
  ];
  lines.push(headers.join(';'));

  // Righe Dati Turni
  const entries = sheet.entries || [];
  if (entries.length === 0) {
    // Nessun turno inserito ancora: riga informativa neutra
    lines.push(
      [
        '-',
        '-',
        '-',
        '-',
        '-',
        '0',
        '0,00',
        '0h 00m',
        '0h 00m',
        'NESSUN TURNO REGISTRATO (FOGLIO PULITO)',
        '-',
        '-',
      ].join(';')
    );
  } else {
    // Ordina per giorno
    const sortedEntries = [...entries].sort((a, b) => {
      const dayA = parseInt(a.giorno.split('/')[0], 10) || 0;
      const dayB = parseInt(b.giorno.split('/')[0], 10) || 0;
      return dayA - dayB;
    });

    sortedEntries.forEach((entry) => {
      const parts = entry.giorno.split('/');
      const dayNum = parts[0] || '';
      const oreDecString = (entry.oreDecimali || (entry.minutiEffettuati / 60)).toFixed(2).replace('.', ',');

      const row = [
        escapeCsvField(dayNum),
        escapeCsvField(entry.giorno),
        escapeCsvField(entry.turnoType),
        escapeCsvField(entry.orarioOrdinario),
        escapeCsvField(entry.orarioStraordinario),
        escapeCsvField(entry.minutiEffettuati),
        escapeCsvField(oreDecString),
        escapeCsvField(entry.totaleOreMonteOre || '-'),
        escapeCsvField(entry.totaleOreStraordinario || '-'),
        escapeCsvField(entry.tipoDestinazione === 'MONTE_ORE' ? 'MONTE ORE (Riposo)' : 'STRAORDINARIO (Liquidazione)'),
        escapeCsvField(entry.motivo),
        escapeCsvField(entry.firmaCoordinatore || 'Autorizzato'),
      ];
      lines.push(row.join(';'));
    });
  }

  // Riga di Riepilogo Totali
  lines.push('');
  const totMinuti = sheet.totaleMinutiComplessivo || 0;
  const totOreDec = (totMinuti / 60).toFixed(2).replace('.', ',');
  const summaryRow = [
    'TOTALE MESE',
    '',
    '',
    '',
    '',
    escapeCsvField(totMinuti),
    escapeCsvField(totOreDec),
    escapeCsvField(sheet.totaleOreMonteOreFormatted || '0h 00m'),
    escapeCsvField(sheet.totaleOreStraordinarioFormatted || '0h 00m'),
    escapeCsvField(`Tot. Generale: ${sheet.totaleOreComplessivoFormatted || '0h 00m'}`),
    '',
    '',
  ];
  lines.push(summaryRow.join(';'));

  return lines.join('\r\n');
}

/**
 * Avvia il download nel browser del file CSV per il foglio mensile
 */
export function downloadSheetCsv(sheet: MonthlySheet): void {
  const content = generateSheetCsvContent(sheet);
  // Byte Order Mark (BOM) UTF-8: \uFEFF assicura che Excel apra correttamente caratteri speciali e accenti italiani
  const blob = new Blob(['\uFEFF' + content], {
    type: 'text/csv;charset=utf-8;',
  });

  const dipName = (sheet.dipendente?.cognome || 'Dipendente')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const monthStr = String(sheet.mese).padStart(2, '0');
  const fileName = `Registro_118_Sanitaservice_${sheet.anno}_${monthStr}_${dipName}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Esporta tutti i fogli storici presenti in un unico file CSV riepilogativo per backup completo offline
 */
export function downloadAllSheetsCsv(sheets: MonthlySheet[]): void {
  const lines: string[] = [];

  lines.push('# =========================================================================');
  lines.push('# BACKUP GLOBALE REGISTRI STRAORDINARI E BANCA ORE S.E.T. 118');
  lines.push('# Sanitaservice ASL TA s.r.l. Unipersonale');
  lines.push(`# Totale Mesi Archiviati: ${sheets.length}`);
  lines.push(`# Data Esportazione: ${new Date().toLocaleString('it-IT')}`);
  lines.push('# =========================================================================');
  lines.push('');

  const headers = [
    'ID Mese',
    'Anno',
    'Mese',
    'Nome Mese',
    'Cognome Dipendente',
    'Nome Dipendente',
    'Matricola',
    'Postazione',
    'Giorno',
    'Data Completa',
    'Tipo Turno',
    'Orario Ordinario',
    'Orario Straordinario',
    'Minuti',
    'Ore Decimali',
    'Monte Ore Formattato',
    'Straordinario Formattato',
    'Destinazione',
    'Motivo Servizio',
    'Firma Coordinatore',
    'Stato Mese',
  ];
  lines.push(headers.join(';'));

  sheets.forEach((sheet) => {
    const dip = sheet.dipendente || {
      nome: '',
      cognome: '',
      matricola: '',
      postazione: '',
      qualifica: '',
    };
    const entries = sheet.entries || [];

    if (entries.length === 0) {
      lines.push(
        [
          escapeCsvField(sheet.id),
          escapeCsvField(sheet.anno),
          escapeCsvField(sheet.mese),
          escapeCsvField(sheet.nomeMese),
          escapeCsvField(dip.cognome),
          escapeCsvField(dip.nome),
          escapeCsvField(dip.matricola),
          escapeCsvField(dip.postazione),
          '-',
          '-',
          '-',
          '-',
          '-',
          '0',
          '0,00',
          escapeCsvField(sheet.totaleOreMonteOreFormatted || '0h 00m'),
          escapeCsvField(sheet.totaleOreStraordinarioFormatted || '0h 00m'),
          'FOGLIO VUOTO',
          '-',
          '-',
          escapeCsvField(sheet.status),
        ].join(';')
      );
    } else {
      entries.forEach((e) => {
        const oreDec = (e.oreDecimali || e.minutiEffettuati / 60).toFixed(2).replace('.', ',');
        lines.push(
          [
            escapeCsvField(sheet.id),
            escapeCsvField(sheet.anno),
            escapeCsvField(sheet.mese),
            escapeCsvField(sheet.nomeMese),
            escapeCsvField(dip.cognome),
            escapeCsvField(dip.nome),
            escapeCsvField(dip.matricola),
            escapeCsvField(dip.postazione),
            escapeCsvField(e.giorno.split('/')[0] || ''),
            escapeCsvField(e.giorno),
            escapeCsvField(e.turnoType),
            escapeCsvField(e.orarioOrdinario),
            escapeCsvField(e.orarioStraordinario),
            escapeCsvField(e.minutiEffettuati),
            escapeCsvField(oreDec),
            escapeCsvField(e.totaleOreMonteOre || '-'),
            escapeCsvField(e.totaleOreStraordinario || '-'),
            escapeCsvField(e.tipoDestinazione),
            escapeCsvField(e.motivo),
            escapeCsvField(e.firmaCoordinatore || 'Autorizzato'),
            escapeCsvField(sheet.status),
          ].join(';')
        );
      });
    }
  });

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });

  const fileName = `Backup_Completo_118_Sanitaservice_${new Date().toISOString().split('T')[0]}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
