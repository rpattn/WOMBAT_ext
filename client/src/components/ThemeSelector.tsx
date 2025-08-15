import React, { useEffect, useLayoutEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeSelectorProps {
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function ThemeSelector({ label = 'Theme', className, style }: ThemeSelectorProps) {
  const LS_KEY_THEME = 'themePreference';
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const stored = (window.localStorage.getItem(LS_KEY_THEME) as ThemeMode | null);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch { /* ignore */ }
    return 'system';
  });

  // Apply theme to <html> and respond to system changes when in 'system'
  useLayoutEffect(() => {
    const root = document.documentElement;
    const mm = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      root.classList.remove('dark');
      root.classList.remove('light');
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.add('light');
      } else {
        if (mm.matches) root.classList.add('dark');
        else root.classList.add('light');
      }
    };
    apply();
    const handler = () => { if (theme === 'system') apply(); };
    mm.addEventListener?.('change', handler);
    return () => { mm.removeEventListener?.('change', handler); };
  }, [theme]);

  // Persist theme choice
  useEffect(() => {
    try { window.localStorage.setItem(LS_KEY_THEME, theme); } catch { /* ignore */ }
  }, [theme]);

  return (
    <div className={className} style={style}>
      <label style={{ fontSize: 12, marginRight: 8 }}>{label}</label>
      <select
        aria-label={label}
        value={theme}
        onChange={(e) => setTheme(e.target.value as ThemeMode)}
        style={{ padding: '6px 8px', borderRadius: 6 }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}
