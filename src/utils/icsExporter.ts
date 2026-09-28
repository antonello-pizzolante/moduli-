import { ShiftImportPlan, ImportedShiftRecord } from '../types';

/**
 * Standard RFC 5545 iCalendar (.ics) Generator for Sanitaservice S.E.T. 118 Shifts
 * Compatible with Apple Calendar (iOS/macOS), Google Calendar (Android/Web), Microsoft Outlook, Samsung Calendar
 */

function padZero(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatIcsDateTime(dateStr: string, timeStr: string, isNextDay = false): string {
  // dateStr is YYYY-MM-DD, timeStr is HH:mm
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '08:00').split(':').map(Number);

  const dateObj = new Date(y, m - 1, d, hh, mm, 0);
  if (isNextDay) {
    dateObj.setDate(dateObj.getDate() + 1);
  }

  const resY = dateObj.getFullYear();
  const resM = padZero(dateObj.getMonth() + 1);
  const resD = padZero(dateObj.getDate());
  const resH = padZero(dateObj.getHours());
  const resMin = padZero(dateObj.getMinutes());

  return `${resY}${resM}${resD}T${resH}${resMin}00`;
}

function formatIcsDateOnly(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function escapeIcsText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Determines the official event title according to the mandatory operational template:
 * - Mattina - [postazione]
 * - Pomeriggio - [postazione]
 * - Notte - [postazione]
 * - 12 ore - 08:00-20:00 - [postazione]
 * - Smonto
 * - Riposo
 */
export function getIcsEventTitle(shift: ImportedShiftRecord, defaultPostazione: string): string {
  const postazione = shift.postazione || defaultPostazione || 'Postazione 118';
  const c = (shift.codiceTurno || '').trim().toUpperCase();

  if (c === '1' || c === 'M' || shift.tipoCategoria === 'MATTINA') {
    return `Mattina - ${postazione}`;
  }
  if (c === '2' || c === 'P' || shift.tipoCategoria === 'POMERIGGIO') {
    return `Pomeriggio - ${postazione}`;
  }
  if (c === '3' || c === 'N' || shift.tipoCategoria === 'NOTTE') {
    return `Notte - ${postazione}`;
  }
  if (c === '12' || shift.codiceTurno === '12') {
    return `12 ore - 08:00-20:00 - ${postazione}`;
  }
  if (c === 'S' || c === 'SM' || shift.tipoCategoria === 'SMONTE_NOTTE') {
    return 'Smonto';
  }
  if (c === 'R' || shift.tipoCategoria === 'RIPOSO') {
    return 'Riposo';
  }
  if (c === 'F' || shift.tipoCategoria === 'FERIE') {
    return 'Ferie';
  }
  return `${shift.significatoCodice || shift.codiceTurno || 'Turno'} - ${postazione}`;
}

export function generateIcsCalendar(
  plan: ShiftImportPlan,
  employeeFullName: string,
  includeRiposiAndSmonti = true
): string {
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${padZero(now.getUTCMonth() + 1)}${padZero(
    now.getUTCDate()
  )}T${padZero(now.getUTCHours())}${padZero(now.getUTCMinutes())}${padZero(now.getUTCSeconds())}Z`;

  const shiftsToExport = includeRiposiAndSmonti
    ? plan.shifts.filter((s) => s.codiceTurno !== 'VUOTO' && s.statoLettura !== 'CELLA_VUOTA')
    : plan.shifts.filter((s) => !s.isRiposo && s.tipoCategoria !== 'RIPOSO' && s.tipoCategoria !== 'FERIE');

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sanitaservice ASL TA S.E.T. 118//Turni Dipendente//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`Turni 118 - ${employeeFullName} (${plan.nomeMese})`)}`,
    'X-WR-TIMEZONE:Europe/Rome',
    'X-WR-CALDESC:Calendario turni operativi S.E.T. 118 Sanitaservice ASL Taranto',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Rome',
    'X-LIC-LOCATION:Europe/Rome',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  for (const shift of shiftsToExport) {
    const postazione = shift.postazione || plan.postazioneRilevata || 'S.E.T. 118 Taranto';
    const c = (shift.codiceTurno || '').trim().toUpperCase();
    const isSmontoOrRiposo = c === 'S' || c === 'SM' || c === 'R' || shift.isRiposo;
    const summary = getIcsEventTitle(shift, postazione);

    const uid = `turno-${shift.data.replace(/-/g, '')}-${plan.matricola}-${shift.id}@sanitaservice118.it`;

    const descriptionParts = [
      `Dipendente: ${employeeFullName} (Matr. ${plan.matricola})`,
      plan.sezionePersonale ? `Sezione: ${plan.sezionePersonale}` : null,
      `Codice Letto nel PDF: ${shift.codiceTurno}`,
      shift.significatoCodice ? `Significato: ${shift.significatoCodice}` : null,
      shift.durataOre !== undefined ? `Durata oraria: ${shift.durataOre} ore` : null,
      shift.orarioFormattato ? `Orario: ${shift.orarioFormattato}` : null,
      !isSmontoOrRiposo ? `Postazione: ${postazione}` : null,
      shift.veicolo ? `Mezzo / Postazione: ${shift.veicolo}` : null,
      shift.coloreCella ? `Colore cella nel documento: ${shift.coloreCella}` : null,
      shift.annotazioni ? `Note: ${shift.annotazioni}` : null,
      shift.daVerificare ? `⚠️ Attenzione: ${shift.motivoVerifica || 'Dato da verificare'}` : null,
      `Pianificazione: ${plan.nomeMese}`,
      `Documento di origine: ${plan.sourceFileName}`,
    ].filter(Boolean);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);

    if (isSmontoOrRiposo) {
      // All-day event for Smonto or Riposo
      const dtDate = formatIcsDateOnly(shift.data);
      lines.push(`DTSTART;VALUE=DATE:${dtDate}`);
      lines.push(`SUMMARY:${escapeIcsText(summary)}`);
      lines.push('TRANSP:TRANSPARENT'); // Non occupa disponibilità
      lines.push(`CATEGORIES:RIPOSO,S.E.T. 118`);
    } else {
      // Timed shift event
      let orarioInizio = shift.orarioInizio || '08:00';
      let orarioFine = shift.orarioFine || '14:00';
      if (c === '12') {
        orarioInizio = '08:00';
        orarioFine = '20:00';
      } else if (c === '3' || shift.isNotturno) {
        orarioInizio = '20:00';
        orarioFine = '08:00';
      }

      const isNightShift = shift.isNotturno || shift.tipoCategoria === 'NOTTE' || (orarioInizio > orarioFine);
      const dtStart = formatIcsDateTime(shift.data, orarioInizio, false);
      const dtEnd = formatIcsDateTime(shift.data, orarioFine, isNightShift);

      lines.push(`DTSTART;TZID=Europe/Rome:${dtStart}`);
      lines.push(`DTEND;TZID=Europe/Rome:${dtEnd}`);
      lines.push(`SUMMARY:${escapeIcsText(summary)}`);
      lines.push(`LOCATION:${escapeIcsText(postazione)}`);
      lines.push('TRANSP:OPAQUE');
      lines.push('CATEGORIES:LAVORO,S.E.T. 118,TURNI');
    }

    lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Downloads the .ics file directly into the device's browser
 */
export function downloadIcsFile(
  plan: ShiftImportPlan,
  employeeFullName: string,
  includeRiposiAndSmonti = true
): void {
  const icsData = generateIcsCalendar(plan, employeeFullName, includeRiposiAndSmonti);
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const cleanName = employeeFullName.trim().replace(/\s+/g, '_') || 'Dipendente';
  const cleanMonth = (plan.nomeMese || 'Mese').replace(/\s+/g, '_');
  const filename = `Turni_118_${cleanName}_${cleanMonth}.ics`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Native Mobile Export / Share using Web Share API
 * Proposes native calendar apps on Android / iOS
 */
export async function shareIcsFile(
  plan: ShiftImportPlan,
  employeeFullName: string,
  includeRiposiAndSmonti = true
): Promise<{ success: boolean; method: 'SHARE' | 'DOWNLOAD'; error?: string }> {
  const icsData = generateIcsCalendar(plan, employeeFullName, includeRiposiAndSmonti);
  const cleanName = employeeFullName.trim().replace(/\s+/g, '_') || 'Dipendente';
  const cleanMonth = (plan.nomeMese || 'Mese').replace(/\s+/g, '_');
  const filename = `Turni_118_${cleanName}_${cleanMonth}.ics`;

  const file = new File([icsData], filename, { type: 'text/calendar' });

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Turni S.E.T. 118 - ${plan.nomeMese}`,
        text: `Esporta pianificazione turni 118 di ${employeeFullName} (${plan.nomeMese}) nel tuo calendario`,
      });
      return { success: true, method: 'SHARE' };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, method: 'SHARE', error: 'Operazione annullata dall\'utente.' };
      }
      // Fallback to direct download
      downloadIcsFile(plan, employeeFullName, includeRiposiAndSmonti);
      return { success: true, method: 'DOWNLOAD' };
    }
  }

  // Desktop or browsers without file sharing: trigger direct standard .ics download
  downloadIcsFile(plan, employeeFullName, includeRiposiAndSmonti);
  return { success: true, method: 'DOWNLOAD' };
}
