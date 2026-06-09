export type InterviewLang = "hi" | "en";

const VOICE_HINTS: Record<InterviewLang, { name: string; lang: string; label: string }> = {
  hi: {
    name: "madhur",
    lang: "hi-IN",
    label: "Madhur Male - Adult Hindi (India)",
  },
  en: {
    name: "arjun",
    lang: "en-IN",
    label: "Arjun Male - Adult English (India)",
  },
};

export function getVoiceTarget(lang: InterviewLang) {
  return VOICE_HINTS[lang];
}

export async function loadSpeechVoices(): Promise<SpeechSynthesisVoice[]> {
  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return existing;

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      window.speechSynthesis.onvoiceschanged = null;
      resolve(window.speechSynthesis.getVoices());
    }, 1200);

    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timeout);
      window.speechSynthesis.onvoiceschanged = null;
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

/** Pick Madhur (hi) or Arjun (en) — partial name match for Windows/browser voices */
export function pickPreferredVoice(
  voices: SpeechSynthesisVoice[],
  lang: InterviewLang,
): SpeechSynthesisVoice | null {
  const target = VOICE_HINTS[lang];
  const nameNeedle = target.name.toLowerCase();

  const byName = voices.find(
    (v) => v?.name && v.name.toLowerCase().includes(nameNeedle),
  );
  if (byName) return byName;

  const byLang = voices.filter(
    (v) =>
      v?.lang &&
      (v.lang === target.lang ||
        v.lang.toLowerCase().startsWith(lang === "hi" ? "hi" : "en")),
  );

  const indiaMale = byLang.find(
    (v) =>
      v.name.toLowerCase().includes("india") &&
      v.name.toLowerCase().includes(nameNeedle),
  );
  if (indiaMale) return indiaMale;

  return byLang[0] ?? null;
}
