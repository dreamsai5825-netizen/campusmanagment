const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
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

const sourceBucket = getStorage(sourceApp).bucket('studio-7522226027-4e1c9.firebasestorage.app');
const destBucket = getStorage(destApp).bucket('cms-011.firebasestorage.app');

async function migrateStorage() {
  console.log('\n--- Starting Firebase Storage Migration ---');
  
  try {
    // List all files in the source bucket
    console.log('Listing files in source bucket...');
    const [files] = await sourceBucket.getFiles();
    console.log(`Found ${files.length} files in source bucket.`);

    if (files.length === 0) {
      console.log('No files to migrate.');
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`[${i + 1}/${files.length}] Migrating: ${file.name}`);
      
      try {
        // Download the file into memory as a buffer
        const [buffer] = await file.download();
        
        // Get metadata from source file to preserve content type, etc.
        const [metadata] = await file.getMetadata();
        
        const destFile = destBucket.file(file.name);
        
        // Upload the buffer to the destination bucket
        await destFile.save(buffer, {
          metadata: {
            contentType: metadata.contentType,
            metadata: metadata.metadata
          },
          resumable: false // suitable for smaller files
        });
        
        console.log(`    Successfully migrated: ${file.name}`);
      } catch (fileError) {
        console.error(`    Failed to migrate ${file.name}:`, fileError.message);
      }
    }
    
    console.log('\n--- Storage Migration Completed Successfully! ---');
  } catch (error) {
    console.error('Storage migration failed:', error);
  }
}

migrateStorage();
