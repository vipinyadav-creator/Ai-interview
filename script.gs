// ============================================================
// CONFIG — update these before deploy if needed
// ============================================================

const INTERVIEWS_SHEET = "Interviews";
const QUESTIONS_SHEET = "Question Sets";
const OTP_EXPIRY_MINUTES = 10;
const FRONTEND_URL = "https://rawalwasia-ai-interview.vercel.app";

// Google Drive folder where interview audio files are saved.
// 1) Create a folder in Drive (or use an existing one)
// 2) Open folder → copy ID from URL: drive.google.com/drive/folders/FOLDER_ID_HERE
// 3) Share folder with the Google account that owns this script (Editor access)
const AUDIO_UPLOAD_FOLDER_ID = "1nOJjVKbuSeaCzYvzD3BYJ2RhCoJd_1ch";
const AUDIO_FOLDER_FALLBACK_NAME = "AI Interview Audio";
const API_VERSION = "3.1.0";

// ============================================================
 // WEB APP ENTRY POINTS
// ============================================================

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: "Interview BOT API is running.",
      version: API_VERSION,
      actions: ["sendOTP", "verifyOTP", "getInterviewData", "tts", "uploadAudio", "uploadAudioMp3", "saveResult"]
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === "sendOTP")          return respond(sendOTP(body.email, body.interviewId));
    if (action === "verifyOTP")        return respond(verifyOTP(body.email, body.otp, body.interviewId));
    if (action === "getInterviewData") return respond(getInterviewData(body.interviewId));
    if (action === "saveResult")       return respond(saveResult(body));
    if (action === "uploadAudioMp3")   return respond(uploadAudioMp3(
      body.base64Data,
      body.fileName,
      body.mimeType,
      body.candidateName,
      body.interviewId
    ));
    if (action === "uploadAudio")      return respond(uploadAudioToDrive(
      body.base64Data,
      body.fileName,
      body.mimeType,
      body.candidateName,
      body.interviewId
    ));
    if (action === "tts")              return respond(ttsSynthesize(body.text, body.lang || 'en-US'));

    return respond({ success: false, message: "Unknown action: " + action });
  } catch (err) {
    return respond({ success: false, message: err.toString() });
  }
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
 // TTS SYNTHESIS (NEW)
 // ============================================================

function ttsSynthesize(text, lang = 'hi-IN') {
  try {
    const voiceMap = {
      'en-US': 'en-IN-ArjunNeural',
      'en-IN': 'en-IN-ArjunNeural',
      'hi-IN': 'hi-IN-MadhurNeural'
    };
    const voice = voiceMap[lang] || (lang.startsWith('en') ? 'en-IN-ArjunNeural' : 'hi-IN-MadhurNeural');
    
    const url = `https://faceless.edgetts.net?voice=${voice}&rate=+0%&pitch=+0Hz`;
    
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({ text })
    };
    
    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`EdgeTTS error: ${response.getContentText()}`);
    }
    
    const audioBlob = response.getBlob();
    return { success: true, audioBase64: Utilities.base64Encode(audioBlob.getBytes()) };
  } catch (primaryErr) {
    try {
      const tlParam = lang.startsWith('hi') ? 'hi' : 'en-IN';
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${tlParam}&client=tw-ob&ttsspeed=1&q=${encodeURIComponent(text)}`;
      
      const response = UrlFetchApp.fetch(ttsUrl, { muteHttpExceptions: true });
      const audioBlob = response.getBlob();
      
      return { success: true, audioBase64: Utilities.base64Encode(audioBlob.getBytes()) };
    } catch (fallbackErr) {
      return { success: false, message: `TTS failed: ${fallbackErr.toString()}` };
    }
  }
}

// ============================================================
 // LINK GENERATION
// ============================================================

function generateInterviewLinksForPending() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(INTERVIEWS_SHEET);
  if (!sheet) throw new Error("Sheet not found: " + INTERVIEWS_SHEET);

  const VIDEO_URL = "https://drive.google.com/file/d/1o7J-ZIBiFzBD1-4PhvKxCW9db1DTLxd9/view?usp=sharing";

  const data = sheet.getDataRange().getValues();
  const COL = {};
  data[0].forEach((h, i) => COL[h.trim()] = i);

  const now = new Date();
  let updated = 0;

  for (let i = 1; i < data.length; i++) {
    const row   = data[i];

    const email = String(row[COL["CandidateEmail"]] || "").trim();
    const name  = String(row[COL["CandidateName"]]  || "").trim();
    const dept  = String(row[COL["Department"]]     || "").trim();
    const desg  = String(row[COL["Designation"]]    || "").trim();
    const status = String(row[COL["Status"]] || "").trim();

    if (!email || status) continue;
    if (!name || !dept || !desg) continue;

    const interviewId   = "INT-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5).toUpperCase();
    const interviewLink = FRONTEND_URL + "?id=" + interviewId;

    sheet.getRange(i+1, COL["InterviewId"]      +1).setValue(interviewId);
    sheet.getRange(i+1, COL["Status"]           +1).setValue("CREATED");
    sheet.getRange(i+1, COL["CreatedAt"]        +1).setValue(
      Utilities.formatDate(now, Session.getScriptTimeZone(), "dd-MMM-yy HH:mm:ss")
    );
    sheet.getRange(i+1, COL["InterviewLink"]    +1).setValue(interviewLink);
    sheet.getRange(i+1, COL["ScreenSwitchCount"]+1).setValue(0);

    MailApp.sendEmail({
  to: email,
  subject: "AI Interview Invitation - Rawalwasia Group",
  htmlBody:
"Dear " + name + ",<br><br>" +

"Greetings from Rawalwasia Group!<br><br>" +

"We are pleased to inform you that your profile has been <b>shortlisted for the next stage</b> of our hiring process.<br><br>" +

"As part of the selection process, you are required to complete an <b>AI-based interview</b>. Please find the details below:<br><br>" +

"<b>Interview Type:</b> AI-Based Interview<br>" +
"<b>Interview Link:</b> <a href='" + interviewLink + "'>Click Here to Start</a><br>" +
"<b>Deadline:</b> <span style='color:red;'><b>Complete within 24 hours</b></span><br><br>" +

"<div style='background-color: #f9f9f9; padding: 10px; border-left: 4px solid #007bff;'>" +
"<b>Step-by-Step Instructions:</b><br>" +
"Please watch this instruction video before starting your interview: " +
"<a href='" + VIDEO_URL + "'>Watch Video Guide</a>" +
"</div><br>" +

"<b>Important Instructions:</b><br>" +
"- Ensure you have a stable internet connection<br>" +
"- Use a laptop or desktop for a better experience<br>" +
"- Complete the interview in one sitting<br>" +
"- Follow all instructions carefully<br><br>" +

"<b>Important Note:</b> Failure to complete within time may lead to disqualification.<br><br>" +

"We wish you all the best!<br><br>" +

"Regards,<br>Rawalwasia Group HR Team"
});

    updated++;
  }

  Logger.log("Interview links generated: " + updated);
}

// ============================================================
 // OTP SYSTEM
// ============================================================

function sendOTP(email, interviewId) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(INTERVIEWS_SHEET);
  const data  = sheet.getDataRange().getValues();
  const COL   = {};
  data[0].forEach((h, i) => COL[h.trim()] = i);

  let found = false;
  for (let i = 1; i < data.length; i++) {
    const rowId    = String(data[i][COL["InterviewId"]]    || "").trim();
    const rowEmail = String(data[i][COL["CandidateEmail"]] || "").trim().toLowerCase();

    if (rowId === interviewId && rowEmail === email.toLowerCase()) {
      const status = String(data[i][COL["Status"]] || "").trim().toUpperCase();
      if (status === "COMPLETED") {
        return { success: false, message: "This interview has already been completed. You cannot access it again." };
      }
      found = true;
      break;
    }
  }

  if (!found) return { success: false, message: "Email or Interview ID does not match." };

  const otp     = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;

  CacheService.getScriptCache().put(
    "otp_" + interviewId,
    JSON.stringify({ otp: otp, email: email.toLowerCase(), expires: expires }),
    600
  );

  MailApp.sendEmail({
    to: email,
    subject: "Your OTP for AI Interview - Rawalwasia Group",
    body:
"Dear Candidate,\n\n" +
"Your OTP for AI Interview is: " + otp + "\n\n" +
"This OTP is valid for " + OTP_EXPIRY_MINUTES + " minutes. Please do not share it with anyone.\n\n" +
"If you did not request this OTP, please ignore this email.\n\n" +
"Regards,\nRawalwasia Group HR Team"
  });

  return { success: true, message: "OTP sent successfully." };
}

function verifyOTP(email, otp, interviewId) {
  const cached = CacheService.getScriptCache().get("otp_" + interviewId);
  if (!cached) return { success: false, message: "OTP expired." };

  const stored = JSON.parse(cached);
  if (stored.email !== email.toLowerCase()) return { success: false, message: "Email mismatch." };
  if (stored.otp   !== otp)                 return { success: false, message: "Invalid OTP." };
  if (Date.now()   >  stored.expires)       return { success: false, message: "OTP expired." };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(INTERVIEWS_SHEET);
  const data  = sheet.getDataRange().getValues();
  const COL   = {};
  data[0].forEach((h, i) => COL[h.trim()] = i);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL["InterviewId"]] || "").trim() === interviewId) {
      if (String(data[i][COL["Status"]] || "").trim().toUpperCase() === "COMPLETED") {
        return { success: false, message: "Interview already completed. Access denied." };
      }
      sheet.getRange(i+1, COL["Status"] +1).setValue("VERIFIED");
      sheet.getRange(i + 1, COL["VerifiedAt"] + 1).setValue(
        Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MMM-yy HH:mm:ss")
      );
      break;
    }
  }

  CacheService.getScriptCache().remove("otp_" + interviewId);
  return { success: true, message: "OTP verified!" };
}

// ============================================================
 // GET INTERVIEW DATA
// ============================================================

function getInterviewData(interviewId) {
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const intSheet = ss.getSheetByName(INTERVIEWS_SHEET);
  const qSheet   = ss.getSheetByName(QUESTIONS_SHEET);

  const intData = intSheet.getDataRange().getValues();
  const COL     = {};
  intData[0].forEach((h, i) => COL[h.trim()] = i);

  let candidate = null;
  for (let i = 1; i < intData.length; i++) {
    if (String(intData[i][COL["InterviewId"]] || "").trim() === interviewId) {
      candidate = {
        name:        intData[i][COL["CandidateName"]],
        department:  intData[i][COL["Department"]],
        designation: intData[i][COL["Designation"]],
        status:      String(intData[i][COL["Status"]] || "").trim().toUpperCase(),
        row:         i + 1,
        index:       i
      };
      break;
    }
  }

  if (!candidate) return { success: false, message: "Interview ID not found." };
  if (candidate.status === "COMPLETED") return { success: false, message: "This interview has already been completed. You cannot access it again." };
  if (candidate.status !== "VERIFIED") return { success: false, message: "Please verify OTP first." };

  const qData = qSheet.getDataRange().getValues();
  const QCOL  = {};
  qData[0].forEach((h, i) => QCOL[h.trim()] = i);

  let questions = [];
  const existingUIDs = String(intData[candidate.index][COL["SelectedQuestionUIDs"]] || "").trim();

  if (existingUIDs) {
    const uidList = existingUIDs.split(",").map(x => x.trim());
    for (let i = 1; i < qData.length; i++) {
      const row = qData[i];
      if (uidList.includes(String(row[QCOL["UID"]]).trim())) {
        questions.push({
          uid: row[QCOL["UID"]],
          srNo: row[QCOL["Sr. No."]],
          type: row[QCOL["Type"]],
          question: row[QCOL["Question"]]
        });
      }
    }
  } else {
    for (let i = 1; i < qData.length; i++) {
      const row = qData[i];
      if (
        String(row[QCOL["Department"]]  || "").trim().toLowerCase() === candidate.department.toLowerCase() &&
        String(row[QCOL["Designation"]] || "").trim().toLowerCase() === candidate.designation.toLowerCase() &&
        String(row[QCOL["Status"]]      || "").trim().toLowerCase() === "live"
      ) {
        questions.push({
          uid: row[QCOL["UID"]],
          srNo: row[QCOL["Sr. No."]],
          type: row[QCOL["Type"]],
          question: row[QCOL["Question"]]
        });
      }
    }

    questions.sort((a, b) => Number(a.srNo) - Number(b.srNo));
    const selectedUIDs = questions.map(q => q.uid).join(",");
    if (COL["SelectedQuestionUIDs"] !== undefined) {
      intSheet.getRange(candidate.row, COL["SelectedQuestionUIDs"] + 1).setValue(selectedUIDs);
    }
  }

  if (questions.length === 0) return { success: false, message: "No questions found." };

  return {
    success: true,
    candidate: {
      name: candidate.name,
      department: candidate.department,
      designation: candidate.designation
    },
    questions: questions
  };
}

// ============================================================
 // SAVE RESULT
// ============================================================

function saveResult(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(INTERVIEWS_SHEET);
  const data  = sheet.getDataRange().getValues();
  const COL   = {};
  data[0].forEach((h, i) => COL[h.trim()] = i);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL["InterviewId"]] || "").trim() === body.interviewId) {
      sheet.getRange(i+1, COL["Status"]+1).setValue("COMPLETED");
      sheet.getRange(i+1, COL["CompletedAt"]+1).setValue(
        Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MMM-yy HH:mm:ss")
      );

      if (body.audioDriveLink && COL["AudioDriveLink"] !== undefined) {
        sheet.getRange(i+1, COL["AudioDriveLink"]+1).setValue(body.audioDriveLink);
      }
      if (body.screenSwitchCount !== undefined && COL["ScreenSwitchCount"] !== undefined) {
        sheet.getRange(i+1, COL["ScreenSwitchCount"]+1).setValue(body.screenSwitchCount);
      }

      return { success: true };
    }
  }

  return { success: false, message: "Interview ID not found." };
}

// ============================================================
 // AUDIO UPLOAD TO GOOGLE DRIVE
// ============================================================

function getAudioUploadFolder() {
  try {
    const folder = DriveApp.getFolderById(AUDIO_UPLOAD_FOLDER_ID);
    if (folder) return folder;
  } catch (primaryErr) {
    Logger.log("Primary folder unavailable: " + primaryErr.toString());
  }

  const root = DriveApp.getRootFolder();
  const existing = root.getFoldersByName(AUDIO_FOLDER_FALLBACK_NAME);
  if (existing.hasNext()) {
    return existing.next();
  }
  return root.createFolder(AUDIO_FOLDER_FALLBACK_NAME);
}

/** Run from Apps Script editor: Tests TTS + Drive folder access */
function testDeployment() {
  const tts = ttsSynthesize("Test audio upload", "en-US");
  Logger.log("TTS success: " + tts.success);

  const folder = getAudioUploadFolder();
  Logger.log("Upload folder: " + folder.getName() + " | " + folder.getId());

  const testBlob = Utilities.newBlob("test", "audio/webm", "deployment_test.webm");
  const file = folder.createFile(testBlob);
  Logger.log("Test file: " + file.getUrl());
  return { tts: tts.success, folderId: folder.getId(), fileUrl: file.getUrl() };
}

function uploadAudioToDrive(base64Data, fileName, mimeType, candidateName, interviewId) {
  try {
    if (!base64Data) {
      throw new Error("Missing required parameter: base64Data");
    }

    const folder = getAudioUploadFolder();
    const requestedMimeType = String(mimeType || "audio/webm").split(";")[0].trim().toLowerCase();
    const extension = getAudioExtensionFromMimeType(requestedMimeType);
    const safeCandidate = String(candidateName || "candidate").replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeInterview = String(interviewId || "interview").replace(/[^a-zA-Z0-9_-]/g, "_");
    let finalFileName = String(fileName || `${safeCandidate}_${safeInterview}.${extension}`).trim();

    finalFileName = finalFileName.replace(/\.(mp3|webm|ogg|m4a|mp4|wav)$/i, "");
    finalFileName = `${finalFileName}.${extension}`;

    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      requestedMimeType,
      finalFileName
    );

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const link = file.getUrl();

    Logger.log("Audio upload successful: " + finalFileName + " (" + requestedMimeType + ")");

    return { success: true, link: link };
  } catch (err) {
    Logger.log("Audio upload error: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

function getAudioExtensionFromMimeType(mimeType) {
  mimeType = String(mimeType || "").toLowerCase();
  if (mimeType.indexOf("mpeg") !== -1 || mimeType.indexOf("mp3") !== -1) return "mp3";
  if (mimeType.indexOf("ogg") !== -1) return "ogg";
  if (mimeType.indexOf("mp4") !== -1 || mimeType.indexOf("m4a") !== -1 || mimeType.indexOf("aac") !== -1) return "m4a";
  if (mimeType.indexOf("wav") !== -1) return "wav";
  return "webm";
}

/**
 * NEW FUNCTION: Upload MP3 file to Google Drive
 * Called from React frontend via mp3-upload.ts
 * 
 * @param {string} base64Data - Base64-encoded MP3 audio file
 * @param {string} fileName - Output filename (should include .mp3 extension)
 * @param {string} mimeType - MIME type (should be "audio/mpeg")
 * @param {string} candidateName - Candidate name (for logging)
 * @param {string} interviewId - Interview ID (for logging)
 * @returns {Object} {success: boolean, link: string, message: string}
 */
function uploadAudioMp3(base64Data, fileName, mimeType, candidateName, interviewId) {
  try {
    if (!base64Data || !fileName) {
      throw new Error("Missing required parameters: base64Data or fileName");
    }
    
    mimeType = "audio/mpeg";
    
    const folder = getAudioUploadFolder();
    
    let safeName = String(candidateName || "").replace(/[^a-zA-Z0-9_\-]/g, "_").trim();
    let safeInterviewId = String(interviewId || "").replace(/[^a-zA-Z0-9_\-]/g, "_").trim();
    
    let finalFileName = fileName;
    if (!finalFileName.toLowerCase().endsWith(".mp3")) {
      finalFileName = finalFileName + ".mp3";
    }
    
    Logger.log("Uploading MP3: " + finalFileName);
    Logger.log("Size: " + base64Data.length + " characters (encoded)");
    Logger.log("MIME type: " + mimeType);
    Logger.log("Candidate: " + safeName);
    Logger.log("Interview ID: " + safeInterviewId);
    
    const decodedData = Utilities.base64Decode(base64Data);
    
    const blob = Utilities.newBlob(
      decodedData,
      mimeType || "audio/mpeg",
      finalFileName
    );
    
    const file = folder.createFile(blob);
    
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileId = file.getId();
    const link = `https://drive.google.com/uc?export=download&id=${fileId}`;
    
    Logger.log("Upload successful!");
    Logger.log("File ID: " + file.getId());
    Logger.log("File name: " + file.getName());
    Logger.log("File size: " + file.getSize() + " bytes");
    Logger.log("Link: " + link);
    
    return {
      success: true,
      link: link,
      message: "MP3 uploaded successfully to Google Drive"
    };
    
  } catch (error) {
    Logger.log("ERROR: " + error.toString());
    return {
      success: false,
      link: "",
      message: error.toString()
    };
  }
}
