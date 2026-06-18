import React from 'react';
import { useTranslation } from 'react-i18next';

// Small fixed CS/EN toggle pinned to the top-right corner, available on every
// screen. Uses i18n.changeLanguage; the language detector caches the choice to
// localStorage, so it persists across reloads.
export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const current = i18n.language?.toLowerCase().startsWith('en') ? 'en' : 'cs';

  const setLang = (lng: 'cs' | 'en') => {
    if (lng !== current) i18n.changeLanguage(lng);
  };

  return (
    <div className="fixed top-2 right-2 z-[110] flex items-center gap-0.5 bg-white/90 backdrop-blur-sm sketch-border p-0.5 text-xs font-bold shadow-sm">
      {(['cs', 'en'] as const).map((lng) => (
        <button
          key={lng}
          onClick={() => setLang(lng)}
          aria-pressed={current === lng}
          aria-label={lng === 'cs' ? 'Čeština' : 'English'}
          className={`px-2 py-1 rounded transition-colors ${
            current === lng ? 'bg-blue-950 text-white' : 'text-blue-950/50 hover:text-blue-950'
          }`}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  );
};
