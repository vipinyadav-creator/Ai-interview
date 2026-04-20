import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  ChevronRight,
  Clock,
  Eye,
  LogOut,
  Mic,
  SkipForward,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "../AppContext";
import { useLang } from "../LanguageContext";
import { convertAudioBlobToMp3, warmAudioConversion } from "../utils/audio";

const QUESTION_DURATION = 120;
const AUDIO_BARS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export default function InterviewScreen() {
  const { state, setState } = useApp();
  const { t, lang } = useLang();
  const {
    questions,
    candidateName,
    department,
    designation,
    maxSwitch,
    preparedMicStream,
  } = state;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_DURATION);
  const [switchCount, setSwitchCount] = useState(0);
  const [showForcedQuit, setShowForcedQuit] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mrKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ttsKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ttsFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStarted = useRef(false);
  const navigating = useRef(false);
  const spokenIdxRef = useRef(-1);
  const goNextRef = useRef<() => void>(() => {});
  const lastSwitchTime = useRef(0);

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIdx];
  const progressPercent = ((QUESTION_DURATION - timeLeft) / QUESTION_DURATION) * 100;
  const overallProgress = Math.round((currentIdx / totalQuestions) * 100);

  const stopTtsKeepAlive = useCallback(() => {
    if (ttsKeepAliveRef.current) {
      clearInterval(ttsKeepAliveRef.current);
      ttsKeepAliveRef.current = null;
    }
  }, []);

  const stopTtsFallback = useCallback(() => {
    if (ttsFallbackRef.current) {
      clearTimeout(ttsFallbackRef.current);
      ttsFallbackRef.current = null;
    }
  }, []);

  const stopStream = useCallback((stream: MediaStream | null) => {
    if (!stream) return;
    for (const track of stream.getTracks()) track.stop();
  }, []);

  // --- Screen switch tracking ---
  useEffect(() => {
    const handleSwitch = () => {
      const now = Date.now();
      if (now - lastSwitchTime.current < 500) return;
      lastSwitchTime.current = now;
      setSwitchCount((c) => {
        const next = c + 1;
        if (next >= maxSwitch) {
          setShowForcedQuit(true);
        } else {
          const remaining = maxSwitch - next;
          // FIXED: Use tabSwitchWarning instead of switchWarning
          toast.warning(t.tabSwitchWarning(remaining));
        }
        return next;
      });
    };
    const onHide = () => {
      if (document.hidden) handleSwitch();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", handleSwitch);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", handleSwitch);
    };
  }, [maxSwitch, t]);

  // --- Timer logic FIXED ---
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(QUESTION_DURATION);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
  }, []);

  useEffect(() => {
    if (timeLeft === 0) {
      goNextRef.current();
    }
  }, [timeLeft]);

  const speakQuestion = useCallback(
    (text: string, idx: number, onDone: () => void) => {
      if (!window.speechSynthesis) {
        onDone();
        return;
      }

      window.speechSynthesis.cancel();
      stopTtsKeepAlive();
      stopTtsFallback();

      const prefix = `Question ${idx}. `;
      const announcement = prefix + text;
      const utterance = new SpeechSynthesisUtterance(announcement);

      const setBestVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        // FIXED: Explicitly allow SpeechSynthesisVoice or undefined
        let bestVoice: SpeechSynthesisVoice | undefined = undefined;

        if (lang === "hi") {
          bestVoice =
            voices.find((v) => v.name.includes("Google") && v.lang === "hi-IN") ||
            voices.find((v) => v.name.includes("Microsoft") && v.lang === "hi-IN") ||
            voices.find((v) => v.lang === "hi-IN");
          utterance.lang = "hi-IN";
        } else {
          bestVoice =
            voices.find((v) => v.name.includes("Google") && v.lang === "en-IN") ||
            voices.find((v) => v.name.includes("Microsoft") && v.lang === "en-IN") ||
            voices.find((v) => v.lang === "en-IN");
          utterance.lang = "en-IN";
        }
        if (bestVoice) utterance.voice = bestVoice;
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1;

        window.speechSynthesis.speak(utterance);
      };

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = setBestVoice;
      } else {
        setBestVoice();
      }

      utterance.onend = () => {
        stopTtsKeepAlive();
        stopTtsFallback();
        setIsSpeaking(false);
        onDone();
      };
      utterance.onerror = () => {
        stopTtsKeepAlive();
        stopTtsFallback();
        setIsSpeaking(false);
        onDone();
      };

      setIsSpeaking(true);

      ttsKeepAliveRef.current = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.resume();
        } else {
          stopTtsKeepAlive();
        }
      }, 10000);

      const estimatedMs = Math.max(
        8000,
        (announcement.length / (3 * utterance.rate)) * 1000 + 5000,
      );
      ttsFallbackRef.current = setTimeout(() => {
        if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
        stopTtsKeepAlive();
        stopTtsFallback();
        setIsSpeaking(false);
        onDone();
      }, estimatedMs);
    },
    [stopTtsKeepAlive, stopTtsFallback, lang],
  );

  useEffect(() => {
    if (recordingStarted.current) return;
    recordingStarted.current = true;
    (async () => {
      try {
        const hasLiveMicStream =
          preparedMicStream &&
          preparedMicStream.getAudioTracks().some((track) => track.readyState === "live");
        const micStream = hasLiveMicStream
          ? preparedMicStream
          : await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
                sampleRate: 48000,
                sampleSize: 16,
              },
            });
        const [micTrack] = micStream.getAudioTracks();
        if (micTrack?.applyConstraints) {
          micTrack
            .applyConstraints({
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
            })
            .catch(() => {});
        }
        streamRef.current = micStream;

        // FIXED: More robust mimeType fallback for cross-browser compatibility
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : MediaRecorder.isTypeSupported("audio/aac")
              ? "audio/aac"
              : ""; 

        const mrOptions = mimeType ? { mimeType, audioBitsPerSecond: 96000 } : { audioBitsPerSecond: 96000 };
        const mr = new MediaRecorder(micStream, mrOptions);
        
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mr.start(250);
        void warmAudioConversion();
        
        mrKeepAliveRef.current = setInterval(() => {
          if (mediaRecorderRef.current?.state === "paused") {
            mediaRecorderRef.current.resume();
          }
        }, 2000);
        mediaRecorderRef.current = mr;
        setIsRecording(true);
        spokenIdxRef.current = 0;
        speakQuestion(questions[0]?.question || "", 1, () => startTimer());
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (
          msg.includes("Permission") ||
          msg.includes("NotAllowed") ||
          msg.includes("denied")
        ) {
          toast.error(t.micPermissionError);
        } else {
          toast.error(t.noMicError);
        }
      }
    })();
  }, [preparedMicStream, questions, speakQuestion, startTimer, t]);

  useEffect(() => {
    if (spokenIdxRef.current === currentIdx) return;
    spokenIdxRef.current = currentIdx;
    speakQuestion(questions[currentIdx]?.question || "", currentIdx + 1, () =>
      startTimer(),
    );
  }, [currentIdx, speakQuestion, startTimer, questions]);

  const finishInterview = useCallback(
    (uids: string[], sc: number) => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopTtsKeepAlive();
      stopTtsFallback();
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      const mr = mediaRecorderRef.current;
      const doFinish = async () => {
        const recordedMimeType =
          mr?.mimeType || chunksRef.current[0]?.type || "audio/webm";
        const rawBlob = new Blob(chunksRef.current, { type: recordedMimeType });
        let finalBlob = rawBlob;
        if (rawBlob.size > 0) {
          try {
            finalBlob = await convertAudioBlobToMp3(rawBlob);
          } catch (error) {
            console.warn("MP3 conversion failed, using original recording blob.", error);
            toast.warning(
              "MP3 conversion complete nahi ho saki. Upload ke liye original recording use hogi.",
            );
          }
        }
        setState({
          screen: "upload",
          recordedBlob: finalBlob,
          preparedMicStream: null,
          selectedQuestionUIDs: uids,
          screenSwitchCount: sc,
        });
      };
      if (mrKeepAliveRef.current) {
        clearInterval(mrKeepAliveRef.current);
        mrKeepAliveRef.current = null;
      }
      if (mr && mr.state !== "inactive") {
        mr.onstop = () => {
          stopStream(streamRef.current);
          void doFinish();
        };
        mr.stop();
      } else {
        void doFinish();
      }
    },
    [setState, stopStream, stopTtsKeepAlive, stopTtsFallback],
  );

  // FIXED: Cleanup fallback and main timer on unmount
  useEffect(() => {
    return () => {
      stopTtsFallback();
      stopStream(streamRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stopStream, stopTtsFallback]);

  const goNext = useCallback(() => {
    if (navigating.current) return;
    navigating.current = true;
    stopTtsKeepAlive();
    stopTtsFallback();
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    if (timerRef.current) clearInterval(timerRef.current);

    setCurrentIdx((idx) => {
      const next = idx + 1;
      if (next >= totalQuestions) {
        finishInterview(
          questions.map((q) => q.uid),
          switchCount,
        );
        return idx;
      }
      setTimeout(() => {
        navigating.current = false;
      }, 50);
      return next;
    });
  }, [
    totalQuestions,
    questions,
    switchCount,
    finishInterview,
    stopTtsKeepAlive,
    stopTtsFallback,
  ]);

  goNextRef.current = goNext;

  const handleSkipClick = () => {
    if (navigating.current || isSpeaking) return;
    setShowSkipConfirm(true);
  };

  const handleSkipConfirm = () => {
    setShowSkipConfirm(false);
    goNext();
  };

  const handleFinishClick = () => setShowFinishConfirm(true);

  const handleFinishConfirm = () => {
    setShowFinishConfirm(false);
    finishInterview(
      questions.slice(0, currentIdx + 1).map((q) => q.uid),
      switchCount,
    );
  };

  const handleForceSubmit = () => {
    setShowForcedQuit(false);
    finishInterview(
      questions.map((q) => q.uid),
      switchCount,
    );
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const switchPillClass =
    switchCount >= 4
      ? "bg-status-red/10 text-status-red border-status-red/30"
      : switchCount > 0
        ? "bg-status-amber/15 text-status-amber border-status-amber/35"
        : "bg-secondary text-muted-foreground border-border";

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <header className="flex items-center justify-between px-3 sm:px-8 py-3 border-b border-border bg-white/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-brand-blue flex items-center justify-center shadow-sm flex-shrink-0">
            <BrainCircuit className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold gradient-brand text-sm hidden sm:inline truncate">
            {t.brandName}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold ${switchPillClass}`}
            data-ocid="interview.switch_count.panel"
          >
            <Eye className="w-3 h-3 flex-shrink-0" />
            <span className="hidden sm:inline">Switches:&nbsp;</span>
            <span>
              {switchCount}/{maxSwitch}
            </span>
          </div>

          <Button
            size="sm"
            variant="destructive"
            className="bg-status-red hover:bg-status-red/90 text-white text-xs h-8 px-2 sm:px-3"
            onClick={handleFinishClick}
          >
            <LogOut className="w-3 h-3 sm:mr-1" />
            <span className="hidden sm:inline">{t.finishInterview}</span>
          </Button>
        </div>
      </header>

      <div className="h-1 bg-border">
        <div
          className="h-full bg-brand-blue transition-all duration-500"
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      {switchCount >= 3 && switchCount < maxSwitch && (
        <div className="mx-3 sm:mx-4 mt-3 bg-status-amber/10 border border-status-amber/25 rounded-xl px-3 sm:px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-status-amber flex-shrink-0" />
          <p className="text-xs sm:text-sm text-status-amber">
            {t.switchWarningBanner(switchCount, maxSwitch)}
          </p>
        </div>
      )}

      <main className="flex-1 flex flex-col items-center px-3 sm:px-8 py-4 sm:py-6 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between w-full mb-4 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge className="bg-brand-blue/10 text-brand-blue border-brand-blue/20 text-xs truncate max-w-[90px] sm:max-w-none">
              {department}
            </Badge>
            <Badge className="bg-brand-teal/10 text-brand-teal border-brand-teal/20 text-xs truncate max-w-[90px] sm:max-w-none">
              {designation}
            </Badge>
          </div>
          <span className="text-xs sm:text-sm text-muted-foreground font-medium flex-shrink-0">
            {t.question}{" "}
            <span className="text-foreground font-bold">{currentIdx + 1}</span>{" "}
            / {totalQuestions}
          </span>
        </div>

        <div className="w-full card-glass rounded-2xl overflow-hidden shadow-sm mb-4">
          <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide truncate">
              {currentQuestion?.questionType || "General"}
            </span>
            {isSpeaking ? (
              <div className="flex items-center gap-1.5 text-brand-blue flex-shrink-0">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                <span className="text-xs font-semibold">Listening...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span
                  className={`font-mono text-sm font-bold ${
                    timeLeft < 30
                      ? "text-status-red"
                      : timeLeft < 60
                        ? "text-status-amber"
                        : "text-foreground"
                  }`}
                >
                  {fmt(timeLeft)}
                </span>
              </div>
            )}
          </div>
          <div className="px-4 sm:px-5 pb-4">
            <Progress
              value={isSpeaking ? 0 : progressPercent}
              className={`h-1.5 bg-border ${
                timeLeft < 30
                  ? "[&>div]:bg-status-red"
                  : timeLeft < 60
                    ? "[&>div]:bg-status-amber"
                    : "[&>div]:bg-brand-blue"
              }`}
            />
          </div>
          <div className="px-4 sm:px-5 pb-5 sm:pb-6">
            <p className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground leading-relaxed">
              {currentQuestion?.question}
            </p>
          </div>
        </div>

        <div className="w-full card-glass rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center mb-4 min-h-[100px]">
          {isRecording ? (
            <>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-3 h-3 rounded-full bg-status-red pulse-recording flex-shrink-0" />
                <span className="text-sm font-semibold text-status-red">
                  {t.recording}
                </span>
              </div>

              {isSpeaking ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Volume2 className="w-4 h-4 text-brand-blue animate-pulse" />
                    <span className="text-sm font-medium text-brand-blue">
                      Reading question aloud...
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Mic is live — your audio is being recorded
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-end gap-1 h-10 mb-3">
                    {AUDIO_BARS.map((i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-brand-blue rounded-full audio-bar"
                        style={{
                          height: `${30 + ((i * 7) % 60)}%`,
                          animationDelay: `${i * 0.07}s`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-status-green" />
                    <span className="text-xs text-status-green">
                      {t.audioActive}
                    </span>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-brand-blue/10 flex items-center justify-center mb-2">
                <Mic className="w-6 h-6 text-brand-blue" />
              </div>
              <p className="text-xs text-muted-foreground">
                Microphone access needed
              </p>
            </>
          )}
        </div>

        <div className="w-full flex gap-2 sm:gap-3">
          <Button
            variant="outline"
            className="flex-1 border-border text-muted-foreground hover:text-foreground min-h-[44px] text-sm"
            onClick={handleSkipClick}
            disabled={isSpeaking}
            data-ocid="interview.skip_question.button"
          >
            <SkipForward className="w-4 h-4 mr-1.5 flex-shrink-0" />
            <span className="truncate">{t.skipQuestion}</span>
          </Button>
          <Button
            className="flex-1 bg-brand-blue hover:bg-brand-blue/90 text-white border-0 min-h-[44px] text-sm"
            onClick={goNext}
            disabled={!isRecording || isSpeaking}
            data-ocid="interview.next_question.button"
          >
            <ChevronRight className="w-4 h-4 mr-1.5 flex-shrink-0" />
            <span className="truncate">
              {currentIdx + 1 >= totalQuestions ? t.finish : t.nextQuestion}
            </span>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          {candidateName} &bull; {department}
        </p>
      </main>

      <Dialog open={showSkipConfirm} onOpenChange={setShowSkipConfirm}>
        <DialogContent className="bg-white border-border max-w-sm mx-4 w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {t.skipConfirmTitle}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t.skipConfirmDesc}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              className="border-border"
              onClick={() => setShowSkipConfirm(false)}
            >
              {t.cancel}
            </Button>
            <Button
              className="bg-status-amber hover:bg-status-amber/90 text-white"
              onClick={handleSkipConfirm}
            >
              {t.skipConfirmYes}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showForcedQuit}>
        <DialogContent className="bg-white border-border max-w-sm mx-4 w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-status-red flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t.autoSubmitTitle}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t.autoSubmitDesc} ({maxSwitch}).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="bg-status-red hover:bg-status-red/90 text-white"
              onClick={handleForceSubmit}
            >
              {t.submitNow}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFinishConfirm} onOpenChange={setShowFinishConfirm}>
        <DialogContent className="bg-white border-border max-w-sm mx-4 w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {t.finishConfirmTitle}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t.finishConfirmDesc} {currentIdx} {t.of} {totalQuestions}{" "}
              {t.questions}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              className="border-border"
              onClick={() => setShowFinishConfirm(false)}
            >
              {t.continueInterview}
            </Button>
            <Button
              className="bg-status-red hover:bg-status-red/90 text-white"
              onClick={handleFinishConfirm}
            >
              {t.endSubmit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}