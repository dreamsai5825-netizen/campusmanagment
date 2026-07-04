const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

const SOURCE_KEY_PATH = path.resolve(__dirname, '../studio-7522226027-4e1c9-firebase-adminsdk-fbsvc-8134658622.json');
const DEST_KEY_PATH = path.resolve(__dirname, '../cms-011-firebase-adminsdk.json');

console.log('Initializing source project...');
const sourceApp = admin.initializeApp({
  credential: admin.credential.cert(require(SOURCE_KEY_PATH))
}, 'source');

console.log('Initializing destination project...');
const destApp = admin.initializeApp({
  credential: admin.credential.cert(require(DEST_KEY_PATH))
}, 'destination');

const sourceAuth = sourceApp.auth();
const sourceDb = getFirestore(sourceApp);
const destAuth = destApp.auth();
const destDb = getFirestore(destApp, 'cms1');

// Scrypt hash configuration parameters extracted programmatically from Identity Toolkit config of source project
const hashOptions = {
  algorithm: 'SCRYPT',
  key: Buffer.from('96MPMYIyMYDYtiuX5QbjhW5kG9HD/957l1DYU7UjbY/B/KaMfyY/QF36vXEcWU9XlnZ4glcYoPKT5vTb7cE0CA==', 'base64'),
  saltSeparator: Buffer.from('Bw==', 'base64'),
  rounds: 8,
  memoryCost: 14
};

async function migrateAuthUsers() {
  console.log('\n--- Migrating Auth Users ---');
  let sourceUsers = [];
  let pageToken = undefined;

  do {
    const result = await sourceAuth.listUsers(1000, pageToken);
    sourceUsers = sourceUsers.concat(result.users);
    pageToken = result.pageToken;
  } while (pageToken);

  console.log(`Found ${sourceUsers.length} users in source project.`);

  if (sourceUsers.length === 0) {
    console.log('No users to migrate.');
    return;
  }

  // Format user records for import
  const usersToImport = sourceUsers.map(user => {
    const importRecord = {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      photoURL: user.photoURL,
      phoneNumber: user.phoneNumber,
      disabled: user.disabled,
      providerData: user.providerData?.map(p => ({
        uid: p.uid,
        displayName: p.displayName,
        email: p.email,
        photoURL: p.photoURL,
        providerId: p.providerId,
        phoneNumber: p.phoneNumber
      }))
    };

    if (user.passwordHash) {
      importRecord.passwordHash = Buffer.from(user.passwordHash, 'base64');
    }
    if (user.passwordSalt) {
      importRecord.passwordSalt = Buffer.from(user.passwordSalt, 'base64');
    }

    return importRecord;
  });

  // Batch import in chunks of 1000 (Firebase Admin Auth limit)
  const chunkSize = 1000;
  for (let i = 0; i < usersToImport.length; i += chunkSize) {
    const chunk = usersToImport.slice(i, i + chunkSize);
    console.log(`Importing user batch ${i / chunkSize + 1} (${chunk.length} users)...`);
    const importResult = await destAuth.importUsers(chunk, { hash: hashOptions });
    
    if (importResult.failureCount > 0) {
      console.error(`Failed to import ${importResult.failureCount} users.`);
      importResult.errors.forEach(err => {
        console.error(`User index ${err.index} error:`, err.error.message);
      });
    } else {
      console.log(`Successfully imported batch ${i / chunkSize + 1}.`);
    }
  }
}

async function copyCollection(srcCollRef, destCollRef) {
  const snapshot = await srcCollRef.get();
  console.log(`Copying ${snapshot.size} documents from: ${srcCollRef.path}...`);
  
  const docs = snapshot.docs;
  const chunkSize = 100; // Small batch size to handle large subcollection requests
  
  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    const batch = destDb.batch();
    
    for (const doc of chunk) {
      const destDocRef = destCollRef.doc(doc.id);
      batch.set(destDocRef, doc.data());
      
      // Recursively fetch and copy nested subcollections
      const subColls = await doc.ref.listCollections();
      for (const subColl of subColls) {
        const destSubCollRef = destDocRef.collection(subColl.id);
        await copyCollection(subColl, destSubCollRef);
      }
    }
    await batch.commit();
    console.log(`Committed chunk of ${chunk.length} docs to ${destCollRef.path}.`);
  }
}

async function migrateFirestore() {
  console.log('\n--- Migrating Firestore Data ---');
  const collections = await sourceDb.listCollections();
  console.log(`Found ${collections.length} root collections.`);

  for (const coll of collections) {
    const destCollRef = destDb.collection(coll.id);
    await copyCollection(coll, destCollRef);
  }
}

async function main() {
  try {
    await migrateAuthUsers();
    await migrateFirestore();
    console.log('\n--- Migration Completed Successfully! ---');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

main();
