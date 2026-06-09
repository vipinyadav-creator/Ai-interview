import React from "react";

export type DebugStepKey =
  | "VOICE_SELECTED"
  | "TTS_STARTED"
  | "TTS_COMPLETED"
  | "AUDIO_CAPTURE_STARTED"
  | "AUDIO_CAPTURE_COMPLETED"
  | "UPLOAD_STARTED"
  | "UPLOAD_COMPLETED"
  | "SHEET_UPDATE_STARTED"
  | "SHEET_UPDATE_COMPLETED";

export type DebugStepStatus = "idle" | "running" | "success" | "error";

export interface DebugStep {
  key: DebugStepKey;
  status: DebugStepStatus;
  ts?: number;
  voiceName?: string;
  audioBytes?: number;
  audioUrl?: string;
  httpStatus?: number;
  functionName?: string;
  errorMessage?: string;
  meta?: Record<string, unknown>;
}

export function formatTime(ts?: number) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

function statusDot(status: DebugStepStatus) {
  switch (status) {
    case "success":
      return "bg-status-green";
    case "error":
      return "bg-status-red";
    case "running":
      return "bg-brand-blue animate-pulse";
    default:
      return "bg-border";
  }
}

export default function DebugPanel({
  title,
  steps,
}: {
  title: string;
  steps: DebugStep[];
}) {
  return (
    <div className="w-full max-w-3xl mx-auto mt-3">
      <div className="card-glass rounded-2xl p-3 border border-border">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-xs font-bold text-foreground">{title}</div>
          <div className="text-[10px] text-muted-foreground">runtime diagnostics</div>
        </div>

        <div className="space-y-2">
          {steps.map((s) => (
            <div
              key={s.key}
              className="flex items-start gap-2 text-[11px]"
              data-ocid={`debug.step.${s.key}`}
            >
              <div
                className={`w-2 h-2 rounded-full mt-[4px] ${statusDot(s.status)}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-mono font-semibold text-foreground">
                    {s.key}
                  </div>
                  <div className="text-muted-foreground">{formatTime(s.ts)}</div>
                </div>

                {s.voiceName ? (
                  <div className="text-muted-foreground break-all">
                    voice: {s.voiceName}
                  </div>
                ) : null}

                {typeof s.audioBytes === "number" ? (
                  <div className="text-muted-foreground break-all">
                    audioBytes: {s.audioBytes}
                  </div>
                ) : null}

                {s.audioUrl ? (
                  <div className="text-muted-foreground break-all">
                    audioUrl: {s.audioUrl}
                  </div>
                ) : null}

                {typeof s.httpStatus === "number" ? (
                  <div className="text-muted-foreground">
                    http: {s.httpStatus}
                  </div>
                ) : null}

                {s.functionName ? (
                  <div className="text-muted-foreground">fn: {s.functionName}</div>
                ) : null}

                {s.errorMessage ? (
                  <div className="text-status-red font-semibold break-all">
                    {s.errorMessage}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

