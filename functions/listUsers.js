const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.listUsers = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Not logged in");
  }

  const uid = context.auth.uid;
  const roleDoc = await admin.firestore().collection("user_roles").doc(uid).get();
  if (!roleDoc.exists || roleDoc.data().role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Not admin");
  }

  const list = [];
  let nextPageToken;

  do {
    const res = await admin.auth().listUsers(1000, nextPageToken);
    res.users.forEach((u) =>
      list.push({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName || "",
      })
    );
    nextPageToken = res.pageToken;
  } while (nextPageToken);

  return list;
});
