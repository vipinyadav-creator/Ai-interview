import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DebugStep, DebugStepKey, DebugStepStatus } from "./DebugPanel";

const STEP_ORDER: DebugStepKey[] = [
  "VOICE_SELECTED",
  "TTS_STARTED",
  "TTS_COMPLETED",
  "AUDIO_CAPTURE_STARTED",
  "AUDIO_CAPTURE_COMPLETED",
  "UPLOAD_STARTED",
  "UPLOAD_COMPLETED",
  "SHEET_UPDATE_STARTED",
  "SHEET_UPDATE_COMPLETED",
];

function idleSteps(): DebugStep[] {
  return STEP_ORDER.map((key) => ({ key, status: "idle" as DebugStepStatus }));
}

type StepPatch = Partial<Omit<DebugStep, "key">>;

interface DebugContextValue {
  steps: DebugStep[];
  logStep: (key: DebugStepKey, patch: StepPatch) => void;
  resetSteps: () => void;
}

const DebugContext = createContext<DebugContextValue | null>(null);

export function DebugProvider({ children }: { children: ReactNode }) {
  const [steps, setSteps] = useState<DebugStep[]>(idleSteps);

  const logStep = useCallback((key: DebugStepKey, patch: StepPatch) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.key === key
          ? {
              ...s,
              ...patch,
              ts: patch.ts ?? Date.now(),
            }
          : s,
      ),
    );
  }, []);

  const resetSteps = useCallback(() => setSteps(idleSteps()), []);

  const value = useMemo(
    () => ({ steps, logStep, resetSteps }),
    [steps, logStep, resetSteps],
  );

  return (
    <DebugContext.Provider value={value}>{children}</DebugContext.Provider>
  );
}

export function useDebug() {
  const ctx = useContext(DebugContext);
  if (!ctx) throw new Error("useDebug must be used inside DebugProvider");
  return ctx;
}
