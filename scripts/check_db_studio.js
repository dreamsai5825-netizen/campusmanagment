const admin = require('firebase-admin');
const path = require('path');

const KEY_PATH = path.resolve(__dirname, '../studio-7522226027-4e1c9-firebase-adminsdk-fbsvc-8134658622.json');
admin.initializeApp({
  credential: admin.credential.cert(require(KEY_PATH))
});

const db = admin.firestore();

async function checkColleges() {
  console.log("Fetching colleges...");
  const snap = await db.collection("colleges").get();
  snap.forEach((doc) => {
    const data = doc.data();
    console.log(`College ID: ${doc.id}`);
    console.log(`  Name: ${data.name}`);
    console.log(`  Biometric Settings:`, data.biometricSettings);
    console.log("-" * 40);
  });
}

checkColleges();
