import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDPT2fOwzfW8u89x9qDfCzsyhazWohOjhk",
  authDomain: "cms-011.firebaseapp.com",
  projectId: "cms-011",
  storageBucket: "cms-011.firebasestorage.app",
  messagingSenderId: "674639396653",
  appId: "1:674639396653:web:f63f24ca008fd2ecd85da4",
  measurementId: "G-79VV0YDRTG"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app, 'cms1'); // Connect to the custom named database 'cms1'
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
