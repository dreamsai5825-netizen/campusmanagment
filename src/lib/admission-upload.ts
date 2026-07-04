import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { compressAndConvertToBase64 } from './profile-photo';

const PREFIX = 'admissions';

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-');
}

export async function uploadAdmissionPhoto(
  collegeId: string,
  studentKey: string,
  file: File
): Promise<string> {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${PREFIX}/${collegeId}/${safeId(studentKey)}/photo_${Date.now()}.${ext}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (err: any) {
    console.warn('Firebase Storage admission photo upload failed. Using compressed base64 fallback. Error:', err);
    try {
      return await compressAndConvertToBase64(file, 300);
    } catch (compressErr) {
      console.error('Failed to convert to compressed base64:', compressErr);
      throw err;
    }
  }
}

export async function uploadAdmissionDocument(
  collegeId: string,
  studentKey: string,
  file: File
): Promise<{ url: string; name: string }> {
  try {
    const path = `${PREFIX}/${collegeId}/${safeId(studentKey)}/documents_${Date.now()}.pdf`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { url, name: file.name };
  } catch (err: any) {
    console.warn('Firebase Storage admission doc upload failed. Using base64 fallback. Error:', err);
    try {
      const base64Url = await new Promise<string>((resolve, reject) => {
        if (typeof window === 'undefined') {
          resolve('');
          return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = (e) => reject(e);
      });
      return { url: base64Url, name: file.name };
    } catch (base64Err) {
      console.error('Failed to convert to base64 data URL:', base64Err);
      throw err;
    }
  }
}
