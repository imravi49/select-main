/**
 * functions/syncDrive/index.js
 * Incremental Drive Sync with lightweight progress updates to Firestore.
 * Writes to: drive_sync_status/current and activity_logs
 */
const admin = require("firebase-admin");
const fetch = require("node-fetch");

if (!admin.apps.length) admin.initializeApp();

const API_KEY = process.env.GOOGLE_API_KEY || "";

function toFileUrls(fileId) {
  const base = `https://lh3.googleusercontent.com/d/${fileId}`;
  return {
    thumb_url: `${base}=w800`,
    full_url: `${base}=w4000`
  };
}

async function listFolder(folderId, pageToken) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and (mimeType contains 'image/' or mimeType='application/vnd.google-apps.folder') and trashed=false`,
    fields: "files(id,name,mimeType,modifiedTime,parents),nextPageToken",
    pageSize: "1000",
    key: API_KEY
  });
  if (pageToken) params.set("pageToken", pageToken);

  const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Drive API error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function countFiles(folderId) {
  let total = 0;
  let nextPageToken;
  do {
    const data = await listFolder(folderId, nextPageToken);
    const files = data.files || [];
    nextPageToken = data.nextPageToken;
    for (const f of files) {
      if (f.mimeType === "application/vnd.google-apps.folder") {
        total += await countFiles(f.id);
      } else {
        total += 1;
      }
    }
  } while (nextPageToken);
  return total;
}

async function walk(db, userId, folderId, statusRef, visited = new Set()) {
  let synced = 0;
  let nextPageToken = undefined;
  let batchCount = 0;
  const BATCH_UPDATE_INTERVAL = 10; // update Firestore every 10 files

  do {
    const data = await listFolder(folderId, nextPageToken);
    const files = data.files || [];
    nextPageToken = data.nextPageToken;

    const batch = db.batch();
    for (const f of files) {
      if (f.mimeType === "application/vnd.google-apps.folder") {
        const key = `${f.id}`;
        if (!visited.has(key)) {
          visited.add(key);
          synced += await walk(db, userId, f.id, statusRef, visited);
        }
        continue;
      }
      const { thumb_url, full_url } = toFileUrls(f.id);
      const flatRef = db.collection("photos").doc(`${userId}_${f.id}`);
      const nestedRef = db.collection("photos").doc(userId).collection("items").doc(f.id);
      const payload = {
        id: f.id,
        file_id: f.id,
        user_id: userId,
        userId,
        name: f.name || "",
        folderId,
        mimeType: f.mimeType,
        created_at: new Date(f.modifiedTime || Date.now()),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        thumb_url,
        full_url,
      };
      batch.set(flatRef, payload, { merge: true });
      batch.set(nestedRef, payload, { merge: true });
      synced += 1;
      batchCount += 1;

      if (batchCount >= 50) {
        try { await batch.commit(); } catch(e){ console.error('batch commit failed', e); }
        batchCount = 0;
      }

      // Lightweight status update every BATCH_UPDATE_INTERVAL
      if (synced % BATCH_UPDATE_INTERVAL === 0) {
        try {
          await statusRef.set({ processed: admin.firestore.FieldValue.increment(BATCH_UPDATE_INTERVAL) }, { merge: true });
        } catch (e) { console.warn('status update failed', e); }
      }
    }

    try { if (batchCount > 0) await batch.commit(); } catch(e){ console.error('final batch commit failed', e); }
  } while (nextPageToken);

  return synced;
}

exports.handler = async ({ userId, folderId }) => {
  if (!API_KEY) throw new Error("GOOGLE_API_KEY env not set");
  if (!userId || !folderId) throw new Error("userId and folderId required");

  const db = admin.firestore();
  const statusRef = db.collection('drive_sync_status').doc('current');
  const startTime = admin.firestore.FieldValue.serverTimestamp();
  await statusRef.set({ status: 'running', processed: 0, total: 0, percent: 0, started_at: startTime });

  // Pre-count total files (lightweight single-purpose listing)
  let totalFiles = 0;
  try {
    totalFiles = await countFiles(folderId);
    await statusRef.set({ total: totalFiles }, { merge: true });
  } catch (e) {
    console.warn('countFiles failed', e);
  }

  let photos = 0;
  try {
    photos = await walk(db, userId, folderId, statusRef);
    // Ensure final processed count is at least photos
    await statusRef.set({
      status: 'finished',
      processed: photos,
      total: totalFiles || photos,
      percent: 100,
      finished_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error('sync failed', e);
    await statusRef.set({ status: 'error', error: String(e), finished_at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("activity_logs").add({
      action: "drive_sync_error",
      user_id: userId,
      details: { error: String(e), folderId },
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    throw e;
  }

  // Activity log
  try {
    await db.collection("activity_logs").add({
      action: "drive_sync",
      user_id: userId,
      count: photos,
      details: { folderId, photos_synced: photos },
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.warn('failed to write activity log', e);
  }

  return { status: "success", photos_synced: photos };
};
