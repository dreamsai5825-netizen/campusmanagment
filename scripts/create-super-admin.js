const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

const KEY_PATH = path.resolve(__dirname, '../cms-011-firebase-adminsdk.json');

const app = admin.initializeApp({
  credential: admin.credential.cert(require(KEY_PATH))
});

const db = getFirestore(app, 'cms1');
const auth = app.auth();

const email = 'dreamsai5825@gmail.com';
const password = 'Qwerty7890@';
const name = 'Super Admin';

async function main() {
  console.log(`Checking if user ${email} already exists...`);
  let uid;
  try {
    const userRecord = await auth.getUserByEmail(email);
    uid = userRecord.uid;
    console.log(`User already exists in Auth with UID: ${uid}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log('User not found. Creating a new Auth user...');
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
        emailVerified: true
      });
      uid = userRecord.uid;
      console.log(`Created new Auth user with UID: ${uid}`);
    } else {
      throw err;
    }
  }

  console.log(`Writing Super Admin document to Firestore (super_admins/${uid})...`);
  await db.collection('super_admins').doc(uid).set({
    name: name,
    email: email,
    createdAt: new Date().toISOString()
  });

  console.log('Super Admin provisioning completed successfully!');
}

main().catch(err => {
  console.error('Error provisioning Super Admin:', err);
  process.exit(1);
});
