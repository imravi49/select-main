# Migration Guide: Supabase to Firebase

This guide walks you through migrating the Golden Drive Gallery from Lovable Cloud (Supabase) to Firebase.

## Overview

The Firebase version maintains 100% feature parity with the Supabase version:
- ✅ Same UI/UX
- ✅ Same authentication flow
- ✅ Same admin panel functionality
- ✅ Same Google Drive sync
- ✅ Same design customization
- ✅ Same gallery experience

## Prerequisites

- Firebase project created (project ID: `selector-0219c`)
- Firebase CLI installed: `npm install -g firebase-tools`
- Node.js 18+ installed
- Google Cloud Project with Drive API enabled

## Step 1: Firebase Project Setup

### 1.1 Create Firebase Project
```bash
# If not already created
firebase projects:create selector-0219c
```

### 1.2 Enable Required Services
In Firebase Console:
1. Enable Authentication (Email/Password provider)
2. Create Firestore Database (start in production mode)
3. Create Storage bucket
4. Enable Cloud Functions

### 1.3 Enable Google Drive API
In Google Cloud Console for your Firebase project:
1. Go to APIs & Services → Enable APIs
2. Search for "Google Drive API" and enable it
3. Create Service Account for Cloud Functions
4. Download service account JSON key

## Step 2: Configuration

### 2.1 Run Setup Script
```powershell
cd firebase_ready
.\SETUP_FIREBASE.ps1
```

This script will:
- Prompt for all necessary credentials
- Create `.env` file
- Initialize Firebase project
- Deploy Firestore rules
- Deploy Storage rules
- Deploy Cloud Functions

### 2.2 Manual Configuration (Alternative)
If you prefer manual setup:

1. Copy `.env.example` to `.env`
2. Fill in all values from Firebase Console
3. Run:
```bash
firebase login
firebase init
npm install
cd functions && npm install
firebase deploy
```

## Step 3: Data Migration

### 3.1 Export from Supabase
```bash
# Export users
supabase db dump --data-only --table profiles > profiles.sql
supabase db dump --data-only --table user_roles > user_roles.sql

# Export other tables
supabase db dump --data-only --table photos > photos.sql
supabase db dump --data-only --table selections > selections.sql
supabase db dump --data-only --table feedback > feedback.sql
supabase db dump --data-only --table activity_logs > activity_logs.sql
supabase db dump --data-only --table design_settings > design_settings.sql
supabase db dump --data-only --table app_settings > app_settings.sql
```

### 3.2 Transform Data
Use the included migration script:
```bash
node scripts/migrate-data.js
```

This script:
- Converts SQL dumps to Firestore-compatible JSON
- Transforms UUIDs to Firestore IDs
- Preserves all relationships
- Creates batched import files

### 3.3 Import to Firestore
```bash
firebase firestore:import firestore-backup/
```

## Step 4: Update Application Code

### 4.1 Replace Service Files
```bash
# Backup current files
cp -r src/lib src/lib.supabase.backup

# Copy Firebase versions
cp -r firebase_ready/src/lib/* src/lib/
```

### 4.2 Update Imports
Replace all instances of:
```typescript
// OLD (Supabase)
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/db';

// NEW (Firebase)
import { db } from '@/lib/firebaseConfig';
import { firebaseDb } from '@/lib/firebaseDb';
```

### 4.3 Update Auth Calls
```typescript
// OLD (Supabase)
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// NEW (Firebase)
const { user, error } = await authService.signIn(email, password);
```

### 4.4 Update Database Calls
```typescript
// OLD (Supabase)
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

// NEW (Firebase)
const { data, error } = await firebaseDb.profiles.get(userId);
```

## Step 5: Update Admin Panel

### 5.1 Update Drive Sync
```typescript
// OLD (Supabase Edge Function)
const { data, error } = await supabase.functions.invoke('syncDrive', {
  body: { userId, folderId }
});

// NEW (Firebase Cloud Function)
const syncDriveFn = httpsCallable(functions, 'syncDrive');
const result = await syncDriveFn({ userId, folderId });
```

### 5.2 Update Realtime Listeners
```typescript
// OLD (Supabase)
const channel = supabase
  .channel('profiles-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
    loadUsers();
  })
  .subscribe();

// NEW (Firebase)
const unsubscribe = onSnapshot(collection(db, 'profiles'), () => {
  loadUsers();
});
```

## Step 6: Testing

### 6.1 Local Testing
```bash
# Run Firebase emulators
firebase emulators:start

# In another terminal, run app
npm run dev
```

### 6.2 Test Drive Sync
```bash
npm run test:drive-sync
```

This uses the test folder:
https://drive.google.com/drive/folders/1rnUioPkKupwo_MW-i2GTUM3H7Xmrn-5I

Expected output:
```json
{
  "success": true,
  "addedCount": 53,
  "failedCount": 0,
  "message": "Successfully synced 53 photos"
}
```

### 6.3 Manual Testing Checklist
- [ ] Admin can log in
- [ ] Admin can add new user
- [ ] Admin can edit user (name, email, Drive folder)
- [ ] Admin can sync Drive for user
- [ ] Admin can view user's gallery
- [ ] Admin can download CSV
- [ ] Admin can delete user
- [ ] Client can log in
- [ ] Client can view gallery
- [ ] Client can select/unselect photos
- [ ] Client can mark photos for later
- [ ] Client can finalize selection
- [ ] Design changes apply instantly
- [ ] Logo upload works
- [ ] Hero images update

## Step 7: Deployment

### 7.1 Deploy Functions
```bash
firebase deploy --only functions
```

### 7.2 Deploy Rules
```bash
firebase deploy --only firestore:rules,storage:rules
```

### 7.3 Deploy to Netlify
```bash
# Build
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

### 7.4 Update OAuth Redirect URLs
Add to Google Cloud Console OAuth credentials:
- `https://ravisharmaphotofilms.in/__/auth/handler`
- `https://ravisharmaphotofilms.in`

## Step 8: Post-Migration

### 8.1 Verify All Features
Run through complete testing checklist (see DEPLOY_CHECKLIST.md)

### 8.2 Monitor Logs
```bash
# Function logs
firebase functions:log

# Firestore logs
firebase firestore:usage
```

### 8.3 Backup
```bash
# Regular backups
firebase firestore:export gs://selector-0219c.appspot.com/backups/$(date +%Y%m%d)
```

## Rollback Procedure

If you need to rollback to Supabase:

1. Stop Firebase hosting
2. Restore backup files:
```bash
cp -r src/lib.supabase.backup/* src/lib/
```
3. Redeploy to Lovable Cloud
4. Update OAuth URLs back to Supabase

## Common Issues

### Issue: "Permission denied" errors
**Solution:** Check Firestore rules, ensure user roles are properly set

### Issue: Drive sync returns no photos
**Solution:** Verify service account has access to the Drive folder

### Issue: Images not loading
**Solution:** Check that Drive URLs use correct format:
- Thumbnail: `https://lh3.googleusercontent.com/d/{id}=w1000`
- Full: `https://lh3.googleusercontent.com/d/{id}=w4000`

### Issue: First user not getting admin role
**Solution:** Check `makeFirstUserAdmin` Cloud Function logs

## Support

- Firebase Docs: https://firebase.google.com/docs
- Drive API Docs: https://developers.google.com/drive/api/v3/reference
- Project Issues: See TUTORIAL.txt

## Cost Comparison

### Supabase (Current)
- Free tier: 500MB database, 1GB storage
- Paid: $25/month (Pro)

### Firebase (New)
- Free tier: 1GB storage, 50K reads/day
- Pay-as-you-go: ~$10-20/month for this app

Firebase is more cost-effective for this use case since:
- Photos stay on Drive (no storage costs)
- Cloud Functions only run on admin sync
- Firestore usage is minimal (metadata only)
