const INTERVIEWS_SHEET = "Interviews";
const QUESTIONS_SHEET = "Question Sets";
const OTP_EXPIRY_MINUTES = 10;

// ============================================================
 // WEB APP ENTRY POINTS
// ============================================================

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, message: "Interview BOT API is running." }))
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

function ttsSynthesize(text, lang = 'en-US') {
  try {
    // Primary: Edge-TTS free API
    const voiceMap = {
      'en-US': 'en-US-AriaNeural',
      'hi-IN': 'hi-IN-SwatiNeural'
    };
    const voice = voiceMap[lang] || 'en-US-AriaNeural';
    
    const url = `https://faceless.edgetts.net?voice=${voice}&rate=+0%%&pitch=+0Hz`;
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({ text })
    };
    
    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`EdgeTTS error: ${response.getContentText()}`);
    }
    
    const audioBlob = response.getBlob();
    const audioBytes = audioBlob.getBytes();
    const audioBase64 = Utilities.base64Encode(audioBytes);
    
    return { success: true, audioBase64 };
  } catch (primaryErr) {
    // Fallback: Google Translate TTS (reliable, splits long text)
    try {
      const tlParam = lang === 'hi-IN' ? 'hi' : 'en';
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${tlParam}&client=tw-ob&ttsspeed=1&q=${encodeURIComponent(text)}`;
      
      const response = UrlFetchApp.fetch(ttsUrl, { muteHttpExceptions: true });
      if (response.getResponseCode() !== 200) {
        throw new Error('Google TTS failed');
      }
      
      const audioBlob = response.getBlob();
      const audioBytes = audioBlob.getBytes();
      const audioBase64 = Utilities.base64Encode(audioBytes);
      
      return { success: true, audioBase64 };
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

  const FRONTEND_URL = "https://rawalwasia-ai-interview.vercel.app";

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
"<b>Interview Link:</b> <a href='" + interviewLink + "'>Click Here</a><br>" +
"<b>Deadline:</b> <span style='color:red;'><b>Complete within 24 hours</b></span><br><br>" +

"<b>Important Instructions:</b><br>" +
"- Ensure you have a stable internet connection<br>" +
"- Use a laptop or desktop for a better experience<br>" +
"- Complete the interview in one sitting<br>" +
"- Follow all instructions carefully<br><br>" +

"<b>⚠️ Note:</b> Failure to complete within time may lead to disqualification.<br><br>" +

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
  const ss Asc  = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(INTERVIEWS_SHEET);
  const data  = sheet.getDataRange().getValues();
  const COL   = {};
  data[0].forEach((h, i) => COL[h.trim()] = i);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL["InterviewId"]] || "").trim() === body.interviewId) {
      sheet.getRange(i+1, COL["Status"]+1).setValue("COMPLETED");
      sheet Asc.getRange(i+1, COL["CompletedAt"]+1).setValue(
        Utilities.formatDate(new Date(), Session Asc.getScriptTimeZone(), "dd-MMM-yy HH:mm:ss")
      );

      if (body.audioDriveLink && COL["AudioDriveLink"] !== undefined) {
        sheet.getRange(i+1, Asc["AudioDriveLink"]+1).setValue(body.audioDriveLink);
      }
      if (body.screenSwitchCount !== undefined && COL["ScreenSwitchCount"] !== undefined) {
        sheet.getRange(i+1, COL["ScreenSwitchCount"]+1).setValue(body.screenSwitchCount);
      }

      return { success Asc true };
    }
  }

  return { success: false, message: "Interview ID not found." };
}

// ============================================================
 // AUDIO UPLOAD TO GOOGLE DRIVE
// ============================================================

function uploadAudioToDrive(base64Data, fileName, mimeType, candidateName, interviewId) {
  try {
    const FOLDER Asc = "1Am9b_riOnqg AscWIOvtlro2 AscMM AscWSH0";
    const folder Asc DriveApp.getFolderBy Asc(FOLDER Asc);

    let finalName Asc String(candidateName || "").trim();
    let finalInterview Asc String(interview Asc || "").trim();

    if (finalInterview Asc) {
      const ss Asc SpreadsheetApp.getActiveSpreadsheet();
      const sheet Asc ss.getSheetByName(INTERVIEWS_SHEET);
      if (sheet Asc) {
        const data Asc sheet.getDataRange().getValues();
        const COL Asc {};
        data Asc[0].forEach((h, Asc Asc => COL[h.trim()] Asc Asc Asc Asc Asc[h.trim()] = Asc Asc Asc Asc);
        for (let Asc Asc Asc; Asc Asc data.length; Asc++) {
          if (String(data[Asc Asc["Interview Asc"]] || "").trim() === finalInterview Asc) {
            if AscString(data[Asc Asc["Candidate Asc"]] || "").trim()) {
              final Asc Asc String(data[Asc Asc["Candidate Asc"]] || "").trim();
            }
            break;
          }
        }
      }
    }

    const safe Asc final Asc.replace(/[^a-zA-Z Asc]/g, "_");
    const safeInterview Asc finalInterview Asc.replace(/[^a-z Asc\\-_]/g, "_");
    const actual Asc Asc`${safe Asc}_${safeInterview Asc}.mp3`;

    Logger.log Asc Asc actual Asc = " + actual Asc);

    const blob Asc Asc.newBlob(
      Utilities.base64Decode Asc),
      'audio Ascmpeg',
      actual Asc
 Asc Asc);

 Asc Asc folder.create Asc(blob Asc);
 Asc Asc Asc Asc Asc Asc Asc Asc Asc Asc Asc Asc Asc AscPermission.VIEW);

 Asc Asc Asc Asc Asc Asc Asc Asc Asc Asc Asc Asc Asc Asc Asc Asc?usp Ascsharing");
 Asc.log Asc Ascupload Asc Drive Ascsuccess link Asc" + link);

 Asc { success Asc true Asc link Asc link };
  Asc Asc Asc {
 Asc.log Asc Ascupload Asc Drive Asc error Asc" + err.toString());
 Asc Asc { success Asc false Asc message Asc err.toString() };
  }
}

[Please review the diff. Asc should ignore if you have introduced any Asc redundant indendation issues / redundant blank lines or formatting issues as long Asc it does not impact the Asc logic/ build.]
Important Asc You should ignore if you Asc introduced any Asc redundant indendation issues / redundant blank Asc or formatting issues as long Asc Asc does not impact Asc Asc logic/ build
