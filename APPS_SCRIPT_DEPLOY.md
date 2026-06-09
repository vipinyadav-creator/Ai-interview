# Apps Script Deploy Guide (Final)

Yeh guide `script.gs` ko Google Apps Script me paste karke deploy karne ke liye hai.

## Pehle yeh check karein

### Google Sheet columns (Interviews sheet)

Header names **exactly** yeh hone chahiye:

| Column | Required |
|--------|----------|
| InterviewId | Yes |
| CandidateName | Yes |
| CandidateEmail | Yes |
| Department | Yes |
| Designation | Yes |
| Status | Yes |
| AudioDriveLink | Yes (audio URL yahan likha jayega) |
| ScreenSwitchCount | Yes |
| CompletedAt | Yes |
| SelectedQuestionUIDs | Recommended |
| VerifiedAt | Recommended |

### Google Drive folder

1. Drive me ek folder banayein (ya existing use karein)
2. Folder URL se ID copy karein: `drive.google.com/drive/folders/FOLDER_ID`
3. `script.gs` ke top par `AUDIO_UPLOAD_FOLDER_ID` me paste karein
4. Folder ko **script owner Google account** ke saath **Editor** access share karein

---

## Deploy steps

1. [Google Apps Script](https://script.google.com) kholen
2. Apna existing Interview project open karein (jo Sheet se linked hai)
3. **Poora purana code delete** karke `script.gs` ka **poora content** paste karein
4. `AUDIO_UPLOAD_FOLDER_ID` verify karein (line ~14)
5. **Save** (Ctrl+S)
6. **Deploy → Manage deployments**
7. Existing deployment par **pencil/edit** icon → **Version: New version** → **Deploy**
   - Ya naya: **Deploy → New deployment → Web app**
8. Settings:
   - Execute as: **Me**
   - Who has access: **Anyone**
9. Deploy ke baad **Web app URL** copy karein

### Important

- Sirf **Save** karne se live URL update **nahi** hota — **New version deploy** zaroori hai
- Frontend URL: `src/frontend/src/api.ts` aur `src/frontend/src/utils/mp3-upload.ts` me same Apps Script URL hona chahiye

---

## Deploy ke baad test

Browser ya Postman se:

```json
POST <YOUR_WEB_APP_URL>
Content-Type: text/plain

{"action":"tts","text":"Hello test","lang":"en-US"}
```

Expected: `{ "success": true, "audioBase64": "..." }`  
Agar `"Unknown action: tts"` aaye → purana deployment abhi bhi live hai, dubara **New version** deploy karein.

---

## Supported actions (frontend uses these)

| action | Purpose |
|--------|---------|
| sendOTP | OTP email |
| verifyOTP | OTP verify |
| getInterviewData | Questions + candidate load |
| tts | Server TTS (recording ke liye zaroori) |
| uploadAudio | WebM audio → Drive |
| saveResult | Sheet me COMPLETED + AudioDriveLink |

---

## Common errors

| Error | Fix |
|-------|-----|
| Unknown action: tts | New version deploy karein |
| No item with the given ID (Drive) | `AUDIO_UPLOAD_FOLDER_ID` sahi karein + folder share karein |
| AudioDriveLink empty in sheet | Pehle recording/upload fix karein; `saveResult` tabhi link likhta hai jab `audioDriveLink` non-empty ho |
