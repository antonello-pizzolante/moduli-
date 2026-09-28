import { ShiftPreset } from '../types';

export const SHIFT_PRESETS: ShiftPreset[] = [
  {
    id: 'MATTINA',
    label: 'Mattina (08:00 - 14:00)',
    nomeTurno: 'Mattina',
    orarioOrdinario: '08:00 - 14:00',
    oreOrdinarie: 6,
    orarioInizio: '08:00',
    orarioFine: '14:00',
  },
  {
    id: 'POMERIGGIO',
    label: 'Pomeriggio (14:00 - 20:00)',
    nomeTurno: 'Pomeriggio',
    orarioOrdinario: '14:00 - 20:00',
    oreOrdinarie: 6,
    orarioInizio: '14:00',
    orarioFine: '20:00',
  },
  {
    id: 'NOTTE_12',
    label: 'Notte (20:00 - 08:00 · 12h)',
    nomeTurno: 'Notte (12 ore)',
    orarioOrdinario: '20:00 - 08:00',
    oreOrdinarie: 12,
    orarioInizio: '20:00',
    orarioFine: '08:00',
  },
  {
    id: 'NOTTE_6',
    label: 'Notte Breve (20:00 - 02:00 · 6h)',
    nomeTurno: 'Notte Breve',
    orarioOrdinario: '20:00 - 02:00',
    oreOrdinarie: 6,
    orarioInizio: '20:00',
    orarioFine: '02:00',
  },
  {
    id: 'DIURNO_12',
    label: 'Diurno Lungo (08:00 - 20:00 · 12h)',
    nomeTurno: 'Diurno 12h',
    orarioOrdinario: '08:00 - 20:00',
    oreOrdinarie: 12,
    orarioInizio: '08:00',
    orarioFine: '20:00',
  },
  {
    id: 'FUORI_TURNO',
    label: 'Fuori Turno / Chiamata Straordinaria',
    nomeTurno: 'Fuori Turno',
    orarioOrdinario: 'Smonto / Riposo',
    oreOrdinarie: 0,
    orarioInizio: '',
    orarioFine: '',
  },
];

export const MOTIVI_PRESET = [
  'Prolungamento soccorso emergenza 118 (Codice Rosso/Arancione)',
  'Attesa sosta barella e consegna paziente al Pronto Soccorso',
  'Sostituzione urgente collega assente turno successivo',
  'Intervento complesso maxi-emergenza territoriale',
  'Trasferimento secondario urgente / trasporto protetto',
  'Sanificazione straordinaria e ripristino presidi ambulanza',
  'Chiamata in reperibilità attiva su ordine di servizio',
];

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function minutesToTimeString(minutes: number): string {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function formatMinutesToHours(minutes: number): string {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) {
    return `${h}h 00m`;
  }
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function formatMinutesToDecimal(minutes: number): string {
  if (!minutes || minutes <= 0) return '0,00';
  const hours = (minutes / 60).toFixed(2);
  return hours.replace('.', ',');
}

export function calculateDifferenceMinutes(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  let start = parseTimeToMinutes(startStr);
  let end = parseTimeToMinutes(endStr);
  
  if (end < start) {
    // Crosses midnight
    end += 1440;
  }
  return end - start;
}

export function calculateEndTimeFromDuration(startStr: string, minutesDuration: number): string {
  if (!startStr) return '';
  const start = parseTimeToMinutes(startStr);
  const end = start + minutesDuration;
  return minutesToTimeString(end);
}

export function getItalianMonthName(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('it-IT', { month: 'long' }).toUpperCase();
}

export function formatDayDate(dateStr: string): string {
  if (!dateStr) return '';
  // if format is YYYY-MM-DD
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return dateStr;
}

export function getNextMonthFirstDay(currentYear: number, currentMonth: number): { date: Date; formatted: string } {
  let nextYear = currentYear;
  let nextMonth = currentMonth + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const date = new Date(nextYear, nextMonth - 1, 1, 8, 0, 0);
  const formatted = `1 ${date.toLocaleString('it-IT', { month: 'long' })} ${nextYear}`;
  return { date, formatted };
}
