// LEGACY / DISABLED — NOT USED IN PUBLIC-LINK MODE. Kept to avoid breaking unrelated code. DO NOT IMPORT.
const { google } = require('googleapis');
const admin = require('firebase-admin');

/**
 * Google Drive Sync Function
 * Syncs photos from a user's Google Drive folder to Firestore
 * 
 * @param {string} userId - The user ID to sync photos for
 * @param {string} folderId - The Google Drive folder ID to sync from
 */
exports.syncDrive = async (userId, folderId) => {
  const db = admin.firestore();
  // drive sync status doc (server updates)
  const statusRef = db.collection('drive_sync_status').doc('current');
  try { await statusRef.set({ status: 'running', processed: 0, total: 0, percent: 0, started_at: admin.firestore.FieldValue.serverTimestamp() }); } catch(e) {}

  
  try {
    // Get user profile to verify Drive connection
    const userRef = db.collection('profiles').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    
    // Validate folder ID
    if (!folderId) {
      throw new Error('No Drive folder ID provided');
    }

    // Initialize Google Drive API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Fetch all image files from the specified folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType contains 'image/')`,
      fields: 'files(id, name, mimeType, createdTime, size, parents)',
      pageSize: 1000,
    });

    const files = response.data.files || [];
    
    if (files.length === 0) {
      return {
        success: true,
        addedCount: 0,
        failedCount: 0,
        message: 'No images found in the specified folder'
      };
    }

    // Get existing photos to avoid duplicates
    const existingPhotosSnapshot = await db.collection('photos')
      .where('user_id', '==', userId)
      .get();
    
    const existingDriveIds = new Set(
      existingPhotosSnapshot.docs.map(doc => doc.data().drive_file_id)
    );

    // Add new photos to Firestore
    const batch = db.batch();
    let addedCount = 0;
    let failedCount = 0;

    for (const file of files) {
      try {
        // Skip if photo already exists
        if (existingDriveIds.has(file.id)) {
          continue;
        }

        const photoRef = db.collection('photos').doc();
        try { await statusRef.update({ processed: admin.firestore.FieldValue.increment(1) }); } catch(e) {}

        batch.set(photoRef, {
          user_id: userId,
          drive_file_id: file.id,
          filename: file.name,
          mime_type: file.mimeType,
          size_bytes: parseInt(file.size) || 0,
          thumbnail_url: `https://lh3.googleusercontent.com/d/${file.id}=w1000`,
          full_url: `https://lh3.googleusercontent.com/d/${file.id}=w4000`,
          drive_folder: folderId,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        addedCount++;
      } catch (error) {
        console.error(`Failed to process file ${file.name}:`, error);
        failedCount++;
      }
    }

    // Commit batch write
    if (addedCount > 0) {
      await batch.commit();
    }

    // Update user's Drive connection status
    await userRef.update({
      google_drive_connected: true,
      google_drive_folder_id: folderId,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Log activity
    await db.collection('activity_logs').add({
      action: 'drive_sync',
      user_id: userId,
      details: {
        photos_synced: addedCount,
        failed: failedCount,
        folder_id: folderId
      },
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    try { await statusRef.set({ status: 'finished', finished_at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }); } catch(e) {}
    return {
      success: true,
      addedCount,
      failedCount,
      message: `Successfully synced ${addedCount} photos${failedCount > 0 ? `, ${failedCount} failed` : ''}`
    };

  } catch (error) {
    console.error('Drive sync error:', error);
    
    // Log error to activity logs
    await db.collection('activity_logs').add({
      action: 'drive_sync_error',
      user_id: userId,
      details: {
        error: error.message,
        folder_id: folderId
      },
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    throw new Error(`Drive sync failed: ${error.message}`);
  }
};
