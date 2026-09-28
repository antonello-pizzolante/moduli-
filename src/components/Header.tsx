import React, { useState } from 'react';
import {
  FileText,
  Clock,
  Send,
  Database,
  User,
  Plus,
  Download,
  FileSpreadsheet,
  Calculator,
  LogOut,
  Smartphone,
  Layers,
  Repeat,
  AlertCircle,
  LayoutGrid,
  Sparkles,
  BookOpen,
  Menu,
  X,
  ChevronDown,
  CalendarDays,
  Upload,
} from 'lucide-react';
import { MonthlySheet, ActiveAppModule } from '../types';
import { downloadSheetCsv } from '../utils/csvExporter';
import { ThemeSelector } from './ThemeSelector';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';
import { ArubaPecTutorialModal } from './ArubaPecTutorialModal';

interface HeaderProps {
  activeTab: 'registro' | 'anteprima' | 'calcolo' | 'pec' | 'archivio' | 'profilo';
  setActiveTab: (tab: 'registro' | 'anteprima' | 'calcolo' | 'pec' | 'archivio' | 'profilo') => void;
  activeModule: ActiveAppModule;
  setActiveModule: (mod: ActiveAppModule) => void;
  currentSheet: MonthlySheet | null;
  onOpenAddModal: () => void;
  onOpenOnlineModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeModule,
  setActiveModule,
  currentSheet,
  onOpenAddModal,
  onOpenOnlineModal,
}) => {
  const { user, logout, isDemo } = useAuth();
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {isDemo && (
        <div className="bg-indigo-600 text-white text-xs font-bold py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-xs z-40 relative">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>AMBIENTE DIMOSTRATIVO · Dati sintetici simulati · Invii PEC reali disabilitati</span>
        </div>
      )}
      <header className="relative md:sticky md:top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-[56px] py-1.5 gap-2">
          {/* Zone 1: Brand Wordmark with Official Sanitaservice Logo (Original Unaltered Image) */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0">
            <button
              onClick={() => setActiveModule('SELECTOR_HUB')}
              className="text-left group cursor-pointer focus:outline-hidden flex items-center gap-1.5 sm:gap-2.5 min-h-[44px]"
              title="Torna all'Hub di selezione moduli"
            >
              <img
                src="/sanitaservice_logo_colori.png?v=2"
                alt="Sanitaservice ASL TA s.r.l. Unipersonale"
                className="h-8 xs:h-9 sm:h-10 w-auto object-contain shrink-0 rounded-md"
              />
              <div className="flex flex-col shrink-0">
                <span className="text-xs xs:text-sm sm:text-base lg:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                  S.E.T. <span className="text-rose-600">118</span>
                </span>
                <span className="text-[8px] xs:text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  Taranto · ASL TA
                </span>
              </div>
            </button>

            {/* Quick Button to Switch Modules Hub (Desktop & Tablet) */}
            <button
              onClick={() => setActiveModule('SELECTOR_HUB')}
              className={`hidden sm:inline-flex min-h-[40px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer items-center gap-1.5 border ${
                activeModule === 'SELECTOR_HUB'
                  ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:border-emerald-500 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Scelta Moduli</span>
            </button>
          </div>

          {/* Zone 2: Module Switcher Pills on Desktop (Preserved exactly for PC) */}
          <div className="hidden xl:flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
            <button
              onClick={() => setActiveModule('STRAORDINARI')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeModule === 'STRAORDINARI'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Straordinari</span>
            </button>

            <button
              onClick={() => setActiveModule('CAMBIO_TURNO')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeModule === 'CAMBIO_TURNO'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Repeat className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Cambi Turno</span>
            </button>

            <button
              onClick={() => setActiveModule('PERMESSI_TIMBRATURA')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeModule === 'PERMESSI_TIMBRATURA'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Permessi & Timbrature</span>
            </button>

            <button
              onClick={() => setActiveModule('IMPORTA_TURNI')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeModule === 'IMPORTA_TURNI'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Carica turni</span>
            </button>
          </div>

          {/* Zone 3: Desktop Actions (Preserved for Desktop >= 1280px) */}
          <div className="hidden xl:flex items-center gap-1.5 sm:gap-2">
            {/* Guida PEC Aruba Tutorial */}
            <button
              onClick={() => setShowTutorialModal(true)}
              title="Apri il Tutorial Aruba PEC scritto per i dipendenti S.E.T. 118"
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Guida PEC</span>
            </button>

            {/* Online / Smartphone Access Button */}
            <button
              onClick={onOpenOnlineModal}
              title="Accedi online da smartphone, tablet o condividi link con colleghi"
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Smartphone</span>
            </button>

            {/* PWA Install Button */}
            <PWAInstallButton />

            {/* Theme Selector */}
            <ThemeSelector />

            {activeModule === 'STRAORDINARI' && currentSheet && (
              <>
                {/* Esporta CSV Quick Action */}
                <button
                  onClick={() => downloadSheetCsv(currentSheet)}
                  title="Esporta dati registro mese in formato CSV (Backup Offline)"
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>CSV</span>
                </button>

                {/* Scarica PDF */}
                <button
                  onClick={async () => {
                    const { downloadPdf } = await import('../utils/pdfGenerator');
                    downloadPdf(currentSheet);
                  }}
                  title="Scarica PDF Ufficiale Compilato"
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <span>PDF</span>
                </button>

                {/* Prominent '+' Inserisci Straordinario button */}
                <button
                  onClick={onOpenAddModal}
                  id="btn-add-overtime"
                  className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 active:scale-98 shadow-sm hover:shadow-md rounded-lg transition-all whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Nuovo Turno</span>
                </button>
              </>
            )}

            {/* Logged in Employee Badge & Logout */}
            {user && (
              <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => {
                    setActiveModule('STRAORDINARI');
                    setActiveTab('profilo');
                  }}
                  className="min-h-[40px] flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-left transition-colors cursor-pointer group"
                  title="Visualizza e modifica profilo dipendente"
                >
                  <div className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center font-black text-[10px] shadow-2xs">
                    {user.nome?.[0] || 'U'}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-none group-hover:text-rose-600 dark:group-hover:text-rose-400 flex items-center gap-1.5">
                      {user.cognome} {user.nome}
                      {isDemo && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                          DEMO
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      Matr. {user.matricola}
                    </span>
                  </div>
                </button>

                <button
                  onClick={logout}
                  title="Disconnetti ed esci dall'area personale"
                  className="min-h-[40px] px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Esci</span>
                </button>
              </div>
            )}
          </div>

          {/* Zone 3 Mobile & Tablet (screens < 1280px): Clean 44x44px Touch Controls, No Overlaps! */}
          <div className="flex xl:hidden items-center gap-1.5 sm:gap-2">
            {/* Primary Action: Add Overtime */}
            {activeModule === 'STRAORDINARI' && currentSheet && (
              <button
                onClick={onOpenAddModal}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-98 shadow-sm rounded-xl transition-all cursor-pointer shrink-0"
                title="Inserisci nuovo turno con straordinario"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden xs:inline">Nuovo Turno</span>
              </button>
            )}

            {/* Profile Avatar Quick Touch (Min 44x44px) */}
            {user && (
              <button
                onClick={() => {
                  setActiveModule('STRAORDINARI');
                  setActiveTab('profilo');
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
                title={`Profilo: ${user.cognome} ${user.nome} (Matr. ${user.matricola})`}
              >
                <div className="w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center font-black text-xs shadow-2xs">
                  {user.nome?.[0] || 'U'}
                </div>
              </button>
            )}

            {/* Theme Selector (compact 44x44px target) */}
            <div className="shrink-0">
              <ThemeSelector compact={true} />
            </div>

            {/* Hamburger / Action Menu Toggle Button (Min 44x44px) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shrink-0"
              title="Apri menu strumenti e azioni"
              aria-label="Menu opzioni e strumenti"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-rose-600" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Secondary Actions Drawer (Clean 44px Buttons with Labels) */}
        {mobileMenuOpen && (
          <div className="xl:hidden py-3 px-1 border-t border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md rounded-b-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Selettore rapido moduli per smartphone e tablet */}
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 pt-1">
              Moduli di Servizio S.E.T. 118
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setActiveModule('STRAORDINARI');
                  setMobileMenuOpen(false);
                }}
                className={`min-h-[44px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  activeModule === 'STRAORDINARI'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-bold shadow-2xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              >
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="text-left">
                  <div className="font-bold">Prospetto Straordinari</div>
                  <div className="text-[10px] text-slate-400">Modello 118 mensile</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveModule('CAMBIO_TURNO');
                  setMobileMenuOpen(false);
                }}
                className={`min-h-[44px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  activeModule === 'CAMBIO_TURNO'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-bold shadow-2xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              >
                <Repeat className="w-4 h-4 text-indigo-600 shrink-0" />
                <div className="text-left">
                  <div className="font-bold">Modello Cambi Turno</div>
                  <div className="text-[10px] text-slate-400">Richiesta tra colleghi</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveModule('PERMESSI_TIMBRATURA');
                  setMobileMenuOpen(false);
                }}
                className={`min-h-[44px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  activeModule === 'PERMESSI_TIMBRATURA'
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-bold shadow-2xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              >
                <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="text-left">
                  <div className="font-bold">Permessi & Timbrature</div>
                  <div className="text-[10px] text-slate-400">Assenze e timbrature</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveModule('IMPORTA_TURNI');
                  setMobileMenuOpen(false);
                }}
                className={`min-h-[44px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  activeModule === 'IMPORTA_TURNI'
                    ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-200 font-bold shadow-2xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              >
                <Upload className="w-4 h-4 text-teal-600 shrink-0" />
                <div className="text-left">
                  <div className="font-bold">Carica turni</div>
                  <div className="text-[10px] text-slate-400">PDF & Foto con OCR</div>
                </div>
              </button>
            </div>

            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              Strumenti & Accesso
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Guida PEC Aruba */}
              <button
                onClick={() => {
                  setShowTutorialModal(true);
                  setMobileMenuOpen(false);
                }}
                className="min-h-[44px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold shadow-2xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="text-left">
                  <div className="font-bold">Guida Ufficiale PEC</div>
                  <div className="text-[10px] text-slate-400">Tutorial Aruba per dipendenti 118</div>
                </div>
              </button>

              {/* Smartphone & QR Code Access */}
              <button
                onClick={() => {
                  onOpenOnlineModal();
                  setMobileMenuOpen(false);
                }}
                className="min-h-[44px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold shadow-2xs hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <Smartphone className="w-4 h-4 text-indigo-600 shrink-0" />
                <div className="text-left">
                  <div className="font-bold">Accesso Smartphone & QR</div>
                  <div className="text-[10px] text-slate-400">Usa dal cellulare o condividi link</div>
                </div>
              </button>

              {/* PWA Install */}
              <div className="min-h-[44px] flex items-center px-1">
                <PWAInstallButton />
              </div>

              {/* CSV & PDF Quick Actions for current sheet */}
              {activeModule === 'STRAORDINARI' && currentSheet && (
                <>
                  <button
                    onClick={() => {
                      downloadSheetCsv(currentSheet);
                      setMobileMenuOpen(false);
                    }}
                    className="min-h-[44px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="text-left">
                      <div className="font-bold">Esporta Registro in CSV</div>
                      <div className="text-[10px] text-slate-400">Backup offline del mese</div>
                    </div>
                  </button>

                  <button
                    onClick={async () => {
                      const { downloadPdf } = await import('../utils/pdfGenerator');
                      downloadPdf(currentSheet);
                      setMobileMenuOpen(false);
                    }}
                    className="min-h-[44px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-rose-600 shrink-0" />
                    <div className="text-left">
                      <div className="font-bold">Scarica Modello Ufficiale PDF</div>
                      <div className="text-[10px] text-slate-400">Copia conforme cartacea 1:1</div>
                    </div>
                  </button>
                </>
              )}

              {/* Logout button */}
              {user && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="min-h-[44px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs font-bold shadow-2xs hover:bg-rose-100 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                  <div className="text-left">
                    <div>Disconnetti ({user.cognome} {user.nome})</div>
                    <div className="text-[10px] text-rose-500 font-normal">Esci dall&apos;area personale</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Subnav strip when in STRAORDINARI module: Touch-friendly min 44px buttons */}
        {activeModule === 'STRAORDINARI' && (
          <nav className="flex items-center gap-1 sm:gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 py-1.5 border-t border-slate-100 dark:border-slate-800 overflow-x-auto scrollbar-none touch-pan-x">
            <button
              onClick={() => setActiveTab('registro')}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'registro'
                  ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 font-bold shadow-2xs'
                  : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>Registro Turni</span>
            </button>
            <button
              onClick={() => setActiveTab('anteprima')}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'anteprima'
                  ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 font-bold shadow-2xs'
                  : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Foglio Originale PDF</span>
            </button>
            <button
              onClick={() => setActiveTab('calcolo')}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'calcolo'
                  ? 'text-emerald-900 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 font-bold shadow-2xs'
                  : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Calcolo Straordinari</span>
            </button>
            <button
              onClick={() => setActiveTab('pec')}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pec'
                  ? 'text-emerald-900 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 font-bold shadow-2xs'
                  : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Send className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Invio PEC Giorno 1</span>
            </button>
            <button
              onClick={() => setActiveTab('archivio')}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'archivio'
                  ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 font-bold shadow-2xs'
                  : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Archivio Rete</span>
            </button>
            <button
              onClick={() => setActiveTab('profilo')}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'profilo'
                  ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 font-bold shadow-2xs'
                  : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Profilo Dipendente</span>
            </button>
          </nav>
        )}

        {/* Mobile & Tablet module strip (Min 44px touch targets) */}
        <div className="flex xl:hidden overflow-x-auto py-2 gap-2 border-t border-slate-100 dark:border-slate-800 scrollbar-none text-xs touch-pan-x">
          <button
            onClick={() => setActiveModule('SELECTOR_HUB')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl whitespace-nowrap font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
              activeModule === 'SELECTOR_HUB'
                ? 'bg-slate-900 text-white dark:bg-emerald-600 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <LayoutGrid className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Hub Moduli</span>
          </button>
          <button
            onClick={() => setActiveModule('STRAORDINARI')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl whitespace-nowrap font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
              activeModule === 'STRAORDINARI'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>Straordinari</span>
          </button>
          <button
            onClick={() => setActiveModule('CAMBIO_TURNO')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl whitespace-nowrap font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
              activeModule === 'CAMBIO_TURNO'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Repeat className="w-4 h-4 shrink-0" />
            <span>Cambi Turno</span>
          </button>
          <button
            onClick={() => setActiveModule('PERMESSI_TIMBRATURA')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl whitespace-nowrap font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
              activeModule === 'PERMESSI_TIMBRATURA'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Permessi & Timbrature</span>
          </button>
          <button
            onClick={() => setActiveModule('IMPORTA_TURNI')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl whitespace-nowrap font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
              activeModule === 'IMPORTA_TURNI'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Carica turni</span>
          </button>
        </div>
      </div>
      {showTutorialModal && (
        <ArubaPecTutorialModal
          isOpen={showTutorialModal}
          onClose={() => setShowTutorialModal(false)}
        />
      )}
    </header>
    </>
  );
};
