import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

// ── Two light background modes: Green & Orange ──────────────────────────────
export const ACCENT_PRESETS = [
  {
    key:   'forest',
    label: 'Green',
    color: '#E8F5EE',
    vars: {
      '--bg':             '#E8F5EE',
      '--bg-secondary':   '#D5EDE0',
      '--bg-tertiary':    '#C0E2CE',
      '--bg-page':        '#E8F5EE',
      '--card-bg':        '#FFFFFF',
      '--card-border':    'rgba(0,0,0,0.06)',
      '--border':         '#C8E6D4',
      '--border-light':   '#DCEEE5',
      '--text-primary':   '#0F172A',
      '--text-secondary': '#334155',
      '--text-muted':     '#64748B',
      '--navbar-bg':      '#FFFFFF',
      '--navbar-border':  'rgba(0,0,0,0.07)',
      '--primary':          '#059669',
      '--primary-light':    '#10B981',
      '--primary-dark':     '#047857',
      '--primary-alpha':    'rgba(5,150,105,0.10)',
      '--primary-alpha-sm': 'rgba(5,150,105,0.06)',
      '--border-focus':     '#059669',
      '--gradient-primary': 'linear-gradient(135deg,#047857 0%,#10B981 100%)',
      '--shadow-primary':   '0 6px 20px rgba(5,150,105,0.28)',
      '--shadow-sm': '0 1px 3px rgba(0,0,0,0.06)',
      '--shadow-md': '0 4px 12px rgba(0,0,0,0.08)',
    },
  },
  {
    key:   'amber',
    label: 'Orange',
    color: '#FEF3E2',
    vars: {
      '--bg':             '#FEF3E2',
      '--bg-secondary':   '#FDE8C8',
      '--bg-tertiary':    '#FCDCB0',
      '--bg-page':        '#FEF3E2',
      '--card-bg':        '#FFFFFF',
      '--card-border':    'rgba(0,0,0,0.06)',
      '--border':         '#F9D7A0',
      '--border-light':   '#FCEBD0',
      '--text-primary':   '#0F172A',
      '--text-secondary': '#334155',
      '--text-muted':     '#64748B',
      '--navbar-bg':      '#FFFFFF',
      '--navbar-border':  'rgba(0,0,0,0.07)',
      '--primary':          '#EA580C',
      '--primary-light':    '#F97316',
      '--primary-dark':     '#C2410C',
      '--primary-alpha':    'rgba(234,88,12,0.10)',
      '--primary-alpha-sm': 'rgba(234,88,12,0.06)',
      '--border-focus':     '#EA580C',
      '--gradient-primary': 'linear-gradient(135deg,#C2410C 0%,#F97316 100%)',
      '--shadow-primary':   '0 6px 20px rgba(234,88,12,0.28)',
      '--shadow-sm': '0 1px 3px rgba(0,0,0,0.06)',
      '--shadow-md': '0 4px 12px rgba(0,0,0,0.08)',
    },
  },
];

const STYLE_TAG_ID = 'edu-accent-vars';

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
    return valid.includes(saved) ? saved : 'light';
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
