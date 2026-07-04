'use client';

import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type AuthRole = 'super-admin' | 'admin' | 'teacher' | 'student' | 'college-admin' | 'clerk' | 'asset-manager' | null;

/**
 * Determine which role the signed-in user has (by Firestore doc id = uid).
 */
export async function getAuthRole(uid: string): Promise<AuthRole> {
  const [superAdminSnap, principalSnap, teacherSnap, studentSnap, collegeAdminSnap, clerkSnap, assetManagerSnap] = await Promise.all([
    getDoc(doc(db, 'super_admins', uid)),
    getDoc(doc(db, 'principals', uid)),
    getDoc(doc(db, 'teachers', uid)),
    getDoc(doc(db, 'students', uid)),
    getDoc(doc(db, 'college_admins', uid)),
    getDoc(doc(db, 'clerks', uid)),
    getDoc(doc(db, 'asset_managers', uid)),
  ]);
  if (superAdminSnap.exists()) return 'super-admin';
  if (principalSnap.exists()) return 'admin';
  if (teacherSnap.exists()) return 'teacher';
  if (studentSnap.exists()) return 'student';
  if (collegeAdminSnap.exists()) return 'college-admin';
  if (clerkSnap.exists()) return 'clerk';
  if (assetManagerSnap.exists()) return 'asset-manager';
  return null;
}

/**
 * Find role by email (for Google sign-in: principal-added users have doc id by email lookup).
 */
export async function getAuthRoleByEmail(email: string): Promise<AuthRole> {
  const trimmed = email?.trim();
  if (!trimmed) return null;
  const studentEmail = trimmed.toLowerCase();
  const [superAdminSnap, principalSnap, teacherSnap, studentSnap, collegeAdminSnap, clerkSnap, assetManagerSnap] = await Promise.all([
    getDocs(query(collection(db, 'super_admins'), where('email', '==', trimmed))),
    getDocs(query(collection(db, 'principals'), where('email', '==', trimmed))),
    getDocs(query(collection(db, 'teachers'), where('email', '==', trimmed))),
    getDocs(query(collection(db, 'students'), where('email', '==', studentEmail))),
    getDocs(query(collection(db, 'college_admins'), where('email', '==', trimmed))),
    getDocs(query(collection(db, 'clerks'), where('email', '==', trimmed))),
    getDocs(query(collection(db, 'asset_managers'), where('email', '==', trimmed))),
  ]);
  if (!superAdminSnap.empty) return 'super-admin';
  if (!principalSnap.empty) return 'admin';
  if (!teacherSnap.empty) return 'teacher';
  if (!studentSnap.empty) return 'student';
  if (!collegeAdminSnap.empty) return 'college-admin';
  if (!clerkSnap.empty) return 'clerk';
  if (!assetManagerSnap.empty) return 'asset-manager';
  return null;
}

export function getDashboardPath(role: AuthRole): string {
  switch (role) {
    case 'super-admin':
      return '/super-admin-dashboard';
    case 'admin':
      return '/admin-dashboard';
    case 'teacher':
      return '/dashboard';
    case 'student':
      return '/student-dashboard';
    case 'college-admin':
      return '/college-admin-dashboard';
    case 'clerk':
      return '/clerk-dashboard';
    case 'asset-manager':
      return '/asset-manager-dashboard';
    default:
      return '/';
  }
}
