import {
  OvertimeRateConfig,
  SeparateAllowancesConfig,
  OvertimeRateType,
  OvertimeCompensationRecord,
  OvertimePaymentStatus,
  SeparateAllowanceRecord,
} from '../types';

export const DEFAULT_OVERTIME_RATE_CONFIG: OvertimeRateConfig = {
  ccnl: 'AIOP–ARIS, codice CNEL T011',
  pagaOrariaBase: 11.56160,
  maggiorazioneDiurnoFeriale: 20,
  maggiorazioneNotturnoFestivo: 30,
  maggiorazioneNotturnoEFestivo: 50,
  aliquotaTrattenuteMedia: 25, // Percentuale facoltativa modificabile per stima netto
  noteContrattuali: 'Configurazione iniziale parametrabile su CCNL Sanità Privata AIOP-ARIS (T011). Da verificare e confermare in base a livello contrattuale e accordi integrativi.',
};

export const DEFAULT_ALLOWANCES_CONFIG: SeparateAllowancesConfig = {
  turnoNotturnoOrdinario: 2.74, // €/ora
  indennitaFestivaIntera: 17.82, // €/evento
  indennitaFestivaRidotta: 8.91, // €/evento
  indennitaTreTurni: 4.50, // €/giornata
};

export const OVERTIME_TYPE_DEFINITIONS: Record<
  OvertimeRateType,
  {
    label: string;
    description: string;
    defaultRateKey: keyof Pick<
      OvertimeRateConfig,
      'maggiorazioneDiurnoFeriale' | 'maggiorazioneNotturnoFestivo' | 'maggiorazioneNotturnoEFestivo'
    >;
  }
> = {
  DIURNO_FERIALE: {
    label: 'Diurno Feriale (+20%)',
    description: 'Straordinario prestato in orario diurno durante i giorni lavorativi feriali',
    defaultRateKey: 'maggiorazioneDiurnoFeriale',
  },
  NOTTURNO_O_FESTIVO: {
    label: 'Notturno oppure Festivo (+30%)',
    description: 'Straordinario prestato in orario notturno feriale o in giornata festiva diurna',
    defaultRateKey: 'maggiorazioneNotturnoFestivo',
  },
  NOTTURNO_E_FESTIVO: {
    label: 'Notturno e Festivo Insieme (+50%)',
    description: 'Straordinario prestato contestualmente in orario notturno e durante giornata festiva',
    defaultRateKey: 'maggiorazioneNotturnoEFestivo',
  },
  PERSONALIZZATO: {
    label: 'Percentuale Personalizzata',
    description: 'Maggiorazione contrattuale concordata su base aziendale',
    defaultRateKey: 'maggiorazioneDiurnoFeriale',
  },
};

/**
 * Converte ore e minuti in ore decimali esatte.
 * Es: 1 ora e 30 minuti = 1.5 ore
 */
export function convertToDecimalHours(ore: number, minuti: number): number {
  const safeHours = Math.max(0, Number(ore) || 0);
  const safeMins = Math.max(0, Number(minuti) || 0);
  return safeHours + safeMins / 60;
}

/**
 * Arrotonda un importo a due cifre decimali senza perdere precisione intermedia.
 */
export function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Calcola il compenso lordo aggiuntivo per lo straordinario:
 * Formula: compensoCompletoLordo = ore × pagaOrariaBase × (1 + maggiorazione / 100)
 * Sola maggiorazione: solaMaggiorazione = ore × pagaOrariaBase × (maggiorazione / 100)
 *
 * Test di riferimento confermato:
 * 10 ore × 11.56160 € × 1.20 = 138.7392 € -> 138.74 € lordi.
 */
export function calculateOvertimePay(params: {
  oreDecimali: number;
  pagaOrariaBase: number;
  maggiorazionePercentuale: number;
}) {
  const { oreDecimali, pagaOrariaBase, maggiorazionePercentuale } = params;
  const rateMultiplier = maggiorazionePercentuale / 100;

  // Calcolo con precisione completa
  const rawCompleto = oreDecimali * pagaOrariaBase * (1 + rateMultiplier);
  const rawMaggiorazione = oreDecimali * pagaOrariaBase * rateMultiplier;

  return {
    compensoCompletoLordo: roundCurrency(rawCompleto),
    solaMaggiorazioneLordi: roundCurrency(rawMaggiorazione),
    compensoCompletoRaw: rawCompleto,
    solaMaggiorazioneRaw: rawMaggiorazione,
  };
}

/**
 * Stima del netto basata ESCLUSIVAMENTE sulla percentuale inserita dall'utente.
 */
export function calculateNetEstimate(
  lordo: number,
  aliquotaTrattenutePercentuale?: number
): {
  nettoStimato: number;
  trattenute: number;
  aliquotaApplicata: number;
} | null {
  if (aliquotaTrattenutePercentuale === undefined || aliquotaTrattenutePercentuale === null || isNaN(aliquotaTrattenutePercentuale) || aliquotaTrattenutePercentuale <= 0) {
    return null;
  }
  const trattenute = roundCurrency(lordo * (aliquotaTrattenutePercentuale / 100));
  const nettoStimato = Math.max(0, roundCurrency(lordo - trattenute));
  return {
    nettoStimato,
    trattenute,
    aliquotaApplicata: aliquotaTrattenutePercentuale,
  };
}

/**
 * Formatta valuta in formato italiano: 138,74 €
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

/**
 * Formatta ore e minuti in stringa leggibile: es. "1h 30m" (1.50h)
 */
export function formatDecimalHours(hours: number): string {
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Genera il mese successivo di default come previsione pagamento (es. lavorato "2026-09" -> pagamento "2026-10")
 */
export function getDefaultPaymentMonth(workedMonth: string): string {
  if (!workedMonth || !workedMonth.includes('-')) {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
  }
  const [yStr, mStr] = workedMonth.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (m === 12) {
    return `${y + 1}-01`;
  }
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * Formatta mese in italiano: "2026-09" -> "Settembre 2026"
 */
export function formatMonthYear(monthStr: string): string {
  if (!monthStr || !monthStr.includes('-')) return monthStr || 'Mese Corrente';
  const [yStr, mStr] = monthStr.split('-');
  const months = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
  ];
  const mIndex = parseInt(mStr, 10) - 1;
  return `${months[mIndex] || ''} ${yStr}`.trim();
}
