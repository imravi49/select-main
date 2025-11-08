// LEGACY / DISABLED — NOT USED IN PUBLIC-LINK MODE. Kept to avoid breaking unrelated code. DO NOT IMPORT.
/**
 * firebase_ready/functions/googleOAuth/index.js
 * FULL-REPLACE
 */

const { google } = require("googleapis");
const admin = require("firebase-admin");
const querystring = require("querystring");

if (!admin.apps.length) admin.initializeApp();

const FUNCTIONS_CONFIG = (() => {
  try {
    return require("firebase-functions").config().google || {};
  } catch (e) {
    return {};
  }
})();

function getClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID || FUNCTIONS_CONFIG.client_id;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || FUNCTIONS_CONFIG.client_secret;
  if (!clientId || !clientSecret) throw new Error("Google client id/secret not set");
  return { clientId, clientSecret };
}

/**
 * generateAuthUrl (callable) -> returns a URL to redirect user to Google consent screen.
 * Expects: { userId } from authenticated requester (caller should pass userId in data or use context.auth.uid)
 */
exports.generateAuthUrl = async (data, context) => {
  // Context may include auth.uid if you're using callable from authenticated client
  const { userId: incomingUserId } = data || {};
  const callerUid = context?.auth?.uid;
  const userId = incomingUserId || callerUid;
  if (!userId) throw new Error("userId required or call must be authenticated");

  const { clientId, clientSecret } = getClient();

  // redirectUri must be the oauthCallback HTTP function URL
  // We'll try to derive from functions config 'app.host' (recommended)
  const appHost = process.env.APP_HOST || (require("firebase-functions").config().app?.host);
  if (!appHost) throw new Error("app.host not set in functions config (used to build redirect URL)");

  // Build redirect URL to our http endpoint (oauthCallback)
  const redirectUri = `${appHost}/.netlify/functions/oauthCallback` // placeholder for Netlify; not used when hosted in Firebase
  // Wait: since functions live on Firebase, we should provide a Firebase region URL.
  // We'll let client call back to a Firebase function endpoint (you can override below)
  // For safety, return an authUrl with redirect_uri pointing at an explicit oauthCallback endpoint you configure.

  // For clarity: generate the URL with redirect_uri = <appHost>/oauth-callback (you will configure to point there)
  // However, simpler approach: produce an OAuth URL with redirect to the Firebase function OAuth callback endpoint:
  const functionsRegion = process.env.FUNCTIONS_REGION || "us-central1";
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIREBASE_CONFIG && JSON.parse(process.env.FIREBASE_CONFIG).projectId;
  const firebaseOAuthCallback = `https://${functionsRegion}-${projectId}.cloudfunctions.net/oauthCallback`;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, firebaseOAuthCallback);

  const state = JSON.stringify({ userId });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email"],
    state,
  });

  return { url: authUrl, oauthCallback: firebaseOAuthCallback };
};


/**
 * oauthCallback (HTTP) -> called by Google with ?code & state
 * Exchanges code for tokens and stores them to users/{userId}
 *
 * Example redirect:
 *  https://us-central1-<project>.cloudfunctions.net/oauthCallback?code=...&state=...
 */
exports.oauthCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send("Missing code");

    const parsedState = state ? JSON.parse(state) : {};
    const userId = parsedState.userId;
    if (!userId) return res.status(400).send("Missing userId in state");

    const { clientId, clientSecret } = getClient();

    // redirectUri must match the one used when building the URL
    const functionsRegion = process.env.FUNCTIONS_REGION || "us-central1";
    const projectId = process.env.GCLOUD_PROJECT || JSON.parse(process.env.FIREBASE_CONFIG || "{}").projectId;
    const redirectUri = `https://${functionsRegion}-${projectId}.cloudfunctions.net/oauthCallback`;

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
      return res.status(500).send("Failed to obtain tokens from Google");
    }

    // Persist tokens to users/{userId}
    const db = admin.firestore();
    const userRef = db.collection("users").doc(userId);

    const update = {
      googleAccessToken: tokens.access_token || null,
      googleAccessTokenExpiry: tokens.expiry_date ? admin.firestore.Timestamp.fromMillis(Number(tokens.expiry_date)) : null,
      googleAccessTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (tokens.refresh_token) {
      update.googleRefreshToken = tokens.refresh_token;
      update.googleRefreshTokenObtainedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await userRef.set(update, { merge: true });

    // Redirect user back to your app (app.host), append success flag
    const appHost = process.env.APP_HOST || (require("firebase-functions").config().app?.host) || "/";
    const redirectSuccess = `${appHost.replace(/\/$/, "")}/?drive_auth=success`;
    return res.redirect(302, redirectSuccess);
  } catch (err) {
    console.error("oauthCallback error:", err);
    return res.status(500).send("OAuth callback failed: " + (err.message || err.toString()));
  }
};
