const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

function normalizeMevaId(value) {
  return String(value || "").trim().toUpperCase();
}

function assertValidMevaId(mevaId) {
  if (!/^[A-Z0-9]{8,12}$/.test(mevaId)) {
    throw new HttpsError("invalid-argument", "Invalid Meva ID.");
  }
}

exports.getMevaViewerState = onCall(async (request) => {
  const mevaId = normalizeMevaId(request.data?.mevaId);
  assertValidMevaId(mevaId);

  const mevaRef = db.collection("mevas").doc(mevaId);
  const claimRef = db.collection("mevaClaims").doc(mevaId);

  const [mevaSnap, claimSnap] = await Promise.all([mevaRef.get(), claimRef.get()]);

  if (!mevaSnap.exists) {
    throw new HttpsError("not-found", "This Meva does not exist.");
  }

  const isSignedIn = !!request.auth;
  const isClaimed = claimSnap.exists;
  const isOwner =
    !!request.auth &&
    claimSnap.exists &&
    claimSnap.data()?.ownerUid === request.auth.uid;

  return {
    isSignedIn,
    isClaimed,
    isOwner,
    canClaim: !isClaimed,
    canUnclaim: isOwner,
  };
});

exports.claimMeva = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must sign in first.");
  }

  const mevaId = normalizeMevaId(request.data?.mevaId);
  assertValidMevaId(mevaId);

  const mevaRef = db.collection("mevas").doc(mevaId);
  const claimRef = db.collection("mevaClaims").doc(mevaId);
  const userRef = db.collection("users").doc(request.auth.uid);

  await db.runTransaction(async (tx) => {
    const [mevaSnap, claimSnap, userSnap] = await Promise.all([
      tx.get(mevaRef),
      tx.get(claimRef),
      tx.get(userRef),
    ]);

    if (!mevaSnap.exists) {
      throw new HttpsError("not-found", "This Meva does not exist.");
    }

    if (claimSnap.exists) {
      throw new HttpsError("already-exists", "This Meva is already claimed.");
    }

    const now = FieldValue.serverTimestamp();

    tx.set(
      claimRef,
      {
        mevaId,
        ownerUid: request.auth.uid,
        ownerEmail: request.auth.token.email || null,
        ownerDisplayName: request.auth.token.name || null,
        ownerPhotoURL: request.auth.token.picture || null,
        claimedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    tx.set(
      mevaRef,
      {
        isClaimed: true,
        updatedAt: now,
      },
      { merge: true }
    );

    tx.set(
      userRef,
      {
        uid: request.auth.uid,
        email: request.auth.token.email || null,
        displayName: request.auth.token.name || null,
        photoURL: request.auth.token.picture || null,
        updatedAt: now,
        createdAt: userSnap.exists ? userSnap.data().createdAt || now : now,
      },
      { merge: true }
    );

    const eventRef = db.collection("mevaEvents").doc();
    tx.set(eventRef, {
      eventType: "claim",
      mevaId,
      actorUid: request.auth.uid,
      actorEmail: request.auth.token.email || null,
      timestamp: now,
    });
  });

  return {
    success: true,
    mevaId,
  };
});

exports.unclaimMeva = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must sign in first.");
  }

  const mevaId = normalizeMevaId(request.data?.mevaId);
  assertValidMevaId(mevaId);

  const mevaRef = db.collection("mevas").doc(mevaId);
  const claimRef = db.collection("mevaClaims").doc(mevaId);

  await db.runTransaction(async (tx) => {
    const [mevaSnap, claimSnap] = await Promise.all([
      tx.get(mevaRef),
      tx.get(claimRef),
    ]);

    if (!mevaSnap.exists) {
      throw new HttpsError("not-found", "This Meva does not exist.");
    }

    if (!claimSnap.exists) {
      throw new HttpsError("failed-precondition", "This Meva is not claimed.");
    }

    const claimData = claimSnap.data();

    if (claimData.ownerUid !== request.auth.uid) {
      throw new HttpsError(
        "permission-denied",
        "Only the current owner can unclaim this Meva."
      );
    }

    const now = FieldValue.serverTimestamp();

    tx.delete(claimRef);

    tx.set(
      mevaRef,
      {
        isClaimed: false,
        updatedAt: now,
      },
      { merge: true }
    );

    const eventRef = db.collection("mevaEvents").doc();
    tx.set(eventRef, {
      eventType: "unclaim",
      mevaId,
      actorUid: request.auth.uid,
      actorEmail: request.auth.token.email || null,
      timestamp: now,
    });
  });

  return {
    success: true,
    mevaId,
  };
});