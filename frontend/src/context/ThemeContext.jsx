import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

// Keep the background preference, but use the bureau palette in both modes.
export const ACCENT_PRESETS = [
  {
    key:   'forest',
    label: 'Standard',
    color: '#F3F5F7',
    vars: {
      '--bg':             '#F3F5F7',
      '--bg-secondary':   '#E9EDF1',
      '--bg-tertiary':    '#DDE3E9',
      '--bg-page':        '#F3F5F7',
      '--card-bg':        '#FFFFFF',
      '--card-border':    '#E1E6EB',
      '--border':         '#D9E0E6',
      '--border-light':   '#E8EDF1',
      '--text-primary':   '#172B3D',
      '--text-secondary': '#526273',
      '--text-muted':     '#758494',
      '--navbar-bg':      '#FFFFFF',
      '--navbar-border':  '#E1E6EB',
      '--primary':          '#17324D',
      '--primary-light':    '#294B68',
      '--primary-dark':     '#10263B',
      '--primary-alpha':    'rgba(23,50,77,0.10)',
      '--primary-alpha-sm': 'rgba(23,50,77,0.06)',
      '--border-focus':     '#294B68',
      '--gradient-primary': 'linear-gradient(135deg,#17324D 0%,#294B68 100%)',
      '--shadow-primary':   '0 4px 12px rgba(23,50,77,0.16)',
      '--shadow-sm': '0 1px 3px rgba(16,38,59,0.04)',
      '--shadow-md': '0 4px 12px rgba(16,38,59,0.08)',
    },
  },
  {
    key:   'amber',
    label: 'Warm',
    color: '#F7F4EF',
    vars: {
      '--bg':             '#F7F4EF',
      '--bg-secondary':   '#EEEAE3',
      '--bg-tertiary':    '#E2DDD4',
      '--bg-page':        '#F7F4EF',
      '--card-bg':        '#FFFFFF',
      '--card-border':    '#E6E0D7',
      '--border':         '#DED8CE',
      '--border-light':   '#ECE7DF',
      '--text-primary':   '#172B3D',
      '--text-secondary': '#526273',
      '--text-muted':     '#758494',
      '--navbar-bg':      '#FFFFFF',
      '--navbar-border':  '#E6E0D7',
      '--primary':          '#17324D',
      '--primary-light':    '#294B68',
      '--primary-dark':     '#10263B',
      '--primary-alpha':    'rgba(23,50,77,0.10)',
      '--primary-alpha-sm': 'rgba(23,50,77,0.06)',
      '--border-focus':     '#294B68',
      '--gradient-primary': 'linear-gradient(135deg,#17324D 0%,#294B68 100%)',
      '--shadow-primary':   '0 4px 12px rgba(23,50,77,0.16)',
      '--shadow-sm': '0 1px 3px rgba(16,38,59,0.04)',
      '--shadow-md': '0 4px 12px rgba(16,38,59,0.08)',
    },
  },
];

const applyAccent = (preset) => {
  // Inline styles on document.documentElement have the highest specificity
  // (equivalent to !important for custom properties) and always override
  // any stylesheet rule, regardless of load order.
  const root = document.documentElement;
  Object.entries(preset.vars).forEach(([k, v]) => {
    root.style.setProperty(k, v);
  });

  // Also set a data-accent attribute so CSS can optionally target it
  root.setAttribute('data-accent', preset.key);
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('edu_theme') || 'light';
  });

  const [sidebarColor, setSidebarColor] = useState(() => {
    const saved = localStorage.getItem('edu_sidebar_color');
    const valid = ['light', 'dark'];
    return valid.includes(saved) ? saved : 'dark';
  });

  const [accentKey, setAccentKey] = useState(() => {
    const saved = localStorage.getItem('edu_accent');
    const valid = ['forest', 'amber'];
    return valid.includes(saved) ? saved : 'forest';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('edu_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('edu_sidebar_color', sidebarColor);
  }, [sidebarColor]);

  // Apply accent CSS variables whenever accentKey changes
  useEffect(() => {
    const preset = ACCENT_PRESETS.find(p => p.key === accentKey) || ACCENT_PRESETS[0];
    applyAccent(preset);
    localStorage.setItem('edu_accent', accentKey);
  }, [accentKey]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const currentAccent = ACCENT_PRESETS.find(p => p.key === accentKey) || ACCENT_PRESETS[0];

  return (
    <ThemeContext.Provider value={{
      theme, toggleTheme, isDark: theme === 'dark',
      sidebarColor, setSidebarColor,
      accentKey, setAccentKey,
      currentAccent,
      accentPresets: ACCENT_PRESETS,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
