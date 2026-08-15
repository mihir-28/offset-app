const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

initializeApp();

const USER_COLLECTIONS = ["cards", "statementCycles", "transactions"];

async function deleteDocumentsForUser(collectionName, userId) {
  const db = getFirestore();

  while (true) {
    const snapshot = await db
      .collection(collectionName)
      .where("userId", "==", userId)
      .limit(400)
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

exports.deleteAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before deleting an account.");
  }

  const userId = request.auth.uid;
  const db = getFirestore();

  try {
    for (const collectionName of USER_COLLECTIONS) {
      await deleteDocumentsForUser(collectionName, userId);
    }

    await db.recursiveDelete(db.collection("users").doc(userId));
    await getAuth().deleteUser(userId);

    return { deleted: true };
  } catch (error) {
    console.error("Account deletion failed", { userId, error });
    throw new HttpsError("internal", "Unable to delete account. Please try again.");
  }
});
