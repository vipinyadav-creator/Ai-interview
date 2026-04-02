import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AnimatePresence, motion } from "motion/react";
import { AppProvider, useApp } from "./AppContext";
import { LanguageProvider } from "./LanguageContext";
const InterviewScreen = React.lazy(() => import("./screens/InterviewScreen"));
const IntroScreen = React.lazy(() => import("./screens/IntroScreen"));
const OtpScreen = React.lazy(() => import("./screens/OtpScreen"));
const UploadScreen = React.lazy(() => import("./screens/UploadScreen"));

function Router() {
  const { state } = useApp();

  return (
    <div className="min-h-screen bg-background font-sans">
      <AnimatePresence mode="wait">
        <motion.div
          key={state.screen}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="min-h-screen"
        >
          <Suspense fallback={<div>Loading screen...</div>}>
            {state.screen === "otp" && <OtpScreen />}
            {state.screen === "intro" && <IntroScreen />}
            {state.screen === "interview" && <InterviewScreen />}
            {state.screen === "upload" && <UploadScreen />}
          </Suspense>
        </motion.div>
      </AnimatePresence>
      <Toaster position="top-right" theme="light" />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppProvider>
        <Router />
      </AppProvider>
    </LanguageProvider>
  );
}
