import { type ReactNode, createContext, useContext } from "react";
import { translations } from "./i18n";

interface LangContextType {
  t: (typeof translations)["en"];
}

const LangContext = createContext<LangContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  return (
    <LangContext.Provider value={{ t: translations.en }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be inside LanguageProvider");
  return ctx;
}
