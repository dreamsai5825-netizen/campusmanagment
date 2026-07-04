# Fix "File in chat" / attachment uploads (Firebase Storage CORS)

If attachments in the Communication chat fail with **CORS** or **blocked by CORS policy**, the browser is blocking uploads to Firebase Storage. Fix it by setting CORS on your Storage bucket.

---

## 1. Add Google Cloud SDK to your PATH (Windows)

Your SDK is at: `C:\Users\PC-18\AppData\Local\Google\Cloud SDK`

**Option A – System settings (permanent)**

1. Press **Win + R**, type `sysdm.cpl`, Enter.
2. **Advanced** tab → **Environment Variables**.
3. Under **User variables**, select **Path** → **Edit** → **New**.
4. Add: `C:\Users\PC-18\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin`
5. OK through all dialogs.
6. **Close and reopen** any terminal (and Cursor) so the new PATH is used.

**Option B – Current PowerShell session only**

```powershell
$env:Path += ";C:\Users\PC-18\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"
```

---

## 2. Sign in and set project (if needed)

In a **new** terminal (so it sees the updated PATH):

```powershell
gcloud auth login
gcloud config set project studio-7522226027-4e1c9
```

---

## 3. Apply CORS to your Storage bucket

From your **project folder** (where `storage-cors.json` is):

```powershell
cd "C:\Users\PC-18\Documents\New folder\New folder"
gsutil cors set storage-cors.json gs://studio-7522226027-4e1c9.firebasestorage.app
```

If `gsutil` is still not found, use the full path:

```powershell
& "C:\Users\PC-18\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gsutil.cmd" cors set storage-cors.json gs://studio-7522226027-4e1c9.firebasestorage.app
```

---

## 4. If you get "404 The specified bucket does not exist"

- **Enable Firebase Storage first:** In [Firebase Console](https://console.firebase.google.com) → your project → **Storage** → click **Get started** (or **Create bucket**). That creates the default bucket.
- **Confirm the bucket name:** In Firebase Console → **Storage**, check the bucket name at the top (e.g. `studio-7522226027-4e1c9.firebasestorage.app` or sometimes `studio-7522226027-4e1c9.appspot.com`). Use that exact name in the `gs://...` URL.
- If your bucket is `*.appspot.com`, run:
  ```powershell
  gsutil cors set storage-cors.json gs://studio-7522226027-4e1c9.appspot.com
  ```
- **Auth:** Ensure you’re logged in and the project is set:
  ```powershell
  gcloud auth login
  gcloud config set project studio-7522226027-4e1c9
  ```

---

## 4b. If you get "Unable to read file VERSION / Permission denied"

gsutil can’t read its own files in the Cloud SDK folder. Try:

1. **Run terminal as Administrator:** Right‑click PowerShell or Command Prompt → **Run as administrator**, then `cd` to your project folder and run the `gsutil cors set` command again.
2. **Fix folder permissions:** Right‑click `C:\Users\PC-18\AppData\Local\Google\Cloud SDK\google-cloud-sdk` → **Properties** → **Security** → ensure your user has **Read** (and **Read & execute**) on this folder and subfolders.

---

## 5. If you get 403 Forbidden or "User does not have permission" (storage/unauthorized)

CORS is for the browser; Firebase also checks **Storage security rules**. If uploads fail with 403 or `storage/unauthorized`, deploy the project’s Storage rules so `principal-messages/` is allowed:

```powershell
cd "C:\Users\PC-18\Documents\New folder\New folder"
firebase deploy --only storage
```

Rules are in `storage.rules`. After deploying, try the file upload again.

---

## 6. Production

When you deploy, add your site URL (e.g. `https://yoursite.com`) to the `"origin"` array in `storage-cors.json`, then run the same `gsutil cors set` command again.

Tighten `storage.rules` before production (e.g. allow read/write only when `request.auth != null`).

After CORS and Storage rules are set, file uploads in the Communication chat should work.
