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

function isMobileLike() {
  if (typeof window === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.innerWidth < 768
  );
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
          } else {
            pushDebug(setDebugInfo, "redirect_pending_mismatch", {
              pending,
              currentMevaId: mevaId,
            });
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

        setMevaData({
          id: mevaId,
          ...mevaSnap.data(),
        });
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

  const displayName =
    mevaData?.nickname && mevaData?.realName
      ? `${mevaData.nickname} (${mevaData.realName})`
      : mevaData?.nickname || mevaData?.realName || "Unnamed Meva";

  const imageUrl = mevaData?.imageUrl || KIBO_IMAGE_URL;

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

  const trackInteraction = async (eventType, extraMetadata = {}) => {
    try {
      const context = await getClientContext();

      await logMevaInteraction({
        mevaId,
        eventType,
        location: context.location,
        device: context.device,
        metadata: {
          ...context.metadata,
          ...extraMetadata,
        },
      });
    } catch (err) {
      console.error(`Failed to track ${eventType}:`, err);
    }
  };

  const refreshCurrentMeva = async () => {
    if (!isTestMeva) {
      const mevaRef = doc(db, "mevas", mevaId);
      const mevaSnap = await getDoc(mevaRef);

      if (mevaSnap.exists()) {
        setMevaData({
          id: mevaId,
          ...mevaSnap.data(),
        });
      }
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
  
      return {
        mode: "popup",
        user: popupResult.user,
      };
    } catch (popupErr) {
      console.error("Popup sign-in failed:", popupErr);
  
      pushDebug(setDebugInfo, "popup_sign_in_failed", {
        pendingAction,
        message: popupErr?.message || null,
        code: popupErr?.code || null,
      });
  
      if (popupErr?.code === "auth/popup-blocked") {
        setAuthMessage(
          "Google sign-in popup was blocked. Please allow popups and try again."
        );
      } else if (popupErr?.code === "auth/popup-closed-by-user") {
        setAuthMessage("Google sign-in was closed before it finished.");
      } else if (popupErr?.code === "auth/cancelled-popup-request") {
        setAuthMessage("Google sign-in was cancelled. Please try again.");
      } else {
        setAuthMessage(
          popupErr?.code
            ? `Google sign-in failed: ${popupErr.code}`
            : "Google sign-in failed. Please try again."
        );
      }
  
      return {
        mode: "failed",
        user: null,
      };
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

          pushDebug(setDebugInfo, "popup_auth_settled", {
            popupUid: signInResult.user?.uid || null,
            popupEmail: signInResult.user?.email || null,
            currentUidBeforeTokenRefresh: auth.currentUser?.uid || null,
            currentEmailBeforeTokenRefresh: auth.currentUser?.email || null,
          });

          await auth.currentUser?.getIdToken(true);

          pushDebug(setDebugInfo, "token_refreshed_after_popup", {
            uid: auth.currentUser?.uid || null,
            email: auth.currentUser?.email || null,
          });

          await syncUserProfile();

          pushDebug(setDebugInfo, "claim_call_start", {
            mevaId,
            currentUserUid: auth.currentUser?.uid || null,
            currentUserEmail: auth.currentUser?.email || null,
          });

          await claimMeva({ mevaId });

          pushDebug(setDebugInfo, "claim_call_done", { mevaId });

          await refreshCurrentMeva();
          setAuthMessage("");
          return;
        }

        return;
      }

      trackInteraction("claim_click");

      pushDebug(setDebugInfo, "claim_existing_user_path_start", {
        mevaId,
        currentUserUid: auth.currentUser?.uid || null,
        currentUserEmail: auth.currentUser?.email || null,
      });

      await auth.currentUser?.getIdToken(true);

      pushDebug(setDebugInfo, "claim_existing_user_token_ready", {
        mevaId,
        currentUserUid: auth.currentUser?.uid || null,
        currentUserEmail: auth.currentUser?.email || null,
      });

      await claimMeva({ mevaId });

      pushDebug(setDebugInfo, "claim_existing_user_done", { mevaId });

      await refreshCurrentMeva();
      setAuthMessage("");
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

          pushDebug(setDebugInfo, "popup_auth_settled", {
            popupUid: signInResult.user?.uid || null,
            popupEmail: signInResult.user?.email || null,
            currentUidBeforeTokenRefresh: auth.currentUser?.uid || null,
            currentEmailBeforeTokenRefresh: auth.currentUser?.email || null,
          });

          await auth.currentUser?.getIdToken(true);

          pushDebug(setDebugInfo, "token_refreshed_after_popup", {
            uid: auth.currentUser?.uid || null,
            email: auth.currentUser?.email || null,
          });

          await syncUserProfile();

          pushDebug(setDebugInfo, "unclaim_call_start", {
            mevaId,
            currentUserUid: auth.currentUser?.uid || null,
            currentUserEmail: auth.currentUser?.email || null,
          });

          await unclaimMeva({ mevaId });
          await signOut(auth);
          pushDebug(setDebugInfo, "unclaim_call_done", { mevaId });
          await refreshCurrentMeva();
          setAuthMessage("");
          return;
        }

        return;
      }

      trackInteraction("unclaim_click");

      pushDebug(setDebugInfo, "unclaim_existing_user_path_start", {
        mevaId,
        currentUserUid: auth.currentUser?.uid || null,
        currentUserEmail: auth.currentUser?.email || null,
      });

      await auth.currentUser?.getIdToken(true);

      pushDebug(setDebugInfo, "unclaim_existing_user_token_ready", {
        mevaId,
        currentUserUid: auth.currentUser?.uid || null,
        currentUserEmail: auth.currentUser?.email || null,
      });

      await unclaimMeva({ mevaId });

      pushDebug(setDebugInfo, "unclaim_existing_user_done", { mevaId });

      await signOut(auth);
      await refreshCurrentMeva();
      setAuthMessage("");
    } catch (err) {
      console.error("Unclaim failed:", err);
      pushDebug(setDebugInfo, "unclaim_call_failed", {
        message: err?.message || null,
        code: err?.code || null,
        name: err?.name || null,
        details: err?.details || null,
      });
      setActionMessage(
        err?.message || "We couldn’t unclaim this Meva right now."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const renderCardShell = (content) => (
    <div className="mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-[470px] items-center justify-center sm:max-w-[500px]">
      <div className="relative w-full rounded-[34px] border border-white/80 bg-[#F7FAFF] px-5 pb-8 pt-8 shadow-[0_20px_70px_rgba(95,72,150,0.08)] sm:px-6 sm:pb-8 sm:pt-8">
        <a
          href="/m"
          aria-label="Back to Meva"
          className="absolute -left-[12px] -top-[12px] sm:-left-7 sm:-top-7"
        >
          <img
            src={MEVA_LOGO_URL}
            alt="Meva logo"
            className="h-[110px] w-auto object-contain sm:h-[150px]"
            draggable="false"
          />
        </a>
        {content}
      </div>
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
      <div className="min-h-screen bg-[#EAF1FB] px-4 py-5 sm:px-5 sm:py-7">
        {renderCardShell(
          <>
            <div className="mb-4 flex justify-center">
              <div className="rounded-full border border-[#DBDDF0] bg-[#F4F6FD] px-4 py-1 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#6B5C96]">
                Public Meva Page
              </div>
            </div>

            <h1 className="mx-auto mt-5 max-w-[320px] text-center text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-[#30215A] sm:text-[34px]">
              Couldn’t load Meva.
            </h1>

            <p className="mx-auto mt-4 max-w-[330px] text-center text-[15px] leading-8 text-[#766F91] sm:text-[17px]">
              {error}
            </p>
          </>
        )}
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#EAF1FB] px-4 py-5 sm:px-5 sm:py-7">
        {renderCardShell(
          <>
            <div className="mb-4 flex justify-center">
              <div className="rounded-full border border-[#DBDDF0] bg-[#F4F6FD] px-4 py-1 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#6B5C96]">
                Public Meva Page
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <div className="relative flex h-[146px] w-[146px] items-center justify-center">
                <div className="absolute h-[122px] w-[122px] rounded-full bg-[radial-gradient(circle_at_32%_28%,#F2ECFF_0%,#DDD2FF_38%,#C6C7FF_70%,#AECFFF_100%)]" />
                <img
                  src={KIBO_IMAGE_URL}
                  alt="Kibo"
                  draggable="false"
                  className="relative z-10 h-[108px] w-auto select-none object-contain"
                  style={{ animation: "mevaFloat 3.6s ease-in-out infinite" }}
                />
              </div>
            </div>

            <h1 className="mx-auto mt-5 max-w-[320px] text-center text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-[#30215A] sm:text-[34px]">
              Meva page not found.
            </h1>

            <p className="mx-auto mt-4 max-w-[330px] text-center text-[15px] leading-8 text-[#766F91] sm:text-[17px]">
              This Meva ID does not exist yet.
            </p>

            <div className="mt-5">
              <a
                href="/m"
                className="flex h-[56px] w-full items-center justify-center rounded-[20px] bg-[#EFE8FB] text-[16px] font-extrabold text-[#5A4D82] transition duration-200 hover:bg-[#E9E0FA]"
              >
                Back to Meva
              </a>
            </div>
          </>
        )}
      </div>
    );
  }

  const primaryButtonLabel = viewerState.isClaimed
  ? "Unclaim Meva"
  : "Claim Meva";

  return (
    <>
      <div className="min-h-screen bg-[#EAF1FB] px-4 py-5 sm:px-5 sm:py-7">
        {renderCardShell(
          <>
            <div className="flex items-start justify-end gap-3">
              <div className="flex gap-2">
                <div className="rounded-full bg-white/80 px-4 py-2 text-[13px] font-bold text-[#7B6F9E] shadow-sm">
                  Visited {mevaData?.tapCount ?? 0}
                </div>
                <div className="rounded-full bg-white/80 px-4 py-2 text-[13px] font-bold text-[#7B6F9E] shadow-sm">
                  Fed {mevaData?.visitorTapCount ?? 0}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <div className="relative flex h-[220px] w-full items-start justify-center">
                <div className="absolute left-1/2 top-0 -translate-x-1/2 rounded-[22px] bg-white px-5 py-3 text-[15px] font-bold text-[#5E537F] shadow-sm">
                  {viewerState.isOwner ? "you found me" : "feed me"}
                  <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-[10px] border-r-[10px] border-t-[12px] border-l-transparent border-r-transparent border-t-white" />
                </div>

                <img
                  src={imageUrl}
                  alt={displayName}
                  draggable="false"
                  onClick={async () => {
                    await trackInteraction("tap");
                    setActionMessage("Fed.");
                  }}
                  className="absolute top-[60px] z-10 h-[120px] w-auto select-none object-contain cursor-pointer"
                  style={{ animation: "mevaFloat 3.6s ease-in-out infinite" }}
                />
              </div>
            </div>

            <div className="mt-2 flex justify-center">
              <div className="rounded-full bg-white/90 px-5 py-3 text-[17px] font-black text-[#625683] shadow-sm">
                {displayName}
              </div>
            </div>

            <div className="mx-auto mt-8 max-w-[320px] rounded-[26px] bg-white/85 px-6 py-5 text-center shadow-sm">
              <p className="text-[18px] leading-8 text-[#7D729B]">
                Tap to feed · Hold for a quiet moment
                <br />
                Drag the one that’s awake
              </p>
            </div>

            {authMessage ? (
              <p className="mt-5 text-center text-[14px] font-medium text-[#B45E7F]">
                {authMessage}
              </p>
            ) : null}

            {isDebug ? (
              <div className="mt-5 rounded-[18px] bg-[#EEF4FD] p-4 text-left text-[12px] leading-5 text-[#4D406D]">
                <p className="font-extrabold">Debug</p>
                <p>User UID: {user?.uid || "none"}</p>
                <p>User Email: {user?.email || "none"}</p>
                <p>isSignedIn: {String(viewerState.isSignedIn)}</p>
                <p>isClaimed: {String(viewerState.isClaimed)}</p>
                <p>isOwner: {String(viewerState.isOwner)}</p>
                <p>canClaim: {String(viewerState.canClaim)}</p>
                <p>canUnclaim: {String(viewerState.canUnclaim)}</p>
                <div className="mt-3 max-h-[220px] overflow-auto rounded-[12px] bg-white p-3">
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

            {actionMessage ? (
              <p className="mt-3 text-center text-[14px] font-medium text-[#6B5C96]">
                {actionMessage}
              </p>
            ) : null}

            <div className="mt-6 grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={viewerState.isClaimed ? handleUnclaim : handleClaim}
                disabled={actionLoading}
                className="h-[58px] w-full rounded-[20px] bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4] text-[16px] font-extrabold text-white transition duration-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? "Please wait..." : primaryButtonLabel}
              </button>
            </div>
          </>
        )}
      </div>

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