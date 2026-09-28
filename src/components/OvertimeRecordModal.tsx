import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Calendar,
  DollarSign,
  AlertCircle,
  Check,
  Split,
  Plus,
  Trash2,
  HelpCircle,
  FileText,
} from 'lucide-react';
import {
  OvertimeCompensationRecord,
  OvertimeRateConfig,
  OvertimeRateType,
  OvertimePaymentStatus,
  MonthlySheet,
} from '../types';
import {
  convertToDecimalHours,
  calculateOvertimePay,
  formatCurrency,
  OVERTIME_TYPE_DEFINITIONS,
  getDefaultPaymentMonth,
} from '../utils/overtimeCalculator';

interface OvertimeRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveRecord: (records: Omit<OvertimeCompensationRecord, 'id' | 'createdAt' | 'updatedAt'>[]) => void;
  editingRecord?: OvertimeCompensationRecord | null;
  config: OvertimeRateConfig;
  currentSheet: MonthlySheet | null;
}

interface SplitItem {
  id: string;
  tipologia: OvertimeRateType;
  ore: number;
  minuti: number;
  maggiorazionePercentuale: number;
}

export const OvertimeRecordModal: React.FC<OvertimeRecordModalProps> = ({
  isOpen,
  onClose,
  onSaveRecord,
  editingRecord,
  config,
  currentSheet,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [data, setData] = useState<string>(todayStr);
  const [mesePrevistoPagamento, setMesePrevistoPagamento] = useState<string>('');
  const [stato, setStato] = useState<OvertimePaymentStatus>('DA_PAGARE');
  const [nota, setNota] = useState<string>('');
  const [selectedSheetEntryId, setSelectedSheetEntryId] = useState<string>('');

  // Mode: Single or Split across multiple types
  const [isSplitting, setIsSplitting] = useState<boolean>(false);

  // Single mode state
  const [tipologia, setTipologia] = useState<OvertimeRateType>('DIURNO_FERIALE');
  const [customRate, setCustomRate] = useState<number>(20);
  const [ore, setOre] = useState<number>(1);
  const [minuti, setMinuti] = useState<number>(0);

  // Split mode state
  const [splitItems, setSplitItems] = useState<SplitItem[]>([
    { id: '1', tipologia: 'DIURNO_FERIALE', ore: 1, minuti: 0, maggiorazionePercentuale: 20 },
    { id: '2', tipologia: 'NOTTURNO_O_FESTIVO', ore: 1, minuti: 0, maggiorazionePercentuale: 30 },
  ]);

  // Sync state when editing or opening
  useEffect(() => {
    if (editingRecord) {
      setData(editingRecord.data);
      setMesePrevistoPagamento(editingRecord.mesePrevistoPagamento);
      setStato(editingRecord.stato);
      setNota(editingRecord.nota || '');
      setSelectedSheetEntryId(editingRecord.sheetEntryId || '');
      setTipologia(editingRecord.tipologia);
      setOre(editingRecord.ore);
      setMinuti(editingRecord.minuti);
      setCustomRate(editingRecord.maggiorazionePercentuale);
      setIsSplitting(false);
    } else {
      setData(todayStr);
      const workedMonth = todayStr.substring(0, 7);
      setMesePrevistoPagamento(getDefaultPaymentMonth(workedMonth));
      setStato('DA_PAGARE');
      setNota('');
      setSelectedSheetEntryId('');
      setTipologia('DIURNO_FERIALE');
      setOre(1);
      setMinuti(0);
      setCustomRate(config.maggiorazioneDiurnoFeriale);
      setIsSplitting(false);
    }
  }, [editingRecord, isOpen]);

  // Update default payment month when data changes
  const handleDateChange = (newDate: string) => {
    setData(newDate);
    if (!editingRecord && newDate) {
      const workedM = newDate.substring(0, 7);
      setMesePrevistoPagamento(getDefaultPaymentMonth(workedM));
    }
  };

  // Populate from existing sheet entry if selected
  const handleSelectSheetEntry = (entryId: string) => {
    setSelectedSheetEntryId(entryId);
    if (!entryId || !currentSheet?.entries) return;
    const entry = currentSheet.entries.find((e) => e.id === entryId);
    if (entry) {
      // Parse day if possible
      if (entry.giorno && entry.giorno.includes('/')) {
        const parts = entry.giorno.split('/');
        if (parts.length === 3) {
          setData(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        }
      }
      const totalMins = entry.minutiEffettuati || 0;
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      setOre(h);
      setMinuti(m);
      if (entry.motivo) {
        setNota(entry.motivo);
      }
    }
  };

  if (!isOpen) return null;

  // Compute rate for single mode
  const currentRatePercent =
    tipologia === 'DIURNO_FERIALE'
      ? config.maggiorazioneDiurnoFeriale
      : tipologia === 'NOTTURNO_O_FESTIVO'
      ? config.maggiorazioneNotturnoFestivo
      : tipologia === 'NOTTURNO_E_FESTIVO'
      ? config.maggiorazioneNotturnoEFestivo
      : customRate;

  // Single calculation preview
  const singleOreDecimali = convertToDecimalHours(ore, minuti);
  const singleCalc = calculateOvertimePay({
    oreDecimali: singleOreDecimali,
    pagaOrariaBase: config.pagaOrariaBase,
    maggiorazionePercentuale: currentRatePercent,
  });

  // Split calculation preview
  const splitCalculations = splitItems.map((item) => {
    const rate =
      item.tipologia === 'DIURNO_FERIALE'
        ? config.maggiorazioneDiurnoFeriale
        : item.tipologia === 'NOTTURNO_O_FESTIVO'
        ? config.maggiorazioneNotturnoFestivo
        : item.tipologia === 'NOTTURNO_E_FESTIVO'
        ? config.maggiorazioneNotturnoEFestivo
        : item.maggiorazionePercentuale;
    const oreDec = convertToDecimalHours(item.ore, item.minuti);
    const pay = calculateOvertimePay({
      oreDecimali: oreDec,
      pagaOrariaBase: config.pagaOrariaBase,
      maggiorazionePercentuale: rate,
    });
    return { item, oreDec, pay, rate };
  });

  const totalSplitHours = splitCalculations.reduce((acc, curr) => acc + curr.oreDec, 0);
  const totalSplitCompleto = splitCalculations.reduce(
    (acc, curr) => acc + curr.pay.compensoCompletoLordo,
    0
  );
  const totalSplitMaggiorazione = splitCalculations.reduce(
    (acc, curr) => acc + curr.pay.solaMaggiorazioneLordi,
    0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const workedMonth = data.substring(0, 7) || '2026-09';
    const paymentMonth = mesePrevistoPagamento || getDefaultPaymentMonth(workedMonth);

    if (isSplitting) {
      if (splitItems.length === 0) {
        alert('Inserisci almeno una suddivisione di orario.');
        return;
      }
      const recordsToSave = splitCalculations.map(({ item, oreDec, pay, rate }) => ({
        sheetEntryId: selectedSheetEntryId || undefined,
        data,
        meseLavorato: workedMonth,
        mesePrevistoPagamento: paymentMonth,
        ore: item.ore,
        minuti: item.minuti,
        oreDecimali: oreDec,
        tipologia: item.tipologia,
        tipologiaLabel: OVERTIME_TYPE_DEFINITIONS[item.tipologia].label,
        maggiorazionePercentuale: rate,
        pagaOrariaBase: config.pagaOrariaBase,
        compensoCompletoLordo: pay.compensoCompletoLordo,
        solaMaggiorazioneLordi: pay.solaMaggiorazioneLordi,
        stato,
        nota: nota ? `${nota} (suddivisione ${OVERTIME_TYPE_DEFINITIONS[item.tipologia].label})` : undefined,
      }));
      onSaveRecord(recordsToSave);
    } else {
      if (singleOreDecimali <= 0) {
        alert('Inserisci almeno 1 minuto di straordinario.');
        return;
      }
      const record = {
        sheetEntryId: selectedSheetEntryId || undefined,
        data,
        meseLavorato: workedMonth,
        mesePrevistoPagamento: paymentMonth,
        ore,
        minuti,
        oreDecimali: singleOreDecimali,
        tipologia,
        tipologiaLabel: OVERTIME_TYPE_DEFINITIONS[tipologia].label,
        maggiorazionePercentuale: currentRatePercent,
        pagaOrariaBase: config.pagaOrariaBase,
        compensoCompletoLordo: singleCalc.compensoCompletoLordo,
        solaMaggiorazioneLordi: singleCalc.solaMaggiorazioneLordi,
        stato,
        nota: nota || undefined,
      };
      onSaveRecord([record]);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-900 dark:bg-slate-950 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <DollarSign className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {editingRecord ? 'Modifica Prestazione Straordinario' : 'Registra Prestazione e Calcolo Compenso'}
              </h2>
              <p className="text-xs text-slate-300">
                Formula CCNL AIOP-ARIS: Ore × Paga Base ({config.pagaOrariaBase.toFixed(5)} €) × (1 + Maggiorazione)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {/* Optional integration with existing monthly sheet entries */}
          {currentSheet && currentSheet.entries && currentSheet.entries.length > 0 && !editingRecord && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Collega a turno dal foglio {currentSheet.nomeMese} (Evita duplicazioni):</span>
              </label>
              <select
                value={selectedSheetEntryId}
                onChange={(e) => handleSelectSheetEntry(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              >
                <option value="">-- Nessun turno collegato (Inserimento manuale autonomo) --</option>
                {currentSheet.entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    Giorno {entry.giorno}: {entry.turnoType} ({entry.orarioStraordinario}) - {entry.motivo || 'Nessun motivo'} [{entry.totaleOreStraordinario || entry.totaleOreMonteOre}]
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date & Expected Payment Month */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data Prestazione *
              </label>
              <input
                type="date"
                required
                value={data}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400">
                Mese lavorato: <strong>{data.substring(0, 7)}</strong>
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mese Previsto di Pagamento *
              </label>
              <input
                type="month"
                required
                value={mesePrevistoPagamento}
                onChange={(e) => setMesePrevistoPagamento(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400">
                Periodo di liquidazione in busta paga
              </span>
            </div>
          </div>

          {/* Split Mode Switcher (only for new records) */}
          {!editingRecord && (
            <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <div className="flex items-center gap-2">
                <Split className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Suddividi le ore su tipologie diverse (es. turno a cavallo giorno/notte)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSplitting(!isSplitting)}
                className={`text-xs px-3 py-1 font-semibold rounded-lg cursor-pointer transition-colors ${
                  isSplitting
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                }`}
              >
                {isSplitting ? 'Attivo' : 'Attiva Suddivisione'}
              </button>
            </div>
          )}

          {/* Mode 1: Single Overtime Type */}
          {!isSplitting ? (
            <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tipologia e Maggiorazione Contrattuale *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['DIURNO_FERIALE', 'NOTTURNO_O_FESTIVO', 'NOTTURNO_E_FESTIVO'] as OvertimeRateType[]).map(
                    (type) => {
                      const def = OVERTIME_TYPE_DEFINITIONS[type];
                      const rate = config[def.defaultRateKey];
                      const isSelected = tipologia === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setTipologia(type)}
                          className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 ring-1 ring-emerald-600'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              +{rate}%
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                          </div>
                          <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-1">
                            {type === 'DIURNO_FERIALE'
                              ? 'Diurno Feriale'
                              : type === 'NOTTURNO_O_FESTIVO'
                              ? 'Notturno / Festivo'
                              : 'Notturno & Festivo'}
                          </p>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Hours and Minutes Inputs */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ore e Minuti di Straordinario Effettivo *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={ore}
                        onChange={(e) => setOre(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full text-sm font-bold bg-transparent text-slate-900 dark:text-white outline-hidden"
                      />
                      <span className="text-xs font-medium text-slate-500">ore</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        min="0"
                        max="59"
                        step="5"
                        value={minuti}
                        onChange={(e) => setMinuti(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-full text-sm font-bold bg-transparent text-slate-900 dark:text-white outline-hidden"
                      />
                      <span className="text-xs font-medium text-slate-500">min</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 px-1">
                  <span>
                    Conversione esatta: <strong>{singleOreDecimali.toFixed(4)} ore</strong>
                  </span>
                  <span>(es. 1h 30m = 1,5 ore)</span>
                </div>
              </div>

              {/* Real-time Math Breakdown Box */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Compenso Lordo Aggiuntivo Atteso:
                  </span>
                  <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(singleCalc.compensoCompletoLordo)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 mt-1">
                  <span>
                    Di cui sola maggiorazione (+{currentRatePercent}%):
                  </span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(singleCalc.solaMaggiorazioneLordi)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  Formula: {singleOreDecimali.toFixed(2)}h × {config.pagaOrariaBase.toFixed(5)} € × {(1 + currentRatePercent / 100).toFixed(2)}
                </div>
              </div>
            </div>
          ) : (
            /* Mode 2: Split Hours across multiple types */
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Quote di straordinario suddivise:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSplitItems([
                      ...splitItems,
                      {
                        id: Date.now().toString(),
                        tipologia: 'NOTTURNO_O_FESTIVO',
                        ore: 1,
                        minuti: 0,
                        maggiorazionePercentuale: 30,
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Aggiungi Quota
                </button>
              </div>

              {splitItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={item.tipologia}
                      onChange={(e) => {
                        const newType = e.target.value as OvertimeRateType;
                        const newItems = [...splitItems];
                        newItems[idx].tipologia = newType;
                        setSplitItems(newItems);
                      }}
                      className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex-1"
                    >
                      <option value="DIURNO_FERIALE">Diurno Feriale (+{config.maggiorazioneDiurnoFeriale}%)</option>
                      <option value="NOTTURNO_O_FESTIVO">Notturno o Festivo (+{config.maggiorazioneNotturnoFestivo}%)</option>
                      <option value="NOTTURNO_E_FESTIVO">Notturno e Festivo (+{config.maggiorazioneNotturnoEFestivo}%)</option>
                    </select>

                    {splitItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSplitItems(splitItems.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">
                      <span>Ore:</span>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={item.ore}
                        onChange={(e) => {
                          const newItems = [...splitItems];
                          newItems[idx].ore = Math.max(0, parseInt(e.target.value) || 0);
                          setSplitItems(newItems);
                        }}
                        className="w-12 font-bold bg-transparent text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">
                      <span>Min:</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={item.minuti}
                        onChange={(e) => {
                          const newItems = [...splitItems];
                          newItems[idx].minuti = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                          setSplitItems(newItems);
                        }}
                        className="w-12 font-bold bg-transparent text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Split Totals */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span>Totale Ore Suddivise:</span>
                  <span className="font-bold font-mono">{totalSplitHours.toFixed(2)}h</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold pt-1 text-emerald-600">
                  <span>Compenso Lordo Complessivo:</span>
                  <span className="font-mono text-sm">{formatCurrency(totalSplitCompleto)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Stato della Prestazione *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'DA_PAGARE', label: 'Da Pagare', desc: 'In attesa di liquidazione cedolino' },
                { id: 'PAGATO', label: 'Pagato', desc: 'Già liquidato in busta paga' },
                { id: 'RECUPERATO_RIPOSO', label: 'Riposo Compensativo', desc: 'Recuperato (escluso da compenso €)' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStato(s.id as OvertimePaymentStatus)}
                  className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer ${
                    stato === s.id
                      ? s.id === 'RECUPERATO_RIPOSO'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 ring-1 ring-amber-500'
                        : 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 ring-1 ring-emerald-600'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    {s.label}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    {s.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nota Facoltativa (Motivo prestazione, protocollo o postazione)
            </label>
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Es. Sostituzione turno emergenza, prolungamento soccorso 118"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 shadow-sm rounded-lg transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{editingRecord ? 'Salva Modifiche' : 'Salva Prestazione e Calcolo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
