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

function isMobileOrTabletFromDevice(device = {}, metadata = {}) {
  const userAgent = String(device.userAgent || "").toLowerCase();
  const screen = String(device.screen || "");
  const isMobileFlag = metadata.isMobile === true;

  if (isMobileFlag) return true;

  if (
    userAgent.includes("iphone") ||
    userAgent.includes("ipad") ||
    userAgent.includes("android") ||
    userAgent.includes("mobile") ||
    userAgent.includes("tablet")
  ) {
    return true;
  }

  const parts = screen.split("x").map((value) => Number(value));
  if (parts.length === 2 && parts.every((value) => Number.isFinite(value))) {
    const shortestSide = Math.min(parts[0], parts[1]);
    const longestSide = Math.max(parts[0], parts[1]);

    return shortestSide <= 1024 && longestSide <= 1400;
  }

  return false;
}

function getTapKey({ mevaId, actorUid, sessionId }) {
  const safeActor = actorUid || "guest";
  const safeSession = sessionId || "nosession";
  return `${mevaId}_${safeActor}_${safeSession}`;
}

function getEasternWeekKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value;
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const weekday = get("weekday");

  const dayMap = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };

  const daysSinceMonday = dayMap[weekday] ?? 0;
  const monday = new Date(Date.UTC(year, month - 1, day - daysSinceMonday));

  return monday.toISOString().slice(0, 10);
}

function generateLeaderboardName() {
  const words = ["Kibo", "Cloud", "Meva", "Star", "Nova", "Mochi", "Lucky"];
  const word = words[Math.floor(Math.random() * words.length)];
  const number = Math.floor(100 + Math.random() * 900);
  return `${word}${number}`;
}

function normalizeLeaderboardName(value) {
  return String(value || "").trim();
}

function assertValidLeaderboardName(name) {
  if (!/^[A-Za-z0-9]{3,12}$/.test(name)) {
    throw new HttpsError(
      "invalid-argument",
      "Name must be 3–12 letters or numbers."
    );
  }

  const blocked = ["admin", "meva", "mod", "owner", "fuck", "shit", "bitch"];
  const lower = name.toLowerCase();

  if (blocked.some((word) => lower.includes(word))) {
    throw new HttpsError("invalid-argument", "Choose a different name.");
  }
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
    sessionId: sanitizeText(metadataPayload.sessionId, 120),
    path: sanitizeText(metadataPayload.path, 160),
    isMobile: metadataPayload.isMobile === true,
  };

  const isCountableTapEvent = eventType === "tap" || eventType === "feed";
  const isMobileOrTablet = isMobileOrTabletFromDevice(safeDevice, safeMetadata);

  let counted = false;
  let countBlockReason = null;

  const counterUpdates = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (eventType === "page_view") {
    counterUpdates.tapCount = FieldValue.increment(1);
    counted = true;
  }

  if (isCountableTapEvent) {
    if (!isMobileOrTablet) {
      countBlockReason = "not_mobile_or_tablet";
    } else if (!safeMetadata.sessionId) {
      countBlockReason = "missing_session";
    } else {
      const tapGuardRef = db
        .collection("mevaTapGuards")
        .doc(getTapKey({
          mevaId,
          actorUid: request.auth?.uid || null,
          sessionId: safeMetadata.sessionId,
        }));

        await db.runTransaction(async (tx) => {
          const guardSnap = await tx.get(tapGuardRef);
          const nowMs = Date.now();
          const lastTapMs = guardSnap.exists
            ? guardSnap.data()?.lastTapMs || 0
            : 0;
  
          const msSinceLastTap = lastTapMs ? nowMs - lastTapMs : 0;
  
          const previousIntervals = guardSnap.exists
            ? guardSnap.data()?.intervals || []
            : [];
  
          const newIntervals = lastTapMs
            ? [...previousIntervals, msSinceLastTap].slice(-6)
            : [];
  
          const isTooConsistent =
            newIntervals.length >= 5 &&
            newIntervals.every(
              (val, i, arr) => i === 0 || Math.abs(val - arr[i - 1]) < 10
            );
  
          const isExtremeSpam = lastTapMs && msSinceLastTap < 50;
  
          if (isTooConsistent || isExtremeSpam) {
            countBlockReason = isTooConsistent ? "bot_pattern" : "extreme_spam";
  
            tx.set(
              tapGuardRef,
              {
                mevaId,
                actorUid: request.auth?.uid || null,
                sessionId: safeMetadata.sessionId,
                intervals: newIntervals,
                lastRejectedTapMs: nowMs,
                rejectedTapCount: FieldValue.increment(1),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
  
            return;
          }
  
          counted = true;
  
          tx.set(
            tapGuardRef,
            {
              mevaId,
              actorUid: request.auth?.uid || null,
              sessionId: safeMetadata.sessionId,
              lastTapMs: nowMs,
              intervals: newIntervals,
              acceptedTapCount: FieldValue.increment(1),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
  
          if (isOwner) {
            tx.set(
              mevaRef,
              {
                ownerTapCount: FieldValue.increment(1),
                ownerCountedTapTotal: FieldValue.increment(1),
                countedTapTotal: FieldValue.increment(1),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );

            if (request.auth?.uid) {
              const weekKey = getEasternWeekKey();
              const allTimeRef = db
                .collection("mevaLeaderboardAllTime")
                .doc(request.auth.uid);
              const weeklyRef = db
                .collection("mevaLeaderboardWeekly")
                .doc(`${weekKey}_${request.auth.uid}`);

              tx.set(
                allTimeRef,
                {
                  uid: request.auth.uid,
                  score: FieldValue.increment(1),
                  updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );

              tx.set(
                weeklyRef,
                {
                  uid: request.auth.uid,
                  weekKey,
                  score: FieldValue.increment(1),
                  updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            }
          } else {
            tx.set(
              mevaRef,
              {
                visitorTapCount: FieldValue.increment(1),
                visitorCountedTapTotal: FieldValue.increment(1),
                countedTapTotal: FieldValue.increment(1),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
        });
    }
  }

  if (!isCountableTapEvent) {
    await mevaRef.set(counterUpdates, { merge: true });
  }

  await createEvent({
    eventType,
    mevaId,
    actorUid: request.auth?.uid || null,
    actorEmail: request.auth?.token?.email || null,
    isAuthenticated: !!request.auth,
    metadata: {
      ...safeMetadata,
      isOwner,
      counted,
      countBlockReason,
      isMobileOrTablet,
    },
    location: safeLocation,
    device: safeDevice,
  });

  return {
    success: true,
    isOwner,
    counted,
    countBlockReason,
  };
});

exports.getMevaLeaderboard = onCall(async (request) => {
  const type = String(request.data?.type || "allTime");
  const weekKey = getEasternWeekKey();

  const source =
    type === "weekly"
      ? db
          .collection("mevaLeaderboardWeekly")
          .where("weekKey", "==", weekKey)
          .orderBy("score", "desc")
          .limit(25)
      : db
          .collection("mevaLeaderboardAllTime")
          .orderBy("score", "desc")
          .limit(25);

  const snap = await source.get();
  const rows = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const userSnap = await db.collection("users").doc(data.uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};

    rows.push({
      uid: data.uid,
      score: data.score || 0,
      leaderboardName:
        userData.leaderboardName || generateLeaderboardName(),
    });
  }

  return {
    type,
    weekKey,
    rows,
  };
});

exports.setMevaLeaderboardName = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must sign in first.");
  }

  const userRef = db.collection("users").doc(request.auth.uid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() : {};

  const useGenerated = request.data?.generate === true;
  const requestedName = useGenerated
    ? generateLeaderboardName()
    : normalizeLeaderboardName(request.data?.name);

  assertValidLeaderboardName(requestedName);

  const nowMs = Date.now();
  const lastChangedMs = userData.leaderboardNameUpdatedAtMs || 0;
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const hasFreeChange = userData.freeLeaderboardNameChangeAvailable !== false;

  if (!hasFreeChange && nowMs - lastChangedMs < fourteenDaysMs) {
    throw new HttpsError(
      "failed-precondition",
      "You can change your leaderboard name once every 14 days."
    );
  }

  await userRef.set(
    {
      leaderboardName: requestedName,
      leaderboardNameLower: requestedName.toLowerCase(),
      freeLeaderboardNameChangeAvailable: false,
      leaderboardNameUpdatedAt: FieldValue.serverTimestamp(),
      leaderboardNameUpdatedAtMs: nowMs,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    success: true,
    leaderboardName: requestedName,
  };
});

exports.getMevaLeaderboardProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must sign in first.");
  }

  const userRef = db.collection("users").doc(request.auth.uid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() : {};

  const nowMs = Date.now();
  const lastChangedMs = userData.leaderboardNameUpdatedAtMs || 0;
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const hasFreeChange = userData.freeLeaderboardNameChangeAvailable !== false;
  const nextChangeAtMs = hasFreeChange ? 0 : lastChangedMs + fourteenDaysMs;
  const canChangeName = hasFreeChange || nowMs >= nextChangeAtMs;

  return {
    leaderboardName: userData.leaderboardName || null,
    email: request.auth.token.email || null,
    canChangeName,
    hasFreeChange,
    nextChangeAtMs,
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