import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Shield, Palette, Check } from 'lucide-react';
import { useTheme, AppTheme } from '../context/ThemeContext';

export const ThemeSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const themes: { id: AppTheme; label: string; desc: string; icon: React.ReactNode; previewBg: string }[] = [
    {
      id: 'night',
      label: 'Turno Notte 118',
      desc: 'Dark mode per cabina ambulanza & turni 20:00-08:00',
      icon: <Moon className="w-4 h-4 text-indigo-400" />,
      previewBg: 'bg-slate-900 border-slate-700 text-white',
    },
    {
      id: 'clinical',
      label: 'Clinico Ospedaliero',
      desc: 'Chiaro ad alta leggibilità e contrasto morbido',
      icon: <Sun className="w-4 h-4 text-amber-500" />,
      previewBg: 'bg-slate-100 border-slate-300 text-slate-800',
    },
    {
      id: 'emergency',
      label: 'Rosso Soccorso 118',
      desc: 'Stile istituzionale Sanitaservice ASL TA',
      icon: <Shield className="w-4 h-4 text-rose-500" />,
      previewBg: 'bg-rose-50 border-rose-200 text-rose-900',
    },
  ];

  const currentThemeObj = themes.find((t) => t.id === theme) || themes[0];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={`Tema attivo: ${currentThemeObj.label}. Clicca per cambiare tema.`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
          theme === 'night'
            ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 shadow-xs'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 shadow-xs'
        }`}
      >
        {currentThemeObj.icon}
        {!compact && (
          <span className="text-xs font-semibold hidden md:inline-block">
            {currentThemeObj.label}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl shadow-xl border py-1.5 z-50 backdrop-blur-md transition-all bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <Palette className="w-3.5 h-3.5 text-rose-500" />
              <span>Seleziona Tema Applicazione</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Personalizza i colori e il contrasto per il tuo turno
            </p>
          </div>

          <div className="p-1 space-y-1">
            {themes.map((t) => {
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">{t.icon}</div>
                    <div>
                      <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                        {t.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                        {t.desc}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
