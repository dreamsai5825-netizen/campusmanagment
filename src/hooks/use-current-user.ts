'use client';

import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import type { Principal, Teacher, Student } from '@/lib/types';

function usePrincipalOrTeacherOrStudent(
  collectionName: 'principals' | 'teachers' | 'students'
): Principal | Teacher | Student | null {
  const { firebaseUser } = useAuth();
  const [data, setData] = useState<Principal | Teacher | Student | null>(null);

  useEffect(() => {
    if (!firebaseUser?.uid) {
      setData(null);
      return;
    }
    const unsubRef = { current: null as (() => void) | null };
    let cancelled = false;
    (async () => {
      const byUid = await getDoc(doc(db, collectionName, firebaseUser.uid));
      if (cancelled) return;
      if (byUid.exists()) {
        unsubRef.current = onSnapshot(doc(db, collectionName, firebaseUser.uid), (snap) => {
          setData(snap.exists() ? { id: snap.id, ...snap.data() } as Principal & Teacher & Student : null);
        });
        if (cancelled && unsubRef.current) unsubRef.current();
        return;
      }
      if (!firebaseUser.email) {
        setData(null);
        return;
      }
      const lookupEmail =
        collectionName === 'students'
          ? firebaseUser.email!.trim().toLowerCase()
          : firebaseUser.email!.trim();
      const byEmail = await getDocs(
        query(collection(db, collectionName), where('email', '==', lookupEmail))
      );
      if (cancelled) return;
      const found = byEmail.docs[0];
      if (!found) {
        setData(null);
        return;
      }
      unsubRef.current = onSnapshot(doc(db, collectionName, found.id), (snap) => {
        setData(snap.exists() ? { id: snap.id, ...snap.data() } as Principal & Teacher & Student : null);
      });
      if (cancelled && unsubRef.current) unsubRef.current();
    })();
    return () => {
      cancelled = true;
      if (unsubRef.current) unsubRef.current();
    };
  }, [firebaseUser?.uid, firebaseUser?.email, collectionName]);

  return data;
}

export function useCurrentPrincipal(): (Principal & { isSuperAdmin?: boolean }) | null {
  const { superAdmin, selectedCollegeId, firebaseUser } = useAuth();
  const [adminUser, setAdminUser] = useState<Principal | null>(null);

  useEffect(() => {
    if (superAdmin || !firebaseUser?.uid) {
      setAdminUser(null);
      return;
    }

    let cancelled = false;
    let unsub: (() => void) | null = null;

    (async () => {
      const collectionsToCheck = ['principals', 'college_admins', 'clerks', 'asset_managers'] as const;
      let matchedCollection: typeof collectionsToCheck[number] | null = null;

      for (const col of collectionsToCheck) {
        const snap = await getDoc(doc(db, col, firebaseUser.uid));
        if (snap.exists()) {
          matchedCollection = col;
          break;
        }
      }

      if (cancelled) return;

      if (matchedCollection) {
        unsub = onSnapshot(doc(db, matchedCollection, firebaseUser.uid), (snap) => {
          if (snap.exists()) {
            setAdminUser({ id: snap.id, ...snap.data() } as Principal);
          } else {
            setAdminUser(null);
          }
        });
      } else {
        if (!firebaseUser.email) return;
        const email = firebaseUser.email.trim();
        
        for (const col of collectionsToCheck) {
          const snap = await getDocs(query(collection(db, col), where('email', '==', email)));
          if (!snap.empty) {
            const foundId = snap.docs[0].id;
            unsub = onSnapshot(doc(db, col, foundId), (s) => {
              if (s.exists()) {
                setAdminUser({ id: s.id, ...s.data() } as Principal);
              } else {
                setAdminUser(null);
              }
            });
            break;
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [firebaseUser?.uid, firebaseUser?.email, superAdmin]);

  if (superAdmin) {
    return {
      id: superAdmin.id,
      name: superAdmin.name,
      email: superAdmin.email,
      collegeId: selectedCollegeId || '',
      isSuperAdmin: true,
      photoUrl: superAdmin.photoUrl
    };
  }

  return adminUser;
}

export function useCurrentTeacher(): Teacher | null {
  return usePrincipalOrTeacherOrStudent('teachers') as Teacher | null;
}

export function useCurrentStudent(): Student | null {
  return usePrincipalOrTeacherOrStudent('students') as Student | null;
}
