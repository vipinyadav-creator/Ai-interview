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
import { ttsSynthesize } from "../api";
import { convertAudioBlobToMp3, warmAudioConversion } from "../utils/audio";

declare global {
  interface Window {
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
    MediaElementAudioSourceNode: typeof MediaElementAudioSourceNode;
    MediaStreamAudioDestinationNode: typeof MediaStreamAudioDestinationNode;
    MediaStreamAudioSourceNode: typeof MediaStreamAudioSourceNode;
  }
}

const QUESTION_DURATION = 120;
const AUDIO_BARS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export default function InterviewScreen() {
  const { state, setState } = useApp();
  const { t, lang } = useLang();
  const {
    candidateName,
    department,
    designation,
    maxSwitch,
    preparedMicStream,
    questions,
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recordingStarted = useRef(false);
  const navigating = useRef(false);
  const spokenIdxRef = useRef(-1);
  const goNextRef = useRef<() => void>(() => {});
  const lastSwitchTime = useRef(0);

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIdx];
  const progressPercent = ((QUESTION_DURATION - timeLeft) / QUESTION_DURATION) * 100;
  const overallProgress = Math.round((currentIdx / totalQuestions) * 100);

  const stopMrKeepAlive = useCallback(() => {
    if (mrKeepAliveRef.current) {
      clearInterval(mrKeepAliveRef.current);
      mrKeepAliveRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback((stream: MediaStream | null) => {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
  }, []);

  const cleanupAudioGraph = useCallback(() => {
    if (ttsSourceRef.current) {
      ttsSourceRef.current.disconnect();
      ttsSourceRef.current = null;
    }
    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }
    if (destinationRef.current) {
      destinationRef.current.disconnect();
      destinationRef.current = null;
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.src = "";
      ttsAudioRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state === "running") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
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

  // --- Timer logic ---
  const startTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(QUESTION_DURATION);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
  }, [stopTimer]);

  useEffect(() => {
    if (timeLeft === 0) {
      goNextRef.current();
    }
  }, [timeLeft]);

  // --- TTS Playing & Mixing ---
  const playTtsWithMix = useCallback(
    async (text: string, idx: number, onDone: () => void) => {
      try {
        setIsSpeaking(true);

        // Fetch TTS
        const { audioBase64 } = await ttsSynthesize(text, lang === "hi" ? "hi-IN" : "en-US");
        const audioUrl = `data:audio/mp3;base64,${audioBase64}`;

        // Setup AudioContext graph if not exists
        if (!audioContextRef.current || audioContextRef.current.state === "closed") {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioContextClass({ sampleRate: 48000 });
        }
        
        const audioCtx = audioContextRef.current;

        const destination = audioCtx.createMediaStreamDestination();
        destinationRef.current = destination;

        // Mic source (already in streamRef.current)
        if (streamRef.current && !micSourceRef.current) {
          const micSource = audioCtx.createMediaStreamSource(streamRef.current);
          micSource.connect(destination);
          micSourceRef.current = micSource;
        } else if (streamRef.current && micSourceRef.current) {
            micSourceRef.current.disconnect();
            micSourceRef.current.connect(destination);
        }

        // TTS audio
        ttsAudioRef.current = new Audio(audioUrl);
        // Ensure CORS if needed, though data URI shouldn't need it
        ttsAudioRef.current.crossOrigin = "anonymous"; 
        
        const ttsSource = audioCtx.createMediaElementSource(ttsAudioRef.current);
        ttsSource.connect(destination);
        // Connect to destination AND to hardware output so the user hears it
        ttsSource.connect(audioCtx.destination); 
        ttsSourceRef.current = ttsSource;

        // Resume AudioContext if suspended (browser autoplay policy)
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        // Update MediaRecorder to use mixed stream
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }

        const mixedStream = destination.stream;
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") 
            ? "audio/webm;codecs=opus" 
            : "";
            
        const mr = new MediaRecorder(mixedStream, mimeType ? { mimeType, audioBitsPerSecond: 48000 } : { audioBitsPerSecond: 48000 });
        
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mr.start(250);

        mrKeepAliveRef.current = setInterval(() => {
          if (mr.state === "paused") mr.resume();
        }, 2000);
        mediaRecorderRef.current = mr;

        await ttsAudioRef.current.play();

        // Cleanup on end
        ttsAudioRef.current.onended = () => {
          setIsSpeaking(false);
          onDone();
        };

        ttsAudioRef.current.onerror = () => {
          setIsSpeaking(false);
          onDone();
        };

      } catch (err) {
        console.error("TTS/Mixing error:", err);
        toast.error("TTS failed, starting timer");
        setIsSpeaking(false);
        cleanupAudioGraph();
        onDone();
      }
    },
    [lang, cleanupAudioGraph]
  );

  // --- Initial setup ---
  useEffect(() => {
    if (recordingStarted.current) return;
    recordingStarted.current = true;

    (async () => {
      try {
        const hasLiveMicStream = preparedMicStream && preparedMicStream.getAudioTracks().some((t) => t.readyState === "live");
        const micStream = hasLiveMicStream ? preparedMicStream : await navigator.mediaDevices.getUserMedia({
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
          micTrack.applyConstraints({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          }).catch(() => {});
        }
        
        streamRef.current = micStream;
        setIsRecording(true);
        spokenIdxRef.current = 0;

        void warmAudioConversion();

        // Start first question TTS reading
        const text = questions[0]?.question || "";
        await playTtsWithMix(text, 1, startTimer);

      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("Permission") || msg.includes("NotAllowed") || msg.includes("denied")) {
          toast.error(t.micPermissionError);
        } else {
          toast.error(t.noMicError);
        }
      }
    })();
  }, [preparedMicStream, questions, playTtsWithMix, startTimer, t]);

  // --- Question change TTS ---
  useEffect(() => {
    if (currentIdx === 0 || spokenIdxRef.current === currentIdx) return;
    spokenIdxRef.current = currentIdx;

    const text = questions[currentIdx]?.question || "";
    playTtsWithMix(text, currentIdx + 1, startTimer);
  }, [currentIdx, questions, playTtsWithMix, startTimer]);

  const finishInterview = useCallback(
    (uids: string[], sc: number) => {
      stopTimer();
      stopMrKeepAlive();
      cleanupAudioGraph();

      const mr = mediaRecorderRef.current;
      const doFinish = async () => {
        const recordedMimeType = mr?.mimeType || chunksRef.current[0]?.type || "audio/webm";
        const rawBlob = new Blob(chunksRef.current, { type: recordedMimeType });
        let finalBlob = rawBlob;
        
        if (rawBlob.size > 0) {
          try {
            finalBlob = await convertAudioBlobToMp3(rawBlob);
          } catch (error) {
            console.warn("MP3 conversion failed:", error);
            toast.warning("MP3 conversion incomplete, using original recording.");
          }
        }
        
        stopStream(streamRef.current);
        
        setState({
          screen: "upload",
          recordedBlob: finalBlob,
          preparedMicStream: null,
          selectedQuestionUIDs: uids,
          screenSwitchCount: sc,
        });
      };

      if (mr && mr.state !== "inactive") {
        mr.onstop = () => {
          void doFinish();
        };
        mr.stop();
      } else {
        void doFinish();
      }
    },
    [setState, stopStream, stopMrKeepAlive, stopTimer, cleanupAudioGraph]
  );

  useEffect(() => {
    return () => {
      stopTimer();
      stopStream(streamRef.current);
      cleanupAudioGraph();
    };
  }, [stopStream, stopTimer, cleanupAudioGraph]);

  const goNext = useCallback(() => {
    if (navigating.current || isSpeaking) return;
    navigating.current = true;
    
    stopMrKeepAlive();
    stopTimer();
    cleanupAudioGraph();
    setIsSpeaking(false);

    setCurrentIdx((idx) => {
      const next = idx + 1;
      if (next >= totalQuestions) {
        finishInterview(
          questions.map((q) => q.uid),
          switchCount
        );
        return idx;
      }
      setTimeout(() => {
        navigating.current = false;
      }, 50);
      return next;
    });
  }, [totalQuestions, questions, switchCount, finishInterview, stopMrKeepAlive, stopTimer, cleanupAudioGraph, isSpeaking]);

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
      switchCount
    );
  };

  const handleForceSubmit = () => {
    setShowForcedQuit(false);
    finishInterview(
      questions.map((q) => q.uid),
      switchCount
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
            {t.question} <span className="text-foreground font-bold">{currentIdx + 1}</span> / {totalQuestions}
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
                    <span className="text-xs text-status-green">{t.audioActive}</span>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-brand-blue/10 flex items-center justify-center mb-2">
                <Mic className="w-6 h-6 text-brand-blue" />
              </div>
              <p className="text-xs text-muted-foreground">Microphone access needed</p>
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
            <DialogTitle className="text-foreground">{t.skipConfirmTitle}</DialogTitle>
            <DialogDescription className="text-muted-foreground">{t.skipConfirmDesc}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" className="border-border" onClick={() => setShowSkipConfirm(false)}>
              {t.cancel}
            </Button>
            <Button className="bg-status-amber hover:bg-status-amber/90 text-white" onClick={handleSkipConfirm}>
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
            <Button className="bg-status-red hover:bg-status-red/90 text-white" onClick={handleForceSubmit}>
              {t.submitNow}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFinishConfirm} onOpenChange={setShowFinishConfirm}>
        <DialogContent className="bg-white border-border max-w-sm mx-4 w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t.finishConfirmTitle}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t.finishConfirmDesc} {currentIdx} {t.of} {totalQuestions} {t.questions}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" className="border-border" onClick={() => setShowFinishConfirm(false)}>
              {t.continueInterview}
            </Button>
            <Button className="bg-status-red hover:bg-status-red/90 text-white" onClick={handleFinishConfirm}>
              {t.endSubmit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}