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
import { useLang } from "../LanguageContext";
import {
  finalizeInterview,
  startResumableUpload,
  uploadAudioToDrive,
  uploadChunk,
} from "../api";
import { convertAudioBlobToMp3, getAudioExtension } from "../utils/audio";

const CHUNK_SIZE = 512 * 1024; // 512 KB

type Step = "preparing" | "uploading" | "finalizing" | "complete" | "error";

export default function UploadScreen() {
  const { state } = useApp();
  const { t } = useLang();
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
      // 🌐 INTERNET CHECK (English)
      if (!navigator.onLine) {
        throw new Error(
          "Your internet connection is not working. Please check your connection and try again.",
        );
      }

      const blob = state.recordedBlob;
      let driveLink = "";

      if (!blob || blob.size === 0) {
        setStep("finalizing");
        await doFinalize(driveLink);
        return;
      }

      setStep("preparing");
      setProgress(5);

      const audioBlob = await convertAudioBlobToMp3(blob);
      setProgress(15);

      const actualMimeType = audioBlob.type || "audio/webm";
      const extension = getAudioExtension(actualMimeType);
      const fileName = `${state.candidateName.replace(/\s+/g, "_")}_${state.interviewId}.${extension}`;

      try {
        const driveRes = await uploadAudioToDrive(
          audioBlob,
          fileName,
          actualMimeType,
          state.candidateName,
          state.interviewId,
        );

        if (driveRes.success && driveRes.link) {
          driveLink = driveRes.link;
          setAudioLink(driveLink);
        } else {
          throw new Error(
            driveRes.message || "Google Drive rejected the upload.",
          );
        }
      } catch (err) {
        // INTERNET FAIL DURING UPLOAD (English)
        if (!navigator.onLine)
          throw new Error(
            "Internet disconnected during upload. Please fix your connection and do not refresh the page.",
          );
        throw err;
      }

      const { uploadId } = await startResumableUpload(
        state.interviewId,
        state.token,
        fileName,
        audioBlob.size,
      );
      setStep("uploading");

      const totalChunks = Math.ceil(audioBlob.size / CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, audioBlob.size);
        const chunk = audioBlob.slice(start, end);
        await uploadChunk(uploadId, chunk, i, totalChunks);
        setProgress(Math.round(((i + 1) / totalChunks) * 70) + 20);
      }

      setStep("finalizing");
      setProgress(92);
      await doFinalize(driveLink);
    } catch (err) {
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      toast.error(
        `Upload failed: ${err instanceof Error ? err.message : "Error"}`,
      );
    }
  };

  const doFinalize = async (link: string) => {
    try {
      await finalizeInterview(
        state.interviewId,
        state.token,
        state.screenSwitchCount,
        state.selectedQuestionUIDs,
        link,
      );
      setProgress(100);
      setStep("complete");
    } catch (err) {
      setStep("error");
      setErrorMsg("Finalization failed.");
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
          <span className="text-xl font-bold gradient-brand">
            {t.brandName}
          </span>
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
              <p className="text-muted-foreground text-sm mb-6">
                {t.submittedDesc}
              </p>
              <div className="bg-secondary rounded-xl p-4 text-left space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                  {t.summary}
                </p>
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground">{t.candidate}:</span>{" "}
                  {state.candidateName}
                </p>
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground">
                    {t.questionsAnswered}:
                  </span>{" "}
                  {state.selectedQuestionUIDs.length} {t.of}{" "}
                  {state.questions.length}
                </p>
                <p className="text-sm text-foreground flex items-center gap-1.5">
                  <span className="text-muted-foreground">
                    Screen Switches:
                  </span>{" "}
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
              <h2 className="text-xl font-bold text-foreground mb-2">
                {t.uploadFailed}
              </h2>
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
                  IMPORTANT: Please do not close or minimize this tab. If the
                  internet disconnects, please retry.
                </p>
              </div>
              <div className="mb-2 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {t.uploadProgress}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {progress}%
                </span>
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
        <p className="text-center mt-6 text-xs text-muted-foreground">
          {t.footer}
        </p>
      </div>
    </div>
  );
}
