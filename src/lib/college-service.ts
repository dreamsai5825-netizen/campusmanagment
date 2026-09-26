'use client';

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { College } from '@/lib/types';
import {
  generatePrivateCollegeCode,
  normalizeCollegeCode,
  generateInstitutionCode,
  normalizeInstitutionCode,
} from '@/lib/college-utils';

/**
 * Create a new college. Code must be unique (official or generated).
 * Returns the created college with its Firestore id.
 */
export async function createCollege(params: {
  name: string;
  code?: string;
  generateCodeIfPrivate?: boolean;
  institutionId?: string;
  institutionCode?: string;
  institutionName?: string;
}): Promise<College & { id: string }> {
  const { name, code: inputCode, generateCodeIfPrivate, institutionId, institutionCode, institutionName } = params;
  let code: string;

  if (inputCode?.trim()) {
    code = normalizeCollegeCode(inputCode);
    const existing = await getCollegeByCode(code);
    if (existing) {
      throw new Error('This college code is already registered.');
    }
  } else if (generateCodeIfPrivate) {
    let attempts = 0;
    const maxAttempts = 10;
    do {
      code = generatePrivateCollegeCode();
      const existing = await getCollegeByCode(code);
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);
    if (attempts >= maxAttempts) {
      throw new Error('Could not generate a unique code. Please try again.');
    }
  } else {
    throw new Error('Please enter a college code or choose "Generate for private".');
  }

  const now = new Date().toISOString();
  const collegeData: Record<string, any> = {
    name: name.trim(),
    code,
    createdAt: now,
  };

  if (institutionId) collegeData.institutionId = institutionId;
  if (institutionCode) collegeData.institutionCode = institutionCode;
  if (institutionName) collegeData.institutionName = institutionName;

  const ref = await addDoc(collection(db, 'colleges'), collegeData);

  return {
    id: ref.id,
    name: name.trim(),
    code,
    createdAt: now,
    ...(institutionId ? { institutionId } : {}),
    ...(institutionCode ? { institutionCode } : {}),
    ...(institutionName ? { institutionName } : {}),
  };
}

/**
 * Find college by code (case-insensitive).
 */
export async function getCollegeByCode(code: string): Promise<College | null> {
  const normalized = normalizeCollegeCode(code);
  if (!normalized) return null;
  const q = query(
    collection(db, 'colleges'),
    where('code', '==', normalized)
  );
  const snap = await getDocs(q);
  const docSnap = snap.docs[0];
  if (!docSnap) return null;
  return { id: docSnap.id, ...docSnap.data() } as College;
}

/**
 * Get college by id. Automatically auto-generates and backfills code if missing or '-'.
 */
export async function getCollegeById(id: string): Promise<College | null> {
  if (!id) return null;
  const ref = doc(db, 'colleges', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  let code = data.code;

  if (!code || code === '-' || code === '—' || String(code).trim() === '') {
    let attempts = 0;
    const maxAttempts = 10;
    do {
      code = generatePrivateCollegeCode();
      const existing = await getCollegeByCode(code);
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);

    try {
      await updateDoc(ref, { code });
    } catch (err) {
      console.error(`[college-service] Failed to auto-backfill code for college ${id}:`, err);
    }
  }

  return { id: snap.id, ...data, code } as College;
}

/**
 * Regenerates a brand-new unique institution code for a college and saves it to Firestore.
 */
export async function regenerateCollegeCode(id: string): Promise<string> {
  if (!id) throw new Error('Invalid college ID');
  const ref = doc(db, 'colleges', id);
  let newCode = '';
  let attempts = 0;
  const maxAttempts = 10;

  do {
    newCode = generatePrivateCollegeCode();
    const existing = await getCollegeByCode(newCode);
    if (!existing) break;
    attempts++;
  } while (attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate a unique college code. Please try again.');
  }

  await updateDoc(ref, { code: newCode });
  return newCode;
}

/**
 * Backfill missing college codes for all colleges in Firestore.
 */
export async function backfillMissingCollegeCodes(): Promise<number> {
  try {
    const snap = await getDocs(collection(db, 'colleges'));
    let updatedCount = 0;
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const code = data.code;
      if (!code || code === '-' || code === '—' || String(code).trim() === '') {
        await getCollegeById(docSnap.id);
        updatedCount++;
      }
    }
    return updatedCount;
  } catch (err) {
    console.error('[college-service] Failed to backfill missing college codes:', err);
    return 0;
  }
}

/**
 * Find institution (system admin) by institution code or system admin id.
 */
export async function getInstitutionByCode(code: string): Promise<{
  id: string;
  name: string;
  institutionCode: string;
  institutionName?: string;
  collegeIds?: string[];
} | null> {
  const normalized = normalizeInstitutionCode(code);
  if (!normalized) return null;

  // 1. Check college_admins collection by institutionCode
  const q = query(
    collection(db, 'college_admins'),
    where('institutionCode', '==', normalized)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    const data = d.data();
    return {
      id: d.id,
      name: data.name || 'System Admin',
      institutionCode: data.institutionCode || normalized,
      institutionName: data.institutionName || data.name || 'Institution',
      collegeIds: data.collegeIds || (data.collegeId ? [data.collegeId] : []),
    };
  }

  // 2. Check if the provided code is a direct system admin UID
  const directDoc = await getDoc(doc(db, 'college_admins', code));
  if (directDoc.exists()) {
    const data = directDoc.data();
    return {
      id: directDoc.id,
      name: data.name || 'System Admin',
      institutionCode: data.institutionCode || directDoc.id,
      institutionName: data.institutionName || data.name || 'Institution',
      collegeIds: data.collegeIds || (data.collegeId ? [data.collegeId] : []),
    };
  }

  return null;
}

/**
 * Ensures a system admin has an assigned institution code, generating one if missing.
 */
export async function ensureSystemAdminInstitutionCode(systemAdminId: string): Promise<string> {
  if (!systemAdminId) return '';
  const ref = doc(db, 'college_admins', systemAdminId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return '';

  const data = snap.data();
  if (data.institutionCode && typeof data.institutionCode === 'string' && data.institutionCode.trim()) {
    return data.institutionCode.trim().toUpperCase();
  }

  // Generate unique institution code
  let newCode = '';
  let attempts = 0;
  const maxAttempts = 10;
  do {
    newCode = generateInstitutionCode();
    const existing = await getInstitutionByCode(newCode);
    if (!existing) break;
    attempts++;
  } while (attempts < maxAttempts);

  await updateDoc(ref, {
    institutionCode: newCode,
    institutionName: data.institutionName || data.name || 'Institution Head Office'
  });

  return newCode;
}

/**
 * Link a college to a parent Institution (System Admin).
 */
export async function linkCollegeToInstitution(params: {
  collegeId: string;
  institutionCode: string;
}): Promise<{ institutionName: string; institutionCode: string; institutionId: string }> {
  const { collegeId, institutionCode } = params;
  if (!collegeId) throw new Error('Missing college ID');

  const institution = await getInstitutionByCode(institutionCode);
  if (!institution) {
    throw new Error(`No Institution / System Admin found with code: "${institutionCode}"`);
  }

  const collegeRef = doc(db, 'colleges', collegeId);
  await updateDoc(collegeRef, {
    institutionId: institution.id,
    institutionCode: institution.institutionCode,
    institutionName: institution.institutionName || institution.name,
  });

  // Also ensure the system admin's collegeIds array contains this collegeId
  const adminRef = doc(db, 'college_admins', institution.id);
  await updateDoc(adminRef, {
    collegeIds: arrayUnion(collegeId)
  });

  return {
    institutionId: institution.id,
    institutionCode: institution.institutionCode,
    institutionName: institution.institutionName || institution.name,
  };
}

/**
 * Unlink a college from its parent Institution.
 */
export async function unlinkCollegeFromInstitution(collegeId: string): Promise<void> {
  if (!collegeId) return;
  const collegeRef = doc(db, 'colleges', collegeId);
  await updateDoc(collegeRef, {
    institutionId: null,
    institutionCode: null,
    institutionName: null,
  });
}

/**
 * Get all colleges belonging to a System Admin / Institution.
 */
export async function getCollegesForSystemAdmin(params: {
  systemAdminId: string;
  institutionCode?: string;
  collegeIds?: string[];
  currentCollegeId?: string;
}): Promise<College[]> {
  const { systemAdminId, institutionCode, collegeIds = [], currentCollegeId } = params;
  const collegeMap = new Map<string, College>();

  // 1. Fetch by explicit collegeIds
  const allIds = Array.from(new Set([...collegeIds, ...(currentCollegeId ? [currentCollegeId] : [])])).filter(Boolean);
  await Promise.all(
    allIds.map(async (id) => {
      try {
        const col = await getCollegeById(id);
        if (col) collegeMap.set(col.id, col);
      } catch (err) {
        console.error('Error fetching college by id:', err);
      }
    })
  );

  // 2. Fetch by institutionCode
  if (institutionCode) {
    try {
      const q = query(collection(db, 'colleges'), where('institutionCode', '==', institutionCode.toUpperCase()));
      const snap = await getDocs(q);
      snap.forEach((d) => {
        if (!collegeMap.has(d.id)) {
          collegeMap.set(d.id, { id: d.id, ...d.data() } as College);
        }
      });
    } catch (err) {
      console.error('Error fetching colleges by institutionCode:', err);
    }
  }

  // 3. Fetch by institutionId
  if (systemAdminId) {
    try {
      const q = query(collection(db, 'colleges'), where('institutionId', '==', systemAdminId));
      const snap = await getDocs(q);
      snap.forEach((d) => {
        if (!collegeMap.has(d.id)) {
          collegeMap.set(d.id, { id: d.id, ...d.data() } as College);
        }
      });
    } catch (err) {
      console.error('Error fetching colleges by institutionId:', err);
    }
  }

  return Array.from(collegeMap.values());
}

