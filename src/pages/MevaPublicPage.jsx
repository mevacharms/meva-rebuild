import { useEffect, useMemo, useState } from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
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

function savePendingAction(action, mevaId) {
  localStorage.setItem(
    PENDING_ACTION_KEY,
    JSON.stringify({
      action,
      mevaId,
      createdAt: Date.now(),
    })
  );
}

function readPendingAction() {
  try {
    const raw = localStorage.getItem(PENDING_ACTION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearPendingAction() {
  localStorage.removeItem(PENDING_ACTION_KEY);
}

export default function MevaPublicPage() {
  const mevaId = getMevaIdFromPath();
  const isRootMPage = mevaId === "";
  const isTestMeva = mevaId === "TEST";
  const isValidRealId = /^[A-Z0-9]{8,12}$/.test(mevaId);

  const [loading, setLoading] = useState(!isRootMPage && !isTestMeva);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [mevaData, setMevaData] = useState(null);

  const [enteredId, setEnteredId] = useState("");
  const [touched, setTouched] = useState(false);

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

  const cleanedEnteredId = useMemo(
    () => enteredId.trim().toUpperCase(),
    [enteredId]
  );
  const isValidEnteredId = /^[A-Z0-9]{8,12}$/.test(cleanedEnteredId);
  const showInputError =
    touched && cleanedEnteredId.length > 0 && !isValidEnteredId;

    const getMevaViewerState = httpsCallable(functions, "getMevaViewerState");
    const syncUserProfile = httpsCallable(functions, "syncUserProfile");
    const claimMeva = httpsCallable(functions, "claimMeva");
    const unclaimMeva = httpsCallable(functions, "unclaimMeva");
    const logMevaInteraction = httpsCallable(functions, "logMevaInteraction");

  useEffect(() => {
    let mounted = true;

    async function handleRedirect() {
      try {
        await getRedirectResult(auth);
      } catch (err) {
        console.error("Redirect sign-in failed:", err);
        if (!mounted) return;
        setAuthMessage("Google sign-in could not finish. Please try again.");
      }
    }

    handleRedirect();

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (!mounted) return;
    
      setUser(nextUser || null);
      setAuthReady(true);
    
      if (nextUser) {
        try {
          await syncUserProfile();
        } catch (err) {
          console.error("User sync failed:", err);
        }
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMeva() {
      if (isRootMPage) {
        setLoading(false);
        setNotFound(false);
        setError("");
        setMevaData(null);
        return;
      }

      if (isTestMeva) {
        setLoading(false);
        setNotFound(false);
        setError("");
        setMevaData({
          id: "TEST",
          nickname: "Test Meva",
          realName: "Kibo",
          bio: "This is the test Meva used to preview the public Meva experience.",
          imageUrl: KIBO_IMAGE_URL,
          isClaimed: false,
          tapCount: 382,
          ownerTapCount: 0,
          visitorTapCount: 15,
        });
        return;
      }

      if (!isValidRealId) {
        setLoading(false);
        setNotFound(true);
        setError("");
        setMevaData(null);
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
  }, [isRootMPage, isTestMeva, isValidRealId, mevaId]);

  useEffect(() => {
    let cancelled = false;

    async function loadViewerState() {
      if (isRootMPage || notFound || loading || !authReady) return;
      if (!isTestMeva && !isValidRealId) return;

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
  }, [
    authReady,
    getMevaViewerState,
    isRootMPage,
    isTestMeva,
    isValidRealId,
    loading,
    mevaId,
    notFound,
    user,
  ]);

  useEffect(() => {
    if (isRootMPage || loading || notFound) return;
    if (!isTestMeva && !isValidRealId) return;

    trackInteraction("page_view");
  }, [isRootMPage, loading, notFound, isTestMeva, isValidRealId, mevaId]);

  useEffect(() => {
    let cancelled = false;

    async function resumePendingAction() {
      if (!authReady || !user) return;
      if (loading || notFound) return;

      const pending = readPendingAction();
      if (!pending) return;
      if (pending.mevaId !== mevaId) return;

      clearPendingAction();

      try {
        setActionLoading(true);
        setActionMessage("");

        if (pending.action === "claim") {
          await claimMeva({ mevaId });
          if (!cancelled) {
            setActionMessage("This Meva is now claimed.");
          }
        }

        if (pending.action === "unclaim") {
          await unclaimMeva({ mevaId });
          if (!cancelled) {
            setActionMessage("This Meva has been unclaimed.");
          }
        }

        const mevaRef = doc(db, "mevas", mevaId);
        const mevaSnap = await getDoc(mevaRef);

        if (!cancelled && mevaSnap.exists()) {
          setMevaData({
            id: mevaId,
            ...mevaSnap.data(),
          });
        }

        const viewerResult = await getMevaViewerState({ mevaId });

        if (!cancelled) {
          setViewerState({
            isSignedIn: !!viewerResult.data?.isSignedIn,
            isClaimed: !!viewerResult.data?.isClaimed,
            isOwner: !!viewerResult.data?.isOwner,
            canClaim: !!viewerResult.data?.canClaim,
            canUnclaim: !!viewerResult.data?.canUnclaim,
          });
        }
      } catch (err) {
        console.error("Resume pending action failed:", err);
        if (!cancelled) {
          setActionMessage(
            err?.message || "We couldn’t finish that action right now."
          );
        }
      } finally {
        if (!cancelled) {
          setActionLoading(false);
        }
      }
    }

    resumePendingAction();

    return () => {
      cancelled = true;
    };
  }, [
    authReady,
    claimMeva,
    getMevaViewerState,
    loading,
    mevaId,
    notFound,
    unclaimMeva,
    user,
  ]);

  const displayName =
    mevaData?.nickname && mevaData?.realName
      ? `${mevaData.nickname} (${mevaData.realName})`
      : mevaData?.nickname || mevaData?.realName || "Unnamed Meva";

  const bio =
    mevaData?.bio ||
    (isTestMeva
      ? "This is the test Meva used to preview the public Meva experience."
      : "This Meva is here, but it does not have a public bio yet.");

  const imageUrl = mevaData?.imageUrl || KIBO_IMAGE_URL;

  const handleEnteredIdChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setEnteredId(value);
  };

  const handleOpenEnteredMeva = () => {
    setTouched(true);

    if (!isValidEnteredId) return;

    window.location.href = `/m/${cleanedEnteredId}`;
  };

  const handleEnteredIdKeyDown = (e) => {
    if (e.key === "Enter") {
      handleOpenEnteredMeva();
    }
  };
  
  const getClientContext = async () => {
    const base = {
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
        source: "meva_public_page",
        referrer: document.referrer || null,
      },
    };
  
    if (!navigator.geolocation) {
      return base;
    }
  
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            ...base,
            location: {
              ...base.location,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            },
          });
        },
        () => resolve(base),
        {
          enableHighAccuracy: false,
          timeout: 2500,
          maximumAge: 300000,
        }
      );
    });
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
    if (!mevaId || isRootMPage || notFound) return;

    const mevaRef = doc(db, "mevas", mevaId);
    const mevaSnap = await getDoc(mevaRef);

    if (mevaSnap.exists()) {
      setMevaData({
        id: mevaId,
        ...mevaSnap.data(),
      });
    }

    const viewerResult = await getMevaViewerState({ mevaId });
    setViewerState({
      isSignedIn: !!viewerResult.data?.isSignedIn,
      isClaimed: !!viewerResult.data?.isClaimed,
      isOwner: !!viewerResult.data?.isOwner,
      canClaim: !!viewerResult.data?.canClaim,
      canUnclaim: !!viewerResult.data?.canUnclaim,
    });
  };

  const beginGoogleSignIn = async (pendingAction) => {
    savePendingAction(pendingAction, mevaId);
    setAuthMessage("");

    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (redirectErr) {
      console.error("Redirect sign-in failed:", redirectErr);

      try {
        await signInWithPopup(auth, googleProvider);
      } catch (popupErr) {
        console.error("Popup sign-in failed:", popupErr);
        clearPendingAction();

        if (
          popupErr?.code === "auth/popup-closed-by-user" ||
          popupErr?.code === "auth/cancelled-popup-request"
        ) {
          setAuthMessage("Google sign-in was closed before it finished.");
          return;
        }

        setAuthMessage("Google sign-in failed. Please try again.");
        return;
      }
    }
  };

  const handleClaim = async () => {
    try {
      setActionLoading(true);
      setActionMessage("");
      setAuthMessage("");
      await trackInteraction("claim_click");

      if (!user) {
        await beginGoogleSignIn("claim");
        return;
      }

      await claimMeva({ mevaId });
      await refreshCurrentMeva();
      setActionMessage("This Meva is now claimed.");
    } catch (err) {
      console.error("Claim failed:", err);
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
      await trackInteraction("unclaim_click");

      if (!user) {
        await beginGoogleSignIn("unclaim");
        return;
      }

      await unclaimMeva({ mevaId });
      await refreshCurrentMeva();
      setActionMessage("This Meva has been unclaimed.");
    } catch (err) {
      console.error("Unclaim failed:", err);
      setActionMessage(
        err?.message || "We couldn’t unclaim this Meva right now."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const renderRootMEntry = () => {
    return (
      <>
        <div className="mb-4 flex justify-center">
          <div className="rounded-full border border-[#DBDDF0] bg-[#F4F6FD] px-4 py-1 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#6B5C96]">
            Meva Hub
          </div>
        </div>

        <h1 className="mx-auto max-w-[330px] text-center text-[28px] font-black leading-[0.98] tracking-[-0.03em] text-[#30215A] sm:max-w-[380px] sm:text-[35px]">
          Open a Meva page or try feeding the test Meva.
        </h1>

        <p className="mx-auto mt-4 max-w-[350px] text-center text-[15px] leading-7 text-[#766F91] sm:max-w-[390px] sm:text-[17px] sm:leading-8">
          Use the real test Meva to experience the interactive public page, or
          enter a Meva ID to open one directly.
        </p>

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

        <button
          type="button"
          onClick={() => {
            window.location.href = "/m/test";
          }}
          className="mt-5 h-[58px] w-full rounded-[20px] bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4] text-[17px] font-extrabold text-white transition duration-200 hover:scale-[1.01] active:scale-[0.99]"
        >
          Feed the Test Meva
        </button>

        <div className="mt-5 rounded-[28px] border border-[#DCE3F1] bg-[#EEF4FD] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:p-5">
          <h2 className="text-center text-[17px] font-extrabold tracking-[-0.02em] text-[#4D406D]">
            Open a Meva by ID
          </h2>

          <div className="mt-4">
            <input
              type="text"
              value={enteredId}
              onChange={handleEnteredIdChange}
              onBlur={() => setTouched(true)}
              onKeyDown={handleEnteredIdKeyDown}
              placeholder="Enter Meva ID"
              maxLength={12}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className={`h-[62px] w-full rounded-[18px] bg-[#FCFDFF] px-5 text-[17px] font-medium uppercase tracking-[0.02em] text-[#31205F] outline-none transition placeholder:normal-case placeholder:tracking-normal placeholder:text-[#8E87A3] ${
                showInputError
                  ? "border border-[#E49AAA] ring-4 ring-[#F6C8D1]/40"
                  : "border border-[#D9E1F0] focus:border-[#A9B8F8] focus:ring-4 focus:ring-[#A9B8F8]/20"
              }`}
            />
          </div>

          <div className="mt-3 text-[14px] leading-6 text-[#7E83A0]">
            <p>Example: EDALINET</p>
            <p>Meva IDs are generally on the back of the Meva.</p>
            {showInputError ? (
              <p className="mt-1 font-medium text-[#C45C77]">
                Enter a valid Meva ID using 8–12 letters or numbers.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleOpenEnteredMeva}
            className="mt-5 h-[58px] w-full rounded-[20px] bg-gradient-to-r from-[#B8A7F4] via-[#A18CF7] to-[#907AF4] text-[17px] font-extrabold text-white transition duration-200 hover:scale-[1.01] active:scale-[0.99]"
          >
            Open Meva
          </button>
        </div>
      </>
    );
  };

  const renderLoading = () => {
    return (
      <>
        <div className="mb-4 flex justify-center">
          <div className="rounded-full border border-[#DBDDF0] bg-[#F4F6FD] px-4 py-1 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#6B5C96]">
            Public Meva Page
          </div>
        </div>

        <div className="mt-2 flex justify-center">
          <div className="relative flex h-[146px] w-[146px] items-center justify-center">
            <div className="absolute h-[122px] w-[122px] rounded-full bg-[radial-gradient(circle_at_32%_28%,#F2ECFF_0%,#DDD2FF_38%,#C6C7FF_70%,#AECFFF_100%)]" />
            <img
              src={KIBO_IMAGE_URL}
              alt="Kibo"
              draggable="false"
              className="relative z-10 h-[108px] w-auto select-none object-contain opacity-85"
              style={{ animation: "mevaFloat 3.6s ease-in-out infinite" }}
            />
          </div>
        </div>

        <h1 className="mx-auto mt-5 max-w-[320px] text-center text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-[#30215A] sm:text-[34px]">
          Loading Meva...
        </h1>

        <p className="mx-auto mt-4 max-w-[330px] text-center text-[15px] leading-8 text-[#766F91] sm:text-[17px]">
          Please wait while we load this Meva page.
        </p>
      </>
    );
  };

  const renderError = () => {
    return (
      <>
        <div className="mb-4 flex justify-center">
          <div className="rounded-full border border-[#DBDDF0] bg-[#F4F6FD] px-4 py-1 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#6B5C96]">
            Public Meva Page
          </div>
        </div>

        <div className="mt-2 flex justify-center">
          <div className="relative flex h-[146px] w-[146px] items-center justify-center">
            <div className="absolute h-[122px] w-[122px] rounded-full bg-[radial-gradient(circle_at_32%_28%,#F2ECFF_0%,#DDD2FF_38%,#C6C7FF_70%,#AECFFF_100%)]" />
            <img
              src={KIBO_IMAGE_URL}
              alt="Kibo"
              draggable="false"
              className="relative z-10 h-[108px] w-auto select-none object-contain opacity-85"
            />
          </div>
        </div>

        <h1 className="mx-auto mt-5 max-w-[320px] text-center text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-[#30215A] sm:text-[34px]">
          Couldn’t load Meva.
        </h1>

        <p className="mx-auto mt-4 max-w-[330px] text-center text-[15px] leading-8 text-[#766F91] sm:text-[17px]">
          {error}
        </p>

        <div className="mt-5">
          <a
            href="/m"
            className="flex h-[56px] w-full items-center justify-center rounded-[20px] bg-gradient-to-r from-[#B8A7F4] via-[#A18CF7] to-[#907AF4] text-[16px] font-extrabold text-white transition duration-200 hover:scale-[1.01] active:scale-[0.99]"
          >
            Back to Meva
          </a>
        </div>
      </>
    );
  };

  const renderNotFound = () => {
    return (
      <>
        <div className="mb-4 flex justify-center">
          <div className="rounded-full border border-[#DBDDF0] bg-[#F4F6FD] px-4 py-1 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#6B5C96]">
            Public Meva Page
          </div>
        </div>

        <div className="mt-2 flex justify-center">
          <div className="relative flex h-[146px] w-[146px] items-center justify-center">
            <div className="absolute h-[122px] w-[122px] rounded-full bg-[radial-gradient(circle_at_32%_28%,#F2ECFF_0%,#DDD2FF_38%,#C6C7FF_70%,#AECFFF_100%)]" />
            <img
              src={KIBO_IMAGE_URL}
              alt="Kibo"
              draggable="false"
              className="relative z-10 h-[108px] w-auto select-none object-contain opacity-85"
            />
          </div>
        </div>

        <h1 className="mx-auto mt-5 max-w-[320px] text-center text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-[#30215A] sm:text-[34px]">
          Meva page not found.
        </h1>

        <p className="mx-auto mt-4 max-w-[330px] text-center text-[15px] leading-8 text-[#766F91] sm:text-[17px]">
          This Meva ID does not exist yet. Check the code on the back of the
          Meva and try again.
        </p>

        <div className="mt-6 rounded-[26px] border border-[#DCE3F1] bg-[#EEF4FD] p-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#8A82A3]">
            Attempted ID
          </p>
          <p className="mt-2 break-all text-[22px] font-black tracking-[0.08em] text-[#31205F]">
            {mevaId || "UNKNOWN"}
          </p>
        </div>

        <div className="mt-5">
          <a
            href="/m"
            className="flex h-[56px] w-full items-center justify-center rounded-[20px] bg-gradient-to-r from-[#B8A7F4] via-[#A18CF7] to-[#907AF4] text-[16px] font-extrabold text-white transition duration-200 hover:scale-[1.01] active:scale-[0.99]"
          >
            Back to Meva
          </a>
        </div>
      </>
    );
  };

  const renderLoadedMeva = () => {
    const claimButtonLabel = viewerState.isOwner
      ? "Unclaim Meva"
      : viewerState.canClaim
      ? "Claim Meva"
      : viewerState.isClaimed
      ? "Already Claimed"
      : "Claim Meva";

    return (
      <>
        <div className="flex items-start justify-between">
          <a
            href="/m"
            className="rounded-full bg-white/85 px-4 py-2 text-[13px] font-bold text-[#6B5C96] shadow-sm"
          >
            meva
          </a>

          <div className="flex gap-2">
            <div className="rounded-full bg-white/80 px-4 py-2 text-[13px] font-bold text-[#7B6F9E] shadow-sm">
              Visited{mevaData?.tapCount ?? 0}
            </div>
            <div className="rounded-full bg-white/80 px-4 py-2 text-[13px] font-bold text-[#7B6F9E] shadow-sm">
              Fed{mevaData?.visitorTapCount ?? 0}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="relative flex min-h-[300px] w-full items-start justify-center">
            <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-[22px] bg-white px-5 py-3 text-[15px] font-bold text-[#5E537F] shadow-sm">
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
              className="mt-16 h-[150px] w-auto select-none object-contain cursor-pointer"
              style={{ animation: "mevaFloat 3.6s ease-in-out infinite" }}
            />
          </div>
        </div>

        <div className="mt-2 flex justify-center">
          <div className="rounded-full bg-white/90 px-5 py-3 text-[17px] font-black text-[#625683] shadow-sm">
            {displayName}
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-[320px] rounded-[26px] bg-white/85 px-6 py-5 text-center shadow-sm">
          <p className="text-[18px] leading-8 text-[#7D729B]">
            Tap to feed · Hold for a quiet moment
            <br />
            Drag the one that’s awake
          </p>
        </div>

        {bio ? (
          <p className="mx-auto mt-5 max-w-[330px] text-center text-[15px] leading-7 text-[#766F91]">
            {bio}
          </p>
        ) : null}

        {authMessage ? (
          <p className="mt-5 text-center text-[14px] font-medium text-[#B45E7F]">
            {authMessage}
          </p>
        ) : null}

        {actionMessage ? (
          <p className="mt-3 text-center text-[14px] font-medium text-[#6B5C96]">
            {actionMessage}
          </p>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-3">
        <button
            type="button"
            onClick={
              viewerState.isOwner
                ? handleUnclaim
                : viewerState.canClaim
                ? handleClaim
                : async () => {
                    await trackInteraction("feed");
                    setActionMessage("Fed.");
                  }
            }
            disabled={actionLoading}
            className="h-[58px] w-full rounded-[20px] bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4] text-[16px] font-extrabold text-white transition duration-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLoading ? "Please wait..." : claimButtonLabel}
          </button>

          {user ? (
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="h-[56px] w-full rounded-[20px] bg-[#EFE8FB] text-[16px] font-extrabold text-[#5A4D82] transition duration-200 hover:bg-[#E9E0FA]"
            >
              Sign Out
            </button>
          ) : null}

          <a
            href="/m"
            className="flex h-[56px] w-full items-center justify-center rounded-[20px] bg-[#EFE8FB] text-[16px] font-extrabold text-[#5A4D82] transition duration-200 hover:bg-[#E9E0FA]"
          >
            Back to Meva
          </a>
        </div>
      </>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-[#EDEAF6] px-4 py-4 sm:px-5 sm:py-6">
        <div className="mx-auto min-h-screen w-full max-w-[1400px] rounded-[28px] border border-[#D7D1E8] bg-[linear-gradient(180deg,#E8E3F2_0%,#ECE7F5_45%,#E5DEF1_100%)] px-5 py-5 shadow-[0_12px_40px_rgba(95,72,150,0.08)]">
          <div className="relative min-h-[calc(100vh-48px)] overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_100%)] px-4 pb-8 pt-4 sm:px-6">
            {isRootMPage ? (
              <div className="mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-[470px] items-center justify-center sm:max-w-[500px]">
                <div className="relative w-full rounded-[34px] border border-white/80 bg-[#F7FAFF] px-5 pb-5 pt-8 shadow-[0_20px_70px_rgba(95,72,150,0.08)] sm:px-6 sm:pb-6 sm:pt-8">
                  <a
                    href="/m"
                    aria-label="Go to Meva"
                    className="absolute -left-[12px] -top-[12px] sm:-left-7 sm:-top-7"
                  >
                    <img
                      src={MEVA_LOGO_URL}
                      alt="Meva logo"
                      className="h-[110px] w-auto object-contain sm:h-[150px]"
                      draggable="false"
                    />
                  </a>
                  {renderRootMEntry()}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-[1100px] items-center justify-center">
                <div className="w-full max-w-[980px]">
                  {loading
                    ? renderLoading()
                    : error
                    ? renderError()
                    : notFound
                    ? renderNotFound()
                    : renderLoadedMeva()}
                </div>
              </div>
            )}
          </div>
        </div>
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