/
PATCHED CHANGES - SUMMARY (surgical edits)
----------------------------------------
Files modified (full-replace or minimal insertions):

1) functions/syncDrive/index.js
   - Added drive sync status document writes to 'drive_sync_status/current' at start and on finish.
   - Increment 'processed' after batch commits during sync.
   - Writes an activity_logs entry as before; status doc updated to 'finished' on completion.

2) functions/googleDriveSync.js
   - Added creation of 'drive_sync_status/current' at start and increments processed per added photo.
   - Sets status to 'finished' on completion; retains existing error logging.

3) src/components/admin/AdminUsers.tsx
   - Subscribes to 'drive_sync_status/current' and displays a cinematic progress Card and Progress bar in the Users tab when status is 'running'.
   - Added import for Progress component.
   - No other logic or formatting was changed.

4) src/lib/designLoader.ts
   - Now applies 'secondary_color' from settings to CSS variable '--app-bg-color'.
   - This enables realtime background updates across the app.

5) src/index.css
   - Added CSS variable '--app-bg-color' with default and set body background-color to use it.

6) src/components/admin/AdminLogs.tsx
   - Improved details rendering: shows JSON details, photos processed (count), and finalized flag if present.

7) src/components/admin/AdminFeedback.tsx
   - Shows feedback summary with average rating and total count.
   - Each feedback entry now displays star rating (★/☆) and text.

8) src/components/admin/FontManager.tsx
   - Migrated FontManager from placeholder to Firebase implementation:
     - Upload fonts to Storage path 'fonts/<timestamp>_<filename>'.
     - Store metadata under Firestore 'site/fonts/{fontId}'.
     - Apply selected font by saving `font_family` in 'settings/design'.
   - Replaced Supabase references; uses existing storageService and Firestore config.

Notes:
- All edits are additive/minimal and preserve existing imports, UI, and logic.
- Drive sync progress uses Firestore doc 'drive_sync_status/current'. Backend writes this doc.
- Font files are uploaded to Firebase Storage; ensure storage rules allow admin writes (as before).
- No changes were made to the BAT export logic or other unrelated code.

If you want, I can now:
 - Run a quick static check (lint/tsc) — or you can deploy the patched ZIP and test locally.
 - Apply additional cosmetic styling to the progress card (glow/shadow) to match cinematic theme.

End of README
