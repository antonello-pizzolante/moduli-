import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Calculator,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Plus,
  Trash2,
  Edit3,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Split,
  Percent,
  Receipt,
  FileText,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  MonthlySheet,
  OvertimeCalcState,
  OvertimeCompensationRecord,
  OvertimeRateConfig,
  OvertimeRateType,
  OvertimePaymentStatus,
  SeparateAllowanceRecord,
  AllowanceType,
} from '../types';
import {
  formatCurrency,
  formatDecimalHours,
  convertToDecimalHours,
  calculateOvertimePay,
  calculateNetEstimate,
  OVERTIME_TYPE_DEFINITIONS,
  DEFAULT_OVERTIME_RATE_CONFIG,
  DEFAULT_ALLOWANCES_CONFIG,
  formatMonthYear,
  getDefaultPaymentMonth,
} from '../utils/overtimeCalculator';
import { OvertimeRecordModal } from './OvertimeRecordModal';

interface OvertimeCompensationViewProps {
  currentSheet: MonthlySheet | null;
  calcState: OvertimeCalcState;
  onUpdateCalcState: (newState: OvertimeCalcState) => Promise<void>;
  onNavigateToSheet: () => void;
}

export const OvertimeCompensationView: React.FC<OvertimeCompensationViewProps> = ({
  currentSheet,
  calcState,
  onUpdateCalcState,
  onNavigateToSheet,
}) => {
  // Modal states
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OvertimeCompensationRecord | null>(null);

  // Collapsible panels
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showAllowancesPanel, setShowAllowancesPanel] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Month filtering & view selection:
  // Default to current sheet's month ID (e.g. "2026-09")
  const currentMonthId = currentSheet?.id || new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthId);
  const [filterMode, setFilterMode] = useState<'LAVORATO' | 'PAGAMENTO'>('LAVORATO');

  // Config editing state
  const [tempConfig, setTempConfig] = useState<OvertimeRateConfig>({ ...calcState.settings });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Cedolino actual gross input for selected month
  const currentCedolino = calcState.cedolinoComparisons[selectedMonth] || {
    meseCompetenza: selectedMonth,
    straordinarioLordoCedolino: 0,
    dataRegistrazioneCedolino: '',
  };
  const [cedolinoInput, setCedolinoInput] = useState<string>(
    currentCedolino.straordinarioLordoCedolino > 0
      ? currentCedolino.straordinarioLordoCedolino.toString()
      : ''
  );

  // User tax percentage for net estimation (editable in UI)
  const [trattenutePercent, setTrattenutePercent] = useState<string>(
    calcState.settings.aliquotaTrattenuteMedia !== undefined
      ? calcState.settings.aliquotaTrattenuteMedia.toString()
      : '25'
  );

  // Allowance form state
  const [allowanceForm, setAllowanceForm] = useState<{
    tipo: AllowanceType;
    quantita: number;
    data: string;
    nota: string;
  }>({
    tipo: 'NOTTURNO_ORDINARIO',
    quantita: 1,
    data: new Date().toISOString().split('T')[0],
    nota: '',
  });

  // Available months across records and sheets
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    if (currentSheet?.id) monthSet.add(currentSheet.id);
    calcState.records.forEach((r) => {
      monthSet.add(r.meseLavorato);
      if (r.mesePrevistoPagamento) monthSet.add(r.mesePrevistoPagamento);
    });
    // Add current and surrounding months if empty
    const now = new Date();
    const currStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthSet.add(currStr);
    return Array.from(monthSet).sort().reverse();
  }, [calcState.records, currentSheet]);

  // Filter records based on selected month and filter mode
  const filteredRecords = useMemo(() => {
    return calcState.records.filter((rec) => {
      if (!selectedMonth) return true;
      if (filterMode === 'LAVORATO') {
        return rec.meseLavorato === selectedMonth;
      } else {
        return rec.mesePrevistoPagamento === selectedMonth;
      }
    });
  }, [calcState.records, selectedMonth, filterMode]);

  // Calculations for current filtered view
  const summary = useMemo(() => {
    let oreTotali = 0;
    let oreDiurnoFeriale = 0;
    let oreNotturnoFestivo = 0;
    let oreNotturnoEFestivo = 0;

    let compensoCompletoMaturato = 0;
    let solaMaggiorazioneMaturata = 0;

    let importoAttesoInPagamento = 0; // Excludes RECUPERATO_RIPOSO
    let oreRecuperateRiposo = 0;

    let importiGiaPagati = 0;
    let importiAncoraDaPagare = 0;

    filteredRecords.forEach((rec) => {
      oreTotali += rec.oreDecimali;

      if (rec.tipologia === 'DIURNO_FERIALE') {
        oreDiurnoFeriale += rec.oreDecimali;
      } else if (rec.tipologia === 'NOTTURNO_O_FESTIVO') {
        oreNotturnoFestivo += rec.oreDecimali;
      } else if (rec.tipologia === 'NOTTURNO_E_FESTIVO') {
        oreNotturnoEFestivo += rec.oreDecimali;
      }

      compensoCompletoMaturato += rec.compensoCompletoLordo;
      solaMaggiorazioneMaturata += rec.solaMaggiorazioneLordi;

      // Status handling
      if (rec.stato === 'RECUPERATO_RIPOSO') {
        oreRecuperateRiposo += rec.oreDecimali;
      } else {
        // Only monetary compensation is expected
        importoAttesoInPagamento += rec.compensoCompletoLordo;
        if (rec.stato === 'PAGATO') {
          importiGiaPagati += rec.compensoCompletoLordo;
        } else {
          importiAncoraDaPagare += rec.compensoCompletoLordo;
        }
      }
    });

    return {
      oreTotali,
      oreDiurnoFeriale,
      oreNotturnoFestivo,
      oreNotturnoEFestivo,
      compensoCompletoMaturato,
      solaMaggiorazioneMaturata,
      importoAttesoInPagamento,
      oreRecuperateRiposo,
      importiGiaPagati,
      importiAncoraDaPagare,
      conteggioPrestazioni: filteredRecords.length,
    };
  }, [filteredRecords]);

  // Net estimate based on user-provided deduction percentage
  const parsedTaxRate = parseFloat(trattenutePercent);
  const netEstimate = useMemo(() => {
    return calculateNetEstimate(summary.importoAttesoInPagamento, parsedTaxRate);
  }, [summary.importoAttesoInPagamento, parsedTaxRate]);

  // Comparison with payslip (cedolino)
  const cedolinoLiquidatoVal = parseFloat(cedolinoInput) || 0;
  const scostamentoCedolino = useMemo(() => {
    if (cedolinoLiquidatoVal <= 0) return null;
    const diff = cedolinoLiquidatoVal - summary.importoAttesoInPagamento;
    return {
      diff,
      isExact: Math.abs(diff) < 0.05,
      isHigher: diff > 0.05,
      isLower: diff < -0.05,
    };
  }, [cedolinoLiquidatoVal, summary.importoAttesoInPagamento]);

  // Filtered separate allowances for the month
  const filteredAllowances = useMemo(() => {
    return (calcState.allowanceRecords || []).filter(
      (a) => a.meseCompetenza === selectedMonth
    );
  }, [calcState.allowanceRecords, selectedMonth]);

  const totalAllowancesLordo = useMemo(() => {
    return filteredAllowances.reduce((acc, curr) => acc + curr.totaleLordo, 0);
  }, [filteredAllowances]);

  // Save overtime record (add or update)
  const handleSaveRecords = async (
    newRecords: Omit<OvertimeCompensationRecord, 'id' | 'createdAt' | 'updatedAt'>[]
  ) => {
    let updatedList = [...calcState.records];

    if (editingRecord) {
      // Update single
      const updated = {
        ...newRecords[0],
        id: editingRecord.id,
        createdAt: editingRecord.createdAt,
        updatedAt: new Date().toISOString(),
      };
      updatedList = updatedList.map((r) => (r.id === editingRecord.id ? updated : r));
    } else {
      // Add new record(s)
      const now = new Date().toISOString();
      const created = newRecords.map((r, idx) => ({
        ...r,
        id: `COMP-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        createdAt: now,
        updatedAt: now,
      }));
      updatedList = [...created, ...updatedList];
    }

    const newState: OvertimeCalcState = {
      ...calcState,
      records: updatedList,
    };
    await onUpdateCalcState(newState);
  };

  // Delete record
  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Vuoi eliminare questa registrazione dal calcolo straordinari?')) return;
    const updatedList = calcState.records.filter((r) => r.id !== id);
    await onUpdateCalcState({
      ...calcState,
      records: updatedList,
    });
  };

  // Quick cycle status
  const handleCycleStatus = async (record: OvertimeCompensationRecord) => {
    const nextStatus: OvertimePaymentStatus =
      record.stato === 'DA_PAGARE'
        ? 'PAGATO'
        : record.stato === 'PAGATO'
        ? 'RECUPERATO_RIPOSO'
        : 'DA_PAGARE';

    const updated = {
      ...record,
      stato: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    const updatedList = calcState.records.map((r) => (r.id === record.id ? updated : r));
    await onUpdateCalcState({
      ...calcState,
      records: updatedList,
    });
  };

  // Save Payslip actual comparison
  const handleSaveCedolino = async () => {
    const val = parseFloat(cedolinoInput) || 0;
    const updatedCedolino: Record<string, any> = {
      ...calcState.cedolinoComparisons,
      [selectedMonth]: {
        meseCompetenza: selectedMonth,
        straordinarioLordoCedolino: val,
        dataRegistrazioneCedolino: new Date().toISOString(),
      },
    };
    await onUpdateCalcState({
      ...calcState,
      cedolinoComparisons: updatedCedolino,
    });
  };

  // Save config settings
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      // Re-calculate all records based on updated base wage if desired
      const updatedRecords = calcState.records.map((r) => {
        const pay = calculateOvertimePay({
          oreDecimali: r.oreDecimali,
          pagaOrariaBase: tempConfig.pagaOrariaBase,
          maggiorazionePercentuale: r.maggiorazionePercentuale,
        });
        return {
          ...r,
          pagaOrariaBase: tempConfig.pagaOrariaBase,
          compensoCompletoLordo: pay.compensoCompletoLordo,
          solaMaggiorazioneLordi: pay.solaMaggiorazioneLordi,
          updatedAt: new Date().toISOString(),
        };
      });

      await onUpdateCalcState({
        ...calcState,
        settings: {
          ...tempConfig,
          aliquotaTrattenuteMedia: parsedTaxRate,
        },
        records: updatedRecords,
      });
      setShowConfigPanel(false);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Reset config to CCNL AIOP-ARIS defaults
  const handleResetConfig = () => {
    if (confirm('Vuoi ripristinare i parametri iniziali contrattuali AIOP-ARIS (T011)?')) {
      setTempConfig({ ...DEFAULT_OVERTIME_RATE_CONFIG });
    }
  };

  // Add separate allowance record
  const handleAddAllowance = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateMap: Record<AllowanceType, number> = {
      NOTTURNO_ORDINARIO: calcState.allowanceSettings.turnoNotturnoOrdinario,
      FESTIVA_INTERA: calcState.allowanceSettings.indennitaFestivaIntera,
      FESTIVA_RIDOTTA: calcState.allowanceSettings.indennitaFestivaRidotta,
      TRE_TURNI: calcState.allowanceSettings.indennitaTreTurni,
    };
    const unitMap: Record<AllowanceType, 'ORE' | 'EVENTI' | 'GIORNATE'> = {
      NOTTURNO_ORDINARIO: 'ORE',
      FESTIVA_INTERA: 'EVENTI',
      FESTIVA_RIDOTTA: 'EVENTI',
      TRE_TURNI: 'GIORNATE',
    };
    const labelMap: Record<AllowanceType, string> = {
      NOTTURNO_ORDINARIO: 'Turno Notturno Ordinario (2,74 €/h)',
      FESTIVA_INTERA: 'Indennità Festiva Intera (17,82 €)',
      FESTIVA_RIDOTTA: 'Indennità Festiva Ridotta (8,91 €)',
      TRE_TURNI: 'Indennità Tre Turni (4,50 €/g)',
    };

    const tariffa = rateMap[allowanceForm.tipo];
    const totale = tariffa * allowanceForm.quantita;
    const meseComp = allowanceForm.data.substring(0, 7);

    const newAllowance: SeparateAllowanceRecord = {
      id: `ALW-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      data: allowanceForm.data,
      tipo: allowanceForm.tipo,
      tipoLabel: labelMap[allowanceForm.tipo],
      unitaMisura: unitMap[allowanceForm.tipo],
      quantita: allowanceForm.quantita,
      tariffaUnitaria: tariffa,
      totaleLordo: Math.round(totale * 100) / 100,
      meseCompetenza: meseComp,
      mesePagamento: getDefaultPaymentMonth(meseComp),
      stato: 'DA_PAGARE',
      nota: allowanceForm.nota || undefined,
      createdAt: new Date().toISOString(),
    };

    await onUpdateCalcState({
      ...calcState,
      allowanceRecords: [newAllowance, ...(calcState.allowanceRecords || [])],
    });

    setAllowanceForm({
      tipo: 'NOTTURNO_ORDINARIO',
      quantita: 1,
      data: new Date().toISOString().split('T')[0],
      nota: '',
    });
  };

  const handleDeleteAllowance = async (id: string) => {
    const updated = (calcState.allowanceRecords || []).filter((a) => a.id !== id);
    await onUpdateCalcState({
      ...calcState,
      allowanceRecords: updated,
    });
  };

  // Intelligent import from current sheet without duplications
  const eligibleSheetEntriesToImport = useMemo(() => {
    if (!currentSheet?.entries) return [];
    // Only entries marked as STRAORDINARIO that aren't already imported
    const importedSheetEntryIds = new Set(
      calcState.records.map((r) => r.sheetEntryId).filter(Boolean)
    );
    return currentSheet.entries.filter(
      (e) => e.tipoDestinazione === 'STRAORDINARIO' && !importedSheetEntryIds.has(e.id)
    );
  }, [currentSheet, calcState.records]);

  const handleImportAllEligibleEntries = async () => {
    if (eligibleSheetEntriesToImport.length === 0) return;
    const now = new Date().toISOString();
    const workedMonth = currentSheet?.id || new Date().toISOString().substring(0, 7);
    const paymentMonth = getDefaultPaymentMonth(workedMonth);

    const imported: OvertimeCompensationRecord[] = eligibleSheetEntriesToImport.map(
      (entry, idx) => {
        const totalMinutes = entry.minutiEffettuati || 0;
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        const oreDec = convertToDecimalHours(h, m);

        // Auto-detect overtime type based on shift name or hours if possible
        const isNotte =
          entry.turnoType.toLowerCase().includes('notte') ||
          entry.orarioStraordinario.includes('20:') ||
          entry.orarioStraordinario.includes('21:') ||
          entry.orarioStraordinario.includes('22:') ||
          entry.orarioStraordinario.includes('23:') ||
          entry.orarioStraordinario.includes('00:') ||
          entry.orarioStraordinario.includes('07:');

        const tipo: OvertimeRateType = isNotte ? 'NOTTURNO_O_FESTIVO' : 'DIURNO_FERIALE';
        const rate =
          tipo === 'NOTTURNO_O_FESTIVO'
            ? calcState.settings.maggiorazioneNotturnoFestivo
            : calcState.settings.maggiorazioneDiurnoFeriale;

        const pay = calculateOvertimePay({
          oreDecimali: oreDec,
          pagaOrariaBase: calcState.settings.pagaOrariaBase,
          maggiorazionePercentuale: rate,
        });

        // Parse date
        let dataIso = `${workedMonth}-01`;
        if (entry.giorno && entry.giorno.includes('/')) {
          const parts = entry.giorno.split('/');
          if (parts.length === 3) {
            dataIso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }

        return {
          id: `IMPORT-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          sheetEntryId: entry.id,
          data: dataIso,
          meseLavorato: workedMonth,
          mesePrevistoPagamento: paymentMonth,
          ore: h,
          minuti: m,
          oreDecimali: oreDec,
          tipologia: tipo,
          tipologiaLabel: OVERTIME_TYPE_DEFINITIONS[tipo].label,
          maggiorazionePercentuale: rate,
          pagaOrariaBase: calcState.settings.pagaOrariaBase,
          compensoCompletoLordo: pay.compensoCompletoLordo,
          solaMaggiorazioneLordi: pay.solaMaggiorazioneLordi,
          stato: 'DA_PAGARE',
          nota: entry.motivo ? `Da registro: ${entry.motivo}` : 'Importato da Registro Turni',
          createdAt: now,
          updatedAt: now,
        };
      }
    );

    await onUpdateCalcState({
      ...calcState,
      records: [...imported, ...calcState.records],
    });

    setShowImportModal(false);
  };

  // CSV export of overtime calculation data
  const handleExportCalcCsv = () => {
    const lines: string[] = [];
    lines.push('CALCOLO COMPENSO STRAORDINARI - SANITASERVICE ASL TA - S.E.T. 118');
    lines.push(`CCNL: ${calcState.settings.ccnl};PAGA BASE: ${calcState.settings.pagaOrariaBase.toFixed(5)} €/ora`);
    lines.push(`PERIODO: ${formatMonthYear(selectedMonth)} (Filtro per mese ${filterMode.toLowerCase()})`);
    lines.push('');
    lines.push('Data;Mese Lavorato;Mese Pagamento;Ore e Minuti;Ore Decimali;Tipologia;Maggiorazione %;Compenso Completo Lordo;Sola Maggiorazione Lorda;Stato;Note');

    filteredRecords.forEach((r) => {
      lines.push(
        `"${r.data}";"${r.meseLavorato}";"${r.mesePrevistoPagamento}";"${r.ore}h ${r.minuti}m";"${r.oreDecimali.toFixed(2)}";"${r.tipologiaLabel}";"+${r.maggiorazionePercentuale}%";"${r.compensoCompletoLordo.toFixed(2)} €";"${r.solaMaggiorazioneLordi.toFixed(2)} €";"${r.stato}";"${(r.nota || '').replace(/"/g, '""')}"`
      );
    });

    lines.push('');
    lines.push(`TOTALE ORE:;${summary.oreTotali.toFixed(2)}h`);
    lines.push(`COMPENSO COMPLETO LORDO:;${summary.compensoCompletoMaturato.toFixed(2)} €`);
    lines.push(`LORDO ATTESO IN PAGAMENTO (escluso riposo):;${summary.importoAttesoInPagamento.toFixed(2)} €`);
    if (netEstimate) {
      lines.push(`NETTO STIMATO (aliquota ${netEstimate.aliquotaApplicata}%):;${netEstimate.nettoStimato.toFixed(2)} €`);
    }

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Calcolo_Straordinari_${selectedMonth}_${filterMode}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar with Filter & Primary Actions */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs">
            <Calculator className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Calcolo Straordinari e Compenso Lordo
              </h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                CCNL AIOP-ARIS (T011)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Formula ufficiale: Ore × Paga Base ({calcState.settings.pagaOrariaBase.toFixed(5)} €) × (1 + Maggiorazione)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Import from Sheet Button */}
          {eligibleSheetEntriesToImport.length > 0 && (
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 rounded-lg transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Importa da Registro ({eligibleSheetEntriesToImport.length})</span>
            </button>
          )}

          {/* Export CSV */}
          <button
            onClick={handleExportCalcCsv}
            title="Esporta calcoli del mese in CSV"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>CSV</span>
          </button>

          {/* Toggle Config Parameters */}
          <button
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              showConfigPanel
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                : 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Parametri CCNL</span>
          </button>

          {/* Add Performance Button */}
          <button
            onClick={() => {
              setEditingRecord(null);
              setIsRecordModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 shadow-sm rounded-lg transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Registra Prestazione</span>
          </button>
        </div>
      </div>

      {/* 2. Mandatory Contract Disclaimer Banner */}
      <div className="p-3.5 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold">
            Configurazione iniziale da confermare secondo il contratto e gli eventuali accordi aziendali, non come regole verificate dall&apos;app.
          </p>
          <p className="text-[11px] text-amber-800 dark:text-amber-300">
            Paga base lorda standard: <strong>11,56160 €/ora</strong> · Maggiorazioni: Diurno feriale <strong>+20%</strong>, Notturno/Festivo <strong>+30%</strong>, Notturno &amp; Festivo <strong>+50%</strong>. Puoi personalizzare questi parametri in qualsiasi momento dal pannello &quot;Parametri CCNL&quot;.
          </p>
        </div>
      </div>

      {/* 3. Collapsible CCNL Parameter Settings Panel */}
      {showConfigPanel && (
        <form
          onSubmit={handleSaveConfig}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4 animate-in fade-in duration-150 transition-colors"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                <span>Parametri Contrattuali Modificabili (CCNL e Paga Oraria)</span>
              </h3>
              <p className="text-xs text-slate-500">
                I valori aggiornati ricalcoleranno istantaneamente tutte le prestazioni registrate
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetConfig}
              className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Ripristina Valori Iniziali
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                CCNL di Riferimento
              </label>
              <input
                type="text"
                value={tempConfig.ccnl}
                onChange={(e) => setTempConfig({ ...tempConfig, ccnl: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Paga Oraria Base Lorda (€) *
              </label>
              <input
                type="number"
                step="0.00001"
                required
                value={tempConfig.pagaOrariaBase}
                onChange={(e) =>
                  setTempConfig({
                    ...tempConfig,
                    pagaOrariaBase: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400">Default iniziale: 11,56160 €</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Straordinario Diurno Feriale (%) *
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="1"
                  required
                  value={tempConfig.maggiorazioneDiurnoFeriale}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      maggiorazioneDiurnoFeriale: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold"
                />
                <span className="text-xs font-bold text-slate-500">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notturno oppure Festivo (%) *
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="1"
                  required
                  value={tempConfig.maggiorazioneNotturnoFestivo}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      maggiorazioneNotturnoFestivo: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold"
                />
                <span className="text-xs font-bold text-slate-500">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notturno e Festivo Insieme (%) *
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="1"
                  required
                  value={tempConfig.maggiorazioneNotturnoEFestivo}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      maggiorazioneNotturnoEFestivo: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold"
                />
                <span className="text-xs font-bold text-slate-500">%</span>
              </div>
            </div>
          </div>

          {/* Test di riferimento box */}
          <div className="p-3 bg-slate-100 dark:bg-slate-800/70 rounded-xl text-xs flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300">
              <strong>Test di riferimento:</strong> 10 ore diurne feriali × {tempConfig.pagaOrariaBase.toFixed(5)} € × {(1 + tempConfig.maggiorazioneDiurnoFeriale / 100).toFixed(2)} =
            </span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
              {formatCurrency(10 * tempConfig.pagaOrariaBase * (1 + tempConfig.maggiorazioneDiurnoFeriale / 100))} lordi
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowConfigPanel(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Chiudi
            </button>
            <button
              type="submit"
              disabled={isSavingConfig}
              className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
            >
              {isSavingConfig ? 'Salvataggio...' : 'Applica e Ricalcola'}
            </button>
          </div>
        </form>
      )}

      {/* 4. Month Selector & Filter Toggle Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Mese:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs font-bold bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white cursor-pointer"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthYear(m)} ({m})
              </option>
            ))}
          </select>
        </div>

        {/* Worked Month vs Expected Payment Month toggle */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setFilterMode('LAVORATO')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              filterMode === 'LAVORATO'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Filtra per Mese Lavorato
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('PAGAMENTO')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              filterMode === 'PAGAMENTO'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Filtra per Mese di Pagamento
          </button>
        </div>
      </div>

      {/* 5. Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Compenso Lordo Atteso in Pagamento */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
            <span>Compenso Lordo Atteso</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {formatCurrency(summary.importoAttesoInPagamento)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {filterMode === 'LAVORATO' ? 'Da liquidare per il mese lavorato' : 'Previsto nel cedolino del mese'}
          </p>
          {summary.oreRecuperateRiposo > 0 && (
            <div className="mt-2 text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
              Escluse {summary.oreRecuperateRiposo.toFixed(1)}h a riposo compensativo
            </div>
          )}
        </div>

        {/* Card 2: Ore Totali e Tipologie */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
            <span>Ore Straordinario Totali</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {summary.oreTotali.toFixed(2)}h
          </div>
          <div className="mt-2 text-[10px] text-slate-500 space-y-0.5">
            <div className="flex justify-between">
              <span>Diurno feriale (+20%):</span>
              <strong className="font-mono">{summary.oreDiurnoFeriale.toFixed(2)}h</strong>
            </div>
            <div className="flex justify-between">
              <span>Notturno/Festivo (+30%):</span>
              <strong className="font-mono">{summary.oreNotturnoFestivo.toFixed(2)}h</strong>
            </div>
            <div className="flex justify-between">
              <span>Notturno &amp; Festivo (+50%):</span>
              <strong className="font-mono">{summary.oreNotturnoEFestivo.toFixed(2)}h</strong>
            </div>
          </div>
        </div>

        {/* Card 3: Sola Maggiorazione vs Compenso Completo */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
            <span>Quota di Sola Maggiorazione</span>
            <Percent className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-teal-700 dark:text-teal-400">
            {formatCurrency(summary.solaMaggiorazioneMaturata)}
          </div>
          <div className="mt-2 text-[10px] text-slate-500">
            <span>Compenso completo base + maggiorazione: </span>
            <strong className="font-mono">{formatCurrency(summary.compensoCompletoMaturato)}</strong>
          </div>
        </div>

        {/* Card 4: Stato Pagamenti (Pagato vs Da Pagare) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
            <span>Stato Liquidazione</span>
            <Receipt className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Ancora da pagare:</span>
              <span className="font-bold font-mono text-rose-600 dark:text-rose-400">
                {formatCurrency(summary.importiAncoraDaPagare)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Già liquidato:</span>
              <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatCurrency(summary.importiGiaPagati)}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px] text-slate-400">
            <span>Prestazioni registrate:</span>
            <strong>{summary.conteggioPrestazioni}</strong>
          </div>
        </div>
      </div>

      {/* 6. Confronto Cedolino Busta Paga & Stima Netto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel A: Confronto Straordinario Lordo Cedolino */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Confronto con Cedolino Effettivo ({formatMonthYear(selectedMonth)})
              </h3>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Inserisci l&apos;importo di straordinario lordo effettivamente liquidato sul cedolino paga per verificare la correttezza contabile.
          </p>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400">€</span>
              <input
                type="number"
                step="0.01"
                placeholder="Es. 138.74"
                value={cedolinoInput}
                onChange={(e) => setCedolinoInput(e.target.value)}
                className="w-full pl-7 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>
            <button
              onClick={handleSaveCedolino}
              className="px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Salva Cedolino
            </button>
          </div>

          {/* Confronto Scostamento Feedback */}
          {scostamentoCedolino && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                scostamentoCedolino.isExact
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : scostamentoCedolino.isHigher
                  ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              {scostamentoCedolino.isExact ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">
                    {scostamentoCedolino.isExact
                      ? 'Perfetta corrispondenza col cedolino!'
                      : scostamentoCedolino.isHigher
                      ? 'Cedolino superiore all\'importo atteso'
                      : 'Attenzione: Differenza riscontrata con il cedolino'}
                  </span>
                  <span className="font-mono font-bold">
                    (Scostamento: {scostamentoCedolino.diff > 0 ? '+' : ''}
                    {formatCurrency(scostamentoCedolino.diff)})
                  </span>
                </div>
                <p className="text-[11px]">
                  Atteso da calcolo: <strong>{formatCurrency(summary.importoAttesoInPagamento)}</strong> · Liquidato cedolino: <strong>{formatCurrency(cedolinoLiquidatoVal)}</strong>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Panel B: Stima Netto (con percentuale libera utente) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Stima Netto in Busta Paga
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Aliquota media trattenute (IRPEF + Addizionali + INPS):
            </label>
            <div className="flex items-center gap-1 w-24">
              <input
                type="number"
                min="0"
                max="90"
                step="1"
                placeholder="25"
                value={trattenutePercent}
                onChange={(e) => setTrattenutePercent(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold text-right"
              />
              <span className="text-xs font-bold text-slate-500">%</span>
            </div>
          </div>

          {netEstimate ? (
            <div className="p-3 bg-teal-50/70 dark:bg-teal-950/40 rounded-xl border border-teal-200 dark:border-teal-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-900 dark:text-teal-200">
                  Netto Stimato:
                </span>
                <span className="text-xl font-bold font-mono text-teal-700 dark:text-teal-300">
                  {formatCurrency(netEstimate.nettoStimato)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-teal-800 dark:text-teal-400">
                <span>Trattenute stimate ({netEstimate.aliquotaApplicata}%):</span>
                <span className="font-mono">-{formatCurrency(netEstimate.trattenute)}</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 italic pt-1 border-t border-teal-200/60 dark:border-teal-800/60">
                Netto stimato: l’importo effettivo dipende da imposte, contributi e conguagli.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-500">
              Inserisci la percentuale di trattenuta per visualizzare la stima del compenso netto.
            </div>
          )}
        </div>
      </div>

      {/* 7. Detailed Table of Overtime Records */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Registro Prestazioni di Straordinario ({filteredRecords.length})
            </h3>
            <p className="text-xs text-slate-500">
              Dettaglio analitico delle ore prestate e compenso lordo calcolato
            </p>
          </div>
          <button
            onClick={() => {
              setEditingRecord(null);
              setIsRecordModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuova Prestazione
          </button>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Nessuna prestazione registrata per {formatMonthYear(selectedMonth)}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Puoi registrare manualmente una prestazione di straordinario oppure importare direttamente i turni con straordinario dal registro mensile.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => {
                  setEditingRecord(null);
                  setIsRecordModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
              >
                Inserisci Prima Prestazione
              </button>
              {eligibleSheetEntriesToImport.length > 0 && (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer border border-rose-200"
                >
                  Importa da Foglio Mese ({eligibleSheetEntriesToImport.length})
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-3">Data</th>
                  <th className="py-3 px-3">Ore / Minuti</th>
                  <th className="py-3 px-3">Tipologia &amp; Maggiorazione</th>
                  <th className="py-3 px-3">Mese Lavorato</th>
                  <th className="py-3 px-3">Mese Pagamento</th>
                  <th className="py-3 px-3">Compenso Lordo Completo</th>
                  <th className="py-3 px-3">Sola Maggiorazione</th>
                  <th className="py-3 px-3">Stato</th>
                  <th className="py-3 px-3">Nota</th>
                  <th className="py-3 px-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Data */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {rec.data}
                    </td>

                    {/* Ore / Minuti */}
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {rec.ore}h {rec.minuti}m
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        ({rec.oreDecimali.toFixed(2)}h)
                      </span>
                    </td>

                    {/* Tipologia */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          rec.tipologia === 'DIURNO_FERIALE'
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            : rec.tipologia === 'NOTTURNO_O_FESTIVO'
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        +{rec.maggiorazionePercentuale}%
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {rec.tipologia === 'DIURNO_FERIALE'
                          ? 'Diurno feriale'
                          : rec.tipologia === 'NOTTURNO_O_FESTIVO'
                          ? 'Notturno/Festivo'
                          : 'Notturno & Festivo'}
                      </span>
                    </td>

                    {/* Mese Lavorato */}
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                      {rec.meseLavorato}
                    </td>

                    {/* Mese Pagamento */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {rec.mesePrevistoPagamento}
                    </td>

                    {/* Compenso Completo */}
                    <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(rec.compensoCompletoLordo)}
                    </td>

                    {/* Sola Maggiorazione */}
                    <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                      {formatCurrency(rec.solaMaggiorazioneLordi)}
                    </td>

                    {/* Stato with quick cycle button */}
                    <td className="py-3 px-3">
                      <button
                        onClick={() => handleCycleStatus(rec)}
                        title="Clicca per cambiare stato rapidamente"
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                          rec.stato === 'PAGATO'
                            ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                            : rec.stato === 'RECUPERATO_RIPOSO'
                            ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                            : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {rec.stato === 'PAGATO' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Pagato
                          </>
                        ) : rec.stato === 'RECUPERATO_RIPOSO' ? (
                          'Riposo'
                        ) : (
                          'Da Pagare'
                        )}
                      </button>
                    </td>

                    {/* Nota */}
                    <td className="py-3 px-3 text-slate-500 max-w-[140px] truncate" title={rec.nota}>
                      {rec.nota || '-'}
                    </td>

                    {/* Azioni */}
                    <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditingRecord(rec);
                          setIsRecordModalOpen(true);
                        }}
                        title="Modifica"
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRecord(rec.id)}
                        title="Elimina"
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 8. Indennità Separate Facoltative (CCNL AIOP-ARIS) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        <button
          onClick={() => setShowAllowancesPanel(!showAllowancesPanel)}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Indennità Separate Facoltative (CCNL AIOP-ARIS)</span>
                {filteredAllowances.length > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-300 font-mono">
                    {formatCurrency(totalAllowancesLordo)}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500">
                Notturno ordinario, indennità festive e tre turni configurate e conteggiate separatamente
              </p>
            </div>
          </div>
          {showAllowancesPanel ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showAllowancesPanel && (
          <div className="p-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Regola di gestione indennità:
              </p>
              <p className="text-[11px] leading-relaxed">
                I valori indicati sono iniziali modificabili: <strong>Turno notturno ordinario (2,74 €/ora)</strong>, <strong>Indennità festiva intera (17,82 €/evento)</strong>, <strong>Indennità festiva ridotta (8,91 €/evento)</strong>, <strong>Indennità tre turni (4,50 €/giornata)</strong>. Non vengono aggiunti automaticamente allo straordinario e non si presume che siano sempre cumulabili.
              </p>
            </div>

            {/* Quick Add Allowance Form */}
            <form onSubmit={handleAddAllowance} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tipologia Indennità
                </label>
                <select
                  value={allowanceForm.tipo}
                  onChange={(e) =>
                    setAllowanceForm({ ...allowanceForm, tipo: e.target.value as AllowanceType })
                  }
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="NOTTURNO_ORDINARIO">Turno Notturno Ord. (2,74 €/h)</option>
                  <option value="FESTIVA_INTERA">Indennità Festiva Intera (17,82 €)</option>
                  <option value="FESTIVA_RIDOTTA">Indennità Festiva Ridotta (8,91 €)</option>
                  <option value="TRE_TURNI">Indennità Tre Turni (4,50 €/g)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Quantità (Ore/Eventi/Giorni)
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  required
                  value={allowanceForm.quantita}
                  onChange={(e) =>
                    setAllowanceForm({
                      ...allowanceForm,
                      quantita: parseFloat(e.target.value) || 1,
                    })
                  }
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Data
                </label>
                <input
                  type="date"
                  required
                  value={allowanceForm.data}
                  onChange={(e) => setAllowanceForm({ ...allowanceForm, data: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nota
                </label>
                <input
                  type="text"
                  placeholder="Es. Turno 20-08 festivo"
                  value={allowanceForm.nota}
                  onChange={(e) => setAllowanceForm({ ...allowanceForm, nota: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-1.5 px-3 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer"
                >
                  Aggiungi Indennità
                </button>
              </div>
            </form>

            {/* List of Registered Allowances for the month */}
            {filteredAllowances.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2 px-3">Data</th>
                      <th className="py-2 px-3">Tipo Indennità</th>
                      <th className="py-2 px-3">Quantità</th>
                      <th className="py-2 px-3">Tariffa</th>
                      <th className="py-2 px-3">Totale Lordo</th>
                      <th className="py-2 px-3">Nota</th>
                      <th className="py-2 px-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredAllowances.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 px-3 font-mono">{a.data}</td>
                        <td className="py-2 px-3 font-semibold">{a.tipoLabel}</td>
                        <td className="py-2 px-3 font-mono">
                          {a.quantita} {a.unitaMisura.toLowerCase()}
                        </td>
                        <td className="py-2 px-3 font-mono">{formatCurrency(a.tariffaUnitaria)}</td>
                        <td className="py-2 px-3 font-mono font-bold text-teal-600 dark:text-teal-400">
                          {formatCurrency(a.totaleLordo)}
                        </td>
                        <td className="py-2 px-3 text-slate-500">{a.nota || '-'}</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleDeleteAllowance(a.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 9. Modal for Record Creation/Edit */}
      <OvertimeRecordModal
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          setEditingRecord(null);
        }}
        onSaveRecord={handleSaveRecords}
        editingRecord={editingRecord}
        config={calcState.settings}
        currentSheet={currentSheet}
      />

      {/* 10. Modal for Importing from Current Sheet */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in duration-150">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold">Importa da Registro Straordinari</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Sono state trovate <strong>{eligibleSheetEntriesToImport.length}</strong> righe di straordinario nel foglio di <strong>{currentSheet?.nomeMese}</strong> non ancora presenti nel calcolo compensi.
              </p>
              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {eligibleSheetEntriesToImport.map((e) => (
                  <div key={e.id} className="p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        Giorno {e.giorno}: {e.turnoType}
                      </span>
                      <p className="text-[11px] text-slate-500">{e.motivo || 'Nessun motivo specificato'}</p>
                    </div>
                    <span className="font-mono font-bold text-emerald-600">
                      {e.totaleOreStraordinario}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 italic">
                L&apos;importazione eviterà duplicazioni e applicherà automaticamente le maggiorazioni CCNL (con rilevamento automatico turni notturni).
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900"
              >
                Annulla
              </button>
              <button
                onClick={handleImportAllEligibleEntries}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
              >
                Conferma Importazione ({eligibleSheetEntriesToImport.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
