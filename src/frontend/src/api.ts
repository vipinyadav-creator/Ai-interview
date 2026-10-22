const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwpR2JXDKg-yRpUw0RAVMCJB5vz35NWbSmySiNJfMc_siraReHxtbcVjUT5DVc649EW_Q/exec";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
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
  const res = await post<unknown>("getInterviewData", { interviewId });

  if (!isRecord(res)) {
    throw new Error("Invalid interview data response from the Apps Script API.");
  }
  if (res.success !== true) {
    throw new Error(
      asString(res.message) || "Failed to load interview data.",
    );
  }

  const candidate = isRecord(res.candidate)
    ? res.candidate
    : isRecord(res.candidateDetails)
      ? res.candidateDetails
      : {};
  const candidateName = asString(
    candidate.name ?? res.candidateName ?? res.name,
  )?.trim();
  if (!candidateName) {
    const apiVersion = asString(res.apiVersion) || "unknown";
    const responseFields = Object.keys(res).join(", ") || "none";
    throw new Error(
      `Apps Script API v${apiVersion} returned interview data without candidate details (fields: ${responseFields}). Redeploy the Apps Script v3.2.0 code.`,
    );
  }

  if (!Array.isArray(res.questions) || res.questions.length === 0) {
    throw new Error(
      "Interview data is missing its question list. Please contact the interview administrator.",
    );
  }

  const questions: Question[] = res.questions.map((value, index) => {
    if (!isRecord(value)) {
      throw new Error(`Interview question ${index + 1} is invalid.`);
    }

    const uid = asString(value.uid)?.trim();
    const question = asString(value.question)?.trim();
    const srNo = Number(value.srNo);
    if (!uid || !question || !Number.isFinite(srNo)) {
      throw new Error(`Interview question ${index + 1} is incomplete.`);
    }

    return {
      uid,
      srNo,
      questionType: asString(value.type) || "General",
      question,
    };
  });

  return {
    candidateName,
    candidateEmail: asString(candidate.email ?? res.candidateEmail) || "",
    department: asString(candidate.department ?? res.department) || "",
    designation: asString(candidate.designation ?? res.designation) || "",
    questions,
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
