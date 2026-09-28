import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Clock,
  Briefcase,
  Layers,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Save,
} from 'lucide-react';
import { OvertimeEntry, DestinazioneTipo } from '../types';
import {
  SHIFT_PRESETS,
  MOTIVI_PRESET,
  formatMinutesToHours,
  calculateDifferenceMinutes,
  calculateEndTimeFromDuration,
} from '../utils/timeCalculations';

interface AddOvertimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: OvertimeEntry, dateIso: string) => Promise<boolean | void> | void;
  initialDate?: string;
  defaultShiftId?: string;
}

const DRAFT_STORAGE_KEY = 'set118_overtime_modal_draft';

export const AddOvertimeModal: React.FC<AddOvertimeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialDate,
  defaultShiftId = 'MATTINA',
}) => {
  if (!isOpen) return null;

  // Selected date
  const todayIso = new Date().toISOString().split('T')[0];
  const [dataGiorno, setDataGiorno] = useState<string>(() => {
    try {
      const draft = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.dataGiorno) return parsed.dataGiorno;
      }
    } catch {}
    return initialDate || todayIso;
  });

  // Selected Shift
  const [selectedShiftId, setSelectedShiftId] = useState<string>(() => {
    try {
      const draft = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.selectedShiftId) return parsed.selectedShiftId;
      }
    } catch {}
    return defaultShiftId;
  });
  const [customOrarioOrdinario, setCustomOrarioOrdinario] = useState<string>('08:00 - 14:00');
  const [customOreOrdinarie, setCustomOreOrdinarie] = useState<number>(6);

  // Overtime destination
  const [tipoDestinazione, setTipoDestinazione] = useState<DestinazioneTipo>(() => {
    try {
      const draft = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.tipoDestinazione) return parsed.tipoDestinazione;
      }
    } catch {}
    return 'STRAORDINARIO';
  });

  // Overtime input method: By Duration or By Exact Hours
  const [inputMode, setInputMode] = useState<'DURATION' | 'EXACT_TIMES'>('DURATION');

  // When inputMode === 'DURATION'
  const [durataOre, setDurataOre] = useState<number>(1);
  const [durataMinuti, setDurataMinuti] = useState<number>(30);

  // When inputMode === 'EXACT_TIMES'
  const [oraInizioStraord, setOraInizioStraord] = useState<string>('14:00');
  const [oraFineStraord, setOraFineStraord] = useState<string>('15:30');

  // Overtime Reason
  const [motivo, setMotivo] = useState<string>(() => {
    try {
      const draft = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.motivo) return parsed.motivo;
      }
    } catch {}
    return 'Intervento emergenza 118 codice rosso e rientro postazione oltre turno';
  });

  // Status & error handling for robust saving
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SAVED' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Persist draft to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          dataGiorno,
          selectedShiftId,
          tipoDestinazione,
          motivo,
        })
      );
    } catch {}
  }, [dataGiorno, selectedShiftId, tipoDestinazione, motivo]);

  // Find shift
  const currentShift = SHIFT_PRESETS.find((s) => s.id === selectedShiftId) || SHIFT_PRESETS[0];

  // Whenever shift changes, auto-propose default overtime start time
  useEffect(() => {
    if (selectedShiftId !== 'CUSTOM') {
      const shiftEnd = currentShift.orarioFine || '14:00';
      setOraInizioStraord(shiftEnd);
      const totalMins = durataOre * 60 + durataMinuti;
      const calculatedEnd = calculateEndTimeFromDuration(shiftEnd, totalMins);
      setOraFineStraord(calculatedEnd);
    }
  }, [selectedShiftId]);

  // When duration changes in DURATION mode, re-compute oraFineStraord
  useEffect(() => {
    if (inputMode === 'DURATION') {
      const start = selectedShiftId !== 'CUSTOM' ? (currentShift.orarioFine || '14:00') : '14:00';
      setOraInizioStraord(start);
      const totalMins = durataOre * 60 + durataMinuti;
      const calculatedEnd = calculateEndTimeFromDuration(start, totalMins);
      setOraFineStraord(calculatedEnd);
    }
  }, [durataOre, durataMinuti, inputMode]);

  // Total overtime minutes calculation
  const totalMinutes =
    inputMode === 'DURATION'
      ? durataOre * 60 + durataMinuti
      : calculateDifferenceMinutes(oraInizioStraord, oraFineStraord);

  const formattedTotalHours = formatMinutesToHours(totalMinutes);
  const decimalHours = Number((totalMinutes / 60).toFixed(2));

  // Convert date format from YYYY-MM-DD to DD/MM/YYYY
  const formatItalianDate = (isoStr: string) => {
    const parts = isoStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoStr;
  };

  const handleSave = async () => {
    if (totalMinutes <= 0) {
      setErrorMessage('Inserisci una durata valida (almeno 1 minuto di straordinario).');
      return;
    }

    setErrorMessage(null);
    setSaveStatus('SAVING');

    const orarioOrd =
      selectedShiftId === 'CUSTOM'
        ? customOrarioOrdinario
        : currentShift.orarioOrdinario;

    const orarioStraord = `${oraInizioStraord} - ${oraFineStraord}`;

    const newEntry: OvertimeEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      giorno: formatItalianDate(dataGiorno),
      turnoType: selectedShiftId,
      orarioOrdinario: orarioOrd,
      orarioStraordinario: orarioStraord,
      motivo: motivo.trim() || 'Straordinario di servizio emergenza 118',
      tipoDestinazione,
      minutiEffettuati: totalMinutes,
      totaleOreMonteOre: tipoDestinazione === 'MONTE_ORE' ? formattedTotalHours : '',
      totaleOreStraordinario: tipoDestinazione === 'STRAORDINARIO' ? formattedTotalHours : '',
      oreDecimali: decimalHours,
      firmaCoordinatore: 'Autorizzato',
      dataCreazione: new Date().toISOString(),
    };

    try {
      const res = await onSave(newEntry, dataGiorno);
      if (res === false) {
        setSaveStatus('ERROR');
        setErrorMessage('Salvataggio non riuscito. I dati inseriti sono conservati per consentirti di riprovare.');
        return;
      }

      setSaveStatus('SAVED');
      try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}

      // Short delay to show confirmation before closing
      setTimeout(() => {
        onClose();
      }, 350);
    } catch (err: any) {
      console.error('Error during onSave:', err);
      setSaveStatus('ERROR');
      setErrorMessage(
        err.message || 'Errore di salvataggio. Nessun dato è stato cancellato: puoi verificare e riprovare.'
      );
    }
  };

  const fastPresetOptions = [
    { label: '+30m', mins: 30 },
    { label: '+45m', mins: 45 },
    { label: '+1h 00m', mins: 60 },
    { label: '+1h 30m', mins: 90 },
    { label: '+2h 00m', mins: 120 },
    { label: '+2h 30m', mins: 150 },
    { label: '+3h 00m', mins: 180 },
    { label: '+4h 00m', mins: 240 },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-900 dark:bg-slate-950 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white shadow-xs">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                Inserisci Straordinario S.E.T. 118
              </h2>
              <p className="text-xs text-slate-300">
                Calcolo automatico turni e trascrizione su foglio Sanitaservice ASL TA
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

        <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Section 1: Giorno del mese */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Data Turno
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dataGiorno}
                  onChange={(e) => setDataGiorno(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Destination Selection: Monte Ore vs Straordinario */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Destinazione Ore (Colonna PDF)
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTipoDestinazione('STRAORDINARIO')}
                  className={`py-2 px-3 text-xs font-bold rounded-md transition-all cursor-pointer text-center ${
                    tipoDestinazione === 'STRAORDINARIO'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Straordinario
                </button>
                <button
                  type="button"
                  onClick={() => setTipoDestinazione('MONTE_ORE')}
                  className={`py-2 px-3 text-xs font-bold rounded-md transition-all cursor-pointer text-center ${
                    tipoDestinazione === 'MONTE_ORE'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Monte Ore
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Scelta Turno Ordinario */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Turno Ordinario Effettuato
              </label>
              <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                {currentShift.oreOrdinarie > 0
                  ? `Durata turno base: ${currentShift.oreOrdinarie} ore`
                  : 'Nessun turno di base (Fuori turno)'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SHIFT_PRESETS.map((shift) => (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() => setSelectedShiftId(shift.id)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    selectedShiftId === shift.id
                      ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 ring-1 ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{shift.nomeTurno}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    {shift.orarioOrdinario}
                  </div>
                </button>
              ))}
            </div>

            {selectedShiftId === 'CUSTOM' && (
              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Dicitura Orario Ordinario
                  </label>
                  <input
                    type="text"
                    value={customOrarioOrdinario}
                    onChange={(e) => setCustomOrarioOrdinario(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Ore Turno Ordinario
                  </label>
                  <input
                    type="number"
                    value={customOreOrdinarie}
                    onChange={(e) => setCustomOreOrdinarie(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-white font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Ore e Minuti di Straordinario */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Inserimento Straordinario Effettuato
              </label>

              {/* Mode Switcher */}
              <div className="flex items-center gap-1 p-0.5 bg-slate-200 dark:bg-slate-700 rounded-md self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setInputMode('DURATION')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                    inputMode === 'DURATION'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Durata (Ore / Min)
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('EXACT_TIMES')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                    inputMode === 'EXACT_TIMES'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Orario Esatto (Dalle - Alle)
                </button>
              </div>
            </div>

            {inputMode === 'DURATION' ? (
              <div className="space-y-3">
                {/* Fast Preset Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
                    Scelta Rapida:
                  </span>
                  {fastPresetOptions.map((opt) => (
                    <button
                      key={opt.mins}
                      type="button"
                      onClick={() => {
                        setDurataOre(Math.floor(opt.mins / 60));
                        setDurataMinuti(opt.mins % 60);
                      }}
                      className="px-2 py-1 text-xs font-mono font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Duration Steppers */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Ore di Straordinario
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={durataOre}
                        onChange={(e) => setDurataOre(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-white text-center"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">ore</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Minuti di Straordinario
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={durataMinuti}
                        onChange={(e) => setDurataMinuti(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-white text-center"
                      >
                        <option value={0}>0 minuti</option>
                        <option value={15}>15 minuti</option>
                        <option value={30}>30 minuti</option>
                        <option value={45}>45 minuti</option>
                        <option value={10}>10 minuti</option>
                        <option value={20}>20 minuti</option>
                        <option value={40}>40 minuti</option>
                        <option value={50}>50 minuti</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Dalle ore (Inizio Straordinario)
                  </label>
                  <input
                    type="time"
                    value={oraInizioStraord}
                    onChange={(e) => setOraInizioStraord(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Alle ore (Fine Straordinario)
                  </label>
                  <input
                    type="time"
                    value={oraFineStraord}
                    onChange={(e) => setOraFineStraord(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* Calculated transcription result banner */}
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-slate-600 dark:text-slate-400">
                  Orario Straordinario calcolato:{' '}
                  <strong className="text-slate-900 dark:text-white font-mono">
                    {oraInizioStraord} - {oraFineStraord}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 dark:text-slate-400">Trascritto in:</span>
                <span
                  className={`px-2 py-0.5 rounded font-bold text-xs ${
                    tipoDestinazione === 'STRAORDINARIO'
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {tipoDestinazione === 'STRAORDINARIO' ? 'Straordinario' : 'Monte Ore'}: {formattedTotalHours}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Motivo dello Straordinario */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Motivo dello Straordinario (Trascritto nella Colonna 4 del PDF)
            </label>
            <div className="space-y-2">
              <textarea
                rows={2}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Descrivi l'intervento di soccorso, codice, motivo..."
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white resize-none"
              />

              <div className="flex flex-wrap gap-1.5">
                {MOTIVI_PRESET.map((m, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMotivo(m)}
                    className="text-[11px] px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md transition-colors text-left cursor-pointer truncate max-w-full"
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error / Failure Banner with Preservation Guarantee */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">Attenzione:</span>
                <p>{errorMessage}</p>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                  Tutti i campi che hai compilato sono rimasti intatti: puoi correggere o riprovare il salvataggio.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions with state display */}
        <div className="px-5 sm:px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            {saveStatus === 'SAVING' && (
              <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Salvataggio in corso...</span>
              </span>
            )}
            {saveStatus === 'SAVED' && (
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Salvato con successo!</span>
              </span>
            )}
            {saveStatus === 'IDLE' && (
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                I dati vengono salvati localmente (IndexedDB) e sincronizzati.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saveStatus === 'SAVING'}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              Annulla
            </button>

            <button
              type="button"
              disabled={saveStatus === 'SAVING'}
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-98 shadow-sm rounded-lg transition-all cursor-pointer disabled:opacity-60"
            >
              {saveStatus === 'SAVING' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Salvataggio in corso...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salva e Trascrivi sul Foglio</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
