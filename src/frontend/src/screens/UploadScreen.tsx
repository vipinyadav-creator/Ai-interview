import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  FileAudio,
  Loader2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "../AppContext";
import { useDebug } from "../debug/DebugContext";
import { useLang } from "../LanguageContext";
import { finalizeInterview } from "../api";
import { uploadRecordedAudioToDrive } from "../utils/mp3-upload";

type Step = "preparing" | "uploading" | "finalizing" | "complete" | "error";

export default function UploadScreen() {
  const { state } = useApp();
  const { t } = useLang();
  const { logStep } = useDebug();
  const [step, setStep] = useState<Step>("preparing");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [audioLink, setAudioLink] = useState("");
  const started = useRef(false);

  const STEPS: { key: Step; label: string }[] = [
    { key: "preparing", label: t.preparingAudio },
    { key: "uploading", label: t.uploadingServer },
    { key: "finalizing", label: t.finalizingInterview },
    { key: "complete", label: t.complete },
  ];

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runUpload();
  }, []);

  const runUpload = async () => {
    try {
      if (!navigator.onLine) {
        throw new Error(
          "Your internet connection is not working. Please check your connection and try again.",
        );
      }

      const blob = state.recordedBlob;
      let driveLink = "";

      if (!blob || blob.size === 0) {
        const msg = "No recorded audio — upload skipped (blob empty)";
        logStep("UPLOAD_STARTED", {
          status: "error",
          functionName: "runUpload",
          errorMessage: msg,
          audioBytes: 0,
        });
        logStep("UPLOAD_COMPLETED", {
          status: "error",
          functionName: "runUpload",
          errorMessage: msg,
        });
        setStep("error");
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }

      setStep("preparing");
      setProgress(5);

      logStep("UPLOAD_STARTED", {
        status: "running",
        functionName: "uploadRecordedAudioToDrive",
        audioBytes: blob.size,
      });

      const uploadResult = await uploadRecordedAudioToDrive(blob, {
        candidateName: state.candidateName,
        interviewId: state.interviewId,
        onProgress: (p) => setProgress(15 + p * 0.75),
        onDebug: (ev) => {
          if (ev.errorMessage) {
            logStep("UPLOAD_COMPLETED", {
              status: "error",
              functionName: "uploadRecordedAudioToDrive",
              httpStatus: ev.httpStatus,
              errorMessage: ev.errorMessage,
              audioBytes: ev.audioBytes,
            });
          }
        },
      });

      if (uploadResult.success && uploadResult.link) {
        driveLink = uploadResult.link;
        setAudioLink(driveLink);
        logStep("UPLOAD_COMPLETED", {
          status: "success",
          functionName: "uploadRecordedAudioToDrive",
          audioUrl: driveLink,
          audioBytes: blob.size,
        });
      } else {
        throw new Error(
          uploadResult.link ? "Upload completed with warnings" : "Audio upload failed",
        );
      }

      setStep("finalizing");
      setProgress(92);
      await doFinalize(driveLink);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      logStep("UPLOAD_COMPLETED", {
        status: "error",
        functionName: "runUpload",
        errorMessage: msg,
      });
      setStep("error");
      setErrorMsg(msg);
      toast.error(`Upload failed: ${msg}`);
    }
  };

  const doFinalize = async (link: string) => {
    logStep("SHEET_UPDATE_STARTED", {
      status: "running",
      functionName: "finalizeInterview",
      audioUrl: link || undefined,
      meta: { interviewId: state.interviewId },
    });

    try {
      const result = await finalizeInterview(
        state.interviewId,
        state.token,
        state.screenSwitchCount,
        state.selectedQuestionUIDs,
        link,
      );

      logStep("SHEET_UPDATE_COMPLETED", {
        status: link ? "success" : "error",
        functionName: "saveResult",
        httpStatus: result.httpStatus,
        audioUrl: result.audioLink || undefined,
        errorMessage: link ? undefined : "Sheet updated but audioDriveLink was empty",
      });

      setProgress(100);
      setStep("complete");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Finalization failed";
      logStep("SHEET_UPDATE_COMPLETED", {
        status: "error",
        functionName: "saveResult",
        errorMessage: msg,
      });
      setStep("error");
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  const currentStepIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-background glow-bg flex flex-col items-center justify-center p-4 overflow-x-hidden">
      <div className="w-full max-w-lg fade-in">
        <div className="flex items-center justify-center gap-2 mb-8 sm:mb-10">
          <div className="w-9 h-9 rounded-xl bg-brand-blue flex items-center justify-center shadow-glow">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold gradient-brand">{t.brandName}</span>
        </div>

        <div className="card-glass rounded-2xl p-5 sm:p-8">
          {step === "complete" ? (
            <div className="text-center" data-ocid="upload.success_state">
              <div className="w-16 h-16 rounded-full bg-status-green/15 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9 text-status-green" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                {t.interviewSubmitted}
              </h2>
              <p className="text-muted-foreground text-sm mb-6">{t.submittedDesc}</p>
              {audioLink ? (
                <p className="text-xs text-muted-foreground break-all mb-4">
                  Audio: {audioLink}
                </p>
              ) : null}
              <div className="bg-secondary rounded-xl p-4 text-left space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                  {t.summary}
                </p>
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground">{t.candidate}:</span>{" "}
                  {state.candidateName}
                </p>
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground">{t.questionsAnswered}:</span>{" "}
                  {state.selectedQuestionUIDs.length} {t.of} {state.questions.length}
                </p>
                <p className="text-sm text-foreground flex items-center gap-1.5">
                  <span className="text-muted-foreground">Screen Switches:</span>{" "}
                  <span
                    className={
                      state.screenSwitchCount >= 5
                        ? "text-status-red font-bold"
                        : "text-status-green font-bold"
                    }
                  >
                    {state.screenSwitchCount}
                  </span>
                </p>
              </div>
            </div>
          ) : step === "error" ? (
            <div className="text-center" data-ocid="upload.error_state">
              <div className="w-16 h-16 rounded-full bg-status-red/15 flex items-center justify-center mx-auto mb-4">
                <FileAudio className="w-8 h-8 text-status-red" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">{t.uploadFailed}</h2>
              <p className="text-muted-foreground text-sm">{errorMsg}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-6 text-brand-blue font-semibold text-sm underline"
              >
                Retry Upload
              </button>
            </div>
          ) : (
            <div data-ocid="upload.loading_state">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
                  <Upload className="w-5 h-5 text-brand-blue" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground">
                    {t.uploadingInterview}
                  </h2>
                  <p className="text-sm text-muted-foreground truncate">
                    {state.candidateName}
                  </p>
                </div>
              </div>
              <div className="bg-status-amber/10 border border-status-amber/30 rounded-lg p-3 mb-6 flex gap-3 items-center">
                <AlertTriangle className="w-5 h-5 text-status-amber flex-shrink-0" />
                <p className="text-xs font-semibold text-status-amber">
                  IMPORTANT: Please do not close or minimize this tab. If the internet
                  disconnects, please retry.
                </p>
              </div>
              <div className="mb-2 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t.uploadProgress}</span>
                <span className="text-sm font-semibold text-foreground">{progress}%</span>
              </div>
              <Progress
                value={progress}
                className="h-2.5 bg-border [&>div]:bg-brand-blue mb-6"
              />
              <div className="space-y-3">
                {STEPS.filter((s) => s.key !== "complete").map((s, i) => (
                  <div key={s.key} className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${i < currentStepIdx ? "bg-status-green/15" : s.key === step ? "bg-brand-blue/15" : "bg-secondary"}`}
                    >
                      {i < currentStepIdx ? (
                        <CheckCircle2 className="w-4 h-4 text-status-green" />
                      ) : s.key === step ? (
                        <Loader2 className="w-4 h-4 text-brand-blue animate-spin" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-border" />
                      )}
                    </div>
                    <span
                      className={`text-sm ${i < currentStepIdx ? "text-status-green" : s.key === step ? "text-foreground font-medium" : "text-muted-foreground/50"}`}
                    >
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <p className="text-center mt-6 text-xs text-muted-foreground">{t.footer}</p>
      </div>
    </div>
  );
}
