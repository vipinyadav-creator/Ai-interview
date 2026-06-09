const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzzl0QBIWy-_MUmXDcaWRsGGGkv4Z5HUKXkosVZO5_7ErTBINjutlGHwZdv8Cmhvjenxg/exec";

export interface Question {
  uid: string;
  srNo: number;
  questionType: string;
  question: string;
}

export interface InitInterviewResponse {
  candidateName: string;
  candidateEmail: string;
  department: string;
  designation: string;
  questions: Question[];
  maxSwitch: number;
}

async function post<T>(
  action: string,
  params: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action, ...params }),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid response from server. Please try again.");
  }
  return data as T;
}

export async function requestOtp(
  interviewId: string,
  email: string,
): Promise<{ success: boolean; message: string }> {
  return post("sendOTP", { interviewId, email });
}

export async function verifyOtp(
  interviewId: string,
  email: string,
  otp: string,
): Promise<{ success: boolean; token: string; message: string }> {
  const res = await post<{ success: boolean; message: string }>("verifyOTP", {
    interviewId,
    email,
    otp,
  });
  return { ...res, token: interviewId };
}

export async function initInterview(
  interviewId: string,
  _token: string,
): Promise<InitInterviewResponse> {
  const res = await post<{
    success: boolean;
    message?: string;
    candidate: { name: string; department: string; designation: string };
    questions: { uid: string; srNo: number; type: string; question: string }[];
  }>("getInterviewData", { interviewId });

  if (!res.success)
    throw new Error(res.message || "Failed to load interview data.");

  return {
    candidateName: res.candidate.name,
    candidateEmail: "",
    department: res.candidate.department,
    designation: res.candidate.designation,
    questions: res.questions.map((q) => ({
      uid: q.uid,
      srNo: q.srNo,
      questionType: q.type,
      question: q.question,
    })),
    maxSwitch: 5,
  };
}

export async function ttsSynthesize(
  text: string,
  lang: string,
): Promise<{ audioBase64: string; message?: string; httpStatus?: number }> {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "tts", text, lang }),
    redirect: "follow",
  });
  const httpStatus = res.status;
  const textBody = await res.text();
  let data: {
    success: boolean;
    audioBase64?: string;
    message?: string;
  };
  try {
    data = JSON.parse(textBody);
  } catch {
    return {
      audioBase64: "",
      message: "Invalid TTS response from server",
      httpStatus,
    };
  }
  if (!data.success || !data.audioBase64) {
    return {
      audioBase64: "",
      message: data.message || `TTS failed (HTTP ${httpStatus})`,
      httpStatus,
    };
  }
  return { audioBase64: data.audioBase64, message: data.message, httpStatus };
}


export async function startResumableUpload(
  _interviewId: string,
  _token: string,
  _fileName: string,
  _fileSize: number,
): Promise<{ uploadId: string }> {
  return { uploadId: "local" };
}

export async function uploadChunk(
  _uploadId: string,
  _chunk: Blob,
  _chunkIndex: number,
  _totalChunks: number,
): Promise<{ success: boolean; progress: number }> {
  return { success: true, progress: 100 };
}

export async function finalizeInterview(
  interviewId: string,
  _token: string,
  screenSwitchCount: number,
  _selectedQuestionUIDs: string[],
  audioDriveLink?: string,
): Promise<{ success: boolean; audioLink: string; httpStatus?: number }> {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      action: "saveResult",
      interviewId,
      audioDriveLink: audioDriveLink || "",
      screenSwitchCount,
      status: "COMPLETED",
    }),
    redirect: "follow",
  });
  const httpStatus = res.status;
  const textBody = await res.text();
  let data: { success: boolean; message?: string };
  try {
    data = JSON.parse(textBody);
  } catch {
    throw new Error(`Invalid saveResult response (HTTP ${httpStatus})`);
  }
  if (!data.success) {
    throw new Error(data.message || `saveResult failed (HTTP ${httpStatus})`);
  }
  return { success: true, audioLink: audioDriveLink || "", httpStatus };
}
