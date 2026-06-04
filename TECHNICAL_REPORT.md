# AI Interview Platform - Comprehensive Technical Report
**Generated:** June 2, 2026 | **Project:** @vipin-yadav/ai-interview

---

## Table of Contents
1. [Frontend Stack](#frontend-stack)
2. [Backend Stack](#backend-stack)
3. [Audio Recording Flow](#audio-recording-flow)
4. [Storage Architecture](#storage-architecture)
5. [Authentication](#authentication)
6. [Database](#database)
7. [Deployment](#deployment)
8. [API Endpoints](#api-endpoints)
9. [Environment Variables](#environment-variables)
10. [Audio Processing Analysis](#audio-processing-analysis)
11. [AI Services](#ai-services)
12. [Architecture Diagram](#architecture-diagram)
13. [Critical Issues](#critical-issues)
14. [Recommendations](#recommendations)

---

## Frontend Stack

### Framework & Build Tool
- **React:** 19.1.0 (latest with new compiler)
- **TypeScript:** 5.8.3
- **Build Tool:** Vite 5.4.1
- **Package Manager:** pnpm (latest-10)

### Key Frontend Libraries

#### UI Components & Styling
- **Tailwind CSS:** 3.4.17 (with container-queries and typography)
- **Tailwind Plugins:** 
  - @tailwindcss/container-queries: 0.1.1
  - @tailwindcss/typography: 0.5.10
  - tailwindcss-animate: 1.0.7
- **Radix UI:** Complete component library (v1.1.0+)
  - Dialog, Dropdown Menu, Label, Select, Tabs, Tooltip, Scroll Area, Popover, Checkbox, Switch, Separator, Avatar, Accordion, Alert Dialog, Aspect Ratio, Hover Card, Menubar, Navigation Menu, Progress, Radio Group, Slider, Toggle, Toggle Group, Collapsible, Context Menu
- **shadcn/ui Components:** Pre-built with Radix UI integration
- **Lucide React:** 0.511.0 (icons)
- **React Icons:** 5.4.0 (additional icons)

#### State Management & Data
- **Zustand:** 5.0.5 (lightweight state)
- **TanStack React Query:** 5.24.0 (server state)
- **TanStack React Router:** 1.131.8 (routing)

#### 3D Graphics & Animation
- **Three.js:** 0.176.0
- **@react-three/fiber:** 9.1.2
- **@react-three/drei:** 10.0.8
- **@react-three/cannon:** 6.6.0
- **Motion:** 12.34.3 (Framer Motion alternative)

#### Forms & Input
- **React Hook Form:** 7.53.0
- **input-otp:** 1.4.1 (OTP input)
- **react-quill-new:** 3.4.6 (rich text editor)

#### Date & Chart
- **date-fns:** 3.6.0
- **React Day Picker:** 9.5.0
- **Recharts:** 2.15.1

#### UI Utilities
- **Sonner:** 1.7.4 (toast notifications)
- **Vaul:** 1.1.2 (drawer component)
- **Embla Carousel:** 8.2.1
- **class-variance-authority:** 0.7.0
- **clsx:** 2.1.1
- **tailwind-merge:** 2.5.2
- **cmdk:** 1.0.0 (command palette)

#### Internet Computer / Blockchain
- **@dfinity/agent:** ~3.3.0
- **@dfinity/identity:** ~3.3.0
- **@dfinity/auth-client:** ~3.3.0
- **@dfinity/candid:** ~3.3.0
- **@dfinity/principal:** ~3.3.0
- **@icp-sdk/core:** ~4.1.0

#### Miscellaneous
- **react-use:** 17.6.0 (hooks utilities)
- **react-dom:** 19.1.0
- **next-themes:** 0.4.6 (dark mode)
- **react-resizable-panels:** 2.1.7
- **dotenv:** 16.5.0

### CSS & PostCSS
- **PostCSS:** 8.4.41 with autoprefixer 10.4.20
- **Post CSS Config:** [src/frontend/postcss.config.js](src/frontend/postcss.config.js)
- **Tailwind Config:** [src/frontend/tailwind.config.js](src/frontend/tailwind.config.js)

### Development Tools
- **Biome:** 1.9.0 (linting & formatting)
- **TypeScript:** Strict mode with incremental compilation

---

## Backend Stack

### Architecture
**Type:** Distributed serverless architecture using Google Apps Script + Internet Computer

### Primary Backend: Google Apps Script
**File:** [script.gs.new](script.gs.new) (613+ lines of Google Apps Script)

#### Language & Runtime
- **Language:** Google Apps Script (JavaScript runtime)
- **Execution:** Serverless (automatic scaling)
- **URL:** `https://script.google.com/macros/s/AKfycbzzl0QBIWy-_MUmXDcaWRsGGGkv4Z5HUKXkosVZO5_7ErTBINjutlGHwZdv8Cmhvjenxg/exec`

#### Database Integration
- **Google Sheets** (primary database)
- **Sheets Used:**
  - `Interviews` - Interview session data
  - `Question Sets` - Question templates

#### Core Functions
| Function | Purpose | Endpoint |
|----------|---------|----------|
| `doPost()` | Main request handler | via `action` parameter |
| `sendOTP()` | OTP generation & email | `action=sendOTP` |
| `verifyOTP()` | OTP verification | `action=verifyOTP` |
| `getInterviewData()` | Load interview questions & candidate info | `action=getInterviewData` |
| `saveResult()` | Save interview completion status | `action=saveResult` |
| `uploadAudioToDrive()` | Upload audio blob to Google Drive | `action=uploadAudio` |
| `ttsSynthesize()` | Text-to-speech synthesis | `action=tts` |
| `generateInterviewLinksForPending()` | Generate interview links for candidates | Manual trigger |

### Secondary Backend: Internet Computer Canister
**Location:** [src/backend/main.mo](src/backend/main.mo) (currently empty)
- **Language:** Motoko (Internet Computer smart contracts)
- **Purpose:** Decentralized storage via Caffeine network
- **Status:** Placeholder for future blockchain integration

### Internet Computer Configuration
**File:** [src/frontend/src/config.ts](src/frontend/src/config.ts)
```
backend_host: undefined (will use default ICP gateway)
backend_canister_id: set via environment
storage_gateway_url: https://blob.caffeine.ai
project_id: 0000000-0000-0000-0000-00000000000
ii_derivation_origin: undefined
```

---

## Audio Recording Flow

### Step 1: Microphone Setup
**File:** [src/frontend/src/screens/InterviewScreen.tsx](src/frontend/src/screens/InterviewScreen.tsx#L296-L320)

```typescript
// Line 299-320
const micStream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000,
    sampleSize: 16,
  },
});
```

**Constraints Applied:**
- Echo cancellation: ✅ Enabled
- Noise suppression: ✅ Enabled
- Auto gain control: ✅ Enabled
- Channel count: 1 (mono)
- Sample rate: 48,000 Hz (48 kHz)
- Sample size: 16-bit

### Step 2: TTS Mixing with Mic Input
**File:** [src/frontend/src/screens/InterviewScreen.tsx](src/frontend/src/screens/InterviewScreen.tsx#L138-L240)

#### Audio Context Setup (Line 189-195)
```typescript
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
audioContextRef.current = new AudioContextClass({ sampleRate: 48000 });
const audioCtx = audioContextRef.current;
const destination = audioCtx.createMediaStreamDestination();
destinationRef.current = destination;
```

#### Audio Graph Routing (Line 200-217)
```
Microphone Stream → MediaStreamAudioSourceNode → MediaStreamDestination
        ↓
    (TTS Audio)
        ↓
TTS Audio Element → MediaElementAudioSourceNode → MediaStreamDestination
                    (also connects to audioCtx.destination for speaker output)
```

### Step 3: MediaRecorder Configuration
**File:** [src/frontend/src/screens/InterviewScreen.tsx](src/frontend/src/screens/InterviewScreen.tsx#L227-L232)

```typescript
// Line 227-231
const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") 
    ? "audio/webm;codecs=opus" 
    : "";
    
const mr = new MediaRecorder(mixedStream, mimeType ? { 
  mimeType, 
  audioBitsPerSecond: 48000 
} : { 
  audioBitsPerSecond: 48000 
});
```

**MediaRecorder Settings:**
| Setting | Value |
|---------|-------|
| **Supported MIME Type** | `audio/webm;codecs=opus` |
| **Fallback MIME Type** | Browser default (usually WebM) |
| **Audio Bitrate** | 48,000 bps (48 kbps) |
| **Chunk Interval** | 250ms (Line 233: `mr.start(250)`) |

### Step 4: Chunk Collection
**File:** [src/frontend/src/screens/InterviewScreen.tsx](src/frontend/src/screens/InterviewScreen.tsx#L233-L235)

```typescript
mr.ondataavailable = (e) => {
  if (e.data.size > 0) chunksRef.current.push(e.data);
};
```

**Key References:**
- `chunksRef` - Ref storing Blob chunks ([Line 68](src/frontend/src/screens/InterviewScreen.tsx#L68))
- Chunks pushed every 250ms during recording
- Used to reconstruct complete audio blob

### Step 5: Keep-Alive Mechanism
**File:** [src/frontend/src/screens/InterviewScreen.tsx](src/frontend/src/screens/InterviewScreen.tsx#L234-L239)

```typescript
// Line 234-239
mrKeepAliveRef.current = setInterval(() => {
  if (mr.state === "paused") mr.resume();
}, 2000);
```

**Purpose:** Prevent MediaRecorder from pausing in background/low-resource conditions

### Complete Audio Recording Data Flow

```
1. User Mic Input (48kHz, 16-bit, mono)
        ↓
2. AudioContext MediaStreamSource
        ↓
3. MediaStreamDestination (mixed with TTS)
        ↓
4. MediaRecorder (WebM/Opus)
        ↓
5. ondataavailable chunks (250ms intervals)
        ↓
6. Stored in chunksRef: Blob[]
        ↓
7. On finish: new Blob(chunksRef, { type: recordedMimeType })
        ↓
8. Conversion attempt (currently no-op)
        ↓
9. Upload to Google Drive
```

---

## Audio Processing Analysis

### ⚠️ CRITICAL ISSUE: File Format Mismatch

#### The Problem
**Recordings are generated as WebM/Opus but assigned .mp3 extension**

### Location 1: Audio Blob Creation
**File:** [src/frontend/src/screens/InterviewScreen.tsx](src/frontend/src/screens/InterviewScreen.tsx#L334-L343)

```typescript
// Line 334-335
const recordedMimeType = mr?.mimeType || chunksRef.current[0]?.type || "audio/webm";
const rawBlob = new Blob(chunksRef.current, { type: recordedMimeType });

// Line 340
finalBlob = await convertAudioBlobToMp3(rawBlob);
```

**Analysis:**
- Actual MIME type: `audio/webm` or `audio/webm;codecs=opus`
- Function called: `convertAudioBlobToMp3()`
- Expected: Converts WebM/Opus to MP3
- Actual: Returns blob unchanged (no-op function)

### Location 2: Audio Extension Assignment
**File:** [src/frontend/src/screens/UploadScreen.tsx](src/frontend/src/screens/UploadScreen.tsx#L51-L60)

```typescript
// Line 55-60
const actualMimeType = audioBlob.type || "audio/webm";
const extension = getAudioExtension(actualMimeType);
const fileName = `${state.candidateName.replace(/\s+/g, "_")}_${state.interviewId}.${extension}`;
```

**Function: getAudioExtension()**
**File:** [src/frontend/src/utils/audio.ts](src/frontend/src/utils/audio.ts#L8-L18)

```typescript
export function getAudioExtension(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("aac") || mimeType.includes("m4a"))
    return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  return "webm"; // Default format for Android and PC
}
```

**Issue:** 
- When MIME type is `audio/webm;codecs=opus`, it doesn't match any condition
- Falls through to default: **returns `"webm"`**
- ✅ Extension SHOULD be `webm`, not `mp3`

### Location 3: Google Apps Script Filename Assignment
**File:** [script.gs.new](script.gs.new#L413) (corrupted file has encoding issues)

```javascript
// Line 413 (in corrupted script.gs - corrected version)
const actualFileName = `${safeName}_${safeInterviewId}.mp3`;
```

**Problem:** 
- Google Apps Script **hardcodes `.mp3` extension**
- Regardless of actual audio format
- File is actually WebM/Opus with .mp3 extension

### Location 4: Google Drive Upload
**File:** [script.gs.new](script.gs.new#L418-L425)

```javascript
const blob = Utilities.newBlob(
  Utilities.base64Decode(base64Data),
  'audio/mpeg',  // ❌ Hardcoded MIME type!
  actualFileName
);
```

**Problem:**
- MIME type set to `audio/mpeg` (MP3) unconditionally
- Actual file content is WebM/Opus
- Creates format mismatch on Google Drive

### Location 5: Conversion Function (No-op)
**File:** [src/frontend/src/utils/audio.ts](src/frontend/src/utils/audio.ts#L22-L26)

```typescript
// Line 22-26
export async function convertAudioBlobToMp3(audioBlob: Blob): Promise<Blob> {
  return audioBlob;  // ❌ No conversion! Returns original blob
}

export const convertWebmOpusToMp3 = convertAudioBlobToMp3;
```

**Comment in file (Line 1):**
```
// FFmpeg hata diya gaya hai! Ab zero crash risk hai.
// Translation: "FFmpeg has been disabled! Now zero crash risk."
```

**Why:** FFmpeg was removed to eliminate browser crashes, but no replacement codec was implemented.

---

### Audio Processing Summary

| Step | Input | Output | Status |
|------|-------|--------|--------|
| Recording | Microphone 48kHz | WebM/Opus Blob | ✅ Working |
| Conversion | WebM/Opus | Unchanged blob | ❌ No-op (FFmpeg removed) |
| Extension | `audio/webm` MIME | `.webm` extension | ✅ Correct |
| GAS Upload | WebM/Opus blob | `audio/mpeg` MIME | ❌ Wrong MIME type |
| Google Drive | WebM/Opus file | `.mp3` extension | ❌ Wrong extension |

---

## Storage Architecture

### Primary Storage: Google Drive
**Service:** Google Drive via Google Apps Script

#### Upload Process
**File:** [script.gs.new](script.gs.new#L385-L440)

```javascript
function uploadAudioToDrive(base64Data, fileName, mimeType, candidateName, interviewId) {
  try {
    const FOLDER_ID = "1Am9b_riOnqgWIOvtlro2MMWSHo";  // Line 387
    const folder = DriveApp.getFolderById(FOLDER_ID);
    
    // Decode and create blob
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      'audio/mpeg',
      actualFileName
    );
    
    // Create file in folder
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    
    const link = file.getUrl() + "?usp=sharing";
    return { success: true, link };
  }
}
```

#### Uploaded File Structure
**Path:** Google Drive → Folder ID: 1Am9b_riOnqgWIOvtlro2MMWSHo
**File Naming:** `{CandidateName}_{InterviewId}.mp3`
**Example:** `John_Doe_INT-1234567890.mp3`

**File Metadata:**
- MIME Type: `audio/mpeg` (hardcoded, incorrect)
- Actual Format: WebM/Opus (inside MP3 container)
- Permissions: Public view-only
- Sharing: Anyone with link

### Secondary Storage: Internet Computer (Caffeine)
**Status:** Planned, not yet implemented

**Configuration:**
```
Storage Gateway URL: https://blob.caffeine.ai
Bucket Name: default-bucket
Project ID: 0000000-0000-0000-0000-00000000000
```

**Class:** [StorageClient](src/frontend/src/utils/StorageClient.ts)
**Features:**
- Chunked uploads (512 KB chunks)
- SHA-256 hash verification
- Exponential backoff retry logic (MAX_RETRIES: 3)
- Binary merkle tree hashing
- Concurrent upload limit: 10 uploads

---

## Authentication

### Method: Internet Identity (DFINITY)
**Framework:** DFINITY Internet Computer authentication

#### Configuration
**File:** [src/frontend/src/hooks/useInternetIdentity.ts](src/frontend/src/hooks/useInternetIdentity.ts#L1-L50)

```typescript
import { AuthClient, type AuthClientCreateOptions } from "@dfinity/auth-client";
import { DelegationIdentity, isDelegationValid } from "@icp-sdk/core/identity";
```

#### Auth Flow
1. **OTP Verification** via Google Apps Script
2. **Token Generation:** Interview ID used as token
3. **II Login:** Internet Identity provider authentication
4. **Session:** Stored in browser local storage

#### OTP System
**File:** [script.gs.new](script.gs.new#L48-L85)

```javascript
const OTP_EXPIRY_MINUTES = 10;

function sendOTP(email, interviewId) {
  // Generate 6-digit OTP
  // Send via email
  // Store with 10-minute expiry
}

function verifyOTP(email, otp, interviewId) {
  // Validate OTP matches stored value
  // Check expiry time
  // Return success/failure
}
```

### OAuth Not Used
- No Google OAuth implementation
- Simple email-based OTP verification
- No user account system (interview-based access)

---

## Database

### Primary Database: Google Sheets
**Service:** Google Sheets (no separate database server)

#### Sheets Structure

**Sheet 1: Interviews**
Columns tracked:
- CandidateEmail
- CandidateName
- Department
- Designation
- InterviewId
- Status (CREATED, COMPLETED)
- CreatedAt
- InterviewLink
- ScreenSwitchCount
- AudioLink (file URL)

**Sheet 2: Question Sets**
Columns:
- uid (unique identifier)
- srNo (serial number)
- type (question type)
- question (text)

#### Query Pattern
All data queries via Google Apps Script functions that:
1. Use `SpreadsheetApp.getActiveSpreadsheet()`
2. Get sheet by name: `ss.getSheetByName(INTERVIEWS_SHEET)`
3. Read entire data range: `sheet.getDataRange().getValues()`
4. Build column index: `const COL = {}`
5. Search rows manually

#### Sample Query
**File:** [script.gs.new](script.gs.new#L100-L140)

```javascript
const data = sheet.getDataRange().getValues();
const COL = {};
data[0].forEach((h, i) => COL[h.trim()] = i);

for (let i = 1; i < data.length; i++) {
  if (String(data[i][COL["InterviewId"]]) === interviewId) {
    // Process row
    candidateName = data[i][COL["CandidateName"]];
  }
}
```

#### Limitations
- ❌ No real-time updates
- ❌ No transactions or ACID guarantees
- ❌ No indexing (linear search through rows)
- ❌ No data validation at database level
- ✅ Simple, requires no server infrastructure

---

## Deployment

### Frontend Deployment
**Platform:** Vercel
**URL:** `https://rawalwasia-ai-interview.vercel.app`

**Deployment Configuration:**
- Auto-deploy from Git
- Build command: `pnpm build`
- Build output: `dist/` directory
- Environment file: `env.json` copied to dist

**File:** [src/frontend/package.json](src/frontend/package.json#L8)
```json
"build": "vite build && pnpm copy:env",
"copy:env": "cp env.json dist/ || copy env.json dist\\",
```

### Backend Deployment
**Type:** Serverless (no deployment needed)
- Google Apps Script: Auto-deployed via script dashboard
- Google Sheets: No deployment required
- Internet Computer: Via `icp deploy --environment local` (local only)

### Docker Support
**File:** [Dockerfile](Dockerfile)
- Base: Ubuntu 24.04
- Node: 20.x LTS
- Package Manager: pnpm latest-10
- Includes: Build tools, OpenSSL, DFINITY mops, ic-mops

---

## API Endpoints

### Backend API Endpoint
**URL:** `https://script.google.com/macros/s/AKfycbzzl0QBIWy-_MUmXDcaWRsGGGkv4Z5HUKXkosVZO5_7ErTBINjutlGHwZdv8Cmhvjenxg/exec`

**Method:** POST
**Content-Type:** `text/plain` (for CORS compatibility)

### API Actions

| Action | Parameters | Returns | Purpose |
|--------|-----------|---------|---------|
| `sendOTP` | `email`, `interviewId` | `{ success, message }` | Request OTP to email |
| `verifyOTP` | `email`, `otp`, `interviewId` | `{ success, token, message }` | Verify OTP code |
| `getInterviewData` | `interviewId` | `{ success, candidate, questions }` | Load interview setup |
| `tts` | `text`, `lang` | `{ success, audioBase64 }` | Synthesize speech |
| `uploadAudio` | `base64Data`, `fileName`, `mimeType`, `candidateName`, `interviewId` | `{ success, link, message }` | Upload to Drive |
| `saveResult` | `interviewId`, `audioDriveLink`, `screenSwitchCount`, `status` | `{ success, message }` | Save completion |

#### Request Format
```json
{
  "action": "sendOTP",
  "email": "candidate@example.com",
  "interviewId": "INT-123456"
}
```

#### Response Format
```json
{
  "success": true,
  "message": "OTP sent",
  "audioBase64": "..."  // Only for tts action
}
```

---

## Environment Variables

### Frontend Environment Variables
**File:** [src/frontend/env.json](src/frontend/env.json) (loaded at build time)

```json
{
  "backend_host": "undefined",
  "backend_canister_id": "undefined",
  "project_id": "undefined",
  "ii_derivation_origin": "undefined"
}
```

### Vite Configuration Environment Variables
**File:** [src/frontend/vite.config.js](src/frontend/vite.config.js#L5-L30)

| Variable | Default | Purpose | Set Via |
|----------|---------|---------|----------|
| `DFX_NETWORK` | N/A | ICP network (local/ic) | Environment |
| `II_URL` | Conditional | Internet Identity provider URL | Environment/default |
| `STORAGE_GATEWAY_URL` | `https://blob.caffeine.ai` | Caffeine storage gateway | Environment/default |
| `CANISTER_ID_BACKEND` | N/A | Backend canister ID | Environment |
| `BASE_URL` | `./` | Frontend base path | Environment/default |

### Vite Plugin Configuration
```javascript
plugins: [
  environment("all", { prefix: "CANISTER_" }),     // Load CANISTER_* variables
  environment("all", { prefix: "DFX_" }),          // Load DFX_* variables
  environment(["II_URL"]),                          // Load II_URL
  environment(["STORAGE_GATEWAY_URL"]),            // Load STORAGE_GATEWAY_URL
  react(),
]
```

### Runtime Configuration
**File:** [src/frontend/src/config.ts](src/frontend/src/config.ts#L10-L35)

```typescript
interface Config {
  backend_host?: string;
  backend_canister_id: string;
  storage_gateway_url: string;
  bucket_name: string;
  project_id: string;
  ii_derivation_origin?: string;
}

export async function loadConfig(): Promise<Config> {
  // Loads from env.json at runtime
  // Falls back to environment variables
}
```

### Deployment Environment Variables (Vercel)
Should be set via Vercel dashboard:
- `CANISTER_ID_BACKEND`
- `DFX_NETWORK` (set to `ic`)
- `II_URL` (set to `https://identity.internetcomputer.org/`)
- `STORAGE_GATEWAY_URL` (set to `https://blob.caffeine.ai`)

---

## AI Services

### Text-to-Speech (TTS)

#### Primary Provider: Edge TTS
**Endpoint:** `https://api.edgetts.net/v1/synthesize`

**Configuration:**
```javascript
const voiceMap = {
  'en-US': 'en-US-AriaNeural',  // English (female)
  'hi-IN': 'hi-IN-SwatiNeural'   // Hindi (female)
};
```

**File:** [script.gs.new](script.gs.new#L53-L80)
```javascript
function ttsSynthesize(text, lang = 'en-US') {
  const voice = voiceMap[lang] || 'en-US-AriaNeural';
  const url = `https://api.edgetts.net/v1/synthesize?voice=${voice}&rate=0.95&pitch=1.0&volume=1.0`;
  
  const response = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/ssml+xml' },
    payload: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">${text}</speak>`
  });
  
  return { success: true, audioBase64: audioBase64 };
}
```

#### Fallback Provider: Google Translate TTS
**URL:** `https://translate.google.com/translate_tts`

**Features:**
- Free, no API key required
- Splits text into 100-character chunks (Line 87)
- Concatenates audio base64 strings
- Used only if Edge TTS fails

#### TTS Flow in Interview
**File:** [src/frontend/src/screens/InterviewScreen.tsx](src/frontend/src/screens/InterviewScreen.tsx#L138-L170)

1. Question text passed to `playTtsWithMix(text, idx, onDone)`
2. Calls `ttsSynthesize(text, lang)` via [api.ts](src/frontend/src/api.ts#L76-L86)
3. Response: `{ audioBase64: string }`
4. Create data URI: `data:audio/mp3;base64,${audioBase64}`
5. Load into HTMLAudioElement
6. Connect to AudioContext for mixing

### No AI Processing Service
- ❌ Gemini (not used)
- ❌ OpenAI (not used)
- ❌ Claude (not used)
- ❌ AssemblyAI (not used)
- ❌ Speech-to-Text services (not used)
- ❌ Candidate response evaluation (not implemented)

**Future Consideration:** Interview responses could be analyzed using Claude 3.5 Sonnet or Gemini API for:
- Relevance scoring
- Technical accuracy assessment
- Communication quality evaluation

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CANDIDATE BROWSER                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    React 19 + Vite App                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │  │
│  │  │ OTP Screen   │  │Interview Scr.│  │  Upload Screen     │  │  │
│  │  │              │  │              │  │  ┌──────────────┐  │  │  │
│  │  │ Email-based  │  │ • Questions  │  │  │Upload to:    │  │  │  │
│  │  │ OTP auth     │  │ • Recording  │  │  │ • GDrive     │  │  │  │
│  │  │              │  │ • TTS play   │  │  │ • Caffeine   │  │  │  │
│  │  └──────────────┘  └──────────────┘  └────────────────────┘  │  │
│  │         ↓                  ↓                    ↓              │  │
│  │      (API POST)       (Audio + API)         (Blob + API)      │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         ↓                       ↓                        ↓
    ┌────────────────────┐ ┌──────────────────┐ ┌──────────────────┐
    │  Google Sheets     │ │  Edge TTS API    │ │   Google Drive   │
    │  (Database)        │ │  (+ Translate    │ │   (Storage)      │
    │                    │ │   Fallback)      │ │                  │
    │ • Interviews       │ │                  │ │ Audio files:     │
    │ • Questions        │ │ Returns: MP3     │ │ Name_{ID}.mp3    │
    │ • Candidates       │ │ Audio Base64     │ │ Mime: audio/mp3  │
    │                    │ │                  │ │ Actual: WebM/Opus│
    └────────────────────┘ └──────────────────┘ └──────────────────┘
         ↑                                             ↑
         └────────────────────────────────────────────┘
              Google Apps Script (Backend)
              script.gs.new (613 lines)
              
              Actions:
              • sendOTP()
              • verifyOTP()
              • getInterviewData()
              • ttsSynthesize() ← calls Edge TTS
              • uploadAudioToDrive() ← saves to GDrive
              • saveResult()


┌─────────────────────────────────────────────────────────────────────┐
│              AUDIO RECORDING & PROCESSING FLOW                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Microphone Input (48kHz, 16-bit, mono)                            │
│  ├─ echoCancellation: ON                                           │
│  ├─ noiseSuppression: ON                                           │
│  └─ autoGainControl: ON                                            │
│           ↓                                                         │
│  AudioContext (48kHz sample rate)                                  │
│  ├─ MediaStreamAudioSourceNode (from mic)                          │
│  ├─ MediaElementAudioSourceNode (from TTS)                         │
│  └─ MediaStreamAudioDestinationNode (mix output)                   │
│           ↓                                                         │
│  MediaRecorder                                                      │
│  ├─ MIME Type: audio/webm;codecs=opus (if supported)               │
│  ├─ Fallback: Browser default                                      │
│  ├─ Bitrate: 48,000 bps                                            │
│  └─ Chunk interval: 250ms                                          │
│           ↓                                                         │
│  Blob Array (WebM/Opus chunks)                                     │
│           ↓                                                         │
│  Blob Reconstruction                                               │
│  ├─ MIME: audio/webm OR audio/webm;codecs=opus                     │
│  └─ Function: convertAudioBlobToMp3() [NO-OP]                      │
│           ↓                                                         │
│  Upload to Google Apps Script                                      │
│           ↓                                                         │
│  Google Apps Script                                                │
│  ├─ Decode base64 → raw bytes                                      │
│  ├─ Create new Blob with MIME: audio/mpeg ❌ WRONG                 │
│  └─ Filename: {name}_{id}.mp3                                      │
│           ↓                                                         │
│  Google Drive Upload                                               │
│  ├─ File stored as: {name}_{id}.mp3                                │
│  ├─ MIME type: audio/mpeg                                          │
│  ├─ Actual content: WebM/Opus (binary)                             │
│  └─ Issue: Format mismatch causes player errors                    │
│           ↓                                                         │
│  ⚠️ RESULT: Invalid MP3 file that won't play in MP3 players        │
│             Will open in WebM-capable players                      │
│             Requires format conversion to be usable as MP3          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Critical Issues

### 🔴 Issue #1: File Format Mismatch (HIGH SEVERITY)

**Summary:** Audio files recorded as WebM/Opus but stored with .mp3 extension and audio/mpeg MIME type

**Impact:**
- MP3 players cannot play the files
- Streaming services may reject files
- Some applications will not recognize files
- Manual format conversion needed for compatibility

**Locations:**
1. [src/frontend/src/screens/InterviewScreen.tsx](src/frontend/src/screens/InterviewScreen.tsx#L334) - Records WebM/Opus
2. [src/frontend/src/utils/audio.ts](src/frontend/src/utils/audio.ts#L22-L26) - No-op conversion function
3. [script.gs.new](script.gs.new#L418-L425) - Hardcodes audio/mpeg MIME type
4. [script.gs.new](script.gs.new#L413) - Hardcodes .mp3 extension

**Root Cause:** FFmpeg was removed to prevent browser crashes, leaving no conversion mechanism

**Severity:** 🔴 HIGH
- Files are unplayable as MP3s
- Breaks promised audio delivery format
- Candidates expect MP3, get invalid files

---

### 🟡 Issue #2: No Real MP3 Conversion (MEDIUM SEVERITY)

**Summary:** `convertAudioBlobToMp3()` returns original blob unchanged

**File:** [src/frontend/src/utils/audio.ts](src/frontend/src/utils/audio.ts#L22-L26)

**Code:**
```typescript
export async function convertAudioBlobToMp3(audioBlob: Blob): Promise<Blob> {
  return audioBlob;  // Returns unchanged
}
```

**Comment:** 
```
// FFmpeg hata diya gaya hai! Ab zero crash risk hai.
// (FFmpeg disabled! Now zero crash risk.)
```

**Impact:**
- No browser-side MP3 generation
- Files remain in WebM/Opus format
- Causes Issue #1

**Severity:** 🟡 MEDIUM
- Intentional workaround (FFmpeg removal)
- Needs server-side solution

---

### 🟡 Issue #3: Storage Gateway Not Integrated (MEDIUM SEVERITY)

**Summary:** Caffeine storage client implemented but not used

**File:** [src/frontend/src/utils/StorageClient.ts](src/frontend/src/utils/StorageClient.ts#L1-L50)

**Status:**
- Class defined: ✅
- Methods implemented: ✅
- Actually called: ❌

**Features Implemented but Not Used:**
- Chunked uploads (512 KB chunks)
- SHA-256 verification
- Retry logic with exponential backoff
- Merkle tree hashing

**Impact:**
- No decentralized backup
- All eggs in Google Drive basket
- Zero resilience if Google Drive fails

**Severity:** 🟡 MEDIUM
- Future-proofing incomplete
- Internet Computer integration not finished

---

### 🟡 Issue #4: No Real-Time Database Queries (LOW SEVERITY)

**Summary:** Google Sheets queried with O(n) linear search

**File:** [script.gs.new](script.gs.new#L100-L140)

**Impact:**
- Performance degrades with more interviews
- No indexing
- ~1-2 second latency for each query

**Severity:** 🟡 LOW
- Works for small scale (<1000 interviews)
- Will need optimization later

---

### 🟢 Issue #5: No Input Validation (LOW SEVERITY)

**Summary:** Minimal server-side validation of audio MIME types

**Files:**
- [src/frontend/src/api.ts](src/frontend/src/api.ts#L126-L135)
- [script.gs.new](script.gs.new#L418-L425)

**Missing Validations:**
- Audio blob size limits
- MIME type verification
- Candidate name sanitization

**Severity:** 🟢 LOW
- Not security-critical
- Nice-to-have improvements

---

## Recommendations

### 🎯 Recommendation #1: Implement Proper MP3 Conversion (URGENT)

**Goal:** Generate valid MP3 files from WebM/Opus recordings

#### Option A: Server-Side Conversion (Recommended)
**Approach:** Use FFmpeg on backend server

**Pros:**
- Reliable, standard tool
- High quality conversion
- Batch processing possible
- Works with any browser

**Cons:**
- Requires server infrastructure
- FFmpeg binary deployment needed
- ~2-3 seconds per file

**Implementation:**
```bash
# Deploy FFmpeg-as-a-Service (e.g., AWS Lambda)
# Or use Cloud Run for Motoko canister backend

1. Frontend sends WebM/Opus blob to backend
2. Backend saves to temporary storage
3. Run: ffmpeg -i input.webm -q:a 9 -n output.mp3
4. Upload MP3 to Google Drive
5. Return URL to frontend
```

**Code Example (Python):**
```python
import ffmpeg

def convert_webm_to_mp3(input_path, output_path):
    ffmpeg.input(input_path).output(output_path, q='9').run()
    return output_path
```

**Estimated Cost:** $0.0001 - $0.001 per file (Lambda/Cloud Run)

#### Option B: WASM-Based Browser Conversion
**Approach:** Use ffmpeg.wasm (already in package.json!)

**File:** [package.json](package.json) - Already includes:
```json
"@ffmpeg/ffmpeg": "^0.12.15",
"@ffmpeg/util": "^0.12.2"
```

**Pros:**
- No server needed
- Fast (GPU acceleration possible)
- Offline capable

**Cons:**
- Large library download (~30-40MB first load)
- CPU-intensive on browser
- May freeze UI during conversion
- Browser crash risk (why it was disabled)

**Implementation:**
```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

async function convertWebmToMp3(blob: Blob): Promise<Blob> {
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();
  
  await ffmpeg.writeFile('input.webm', await fetchFile(blob));
  await ffmpeg.exec(['-i', 'input.webm', '-q:a', '9', 'output.mp3']);
  
  const data = await ffmpeg.readFile('output.mp3');
  return new Blob([data.buffer], { type: 'audio/mpeg' });
}
```

**⚠️ Risk:** The reason FFmpeg was disabled. Mitigate with:
- Web Worker to avoid freezing main thread
- Time-limited execution (abort if > 30 seconds)
- Graceful fallback to original WebM

#### Option C: Hybrid Approach (BEST)
1. **Recording phase:** Keep as WebM/Opus (low bandwidth)
2. **Upload phase:** 
   - If file < 5MB: Use ffmpeg.wasm in background worker
   - If file > 5MB: Send to Cloud Run for conversion
3. **Fallback:** If conversion fails, upload WebM with corrected MIME type

**Implementation Recommendation:**
```typescript
// src/frontend/src/utils/audio.ts
export async function convertAudioBlobToMp3(
  audioBlob: Blob,
  options: { maxSizeForBrowser: number } = { maxSizeForBrowser: 5 * 1024 * 1024 }
): Promise<Blob> {
  if (audioBlob.size > options.maxSizeForBrowser) {
    // Server-side conversion
    return await serverConvertToMp3(audioBlob);
  }
  
  try {
    // Browser-side conversion in Worker
    return await browserConvertToMp3InWorker(audioBlob);
  } catch (error) {
    console.warn("Browser conversion failed, uploading WebM:", error);
    // Return as-is with corrected MIME type
    return audioBlob;
  }
}
```

**Timeline:** 2-3 days implementation

---

### 🎯 Recommendation #2: Fix MIME Type and Extension (IMMEDIATE)

**Quick Fix:** Correct the filename and MIME type mapping

**File Changes Required:**

#### Change 1: Update getAudioExtension() to return actual format
**File:** [src/frontend/src/utils/audio.ts](src/frontend/src/utils/audio.ts#L8-L18)

```typescript
// Current (incorrect)
export function getAudioExtension(mimeType: string): string {
  if (mimeType.includes("mp3")) return "mp3";
  return "webm"; // Falls through for WebM
}

// Fixed version
export function getAudioExtension(
  mimeType: string,
  targetFormat: 'webm' | 'mp3' = 'webm'
): string {
  // If we're converting to MP3, return mp3
  if (targetFormat === 'mp3') return "mp3";
  
  // Otherwise return format matching MIME type
  if (mimeType.includes("mp3") || mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("m4a") || mimeType.includes("aac")) return "m4a";
  return "webm"; // Default: WebM
}
```

#### Change 2: Fix Google Apps Script MIME type
**File:** [script.gs.new](script.gs.new#L418-L425)

```javascript
// Current (wrong)
const blob = Utilities.newBlob(
  Utilities.base64Decode(base64Data),
  'audio/mpeg',  // ❌ Hardcoded
  actualFileName
);

// Fixed version
const blob = Utilities.newBlob(
  Utilities.base64Decode(base64Data),
  mimeType || 'audio/webm',  // Use provided MIME type
  actualFileName
);
```

#### Change 3: Remove hardcoded .mp3 extension
**File:** [script.gs.new](script.gs.new#L413)

```javascript
// Current (wrong)
const actualFileName = `${safeName}_${safeInterviewId}.mp3`;

// Fixed version - derive extension from MIME type or filename
function getExtensionFromMime(mimeType: string): string {
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm'; // Default
}

const ext = getExtensionFromMime(mimeType);
const actualFileName = `${safeName}_${safeInterviewId}.${ext}`;
```

**Impact:** 
- ✅ Files will have correct extension
- ✅ MIME type will match actual format
- ✅ Files will play in WebM-capable players
- ⏳ Still need MP3 conversion for full compatibility

**Timeline:** 1 hour implementation

---

### 🎯 Recommendation #3: Integrate Caffeine Storage (OPTIONAL)

**Goal:** Add decentralized backup using Internet Computer Caffeine network

**Current State:**
- StorageClient class fully implemented ✅
- Not used in interview flow ❌

**Integration Steps:**

1. **Enable Storage Gateway URL:**
```typescript
// src/frontend/src/config.ts
storage_gateway_url: process.env.STORAGE_GATEWAY_URL || "https://blob.caffeine.ai"
```

2. **Create upload wrapper:**
```typescript
// src/frontend/src/utils/audio.ts
export async function uploadAudioToICP(
  audioBlob: Blob,
  fileName: string,
  storageClient: StorageClient
): Promise<{ hash: string; url: string }> {
  const chunks: Blob[] = [];
  const chunkSize = 512 * 1024; // 512 KB
  
  for (let i = 0; i < audioBlob.size; i += chunkSize) {
    chunks.push(audioBlob.slice(i, i + chunkSize));
  }
  
  const result = await storageClient.uploadChunked(chunks, {
    fileName,
    mimeType: audioBlob.type,
  });
  
  return {
    hash: result.hash,
    url: `${storageClient.getStorageGatewayUrl()}/v1/blob/?blob_hash=${result.hash}`
  };
}
```

3. **Save to both Google Drive and ICP:**
```typescript
// src/frontend/src/screens/UploadScreen.tsx
let icpLink = "";
try {
  const icpResult = await uploadAudioToICP(audioBlob, fileName, storageClient);
  icpLink = icpResult.url;
} catch (error) {
  console.warn("ICP upload failed:", error); // Continue anyway
}

// Save both links
await finalizeInterview(
  interviewId,
  token,
  screenSwitchCount,
  selectedQuestionUIDs,
  { googleDriveLink: driveLink, icpLink }
);
```

**Benefits:**
- Geographic redundancy
- Blockchain-backed verification
- Immutable audit trail
- Web3-native architecture

**Timeline:** 2-3 days

---

### 🎯 Recommendation #4: Implement AI-Powered Response Analysis (FUTURE)

**Goal:** Analyze candidate responses using Claude or Gemini

**Use Cases:**
1. **Answer Relevance Scoring** - Does answer address question?
2. **Technical Accuracy** - For technical positions
3. **Communication Quality** - Clarity, conciseness
4. **Confidence Scoring** - Based on speech patterns
5. **Red Flags** - Suspicious patterns detection

**Implementation:**

```typescript
// src/backend/analyze-response.ts
import Anthropic from "@anthropic-ai/sdk";

async function analyzeInterviewResponse(
  question: string,
  candidateResponse: string,
  jobLevel: "junior" | "mid" | "senior"
) {
  const client = new Anthropic();
  
  const prompt = `
You are an expert technical interviewer. Analyze this interview response:

Question: ${question}
Candidate Response: ${candidateResponse}
Job Level: ${jobLevel}

Provide structured analysis:
1. Relevance (0-100): Does the answer address the question?
2. Technical Accuracy (0-100): Is the technical information correct?
3. Completeness (0-100): Did they cover key points?
4. Communication (0-100): Was it clear and well-structured?
5. Confidence (0-100): Speech pattern confidence level
6. Red Flags: Any concerns?
7. Strengths: What did they do well?
8. Overall Score (0-100): Combined assessment

Return as JSON.
  `;

  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 500,
    messages: [
      { role: "user", content: prompt }
    ]
  });

  return JSON.parse(response.content[0].text);
}
```

**Integration Point:**
```typescript
// In saveResult() - after interview completes
async function analyzeAndScoreInterview(
  interviewId: string,
  questions: Question[],
  audioTranscript: string
) {
  const scores = [];
  const responses = audioTranscript.split("|||"); // Delimiter between answers
  
  for (let i = 0; i < questions.length; i++) {
    const analysis = await analyzeInterviewResponse(
      questions[i].question,
      responses[i],
      "mid"
    );
    scores.push({
      questionUid: questions[i].uid,
      analysis
    });
  }
  
  // Save scores to Sheets
  updateInterviewScores(interviewId, scores);
}
```

**Requirements:**
- [ ] Implement speech-to-text (AssemblyAI or Google Cloud Speech)
- [ ] Integrate Claude API with error handling
- [ ] Store scores in Google Sheets
- [ ] Create scoring dashboard
- [ ] Handle cost optimization (API calls per interview)

**Estimated Cost:** $0.50 - $2.00 per interview (transcription + analysis)

**Timeline:** 1-2 weeks

---

### 🎯 Recommendation #5: Add Candidate Performance Dashboard (FUTURE)

**Goal:** Create admin dashboard to review candidate responses

**Features:**
```
Dashboard Layout:
├─ Interview List
│  ├─ Candidate Name
│  ├─ Date
│  ├─ Overall Score
│  └─ Status (Completed, Pending Review)
│
├─ Interview Detail
│  ├─ Audio Playback Player
│  ├─ Transcript (speech-to-text)
│  ├─ Question-by-Question Breakdown
│  │  ├─ Question text
│  │  ├─ Response transcript
│  │  ├─ AI Analysis scores
│  │  ├─ Timestamp
│  │  └─ Play/Pause controls
│  │
│  └─ Summary
│     ├─ Total Score
│     ├─ Technical Skills: 7/10
│     ├─ Communication: 8/10
│     ├─ Problem-Solving: 6/10
│     └─ Red Flags (if any)
```

**Technology:** React + TailwindCSS on existing frontend

---

## Summary of File Locations and Key Code

### Critical Files for Audio Processing

| File | Lines | Purpose |
|------|-------|---------|
| [src/frontend/src/screens/InterviewScreen.tsx](src/frontend/src/screens/InterviewScreen.tsx#L227-L243) | 227-243 | MediaRecorder setup with WebM/Opus |
| [src/frontend/src/utils/audio.ts](src/frontend/src/utils/audio.ts#L22-L26) | 22-26 | No-op MP3 conversion function |
| [src/frontend/src/screens/UploadScreen.tsx](src/frontend/src/screens/UploadScreen.tsx#L51-L60) | 51-60 | Filename and extension assignment |
| [script.gs.new](script.gs.new#L413) | 413 | Hardcoded .mp3 extension |
| [script.gs.new](script.gs.new#L418-L425) | 418-425 | Hardcoded audio/mpeg MIME type |

### Configuration Files

| File | Purpose |
|------|---------|
| [src/frontend/src/config.ts](src/frontend/src/config.ts) | Runtime configuration loading |
| [src/frontend/env.json](src/frontend/env.json) | Build-time environment variables |
| [src/frontend/vite.config.js](src/frontend/vite.config.js) | Vite build configuration |

### API Integration

| File | Purpose |
|------|---------|
| [src/frontend/src/api.ts](src/frontend/src/api.ts) | Google Apps Script API calls |
| [script.gs.new](script.gs.new) | Backend implementation |

---

## Conclusion

The AI Interview platform is a well-structured React application leveraging Google infrastructure for backend services. While the core functionality is solid, there is a **critical audio format issue** that needs immediate attention: recordings are WebM/Opus but are stored with .mp3 extensions.

**Key Priorities:**
1. 🔴 **URGENT:** Fix file format mismatch (Recommendation #1 & #2)
2. 🟡 **SOON:** Implement proper MP3 conversion
3. 🟢 **NICE-TO-HAVE:** Integrate Caffeine storage and AI analysis

The recommended approach is **Hybrid Option C** for MP3 conversion, combining browser-side conversion for small files with server-side conversion for larger ones, with automatic fallback to WebM if conversion fails.

---

**Report Generated:** 2026-06-02
**Analysis Scope:** Complete codebase review
**Recommendation Type:** Actionable with code examples
