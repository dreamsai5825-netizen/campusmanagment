import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let adminApp: App | null = null;

function getFirebaseAdmin() {
  if (adminApp) return adminApp;
  const existing = getApps();
  if (existing.length) {
    adminApp = existing[0] as App;
    return adminApp;
  }
  // Option 1: Path to service account JSON file (filename can be anything, e.g. studio-xxx-firebase-adminsdk-xxx.json)
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    try {
      const absPath = resolve(process.cwd(), credPath);
      const key = JSON.parse(readFileSync(absPath, 'utf8'));
      adminApp = initializeApp({ credential: cert(key) });
      return adminApp;
    } catch (e) {
      console.warn('Firebase Admin: GOOGLE_APPLICATION_CREDENTIALS file failed', e);
    }
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    adminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    return adminApp;
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const key = typeof json === 'string' ? JSON.parse(json) : json;
      adminApp = initializeApp({ credential: cert(key) });
      return adminApp;
    } catch {
      // ignore
    }
  }
  // Option 4: Application Default Credentials (Cloud Run, GCE, etc.)
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
    adminApp = initializeApp({
      credential: applicationDefault(),
      ...(projectId && { projectId }),
    });
    return adminApp;
  } catch (e) {
    console.error('Firebase Admin: applicationDefault() failed', e);
  }
  throw new Error(
    'Firebase Admin: set GOOGLE_APPLICATION_CREDENTIALS (path to JSON file), or FIREBASE_ADMIN_* env vars, or FIREBASE_SERVICE_ACCOUNT_JSON. On Cloud Run, ensure the service account has Firebase Admin roles.'
  );
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdmin());
}

export function getAdminFirestore() {
  return getFirestore(getFirebaseAdmin(), 'cms1');
}
