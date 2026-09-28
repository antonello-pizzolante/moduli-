import React from 'react';
import {
  Clock,
  Repeat,
  FileSpreadsheet,
  FileCheck,
  Send,
  ShieldCheck,
  ArrowRight,
  UserCheck,
  AlertCircle,
  FileText,
  CalendarDays,
  Upload,
} from 'lucide-react';
import { ActiveAppModule, EmployeeProfile } from '../types';

interface ModuleSelectorHubProps {
  onSelectModule: (module: ActiveAppModule) => void;
  profile: EmployeeProfile;
  currentActive?: ActiveAppModule;
}

export const ModuleSelectorHub: React.FC<ModuleSelectorHubProps> = ({
  onSelectModule,
  profile,
  currentActive,
}) => {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-md border border-slate-700/60 relative overflow-hidden flex flex-col md:flex-row items-center md:items-center justify-between gap-4 sm:gap-6">
        <div className="relative z-10 max-w-2xl space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="truncate">Portale Operativo 118 – Sanitaservice ASL TA</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">
            Benvenuto, {profile.nome} {profile.cognome}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Matricola: <span className="font-mono text-white font-bold">{profile.matricola}</span> | Postazione: <span className="text-white font-bold">{profile.postazione}</span> | Qualifica: <span className="text-white font-bold">{profile.qualifica}</span>
          </p>
          <p className="text-xs sm:text-sm text-slate-400 pt-1">
            Seleziona il modulo ufficiale che desideri compilare. Tutti i documenti generano il PDF conforme 1:1 e possono essere trasmessi con valore legale via PEC all&apos;Ufficio Personale.
          </p>
        </div>

        <div className="relative z-10 shrink-0 w-full sm:w-auto flex justify-center md:justify-end">
          <img
            src="/loghi_originali_pdf.png?v=2"
            alt="Sanitaservice ASL TA s.r.l. Unipersonale · ASL Taranto PugliaSalute"
            className="h-9 xs:h-11 sm:h-14 max-w-[260px] xs:max-w-xs sm:max-w-none w-auto object-contain"
          />
        </div>
      </div>

      {/* Grid of 4 Main Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Module 1: Foglio Firme Straordinari */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all p-6 flex flex-col justify-between shadow-xs hover:shadow-md group">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6" />
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Modulo Mensile
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                Prospetto Straordinari S.E.T. 118
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Gestione foglio mensile dei turni, calcolo automatico ore ordinarie e straordinarie, apposizione firma digitale e trasmissione PEC autonoma giorno 1 del mese.
              </p>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Riepilogo ore & compenso lordo</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <Send className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Invio programmato PEC Aruba</span>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={() => onSelectModule('STRAORDINARI')}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-emerald-700 dark:bg-emerald-800 dark:hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <span>Compila Foglio Straordinari</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Module 2: Modello per Cambi Turno */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all p-6 flex flex-col justify-between shadow-xs hover:shadow-md group">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Repeat className="w-6 h-6" />
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Accordo Tra Colleghi
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                Modello per Cambi Turno
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Compilazione ufficiale richiesta cambio turno tra colleghi (autista soccorritore o soccorritore), specifica orari e data, firma richiedente e spedizione istantanea via PEC.
              </p>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Richiedente & Accettante</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <FileCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>PDF conforme con logo e note</span>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={() => onSelectModule('CAMBIO_TURNO')}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <span>Compila Cambio Turno</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Module 3: Permessi & Mancata Timbratura */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 transition-all p-6 flex flex-col justify-between shadow-xs hover:shadow-md group">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6" />
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Assenze & Omissioni
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                Permessi & Mancata Timbratura
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Richiesta autorizzazione assenza (ferie, ROL, congedo, recupero festività, Legge 104, art. 34) e dichiarazione omessa timbratura entrata/uscita con causale formale.
              </p>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Omessa timbratura & orario</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Firma Sanitaservice & PugliaSalute</span>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={() => onSelectModule('PERMESSI_TIMBRATURA')}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-amber-700 dark:bg-amber-800 dark:hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <span>Compila Permessi / Timbratura</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Module 4: Carica Turni da PDF / Foto */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500 transition-all p-6 flex flex-col justify-between shadow-xs hover:shadow-md group">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CalendarDays className="w-6 h-6" />
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Pianificazione & Calendario
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                Carica Turni da PDF / Foto
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Carica il prospetto turni mensile in PDF o foto (anche multi-pagina). L&apos;app individua i tuoi turni con OCR certificato ed esporta nel calendario del telefono (.ics).
              </p>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Solo i tuoi turni (privacy protetta)</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <CalendarDays className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Export Google / Apple / Outlook</span>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={() => onSelectModule('IMPORTA_TURNI')}
              className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Carica turni</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Info Card on PEC Transmission */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-600 flex items-center justify-center shrink-0">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-white block">
              Invio PEC Certificato con Credenziali Aruba
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              Ogni modulo inviato viene recapitato via PEC a <span className="font-mono text-slate-800 dark:text-slate-200">118centrale@sanitaserviceaslta.it</span> e archiviato nel tuo registro personale.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
