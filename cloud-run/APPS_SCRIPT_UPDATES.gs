/**
 * Google Apps Script - Updated Audio Upload Handler
 * 
 * File: script.gs (Add this function to existing script)
 * 
 * This function handles MP3 uploads from the Cloud Run conversion service.
 * It properly sets MIME type and file extension for genuine MP3 files.
 * 
 * NEW FLOW:
 * 1. Cloud Run converts WebM/Opus to genuine MP3
 * 2. React calls this function with MP3 base64 and metadata
 * 3. This function uploads to Google Drive with correct MIME type
 * 4. Google Drive stores genuine, playable MP3 files
 */

// ============================================================================
// New Handler Function (Add to existing script.gs)
// ============================================================================

/**
 * Upload MP3 file to Google Drive
 * 
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
    const FOLDER_ID = "1Am9b_riOnqgWIOvtlro2MMWSHo";  // Google Drive folder
    
    // Validate inputs
    if (!base64Data || !fileName) {
      throw new Error("Missing required parameters: base64Data or fileName");
    }
    
    if (!mimeType) {
      mimeType = "audio/mpeg";  // Default to MP3 MIME type
    }
    
    // Get folder reference
    const folder = DriveApp.getFolderById(FOLDER_ID);
    if (!folder) {
      throw new Error("Could not access Google Drive folder: " + FOLDER_ID);
    }
    
    // Sanitize filename
    let safeName = String(candidateName || "").replace(/[^a-zA-Z0-9_\-]/g, "_").trim();
    let safeInterviewId = String(interviewId || "").replace(/[^a-zA-Z0-9_\-]/g, "_").trim();
    
    // Ensure .mp3 extension
    let finalFileName = fileName;
    if (!finalFileName.toLowerCase().endsWith(".mp3")) {
      finalFileName = finalFileName + ".mp3";
    }
    
    Logger.log("Uploading MP3: " + finalFileName);
    Logger.log("Size: " + base64Data.length + " characters (encoded)");
    Logger.log("MIME type: " + mimeType);
    Logger.log("Candidate: " + safeName);
    Logger.log("Interview ID: " + safeInterviewId);
    
    // Decode base64 to bytes
    const decodedData = Utilities.base64Decode(base64Data);
    
    // Create blob with correct MIME type
    // ✅ IMPORTANT: Use audio/mpeg for genuine MP3 files
    const blob = Utilities.newBlob(
      decodedData,
      mimeType || "audio/mpeg",  // ✅ Correct MIME type for MP3
      finalFileName               // ✅ Filename with .mp3 extension
    );
    
    // Create file in Google Drive
    const file = folder.createFile(blob);
    
    // Set permissions (public view-only)
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    
    // Generate shareable link
    const link = file.getUrl() + "?usp=sharing";
    
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

// ============================================================================
// Updated doPost handler (Add to existing script.gs)
// ============================================================================

/**
 * Update the doPost function to handle the new action
 * Add this line to the existing doPost function:
 */

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === "sendOTP")          return respond(sendOTP(body.email, body.interviewId));
    if (action === "verifyOTP")        return respond(verifyOTP(body.email, body.otp, body.interviewId));
    if (action === "getInterviewData") return respond(getInterviewData(body.interviewId));
    if (action === "saveResult")       return respond(saveResult(body));
    if (action === "tts")              return respond(ttsSynthesize(body.text, body.lang || 'en-US'));
    
    // ✅ NEW: Handle MP3 uploads from Cloud Run
    if (action === "uploadAudioMp3") {
      return respond(uploadAudioMp3(
        body.base64Data,
        body.fileName,
        body.mimeType,
        body.candidateName,
        body.interviewId
      ));
    }
    
    // DEPRECATED: Keep for backward compatibility (but not used in new flow)
    if (action === "uploadAudio") {
      return respond(uploadAudioToDrive(
        body.base64Data,
        body.fileName,
        body.mimeType,
        body.candidateName,
        body.interviewId
      ));
    }

    return respond({ success: false, message: "Unknown action: " + action });
  } catch (err) {
    return respond({ success: false, message: err.toString() });
  }
}

// ============================================================================
// Optional: Test function (run from Apps Script editor)
// ============================================================================

/**
 * Test the MP3 upload function
 * Run this from the Apps Script editor to verify it works
 */
function testMp3Upload() {
  // Create test MP3 data (small valid MP3 file)
  // This is a minimal valid MP3 frame (FFFB = sync word)
  const testMp3Hex = "FFFB9040000000000000000000000000";
  
  // For real testing, use a proper MP3 file
  // This is just a smoke test
  
  Logger.log("Testing MP3 upload function...");
  
  const result = uploadAudioMp3(
    "//NExAAAAANIAUgAIQEATEBgkDAAUQAIQAGEABhAA==",  // Minimal MP3 (base64)
    "test_audio",                                      // filename (will add .mp3)
    "audio/mpeg",
    "Test_Candidate",
    "INT-TEST-001"
  );
  
  Logger.log("Test result: " + JSON.stringify(result));
}

// ============================================================================
// Key Differences from Original uploadAudioToDrive()
// ============================================================================

/*

ORIGINAL uploadAudioToDrive():
  ❌ Always sets MIME type to 'audio/mpeg' even if file is WebM
  ❌ Always adds .mp3 extension even if file is WebM
  ❌ Creates fake MP3 files
  ✅ Receives base64 from React directly

NEW uploadAudioMp3():
  ✅ Sets correct MIME type (audio/mpeg) for genuine MP3 files
  ✅ Ensures .mp3 extension on genuine MP3 files
  ✅ Creates genuine MP3 files from Cloud Run
  ✅ Receives MP3 base64 from Cloud Run service
  ✅ Properly validates and logs file metadata
  ✅ Better error handling
  
MIGRATION:
  1. Add uploadAudioMp3() function to script.gs
  2. Update doPost() to handle "uploadAudioMp3" action
  3. Deploy updated script
  4. Update React frontend to use mp3-upload.ts
  5. Test end-to-end
  6. Monitor for errors

ROLLBACK:
  If issues occur, the old uploadAudioToDrive() is still available
  and the Apps Script can revert to accepting WebM files with corrected metadata

*/
