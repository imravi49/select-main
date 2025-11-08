/**
 * Firebase Functions - Gen 2 (Node.js 20)
 * We ONLY expose Drive sync as a callable function.
 * No other features use Cloud Functions to keep the app free.
 */
const { onCall } = require("firebase-functions/v2/https");
const { logger, setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

// Keep one region for everything
setGlobalOptions({ region: "us-central1", memory: "256MiB", timeoutSeconds: 300 });

// Drive sync handler (public-folder + API key path)
const syncDrive = require("./syncDrive/index.js");

exports.syncDrive = onCall(async (request) => {
  try {
    const data = request.data || {};
    // Frontend may pass only userId. If folderId is missing we'll try to read it from profile.
    const db = admin.firestore();
    let { userId, folderId } = data || {};
    if (!userId) throw new Error("userId required");

    if (!folderId) {
      const prof = await db.collection("profiles").doc(userId).get();
      if (prof.exists) {
        const p = prof.data() || {};
        // support multiple field names
        const link = p.driveFolderLink || p.google_drive_folder_link || p.google_drive_link;
        const id = p.google_drive_folder_id || p.folderId || null;
        const parsed = id || (link ? (link.match(/folders\/([a-zA-Z0-9_-]+)/)?.[1] || null) : null);
        folderId = parsed;
      }
    }

    if (!folderId) {
      logger.warn("No folderId for user", userId);
      return { ok: false, error: "missing-folder" };
    }

    const result = await syncDrive.handler({ userId, folderId });
    return { ok: true, ...result };
  } catch (err) {
    logger.error("syncDrive failed", err);
    return { ok: false, error: String(err && err.message || err) };
  }
});
