# Fix Firestore "The query requires an index" errors

If you see console errors like:

- **principalMessages**: "The query requires an index" (collegeId + createdAt)
- **leaveRequests**: "The query requires an index" (collegeId + createdAt)
- **reportIssues**: "The query requires an index" (collegeId + createdAt)

the composite indexes are defined in `firestore.indexes.json` but **have not been deployed** yet.

## Deploy the indexes

From your project folder, run:

```bash
firebase deploy --only firestore:indexes
```

Wait until the command finishes. Index creation can take a few minutes. After that, refresh the app; the Communication page (Admin, Teacher, Student) should load without those errors.

## Alternative: create from the error link

If deploy fails or you prefer the Console, click the link in the error message (e.g. `https://console.firebase.google.com/.../firestore/indexes?create_composite=...`). It will open Firebase Console and pre-fill the index. Click **Create** for each of the three indexes (principalMessages, leaveRequests, reportIssues).
