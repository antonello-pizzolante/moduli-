import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'night' | 'clinical' | 'emergency';

interface ThemeContextType {
  theme: AppTheme;
  isDark: boolean;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'sanitaservice_app_theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to 'night' as requested by user ("cambia tema app" - gives an immediate, stunning dark night-shift look)
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme;
    if (saved === 'night' || saved === 'clinical' || saved === 'emergency') {
      return saved;
    }
    return 'night';
  });

  const isDark = theme === 'night';

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    if (theme === 'night') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'night' ? 'clinical' : 'night'));
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
