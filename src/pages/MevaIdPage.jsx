import { useEffect, useMemo, useState } from "react";
import {
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions, googleProvider } from "../firebase";

const KIBO_IMAGE_URL =
  "https://firebasestorage.googleapis.com/v0/b/meva-clean.firebasestorage.app/o/mevas%2FKibo%2FKibo.png?alt=media&token=82c12f12-2989-49dc-ae73-59ee0577c3a8";

const MEVA_LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/meva-clean.firebasestorage.app/o/brand%2FLogo.png?alt=media&token=dc0fef03-4c72-4a08-967e-0ffa9b55c39a";

const PENDING_ACTION_KEY = "meva_pending_action";
const OFFLINE_QUEUE_KEY = "meva_offline_queue";

function savePendingAction(action, mevaId) {
  localStorage.setItem(
    PENDING_ACTION_KEY,
    JSON.stringify({ action, mevaId, createdAt: Date.now() })
  );
}

function readPendingAction() {
  try {
    const raw = localStorage.getItem(PENDING_ACTION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearPendingAction() {
  localStorage.removeItem(PENDING_ACTION_KEY);
}

function getMevaIdFromPath() {
  const rawPath = window.location.pathname;
  const path =
    rawPath.length > 1 && rawPath.endsWith("/")
      ? rawPath.slice(0, -1)
      : rawPath;

  const parts = path.split("/").filter(Boolean);

  if (parts.length >= 2 && parts[0] === "m") {
    return decodeURIComponent(parts[1]).toUpperCase();
  }

  return "";
}

function pushDebug(setter, label, data = {}) {
  const entry = {
    time: new Date().toISOString(),
    label,
    data,
  };

  console.log("[MEVA DEBUG]", label, data);
  setter((prev) => [entry, ...prev].slice(0, 20));
}

function getSessionId() {
  let id = sessionStorage.getItem("mevaSession");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("mevaSession", id);
  }
  return id;
}

function isMobileLike() {
  if (typeof window === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent) ||
    window.innerWidth < 1024
  );
}

function maskEmail(email) {
  if (!email || !email.includes("@")) return "";
  const [name, domain] = email.split("@");
  const safeName =
    name.length <= 4
      ? `${name.slice(0, 1)}***${name.slice(-1)}`
      : `${name.slice(0, 2)}***${name.slice(-2)}`;
  const safeDomain =
    domain.length <= 6
      ? domain
      : `${domain.slice(0, 2)}***${domain.slice(domain.lastIndexOf("."))}`;
  return `${safeName}@${safeDomain}`;
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getWeeklyResetMs() {
  const now = new Date();
  const easternParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);

  const get = (type) => easternParts.find((part) => part.type === type)?.value;
  const weekday = get("weekday");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const second = Number(get("second"));

  const dayMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const currentDay = dayMap[weekday] ?? 0;
  const minutesSinceMonday = currentDay * 1440 + hour * 60 + minute + second / 60;
  const weekMinutes = 7 * 1440;
  return Math.max(0, (weekMinutes - minutesSinceMonday) * 60000);
}

async function waitForAuthUser(expectedUid, timeoutMs = 5000) {
  if (auth.currentUser?.uid === expectedUid) return auth.currentUser;

  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error("Auth session did not settle in time."));
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (nextUser?.uid === expectedUid) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(nextUser);
      }
    });
  });
}

export default function MevaIdPage() {
  const mevaId = getMevaIdFromPath();
  const isTestMeva = mevaId === "TEST";

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [mevaData, setMevaData] = useState(null);

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [viewerState, setViewerState] = useState({
    isSignedIn: false,
    isClaimed: false,
    isOwner: false,
    canClaim: false,
    canUnclaim: false,
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [debugInfo, setDebugInfo] = useState([]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [leaderboardType, setLeaderboardType] = useState("allTime");
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardProfile, setLeaderboardProfile] = useState(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameMessage, setNameMessage] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [weeklyResetText, setWeeklyResetText] = useState(formatDuration(getWeeklyResetMs()));

  const isDebug =
    new URLSearchParams(window.location.search).get("debug") === "1";

  const getMevaViewerState = useMemo(
    () => httpsCallable(functions, "getMevaViewerState"),
    []
  );
  const syncUserProfile = useMemo(
    () => httpsCallable(functions, "syncUserProfile"),
    []
  );
  const claimMeva = useMemo(() => httpsCallable(functions, "claimMeva"), []);
  const unclaimMeva = useMemo(() => httpsCallable(functions, "unclaimMeva"), []);
  const logMevaInteraction = useMemo(
    () => httpsCallable(functions, "logMevaInteraction"),
    []
  );
  const getMevaLeaderboard = useMemo(
    () => httpsCallable(functions, "getMevaLeaderboard"),
    []
  );
  const getMevaLeaderboardProfile = useMemo(
    () => httpsCallable(functions, "getMevaLeaderboardProfile"),
    []
  );
  const setMevaLeaderboardName = useMemo(
    () => httpsCallable(functions, "setMevaLeaderboardName"),
    []
  );

  useEffect(() => {
    let mounted = true;

    async function bootAuth() {
      try {
        await setPersistence(auth, browserLocalPersistence);
        pushDebug(setDebugInfo, "persistence_set");
      } catch (err) {
        console.error("Persistence setup failed:", err);
        pushDebug(setDebugInfo, "persistence_failed", {
          message: err?.message || null,
          code: err?.code || null,
        });
      }

      try {
        const redirectResult = await getRedirectResult(auth);

        pushDebug(setDebugInfo, "redirect_result_checked", {
          hasUser: !!redirectResult?.user,
          uid: redirectResult?.user?.uid || null,
          email: redirectResult?.user?.email || null,
        });

        if (redirectResult?.user) {
          const pending = readPendingAction();
          setUser(redirectResult.user);
          await syncUserProfile();

          pushDebug(setDebugInfo, "redirect_pending_checked", {
            pending,
            currentMevaId: mevaId,
            redirectUid: redirectResult.user?.uid || null,
            redirectEmail: redirectResult.user?.email || null,
          });

          if (pending?.mevaId === mevaId) {
            if (pending.action === "claim") {
              pushDebug(setDebugInfo, "redirect_claim_start", { mevaId });
              await claimMeva({ mevaId });
              pushDebug(setDebugInfo, "redirect_claim_done", { mevaId });
            }

            if (pending.action === "unclaim") {
              pushDebug(setDebugInfo, "redirect_unclaim_start", { mevaId });
              await unclaimMeva({ mevaId });
              await signOut(auth);
              pushDebug(setDebugInfo, "redirect_unclaim_done", { mevaId });
            }

            clearPendingAction();
            await refreshCurrentMeva();
            pushDebug(setDebugInfo, "redirect_refresh_done", { mevaId });
          }
        }
      } catch (err) {
        pushDebug(setDebugInfo, "redirect_result_failed", {
          message: err?.message || null,
          code: err?.code || null,
        });
      }
    }

    bootAuth();

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (!mounted) return;

      pushDebug(setDebugInfo, "auth_state_changed", {
        hasUser: !!nextUser,
        uid: nextUser?.uid || null,
        email: nextUser?.email || null,
      });

      setUser(nextUser || null);
      setAuthReady(true);

      if (nextUser) {
        setAuthMessage("");
        try {
          await syncUserProfile();
          pushDebug(setDebugInfo, "sync_user_done", {
            uid: nextUser.uid,
            email: nextUser.email,
          });
        } catch (err) {
          console.error("User sync failed:", err);
          pushDebug(setDebugInfo, "sync_user_failed", {
            message: err?.message || null,
            code: err?.code || null,
          });
        }
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, [syncUserProfile]);

  useEffect(() => {
    let cancelled = false;

    async function loadMeva() {
      if (isTestMeva) {
        setLoading(false);
        setNotFound(false);
        setError("");
        setMevaData({
          id: "TEST",
          nickname: "Test Meva",
          realName: "Kibo",
          imageUrl: KIBO_IMAGE_URL,
          isClaimed: false,
          tapCount: 18,
          ownerTapCount: 0,
          visitorTapCount: 5,
        });
        return;
      }

      try {
        setLoading(true);
        setNotFound(false);
        setError("");

        const mevaRef = doc(db, "mevas", mevaId);
        const mevaSnap = await getDoc(mevaRef);

        if (cancelled) return;

        if (!mevaSnap.exists()) {
          setMevaData(null);
          setNotFound(true);
          setLoading(false);
          return;
        }

        setMevaData({ id: mevaId, ...mevaSnap.data() });
        setNotFound(false);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("Error loading Meva:", err);
        setError("We couldn’t load this Meva right now.");
        setMevaData(null);
        setNotFound(false);
        setLoading(false);
      }
    }

    loadMeva();

    return () => {
      cancelled = true;
    };
  }, [isTestMeva, mevaId]);

  useEffect(() => {
    let cancelled = false;

    async function loadViewerState() {
      if (!authReady || loading || notFound) return;

      try {
        const result = await getMevaViewerState({ mevaId });
        if (cancelled) return;

        setViewerState({
          isSignedIn: !!result.data?.isSignedIn,
          isClaimed: !!result.data?.isClaimed,
          isOwner: !!result.data?.isOwner,
          canClaim: !!result.data?.canClaim,
          canUnclaim: !!result.data?.canUnclaim,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Viewer state error:", err);
      }
    }

    loadViewerState();

    return () => {
      cancelled = true;
    };
  }, [authReady, getMevaViewerState, loading, mevaId, notFound, user]);

  useEffect(() => {
    if (loading || notFound) return;
    trackInteraction("page_view");
  }, [loading, notFound, mevaId]);

  useEffect(() => {
    const tick = () => setWeeklyResetText(formatDuration(getWeeklyResetMs()));
    tick();
    const timer = setInterval(tick, 60000);
    return () => clearInterval(timer);
  }, []);

  const displayName = mevaData?.nickname || mevaData?.realName || "Unnamed Meva";
  const imageUrl = mevaData?.imageUrl || KIBO_IMAGE_URL;
  const isMobileDevice = isMobileLike();
  const primaryButtonLabel = viewerState.isClaimed ? "Unclaim Meva" : "Claim Meva";

  const getClientContext = async () => {
    return {
      location: {
        latitude: null,
        longitude: null,
        accuracy: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      },
      device: {
        userAgent: navigator.userAgent || null,
        language: navigator.language || null,
        platform: navigator.platform || null,
        screen: `${window.innerWidth}x${window.innerHeight}`,
      },
      metadata: {
        source: "meva_id_page",
        referrer: document.referrer || null,
      },
    };
  };

  const saveOfflineEvent = (event) => {
    try {
      const existing = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
      existing.push({
        ...event,
        metadata: { ...event.metadata, queuedAt: Date.now() },
      });
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(existing));
    } catch {}
  };

  const flushOfflineQueue = async () => {
    try {
      const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
      if (!queue.length) return;

      const remaining = [];
      for (const item of queue) {
        try {
          await logMevaInteraction(item);
        } catch {
          remaining.push(item);
        }
      }

      if (remaining.length) {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
      } else {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
      }
    } catch {}
  };

  const trackInteraction = async (eventType, extraMetadata = {}) => {
    try {
      if (!mevaId) return;
      const context = await getClientContext();
      const payload = {
        mevaId,
        eventType,
        location: { ...context.location, latitude: null, longitude: null, accuracy: null },
        device: context.device,
        metadata: {
          ...context.metadata,
          ...extraMetadata,
          sessionId: getSessionId(),
          path: window.location.pathname,
          isMobile: isMobileLike(),
        },
      };

      if (!navigator.onLine) {
        saveOfflineEvent(payload);
        return;
      }

      await flushOfflineQueue();
      await logMevaInteraction(payload);
    } catch (err) {
      console.error(`Failed to track ${eventType}:`, err);
    }
  };

  const fetchLeaderboardProfile = async () => {
    if (!auth.currentUser) {
      setLeaderboardProfile(null);
      return null;
    }

    try {
      const res = await getMevaLeaderboardProfile();
      setLeaderboardProfile(res.data || null);
      return res.data || null;
    } catch (err) {
      console.error("Leaderboard profile error:", err);
      return null;
    }
  };

  const fetchLeaderboard = async (type) => {
    try {
      setLoadingLeaderboard(true);
      const [leaderboardRes] = await Promise.all([
        getMevaLeaderboard({ type }),
        fetchLeaderboardProfile(),
      ]);
      setLeaderboardData(leaderboardRes.data?.rows || []);
    } catch (err) {
      console.error("Leaderboard error:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const refreshCurrentMeva = async () => {
    if (!isTestMeva) {
      const mevaRef = doc(db, "mevas", mevaId);
      const mevaSnap = await getDoc(mevaRef);
      if (mevaSnap.exists()) setMevaData({ id: mevaId, ...mevaSnap.data() });
    }

    const viewerResult = await getMevaViewerState({ mevaId });
    pushDebug(setDebugInfo, "viewer_state_result", {
      mevaId,
      isSignedIn: !!viewerResult.data?.isSignedIn,
      isClaimed: !!viewerResult.data?.isClaimed,
      isOwner: !!viewerResult.data?.isOwner,
      canClaim: !!viewerResult.data?.canClaim,
      canUnclaim: !!viewerResult.data?.canUnclaim,
      currentUserUid: user?.uid || null,
      currentUserEmail: user?.email || null,
    });

    setViewerState({
      isSignedIn: !!viewerResult.data?.isSignedIn,
      isClaimed: !!viewerResult.data?.isClaimed,
      isOwner: !!viewerResult.data?.isOwner,
      canClaim: !!viewerResult.data?.canClaim,
      canUnclaim: !!viewerResult.data?.canUnclaim,
    });
  };

  const beginGoogleSignIn = async (pendingAction) => {
    try {
      if (!isMobileLike()) {
        savePendingAction(pendingAction, mevaId);
        await signInWithRedirect(auth, googleProvider);
        return { mode: "redirect", user: null };
      }

      const popupResult = await signInWithPopup(auth, googleProvider);
      pushDebug(setDebugInfo, "popup_sign_in_success", {
        pendingAction,
        uid: popupResult.user?.uid || null,
        email: popupResult.user?.email || null,
        currentUidImmediatelyAfterPopup: auth.currentUser?.uid || null,
        currentEmailImmediatelyAfterPopup: auth.currentUser?.email || null,
      });
      return { mode: "popup", user: popupResult.user };
    } catch (popupErr) {
      console.error("Popup sign-in failed:", popupErr);
      pushDebug(setDebugInfo, "popup_sign_in_failed", {
        pendingAction,
        message: popupErr?.message || null,
        code: popupErr?.code || null,
      });

      if (popupErr?.code === "auth/popup-blocked") {
        setAuthMessage("Google sign-in popup was blocked. Please allow popups and try again.");
      } else if (popupErr?.code === "auth/popup-closed-by-user") {
        setAuthMessage("Google sign-in was closed before it finished.");
      } else if (popupErr?.code === "auth/cancelled-popup-request") {
        setAuthMessage("Google sign-in was cancelled. Please try again.");
      } else {
        setAuthMessage(
          popupErr?.code ? `Google sign-in failed: ${popupErr.code}` : "Google sign-in failed. Please try again."
        );
      }

      return { mode: "failed", user: null };
    }
  };

  const handleClaim = async () => {
    try {
      setActionLoading(true);
      setActionMessage("");
      setAuthMessage("");
      pushDebug(setDebugInfo, "handle_claim_clicked", {
        mevaId,
        currentUserUid: user?.uid || null,
        currentUserEmail: user?.email || null,
        authCurrentUid: auth.currentUser?.uid || null,
        authCurrentEmail: auth.currentUser?.email || null,
        viewerState,
      });

      if (!user) {
        const signInResult = await beginGoogleSignIn("claim");
        if (signInResult?.mode === "failed") return;
        if (signInResult?.mode === "redirect") return;

        if (signInResult?.mode === "popup" && signInResult.user) {
          await waitForAuthUser(signInResult.user.uid);
          await auth.currentUser?.getIdToken(true);
          await syncUserProfile();
          await claimMeva({ mevaId });
          await refreshCurrentMeva();
          setAuthMessage("");
          return;
        }
        return;
      }

      await trackInteraction("claim_click");
      await auth.currentUser?.getIdToken(true);
      await claimMeva({ mevaId });
      await refreshCurrentMeva();
      setAuthMessage("");
      setIsMoreOpen(false);
      setIsMenuOpen(false);
    } catch (err) {
      console.error("Claim failed:", err);
      pushDebug(setDebugInfo, "claim_call_failed", {
        message: err?.message || null,
        code: err?.code || null,
        name: err?.name || null,
        details: err?.details || null,
      });
      setActionMessage(err?.message || "We couldn’t claim this Meva right now.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnclaim = async () => {
    try {
      setActionLoading(true);
      setActionMessage("");
      setAuthMessage("");

      if (!user) {
        const signInResult = await beginGoogleSignIn("unclaim");
        if (signInResult?.mode === "failed") return;
        if (signInResult?.mode === "redirect") return;

        if (signInResult?.mode === "popup" && signInResult.user) {
          await waitForAuthUser(signInResult.user.uid);
          await auth.currentUser?.getIdToken(true);
          await syncUserProfile();
          await unclaimMeva({ mevaId });
          await signOut(auth);
          await refreshCurrentMeva();
          setAuthMessage("");
          return;
        }
        return;
      }

      await trackInteraction("unclaim_click");
      await auth.currentUser?.getIdToken(true);
      await unclaimMeva({ mevaId });
      await signOut(auth);
      await refreshCurrentMeva();
      setAuthMessage("");
      setIsMoreOpen(false);
      setIsMenuOpen(false);
    } catch (err) {
      console.error("Unclaim failed:", err);
      pushDebug(setDebugInfo, "unclaim_call_failed", {
        message: err?.message || null,
        code: err?.code || null,
        name: err?.name || null,
        details: err?.details || null,
      });
      setActionMessage(err?.message || "We couldn’t unclaim this Meva right now.");
    } finally {
      setActionLoading(false);
    }
  };

  const openLeaderboard = async (type = "allTime") => {
    setIsMenuOpen(false);
    setIsLeaderboardOpen(true);
    setLeaderboardType(type);
    await fetchLeaderboard(type);
  };

  const openNameModal = async () => {
    const profile = await fetchLeaderboardProfile();
    setNameDraft(profile?.leaderboardName || "");
    setNameMessage("");
    setIsNameModalOpen(true);
  };

  const saveLeaderboardName = async (payload) => {
    try {
      setSavingName(true);
      setNameMessage("");
      const res = await setMevaLeaderboardName(payload);
      setNameDraft(res.data?.leaderboardName || "");
      setNameMessage("Name saved.");
      await fetchLeaderboardProfile();
      await fetchLeaderboard(leaderboardType);
    } catch (err) {
      const remaining = err?.details?.cooldownRemainingMs;
      setNameMessage(
        remaining
          ? `You can change your name in ${formatDuration(remaining)}.`
          : err?.message || "Could not update name."
      );
    } finally {
      setSavingName(false);
    }
  };

  const renderCardShell = (content) => (
    <div className="relative mx-auto min-h-[calc(100vh-24px)] w-full max-w-[430px] overflow-hidden select-none [-webkit-user-select:none] [-webkit-touch-callout:none]">
      <a
        href="/m"
        aria-label="Back to Meva"
        className="absolute left-0 top-3 z-20"
      >
        <img
          src={MEVA_LOGO_URL}
          alt="Meva logo"
          className="h-[138px] w-auto object-contain select-none pointer-events-none"
          draggable="false"
        />
      </a>

      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setIsMenuOpen(true)}
        className="absolute right-2 top-8 z-20 flex h-[58px] w-[58px] items-center justify-center rounded-full bg-white/90 text-[28px] font-black text-[#6B5C96] shadow-[0_12px_30px_rgba(95,72,150,0.10)]"
      >
        ≡
      </button>

      {content}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EAF1FB] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[20px] font-bold text-[#30215A]">Loading Meva...</p>
          <p className="mt-2 text-[14px] text-[#766F91]">Please wait</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F4F1FB] px-4 pt-5">
        {renderCardShell(
          <>
            <h1 className="mx-auto mt-28 max-w-[320px] text-center text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-[#30215A]">
              Couldn’t load Meva.
            </h1>
            <p className="mx-auto mt-4 max-w-[330px] text-center text-[15px] leading-8 text-[#766F91]">
              {error}
            </p>
          </>
        )}
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#EAF1FB] px-4 pt-5">
        {renderCardShell(
          <>
            <div className="mt-28 flex justify-center">
              <div className="relative flex h-[146px] w-[146px] items-center justify-center">
                <div className="absolute h-[122px] w-[122px] rounded-full bg-[radial-gradient(circle_at_32%_28%,#F2ECFF_0%,#DDD2FF_38%,#C6C7FF_70%,#AECFFF_100%)]" />
                <img
                  src={KIBO_IMAGE_URL}
                  alt="Kibo"
                  draggable="false"
                  className="relative z-10 h-[108px] w-auto select-none object-contain pointer-events-none"
                  style={{ animation: "mevaFloat 3.6s ease-in-out infinite" }}
                />
              </div>
            </div>
            <h1 className="mx-auto mt-5 max-w-[320px] text-center text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-[#30215A]">
              Meva page not found.
            </h1>
            <p className="mx-auto mt-4 max-w-[330px] text-center text-[15px] leading-8 text-[#766F91]">
              This Meva ID does not exist yet.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen overflow-hidden bg-[#EAF1FB] px-4 pt-3 select-none [-webkit-user-select:none] [-webkit-touch-callout:none]">
        {renderCardShell(
          <>
            <div className="flex justify-center pt-4">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-white/85 px-4 py-2 text-[13px] font-black text-[#7B6F9E] shadow-sm">
                  Visited {mevaData?.tapCount ?? 0}
                </div>
                <div className="rounded-full bg-white/85 px-4 py-2 text-[13px] font-black text-[#7B6F9E] shadow-sm">
                  Fed {mevaData?.visitorTapCount ?? 0}
                </div>
              </div>
            </div>

            <div className="mt-[150px] flex justify-center">
              <div className="relative flex h-[210px] w-full items-start justify-center">
                <div className="absolute left-1/2 top-0 -translate-x-1/2 rounded-[20px] bg-white px-5 py-2 text-[14px] font-bold text-[#5E537F] shadow-sm">
                  {viewerState.isOwner ? "you found me" : "feed me"}
                  <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-[9px] border-r-[9px] border-t-[10px] border-l-transparent border-r-transparent border-t-white" />
                </div>

                <img
                  src={imageUrl}
                  alt={displayName}
                  draggable="false"
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={async () => {
                    await trackInteraction("tap");
                    setActionMessage("Fed.");
                  }}
                  className="absolute top-[52px] z-10 h-[118px] w-auto cursor-pointer select-none object-contain [-webkit-user-drag:none] pointer-events-auto"
                  style={{
                    animation: "mevaFloat 3.6s ease-in-out infinite",
                    WebkitTouchCallout: "none",
                    WebkitUserSelect: "none",
                    userSelect: "none",
                  }}
                />
              </div>
            </div>

            <div className="mt-1 flex justify-center">
              <div className="rounded-full bg-white/90 px-5 py-2 text-[16px] font-black text-[#625683] shadow-sm">
                {displayName}
              </div>
            </div>

            <div className="mx-auto mt-4 max-w-[300px] rounded-[22px] bg-white/85 px-4 py-3 text-center shadow-sm">
              <p className="text-[14px] font-semibold leading-6 text-[#7D729B]">
                Tap to feed · Hold for quiet
                <br />
                Drag the one that’s awake
              </p>
            </div>

            {authMessage ? (
              <p className="mt-3 text-center text-[13px] font-medium text-[#B45E7F]">
                {authMessage}
              </p>
            ) : null}

            {actionMessage ? (
              <p className="mt-2 text-center text-[13px] font-medium text-[#6B5C96]">
                {actionMessage}
              </p>
            ) : null}

            {isDebug ? (
              <div className="mt-4 max-h-[180px] overflow-auto rounded-[18px] bg-[#EEF4FD] p-4 text-left text-[12px] leading-5 text-[#4D406D]">
                <p className="font-extrabold">Debug</p>
                <p>User UID: {user?.uid || "none"}</p>
                <p>User Email: {user?.email || "none"}</p>
                <p>isSignedIn: {String(viewerState.isSignedIn)}</p>
                <p>isClaimed: {String(viewerState.isClaimed)}</p>
                <p>isOwner: {String(viewerState.isOwner)}</p>
                <p>canClaim: {String(viewerState.canClaim)}</p>
                <p>canUnclaim: {String(viewerState.canUnclaim)}</p>
                <div className="mt-3 max-h-[120px] overflow-auto rounded-[12px] bg-white p-3">
                  {debugInfo.map((item, index) => (
                    <div key={`${item.time}-${index}`} className="mb-3">
                      <p className="font-bold">{item.label}</p>
                      <pre className="whitespace-pre-wrap break-words text-[11px]">
                        {JSON.stringify(item.data, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {isMenuOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#30215A]/35 px-4 backdrop-blur-sm"
          onClick={() => {
            setIsMenuOpen(false);
            setIsMoreOpen(false);
          }}
        >
          <div
            className="relative w-full max-w-[360px] rounded-[30px] bg-white p-5 text-center shadow-[0_24px_70px_rgba(48,33,90,0.20)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                setIsMoreOpen(false);
              }}
              className="absolute right-4 top-4 flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#F4F1FB] text-[18px] font-black text-[#6B5C96]"
            >
              ×
            </button>

            <p className="mb-5 text-center text-[18px] font-black text-[#30215A]">
              MEVA MENU
            </p>

            <button
              type="button"
              onClick={() => openLeaderboard("allTime")}
              className="mb-3 w-full rounded-[22px] bg-[#F4F1FB] px-5 py-4 text-center shadow-sm"
            >
              <p className="text-[16px] font-black text-[#5A4D82]">Leaderboard</p>
            </button>

            <button
              type="button"
              onClick={() => setIsMoreOpen((prev) => !prev)}
              className="w-full rounded-[22px] bg-[#F4F1FB] px-5 py-4 text-center shadow-sm"
            >
              <p className="text-[16px] font-black text-[#5A4D82]">More</p>
            </button>

            {isMoreOpen ? (
              <div className="mt-3 rounded-[22px] bg-[#F8F6FD] p-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!isMobileDevice) {
                      setAuthMessage("Please open this Meva on your phone to claim or unclaim.");
                      setIsMenuOpen(false);
                      return;
                    }
                    return viewerState.isClaimed ? handleUnclaim() : handleClaim();
                  }}
                  disabled={actionLoading}
                  className="h-[50px] w-full rounded-[18px] bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4] text-[15px] font-black text-white disabled:opacity-60"
                >
                  {actionLoading ? "Please wait..." : primaryButtonLabel}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isLeaderboardOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#30215A]/40 px-4 backdrop-blur-sm"
          onClick={() => setIsLeaderboardOpen(false)}
        >
          <div
            className="relative w-full max-w-[420px] rounded-[32px] bg-white p-5 text-center shadow-[0_24px_80px_rgba(48,33,90,0.24)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsLeaderboardOpen(false)}
              className="absolute right-4 top-4 flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#F4F1FB] text-[18px] font-black text-[#6B5C96]"
            >
              ×
            </button>

            <p className="mb-4 text-center text-[22px] font-black text-[#30215A]">
              Top collectors
            </p>

            <div className="mb-3 grid grid-cols-2 gap-2 rounded-[20px] bg-[#F4F1FB] p-1">
              <button
                type="button"
                onClick={async () => {
                  setLeaderboardType("allTime");
                  await fetchLeaderboard("allTime");
                }}
                className={`h-[42px] rounded-[16px] text-[14px] font-black ${
                  leaderboardType === "allTime" ? "bg-white text-[#5A4D82] shadow-sm" : "text-[#8A7CA8]"
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={async () => {
                  setLeaderboardType("weekly");
                  await fetchLeaderboard("weekly");
                }}
                className={`h-[42px] rounded-[16px] text-[14px] font-black ${
                  leaderboardType === "weekly" ? "bg-white text-[#5A4D82] shadow-sm" : "text-[#8A7CA8]"
                }`}
              >
                Weekly
              </button>
            </div>

            {leaderboardType === "weekly" ? (
              <p className="mb-3 text-center text-[13px] font-bold text-[#8A7CA8]">
                Weekly leaderboard resets in {weeklyResetText}.
              </p>
            ) : null}

            <div className="min-h-[165px] max-h-[220px] space-y-2 overflow-y-auto rounded-[24px] bg-[#F8F6FD] p-3">
              {loadingLeaderboard ? (
                <p className="py-10 text-center text-[14px] font-bold text-[#8A7CA8]">Loading...</p>
              ) : leaderboardData.length === 0 ? (
                <p className="py-10 text-center text-[14px] font-bold text-[#8A7CA8]">No collectors yet.</p>
              ) : (
                leaderboardData.map((item, index) => (
                  <div key={item.uid} className="flex items-center justify-between rounded-[18px] bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#EFE8FB] text-[14px] font-black text-[#6B5C96]">
                        {index + 1}
                      </div>
                      <p className="text-[15px] font-black text-[#5A4D82]">{item.leaderboardName}</p>
                    </div>
                    <p className="text-[15px] font-black text-[#7B6F9E]">{item.score}</p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 rounded-[24px] bg-[#F4F1FB] p-4 text-center">
              <p className="text-[15px] font-black text-[#5A4D82]">
                {user ? leaderboardProfile?.leaderboardName || "Choose your name" : "Sign in to join"}
              </p>
              <p className="mt-1 text-[13px] font-bold text-[#8A7CA8]">
                {user?.email ? maskEmail(user.email) : "Claim a Meva first to compete."}
              </p>

              {user ? (
                <button
                  type="button"
                  onClick={openNameModal}
                  className="mt-3 h-[46px] w-full rounded-[18px] bg-white text-[14px] font-black text-[#6B5C96] shadow-sm"
                >
                  Change leaderboard name
                </button>
              ) : null}

              <p className="mt-3 text-[12px] font-bold text-[#9B8FB5]">
                Your first name is free. After that, changes unlock every 14 days.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {isNameModalOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#30215A]/45 px-4 backdrop-blur-sm"
          onClick={() => setIsNameModalOpen(false)}
        >
          <div
            className="relative w-full max-w-[360px] rounded-[30px] bg-white p-5 text-center shadow-[0_24px_80px_rgba(48,33,90,0.24)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsNameModalOpen(false)}
              className="absolute right-4 top-4 flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#F4F1FB] text-[18px] font-black text-[#6B5C96]"
            >
              ×
            </button>

            <p className="mb-2 text-[20px] font-black text-[#30215A]">Leaderboard name</p>
            <p className="mb-4 text-[13px] font-bold text-[#8A7CA8]">3–12 letters or numbers.</p>

            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 12))}
              placeholder="Kibo123"
              className="h-[52px] w-full rounded-[18px] border border-[#E6DEF8] bg-[#F8F6FD] px-4 text-center text-[18px] font-black text-[#5A4D82] outline-none"
            />

            {leaderboardProfile?.cooldownRemainingMs > 0 ? (
              <p className="mt-3 text-[13px] font-bold text-[#B45E7F]">
                You can change your name in {formatDuration(leaderboardProfile.cooldownRemainingMs)}.
              </p>
            ) : nameMessage ? (
              <p className="mt-3 text-[13px] font-bold text-[#6B5C96]">{nameMessage}</p>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => saveLeaderboardName({ generate: true })}
                disabled={savingName || leaderboardProfile?.cooldownRemainingMs > 0}
                className="h-[48px] rounded-[18px] bg-[#F4F1FB] text-[14px] font-black text-[#6B5C96] disabled:opacity-50"
              >
                Generate random name
              </button>
              <button
                type="button"
                onClick={() => saveLeaderboardName({ name: nameDraft })}
                disabled={savingName || leaderboardProfile?.cooldownRemainingMs > 0}
                className="h-[50px] rounded-[18px] bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4] text-[15px] font-black text-white disabled:opacity-50"
              >
                {savingName ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes mevaFloat {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }
      `}</style>
    </>
  );
}
