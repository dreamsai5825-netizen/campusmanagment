# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Testing

- **Unit tests** (Vitest + React Testing Library): `npm run test:run` or `npm run test` (watch). Covers `src/lib` utilities and UI components.
- **Integration tests** (API routes with mocked Firebase): `npm run test:integration`.
- **E2E / automation** (Playwright): `npm run test:e2e`. Start the app (`npm run dev`) or let Playwright start it. UI mode: `npm run test:e2e:ui`.
- **Performance**: `npm run test:performance` (measures response times; app must be running). For E2E performance: `npm run test:e2e -- e2e/performance.spec.ts`.
- **Stress**: `npm run test:stress` (autocannon load test; app must be running). Tune with `STRESS_DURATION`, `STRESS_CONNECTIONS`, `STRESS_PIPELINING`.

## Deploy (Firebase App Hosting)

This project uses **Firebase App Hosting** for the Next.js app (SSR + API routes). All API routes (e.g. `/api/create-teacher-logins`, `/api/create-student-logins`) live in the main app under `src/app/api/` and deploy with App Hosting in one go—no separate functions directory. Firestore and Storage rules deploy alongside.

### First-time setup

1. **Create an App Hosting backend** (one of two ways):
   - **Console**: [Firebase Console → Build → App Hosting](https://console.firebase.google.com/project/_/apphosting) → **Get started** (or **Create backend**). Connect your GitHub repo, set app root to `/` or your repo root, set live branch (e.g. `main`), then create. You need the **Blaze** plan.
   - **CLI**: From the project root run:
     ```bash
     firebase init apphosting
     ```
     Choose your Firebase project, create or select a backend, set root directory to `.`. This writes your `backendId` into `firebase.json` (replace `REPLACE_WITH_YOUR_BACKEND_ID` if you edited it by hand).

2. **Backend ID rules**  
   Use only **lowercase letters, digits, and hyphens**; must start with a letter and cannot end with a hyphen (e.g. `campus-connect`, not `Campus-Connect`).

3. **Link `firebase.json` to your backend**  
   If you didn’t run `firebase init apphosting`, open `firebase.json` and set `apphosting[0].backendId` to your backend ID (e.g. `campus-connect`).

### Deploy

- **Full deploy** (App Hosting + Firestore + Storage):  
  `npm run deploy` or `firebase deploy`
- **App Hosting only**:  
  `npm run deploy:apphosting` or `firebase deploy --only apphosting`
- **Firestore + Storage rules only**:  
  `npm run deploy:rules` or `firebase deploy --only firestore,storage`

### Live URL (App Hosting)

Use **this URL on other devices** (direct Cloud Run – works everywhere):

**https://campus-connect-6x72c7pova-uc.a.run.app**

Alternative (Firebase App Hosting domain):

**https://campus-connect--studio-7522226027-4e1c9.us-central1.hosted.app**

If the `.hosted.app` link does not open on phones or other networks, use the first URL (`.run.app`). You can also open [Firebase Console → App Hosting](https://console.firebase.google.com/project/studio-7522226027-4e1c9/apphosting) → backend **campus-connect** → **Backend information** for the live link.

### Make site public (accessible on other devices)

By default, the App Hosting backend runs on **Cloud Run**, which can be **private** (only your Google account / this device). To allow anyone to open the site on any device:

**Option 1 – Google Cloud CLI (gcloud)**

1. Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) and run `gcloud auth login` and `gcloud config set project studio-7522226027-4e1c9` if needed.
2. List Cloud Run services (to find the exact service name if needed):
   ```bash
   gcloud run services list --project=studio-7522226027-4e1c9 --region=us-central1
   ```
3. Allow public access and allow all traffic:
   ```bash
   gcloud run services add-iam-policy-binding campus-connect --project=studio-7522226027-4e1c9 --region=us-central1 --member="allUsers" --role="roles/run.invoker"
   gcloud run services update campus-connect --project=studio-7522226027-4e1c9 --region=us-central1 --ingress=all
   ```
   Or run the script (PowerShell):
   ```powershell
   .\scripts\make-apphosting-public.ps1
   ```
   To use a different service name: `.\scripts\make-apphosting-public.ps1 -ServiceName "your-service-name"`

**Option 2 – Google Cloud Console**

1. Open [Cloud Run](https://console.cloud.google.com/run?project=studio-7522226027-4e1c9), region **us-central1**.
2. Click the service (e.g. **campus-connect**).
3. Open the **Security** tab → **Allow unauthenticated invocations** → Save.

After this, the live URL will work on all devices and networks.

### API 500 (create-teacher-logins / create-student-logins)

The app uses **Firebase Admin** on the server. On App Hosting (Cloud Run) it uses **Application Default Credentials** and `GOOGLE_CLOUD_PROJECT` (set in `apphosting.yaml`). If those API routes still return 500 after deploy:

1. **Redeploy** so the latest `firebase-admin` and `apphosting.yaml` are live: `npm run deploy` or `firebase deploy --only apphosting`.
2. **Grant the Cloud Run service account Firebase access**: In [Google Cloud Console → IAM](https://console.cloud.google.com/iam-admin/iam?project=studio-7522226027-4e1c9), find the service account used by the Cloud Run service (e.g. `...@appspot.gserviceaccount.com` or the default Compute one). Add role **Firebase Admin SDK Administrator Service Agent** (or at least **Cloud Datastore User** and access to Firebase Authentication) so the API can call Firestore and Auth.

- [App Hosting docs](https://firebase.google.com/docs/app-hosting)
- [Deploy from local (no GitHub)](https://firebase.google.com/docs/app-hosting/alt-deploy)
