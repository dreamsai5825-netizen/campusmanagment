import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

const PROFILE_PHOTOS_PREFIX = 'profile-photos';

/**
 * Helper to compress an image and convert it to a Base64 string on the client side.
 * It resizes the image so that the maximum dimension (width or height) is 300 pixels
 * to keep the Firestore document size minimal (usually 10-25KB).
 */
export async function compressAndConvertToBase64(file: File, maxDim = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string); // fallback to original base64
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as jpeg with 0.7 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => {
        reject(err);
      };
    };
    reader.onerror = (err) => {
      reject(err);
    };
  });
}

/**
 * Uploads a profile photo to Storage and returns its download URL.
 * Path: profile-photos/{role}/{userId}_{timestamp}.{ext}
 * Falls back to Base64 data URL if storage quota is exceeded.
 */
export async function uploadProfilePhoto(
  role: 'principal' | 'teacher' | 'student',
  userId: string,
  file: File
): Promise<string> {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${PROFILE_PHOTOS_PREFIX}/${role}/${userId}_${Date.now()}.${ext}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (err: any) {
    console.warn('Firebase Storage upload failed. Using compressed base64 fallback. Error:', err);
    try {
      return await compressAndConvertToBase64(file, 300);
    } catch (compressErr) {
      console.error('Failed to convert to compressed base64:', compressErr);
      throw err; // Throw original error if fallback fails
    }
  }
}

const COLLEGE_LOGOS_PREFIX = 'college-logos';

/**
 * Uploads a college logo to Storage and returns its download URL.
 * Path: college-logos/{collegeId}/logo{logoNumber}_{timestamp}.{ext}
 * Falls back to Base64 data URL if storage quota is exceeded.
 */
export async function uploadCollegeLogo(
  collegeId: string,
  logoNumber: 1 | 2,
  file: File
): Promise<string> {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${COLLEGE_LOGOS_PREFIX}/${collegeId}/logo${logoNumber}_${Date.now()}.${ext}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (err: any) {
    console.warn('Firebase Storage upload failed. Using compressed base64 fallback. Error:', err);
    try {
      return await compressAndConvertToBase64(file, 300);
    } catch (compressErr) {
      console.error('Failed to convert to compressed base64:', compressErr);
      throw err; // Throw original error if fallback fails
    }
  }
}
