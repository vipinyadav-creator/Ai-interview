import { type ReactNode, createContext, useContext, useState } from "react";
import { translations } from "./i18n";

// Support kiye jane wale languages define kar rahe hain
export type Language = "en" | "hi";

interface LangContextType {
  t: (typeof translations)["en"]; // Yeh assume kar raha hai ki en aur hi dono objects ka structure same hai
  lang: Language;
  setLang: (lang: Language) => void; // Future mein language change karne ke liye
}

const LangContext = createContext<LangContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default language "en" set ki hai. Aap ise badal kar "hi" bhi kar sakte hain.
  const [lang, setLang] = useState<Language>("en");

  // Jo language select hogi, uske translations automatic pick ho jayenge
  const t = translations[lang] || translations.en;

  return (
    <LangContext.Provider value={{ t, lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error("useLang must be inside LanguageProvider");
  }
  return ctx;
}
