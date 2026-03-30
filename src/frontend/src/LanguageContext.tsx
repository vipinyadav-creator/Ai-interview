import { type ReactNode, createContext, useContext, useState } from "react";
import { type Lang, translations } from "./i18n";

interface LangContextType {
  lang: Lang;
  t: (typeof translations)["en"];
  toggleLang: () => void;
}

const LangContext = createContext<LangContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang] = useState<Lang>("en");

  const toggleLang = () => {
    // Language toggle disabled; always English
  };

  return (
    <LangContext.Provider value={{ lang, t: translations[lang], toggleLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be inside LanguageProvider");
  return ctx;
}
