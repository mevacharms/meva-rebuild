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

function normalizeEventType(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeText(value, maxLength = 200) {
  if (!value) return null;
  return String(value).trim().slice(0, maxLength);
}

function roundCoord(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.round(value * 100) / 100;
}

async function createEvent({
  eventType,
  mevaId,
  actorUid = null,
  actorEmail = null,
  isAuthenticated = false,
  metadata = {},
  location = null,
  device = {},
}) {
  const eventRef = db.collection("mevaEvents").doc();

  await eventRef.set({
    eventType,
    mevaId,
    actorUid,
    actorEmail,
    isAuthenticated,
    metadata,
    location,
    device,
    timestamp: FieldValue.serverTimestamp(),
  });
}

exports.getMevaViewerState = onCall(async (request) => {
  const mevaId = normalizeMevaId(request.data?.mevaId);
  assertValidMevaId(mevaId);

  const mevaRef = db.collection("mevas").doc(mevaId);
  const claimRef = db.collection("mevaClaims").doc(mevaId);

  const [mevaSnap, claimSnap] = await Promise.all([
    mevaRef.get(),
    claimRef.get(),
  ]);

  if (!mevaSnap.exists) {
    throw new HttpsError("not-found", "This Meva does not exist.");
  }

  const isSignedIn = !!request.auth;
  const isClaimed = claimSnap.exists;
  const claimData = claimSnap.exists ? claimSnap.data() : null;
  const isOwner =
    !!request.auth &&
    claimSnap.exists &&
    claimData?.ownerUid === request.auth.uid;

  console.log("getMevaViewerState", {
    mevaId,
    authUid: request.auth?.uid || null,
    authEmail: request.auth?.token?.email || null,
    isSignedIn,
    isClaimed,
    claimOwnerUid: claimData?.ownerUid || null,
    claimOwnerEmail: claimData?.ownerEmail || null,
    isOwner,
  });

  return {
    isSignedIn,
    isClaimed,
    isOwner,
    canClaim: !isClaimed,
    canUnclaim: isOwner,
  };
});

exports.syncUserProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must sign in first.");
  }

  const userRef = db.collection("users").doc(request.auth.uid);
  const userSnap = await userRef.get();
  const now = FieldValue.serverTimestamp();

  await userRef.set(
    {
      uid: request.auth.uid,
      email: request.auth.token.email || null,
      displayName: request.auth.token.name || null,
      photoURL: request.auth.token.picture || null,
      createdAt: userSnap.exists ? userSnap.data().createdAt || now : now,
      updatedAt: now,
      lastSignInAt: now,
    },
    { merge: true }
  );

  return { success: true };
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

  console.log("claimMeva_start", {
    mevaId,
    authUid: request.auth.uid,
    authEmail: request.auth.token.email || null,
  });

  await db.runTransaction(async (tx) => {
    const [mevaSnap, claimSnap, userSnap] = await Promise.all([
      tx.get(mevaRef),
      tx.get(claimRef),
      tx.get(userRef),
    ]);

    console.log("claimMeva_transaction_state", {
      mevaId,
      mevaExists: mevaSnap.exists,
      alreadyClaimed: claimSnap.exists,
      existingOwnerUid: claimSnap.exists
        ? claimSnap.data()?.ownerUid || null
        : null,
      existingOwnerEmail: claimSnap.exists
        ? claimSnap.data()?.ownerEmail || null
        : null,
    });

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
        createdAt: userSnap.exists ? userSnap.data().createdAt || now : now,
        updatedAt: now,
        lastSignInAt: now,
      },
      { merge: true }
    );
  });

  await createEvent({
    eventType: "claim",
    mevaId,
    actorUid: request.auth.uid,
    actorEmail: request.auth.token.email || null,
    isAuthenticated: true,
  });

  console.log("claimMeva_success", {
    mevaId,
    authUid: request.auth.uid,
    authEmail: request.auth.token.email || null,
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
  });

  await createEvent({
    eventType: "unclaim",
    mevaId,
    actorUid: request.auth.uid,
    actorEmail: request.auth.token.email || null,
    isAuthenticated: true,
  });

  return {
    success: true,
    mevaId,
  };
});

exports.logMevaInteraction = onCall(async (request) => {
  const mevaId = normalizeMevaId(request.data?.mevaId);
  const eventType = normalizeEventType(request.data?.eventType);

  assertValidMevaId(mevaId);

  const allowedEventTypes = new Set([
    "page_view",
    "tap",
    "feed",
    "hold_start",
    "hold_end",
    "drag_start",
    "drag_end",
    "menu_open",
    "claim_click",
    "unclaim_click",
  ]);

  if (!allowedEventTypes.has(eventType)) {
    throw new HttpsError("invalid-argument", "Invalid event type.");
  }

  const mevaRef = db.collection("mevas").doc(mevaId);
  const claimRef = db.collection("mevaClaims").doc(mevaId);

  const [mevaSnap, claimSnap] = await Promise.all([
    mevaRef.get(),
    claimRef.get(),
  ]);

  if (!mevaSnap.exists) {
    throw new HttpsError("not-found", "This Meva does not exist.");
  }

  const isOwner =
    !!request.auth &&
    claimSnap.exists &&
    claimSnap.data()?.ownerUid === request.auth.uid;

  const locationPayload = request.data?.location || {};
  const devicePayload = request.data?.device || {};
  const metadataPayload = request.data?.metadata || {};

  const safeLocation = {
    latitude: roundCoord(locationPayload.latitude),
    longitude: roundCoord(locationPayload.longitude),
    accuracy:
      typeof locationPayload.accuracy === "number"
        ? Math.round(locationPayload.accuracy)
        : null,
    city: sanitizeText(locationPayload.city, 80),
    region: sanitizeText(locationPayload.region, 80),
    country: sanitizeText(locationPayload.country, 80),
    timezone: sanitizeText(locationPayload.timezone, 80),
  };

  const safeDevice = {
    userAgent: sanitizeText(devicePayload.userAgent, 300),
    language: sanitizeText(devicePayload.language, 40),
    platform: sanitizeText(devicePayload.platform, 80),
    screen: sanitizeText(devicePayload.screen, 40),
  };

  const safeMetadata = {
    source: sanitizeText(metadataPayload.source, 80),
    referrer: sanitizeText(metadataPayload.referrer, 300),
    note: sanitizeText(metadataPayload.note, 200),
  };

  const counterUpdates = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (eventType === "page_view") {
    counterUpdates.tapCount = FieldValue.increment(1);
  }

  if (eventType === "tap" || eventType === "feed") {
    if (isOwner) {
      counterUpdates.ownerTapCount = FieldValue.increment(1);
    } else {
      counterUpdates.visitorTapCount = FieldValue.increment(1);
    }
  }

  await mevaRef.set(counterUpdates, { merge: true });

  await createEvent({
    eventType,
    mevaId,
    actorUid: request.auth?.uid || null,
    actorEmail: request.auth?.token?.email || null,
    isAuthenticated: !!request.auth,
    metadata: {
      ...safeMetadata,
      isOwner,
    },
    location: safeLocation,
    device: safeDevice,
  });

  return {
    success: true,
    isOwner,
  };
});

exports.getMevaAnalyticsSummary = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must sign in first.");
  }

  const mevaId = normalizeMevaId(request.data?.mevaId);
  assertValidMevaId(mevaId);

  const claimRef = db.collection("mevaClaims").doc(mevaId);
  const mevaRef = db.collection("mevas").doc(mevaId);

  const [claimSnap, mevaSnap] = await Promise.all([
    claimRef.get(),
    mevaRef.get(),
  ]);

  if (!mevaSnap.exists) {
    throw new HttpsError("not-found", "This Meva does not exist.");
  }

  if (!claimSnap.exists || claimSnap.data()?.ownerUid !== request.auth.uid) {
    throw new HttpsError(
      "permission-denied",
      "Only the owner can view analytics for this Meva."
    );
  }

  const mevaData = mevaSnap.data();

  return {
    mevaId,
    tapCount: mevaData?.tapCount || 0,
    ownerTapCount: mevaData?.ownerTapCount || 0,
    visitorTapCount: mevaData?.visitorTapCount || 0,
    isClaimed: !!mevaData?.isClaimed,
  };
});