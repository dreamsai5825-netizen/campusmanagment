'use client';

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { College } from '@/lib/types';
import { generatePrivateCollegeCode, normalizeCollegeCode } from '@/lib/college-utils';

/**
 * Create a new college. Code must be unique (official or generated).
 * Returns the created college with its Firestore id.
 */
export async function createCollege(params: {
  name: string;
  code?: string;
  generateCodeIfPrivate?: boolean;
}): Promise<College & { id: string }> {
  const { name, code: inputCode, generateCodeIfPrivate } = params;
  let code: string;

  if (inputCode?.trim()) {
    code = normalizeCollegeCode(inputCode);
    const existing = await getCollegeByCode(code);
    if (existing) {
      throw new Error('This institution code is already registered.');
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
    throw new Error('Please enter an institution code or choose "Generate for private".');
  }

  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, 'colleges'), {
    name: name.trim(),
    code,
    createdAt: now,
  });

  return {
    id: ref.id,
    name: name.trim(),
    code,
    createdAt: now,
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
 * Get college by id.
 */
export async function getCollegeById(id: string): Promise<College | null> {
  const ref = doc(db, 'colleges', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as College;
}
