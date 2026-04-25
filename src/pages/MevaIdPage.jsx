  import { useEffect, useMemo, useRef, useState } from "react";
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
  
    const ua = navigator.userAgent || "";
    const hasTouch = navigator.maxTouchPoints > 0;
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  
    return (
      /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua) ||
      hasTouch ||
      coarsePointer ||
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
    const dotIndex = domain.lastIndexOf(".");
    const domainName = dotIndex > 0 ? domain.slice(0, dotIndex) : domain;
    const domainEnd = dotIndex > 0 ? domain.slice(dotIndex) : "";
    const safeDomain =
      domainName.length <= 4
        ? `${domainName.slice(0, 1)}***${domainEnd}`
        : `${domainName.slice(0, 2)}***${domainEnd}`;
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
    const parts = new Intl.DateTimeFormat("en-US", {
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

    const get = (type) => parts.find((part) => part.type === type)?.value;
    const weekday = get("weekday");
    const hour = Number(get("hour"));
    const minute = Number(get("minute"));
    const second = Number(get("second"));

    const dayMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    const currentDay = dayMap[weekday] ?? 0;
    const minutesSinceMonday =
      currentDay * 1440 + hour * 60 + minute + second / 60;
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
const [mevaTypeData, setMevaTypeData] = useState(null);

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

    const [panel, setPanel] = useState(null);
    const [moreMode, setMoreMode] = useState("main");
    const [collectionTab, setCollectionTab] = useState("claimed");
    const [shopTab, setShopTab] = useState("wardrobe");

    const [leaderboardType, setLeaderboardType] = useState("collectors");
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [leaderboardProfile, setLeaderboardProfile] = useState(null);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

    const [nameDraft, setNameDraft] = useState("");
    const [nameMessage, setNameMessage] = useState("");
    const [savingName, setSavingName] = useState(false);
    const [weeklyResetText, setWeeklyResetText] = useState(
      formatDuration(getWeeklyResetMs())
    );
    const [tapBounce, setTapBounce] = useState(false);
    const [glowActive, setGlowActive] = useState(false);
    const [mevaMood, setMevaMood] = useState("calm");

const TAP_LINES = [
  "hi",
  "that felt nice",
  "again?",
  "you’re here",
  "I like that",
];

const HOLD_LINES = [
  "stay a bit",
  "I’m here",
  "don’t rush",
  "this is nice",
];

const IDLE_LINES = [
  "tap me gently",
  "I’m waiting",
  "still here",
];
    const [mevaPos, setMevaPos] = useState({ x: 0, y: 0 });
    const [draggingMeva, setDraggingMeva] = useState(false);
    const [renameDraft, setRenameDraft] = useState("");
    const [renameMessage, setRenameMessage] = useState("");
    const [renamingMeva, setRenamingMeva] = useState(false);
    const unclaimInputRef = useRef(null);
  const unclaimButtonRef = useRef(null);
  const [notice, setNotice] = useState(null);
  const [mevaText, setMevaText] = useState("tap me gently");
    const holdTimerRef = useRef(null);
    const holdActiveRef = useRef(false);
    const dragRef = useRef({
      active: false,
      moved: false,
      startX: 0,
      startY: 0,
      baseX: 0,
      baseY: 0,
    });

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
    const setMevaNickname = useMemo(
      () => httpsCallable(functions, "setMevaNickname"),
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

          if (redirectResult?.user) {
            const pending = readPendingAction();
            setUser(redirectResult.user);
            await syncUserProfile();

            if (pending?.mevaId === mevaId) {
              if (pending.action === "claim") await claimMeva({ mevaId });

              if (pending.action === "unclaim") {
                await unclaimMeva({ mevaId });
                await signOut(auth);
              }

              clearPendingAction();
              await refreshCurrentMeva();
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

        setUser(nextUser || null);
        setAuthReady(true);

        if (nextUser) {
          setAuthMessage("");
        
          try {
            await syncUserProfile();
        
            const pending = readPendingAction();
        
            if (pending?.mevaId === mevaId) {
              if (pending.action === "claim") {
                await claimMeva({ mevaId });
              }
        
              if (pending.action === "unclaim") {
                await unclaimMeva({ mevaId });
                await signOut(auth);
              }
        
              clearPendingAction();
              await refreshCurrentMeva();
            }
          } catch (err) {
            console.error("User sync / pending action failed:", err);
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
            nickname: "",
            realName: "Kibo",
            imageUrl: KIBO_IMAGE_URL,
            isClaimed: false,
            tapCount: 382,
            ownerTapCount: 0,
            visitorTapCount: 15,
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
          const typeId = mevaSnap.data()?.mevaTypeDocId;

if (typeId) {
  try {
    const typeRef = doc(db, "mevaTypes", typeId);
    const typeSnap = await getDoc(typeRef);

    if (typeSnap.exists()) {
      setMevaTypeData(typeSnap.data());
    } else {
      setMevaTypeData(null);
    }
  } catch {
    setMevaTypeData(null);
  }
}
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

          const deviceOwner = false;

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

    useEffect(() => {
      if (!draggingMeva) return;

      const handleMove = (e) => moveMevaToPointer(e.clientX, e.clientY);
      const handleUp = () => finishMevaDrag();

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleUp);

      return () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleUp);
      };
    }, [draggingMeva]);

    const safeRealName =
      mevaData?.realName && !["edaline", "edalinet"].includes(String(mevaData.realName).toLowerCase())
        ? mevaData.realName
        : mevaTypeData?.officialName || "Kibo";

    const displayName =
    mevaData?.nickname && !["edaline", "edalinet"].includes(String(mevaData.nickname).toLowerCase())
        ? mevaData.nickname
        : safeRealName;
        const imageUrl =
        mevaTypeData?.imageUrl ||
        mevaData?.imageUrl ||
        KIBO_IMAGE_URL;
    const isMobileDevice = isMobileLike();
    const isDesktop = !isMobileDevice;
    const primaryButtonLabel = viewerState.isClaimed ? "Unclaim Meva" : "Claim Meva";

    const ownershipTitle = viewerState.isOwner
  ? "Saved with Google"
  : viewerState.isClaimed
  ? "Already claimed"
  : "Not claimed yet";

  const ownershipText = viewerState.isOwner
  ? "This Meva is protected and follows your Google account."
  : viewerState.isClaimed
  ? "This Meva belongs to another Google account."
  : "Claim this Meva to save it to your account.";

    const getClientContext = async () => ({
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
    });

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

const deviceOwner = false;

setViewerState({
  isSignedIn: !!viewerResult.data?.isSignedIn,
  isClaimed: !!viewerResult.data?.isClaimed,
  isOwner: !!viewerResult.data?.isOwner,
  canClaim: !!viewerResult.data?.canClaim,
  canUnclaim: !!viewerResult.data?.canUnclaim,
});
    };

    const showNotice = (title, message) => {
      setNotice({ title, message });
      setPanel("notice");
    };

    const beginGoogleSignIn = async (pendingAction) => {
      try {
        savePendingAction(pendingAction, mevaId);
    
        const ua = navigator.userAgent || "";
        const isTablet =
          /iPad|Tablet/i.test(ua) ||
          (navigator.maxTouchPoints > 1 && window.innerWidth >= 768);
    
        if (isTablet) {
          await signInWithRedirect(auth, googleProvider);
          return { mode: "redirect", user: null };
        }
    
        const popupResult = await signInWithPopup(auth, googleProvider);
        return { mode: "popup", user: popupResult.user };
      } catch (err) {
        console.error("Google sign-in failed:", err);
        showNotice("Google sign-in failed", "Please try again.");
        return { mode: "failed", user: null };
      }
    };
    
    const handleClaim = async () => {
      try {
        setActionLoading(true);
        setActionMessage("");
        setAuthMessage("");

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
          showNotice("Saved with Google", `${displayName} is now protected and saved to your account.`);
          return;
          }
          return;
        }

        await trackInteraction("claim_click");
        await auth.currentUser?.getIdToken(true);
        await claimMeva({ mevaId });
        await refreshCurrentMeva();
      setAuthMessage("");
      showNotice("Saved with Google", `${displayName} is now protected and saved to your account.`);
      } catch (err) {
        console.error("Claim failed:", err);
        showNotice("Claim failed", err?.message || "We couldn’t claim this Meva right now.");
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
            showNotice("Unclaimed", `${displayName} is no longer saved to your Google account.`);
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
        showNotice("Unclaimed", `${displayName} is no longer saved to your Google account.`);
      } catch (err) {
        console.error("Unclaim failed:", err);
        showNotice("Unclaim failed", err?.message || "We couldn’t unclaim this Meva right now.");
      } finally {
        setActionLoading(false);
      }
    };

    const closePanels = () => {
      setPanel(null);
      setMoreMode("main");
    };

    const openLeaderboard = async (type = "collectors") => {
      setPanel("leaderboard");
      setLeaderboardType(type);
      await fetchLeaderboard(type);
    };

    const openNameModal = async () => {
      const profile = await fetchLeaderboardProfile();
      setNameDraft(profile?.leaderboardName || "");
      setNameMessage("");
      setPanel("name");
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

    const handleTap = async () => {
      setTapBounce(true);
        setGlowActive(true);
        setMevaMood("happy");
        setMevaText(TAP_LINES[Math.floor(Math.random() * TAP_LINES.length)]);
      setMevaData((prev) =>
        prev
          ? {
              ...prev,
              countedTapTotal: (prev.countedTapTotal || 0) + 1,
              ownerTapCount: viewerState.isOwner
                ? (prev.ownerTapCount || 0) + 1
                : prev.ownerTapCount || 0,
              visitorTapCount: viewerState.isOwner
                ? prev.visitorTapCount || 0
                : (prev.visitorTapCount || 0) + 1,
            }
          : prev
      );

      window.setTimeout(() => {
        setTapBounce(false);
        setGlowActive(false);
      }, 220);
      window.setTimeout(() => {
        setMevaMood("calm");
        setMevaText(IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)]);
      }, 900);

      await trackInteraction("tap");
    };

    const moveMevaToPointer = (clientX, clientY) => {
      if (!dragRef.current.active) return;

      const dx = clientX - dragRef.current.startX;
      const dy = clientY - dragRef.current.startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragRef.current.moved = true;
      }

      window.requestAnimationFrame(() => {
        setMevaPos((prev) => {
          const targetX = Math.max(-120, Math.min(120, dragRef.current.baseX + dx));
          const targetY = Math.max(-155, Math.min(135, dragRef.current.baseY + dy));
      
          return {
            x: prev.x + (targetX - prev.x) * 0.25,
            y: prev.y + (targetY - prev.y) * 0.25,
          };
        });
      });
    };

    const finishMevaDrag = async () => {
      const shouldTap = dragRef.current.active && !dragRef.current.moved;

      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      const wasHolding = holdActiveRef.current;

      dragRef.current.active = false;
      holdActiveRef.current = false;
      setDraggingMeva(false);

// small settle easing
setMevaPos((prev) => ({
  x: prev.x * 0.9,
  y: prev.y * 0.9,
}));

      if (wasHolding) {
        setMevaMood("calm");
      setGlowActive(false);
        await trackInteraction("hold_end");
        return;
      }

      if (shouldTap) {
        await handleTap();
      } else {
        await trackInteraction("drag_end");
      }
    };

    const handleMevaPointerDown = (e) => {
      e.preventDefault();

      dragRef.current = {
        active: true,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        baseX: mevaPos.x,
        baseY: mevaPos.y,
      };

      setMevaMood("soft");
      setGlowActive(true);
      setMevaText(HOLD_LINES[Math.floor(Math.random() * HOLD_LINES.length)]);

      holdTimerRef.current = window.setTimeout(() => {
        if (!dragRef.current.active || dragRef.current.moved) return;
        holdActiveRef.current = true;
        trackInteraction("hold_start");
      }, 200);

      setDraggingMeva(true);
    };

    const handleMevaPointerMove = (e) => {
      moveMevaToPointer(e.clientX, e.clientY);
    };

    const handleMevaPointerUp = async () => {
      await finishMevaDrag();
    };

    const saveMevaNickname = async (payload) => {
      try {
        setRenamingMeva(true);
        setRenameMessage("");

        const res = await setMevaNickname({ mevaId, ...payload });
        const nickname = res.data?.nickname || payload.nickname || "Kibo";

        setMevaData((prev) => (prev ? { ...prev, nickname } : prev));
        setRenameDraft(nickname);
        setRenameMessage("Name saved.");

        await refreshCurrentMeva();
      } catch (err) {
        setRenameMessage(err?.message || "Could not rename this Meva.");
      } finally {
        setRenamingMeva(false);
      }
    };

    const renderMainShell = (content) => (
      <div className="relative mx-auto h-[100dvh] max-h-[100dvh] w-full max-w-[430px] overflow-hidden select-none [-webkit-user-select:none] [-webkit-touch-callout:none]">
        <a
          href="/m"
          aria-label="Back to Meva"
          className="absolute left-3 top-4 z-20 flex h-[58px] w-[58px] items-center justify-center"
        >
          <img
            src={MEVA_LOGO_URL}
            alt="Meva logo"
            className="h-[116px] w-[116px] max-w-none object-cover select-none pointer-events-none"
            draggable="false"
          />
        </a>

        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setPanel("menu")}
          className="absolute right-4 top-5 z-20 flex h-[48px] w-[48px] items-center justify-center rounded-full bg-white/90 text-[23px] font-black text-[#6B5C96] shadow-[0_10px_24px_rgba(95,72,150,0.10)]"
        >
          <div className="flex flex-col items-center justify-center gap-[3px] translate-y-[0.5px]">
  <span className="block h-[2.5px] w-[18px] rounded-full bg-[#6B5C96]" />
  <span className="block h-[2.5px] w-[18px] rounded-full bg-[#6B5C96]" />
  <span className="block h-[2.5px] w-[18px] rounded-full bg-[#6B5C96]" />
</div>
        </button>

        {content}
      </div>
    );

    const ModalShell = ({ children, large = false }) => (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#30215A]/38 px-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) closePanels();
        }}
      >
        <div
          className={`relative max-h-[92vh] w-full overflow-y-auto ${
            large ? "max-w-[420px]" : "max-w-[380px]"
          } rounded-[32px] bg-white/95 p-5 text-center shadow-[0_24px_80px_rgba(48,33,90,0.24)]`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={closePanels}
            className="absolute right-4 top-4 flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white text-[22px] font-black text-[#6B5C96] shadow-[0_8px_22px_rgba(95,72,150,0.10)]"
          >
            ×
          </button>
          {children}
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

    if (error || notFound) {
      return (
        <div className="min-h-screen bg-[#EAF1FB] px-4 pt-5">
          {renderMainShell(
            <div className="pt-[230px] text-center">
              <h1 className="mx-auto max-w-[320px] text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-[#30215A]">
                {error ? "Couldn’t load Meva." : "Meva page not found."}
              </h1>
              <p className="mx-auto mt-4 max-w-[330px] text-[15px] leading-8 text-[#766F91]">
                {error || "This Meva ID does not exist yet."}
              </p>
            </div>
          )}
        </div>
      );
    }

    return (
      <>
        <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#EAF1FB] px-4 pt-0 select-none [-webkit-user-select:none] [-webkit-touch-callout:none]">
          {renderMainShell(
            <>
              <div className="flex flex-col items-center pt-[18px]">
  <div className="grid grid-cols-2 gap-1.5 rounded-full bg-white/45 p-1 shadow-sm backdrop-blur-sm">
    <div className="min-w-[78px] rounded-full bg-white/90 px-2.5 py-1 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#A095B8]">
        Visited
      </p>
      <p className="text-[13px] font-black text-[#625683]">
        {mevaData?.tapCount ?? 0}
      </p>
    </div>

    <div className="min-w-[78px] rounded-full bg-white/90 px-2.5 py-1 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#A095B8]">
        Fed
      </p>
      <p className="text-[13px] font-black text-[#625683]">
        {mevaData?.countedTapTotal ??
          (mevaData?.visitorTapCount || 0) + (mevaData?.ownerTapCount || 0)}
      </p>
    </div>
  </div>

  {isDesktop && (
    <div className="mt-2 text-center text-[11px] font-bold text-[#8A7CA8] opacity-70">
      Desktop taps and actions do not count toward Meva progress or leaderboards
    </div>
  )}
</div>

<div className="mt-[150px] flex justify-center">
                <div className="relative flex h-[250px] w-full items-start justify-center">
                <div
                  className="absolute left-1/2 top-0 rounded-[22px] bg-white/95 px-5 py-2.5 text-[14px] font-black text-[#5E537F] shadow-sm transition-transform duration-100 ease-out"
                  style={{
                    transform: `translate(calc(-50% + ${mevaPos.x}px), calc(${mevaPos.y}px - 8px))`,
                  }}
                >
                  {mevaText}
                    <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-[10px] border-r-[10px] border-t-[12px] border-l-transparent border-r-transparent border-t-white" />
                  </div>

                  <div
  className={`absolute z-0 flex h-[190px] w-[190px] items-center justify-center rounded-full transition-opacity duration-300 ${
    glowActive ? "opacity-100" : "opacity-0"
  }`}
  style={{
    transform: `translate(${mevaPos.x}px, ${mevaPos.y}px)`,
    top: "32px",
  }}
>
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-[#A894F0]/12 via-[#8D76F6]/10 to-[#7E66F4]/12 blur-[34px]" />
                  </div>

                  <img
                    src={imageUrl}
                    alt={displayName}
                    draggable="false"
                    onContextMenu={(e) => e.preventDefault()}
                    onPointerDown={handleMevaPointerDown}
                    onPointerMove={handleMevaPointerMove}
                    onPointerUp={handleMevaPointerUp}
                    onPointerCancel={() => {
                      dragRef.current.active = false;
                      holdActiveRef.current = false;
                      setGlowActive(false);
                      setMevaMood("calm");
                      setDraggingMeva(false);
                    }}
                    className={`absolute top-[54px] z-10 h-[122px] w-auto cursor-grab select-none object-contain [-webkit-user-drag:none] ${
                      draggingMeva ? "cursor-grabbing" : ""
                    } transition-transform duration-100 ease-out`}
                    style={{
                      animation: mevaMood === "calm" ? "mevaFloat 3.5s ease-in-out infinite" : "none",
                      transform: `translate(${mevaPos.x}px, ${mevaPos.y}px) scale(${
  glowActive ? 1.06 : mevaMood === "soft" ? 1.04 : tapBounce ? 1.08 : 1
}) rotate(${tapBounce ? 2 : 0}deg)`,
                      WebkitTouchCallout: "none",
                      WebkitUserSelect: "none",
                      userSelect: "none",
                      touchAction: "none",
                    }}
                  />
                </div>
              </div>

              <div className="absolute bottom-[clamp(92px,10dvh,120px)] left-0 right-0 flex justify-center">
                <div className="rounded-full bg-white/95 px-5 py-2 text-[15px] font-black text-[#5A4D82] shadow-sm">
                  {displayName}
                </div>
              </div>

              <div className="absolute bottom-[clamp(45px,5dvh,70px)] left-1/2 w-[min(238px,78vw)] -translate-x-1/2 rounded-[20px] bg-white/80 px-4 py-2 text-center shadow-sm backdrop-blur-sm">
                <p className="text-[12px] font-bold leading-5 text-[#69617F]">
                  Tap, hold, or drag to interact
                </p>
              </div>

              {isDebug ? (
                <div className="mt-4 max-h-[160px] overflow-auto rounded-[18px] bg-[#EEF4FD] p-4 text-left text-[12px] leading-5 text-[#4D406D]">
                  <p className="font-extrabold">Debug</p>
                  <p>User UID: {user?.uid || "none"}</p>
                  <p>User Email: {user?.email || "none"}</p>
                  <p>isSignedIn: {String(viewerState.isSignedIn)}</p>
                  <p>isClaimed: {String(viewerState.isClaimed)}</p>
                  <p>isOwner: {String(viewerState.isOwner)}</p>
                  <p>canClaim: {String(viewerState.canClaim)}</p>
                  <p>canUnclaim: {String(viewerState.canUnclaim)}</p>
                  <div className="mt-3 max-h-[110px] overflow-auto rounded-[12px] bg-white p-3">
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

        {panel === "notice" && notice ? (
          <ModalShell>
            <div className="text-center">
              <img
                src={MEVA_LOGO_URL}
                alt="Meva"
                className="mx-auto mb-3 h-[76px] w-auto pointer-events-none"
                draggable="false"
              />
              <p className="mb-2 text-[22px] font-black text-[#30215A]">
                {notice.title}
              </p>
              <p className="mx-auto mb-5 max-w-[310px] text-[14px] font-bold leading-6 text-[#6B5C96]">
                {notice.message}
              </p>
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  closePanels();
                }}
                className="h-[48px] w-full rounded-[18px] bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4] text-[15px] font-black text-white"
              >
                Okay
              </button>
            </div>
          </ModalShell>
        ) : null}

        {panel === "menu" ? (
          <ModalShell>
            <p className="mb-4 text-[18px] font-black tracking-[0.14em] text-[#8A7CA8]">
              MEVA MENU
            </p>

            {[
              ["Leaderboard", "See collectors and rankings", () => openLeaderboard("collectors")],
              ["My Meva / Collection", "Open claimed, seen, and collection views", () => setPanel("collection")],
              ["Wardrobe / Shop", "Browse cosmetics, themes, and future items", () => setPanel("shop")],
              ["More", "Rename, claim, bug report, and play mode", () => setPanel("more")],
            ].map(([title, subtitle, onClick]) => (
              <button
                key={title}
                type="button"
                onClick={onClick}
                className="mb-3 w-full rounded-[22px] bg-white px-5 py-4 text-left shadow-sm"
              >
                <p className="text-[17px] font-black text-[#4D406D]">{title}</p>
                <p className="mt-1 text-[14px] font-semibold leading-5 text-[#8A7CA8]">
                  {subtitle}
                </p>
              </button>
            ))}
          </ModalShell>
        ) : null}

{panel === "leaderboard" ? (
          <ModalShell large>
            <p className="mb-1 text-[22px] font-black text-[#30215A]">
              Meva Leaderboards
            </p>
            <p className="mb-4 text-[13px] font-black uppercase tracking-[0.16em] text-[#8A7CA8]">
              Top 10
            </p>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-[26px] bg-[#F4F1FB] p-2">
              {[
                ["collectors", "Collectors"],
                ["mostFed", "Most Fed"],
                ["mostFound", "Most Opened"],
                ["ownerCare", "Owner Care"],
              ].map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={async () => {
                    setLeaderboardType(type);
                    await fetchLeaderboard(type);
                  }}
                  className={`h-[48px] rounded-[20px] text-[13px] font-black ${
                    leaderboardType === type
                      ? "bg-white text-[#5A4D82] shadow-sm"
                      : "text-[#6B5C96]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="mx-auto mb-3 max-w-[320px] text-[13px] font-bold leading-5 text-[#8A7CA8]">
              {leaderboardType === "collectors"
                ? "Claimed the most Mevas."
                : leaderboardType === "mostFed"
                ? "Mevas fed the most overall."
                : leaderboardType === "mostFound"
                ? "Mevas opened the most. Unique finds will come later."
                : "Owners who care for their own Meva most."}
            </p>

            <div className="min-h-[230px] max-h-[360px] space-y-2 overflow-y-auto rounded-[24px] bg-[#F8F6FD] p-3">
              {loadingLeaderboard ? (
                <p className="py-10 text-center text-[15px] font-bold text-[#8A7CA8]">
                  Loading...
                </p>
              ) : leaderboardData.length === 0 ? (
                <p className="py-10 text-center text-[15px] font-bold text-[#8A7CA8]">
                  No leaderboard data yet.
                </p>
              ) : (
                leaderboardData.map((item, index) => (
                  <div
                    key={`${item.uid}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-[18px] bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#EFE8FB] text-[14px] font-black text-[#6B5C96]">
                        {index + 1}
                      </div>
                      <p className="truncate text-[15px] font-black text-[#5A4D82]">
                        {item.leaderboardName}
                      </p>
                    </div>
                    <p className="shrink-0 text-[14px] font-black text-[#7B6F9E]">
                      {item.score}
                    </p>
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
                Your first name change is free. After that, names unlock every 14 days.
              </p>
            </div>
          </ModalShell>
        ) : null}

        {panel === "name" ? (
          <ModalShell>
            <p className="mb-1 text-[20px] font-black text-[#30215A]">
              Leaderboard name
            </p>
            <p className="mb-4 text-[13px] font-bold text-[#8A7CA8]">
              3–12 letters or numbers.
            </p>

            <input
              value={nameDraft}
              onChange={(e) =>
                setNameDraft(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 12))
              }
              placeholder="Kibo123"
              className="h-[54px] w-full rounded-[20px] border border-[#E6DEF8] bg-white px-4 text-center text-[18px] font-black text-[#5A4D82] outline-none"
            />

            {leaderboardProfile?.cooldownRemainingMs > 0 ? (
              <p className="mt-3 text-[13px] font-bold text-[#B45E7F]">
                You can change your name in {formatDuration(leaderboardProfile.cooldownRemainingMs)}.
              </p>
            ) : nameMessage ? (
              <p className="mt-3 text-[13px] font-bold text-[#6B5C96]">{nameMessage}</p>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => saveLeaderboardName({ generate: true })}
                disabled={savingName || leaderboardProfile?.cooldownRemainingMs > 0}
                className="h-[50px] rounded-[18px] bg-white text-[14px] font-black text-[#6B5C96] shadow-sm disabled:opacity-50"
              >
                Generate
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
          </ModalShell>
        ) : null}

        {panel === "collection" ? (
          <ModalShell large>
            <p className="mb-6 text-[22px] font-black text-[#30215A]">Your Mevas</p>
            <p className="mb-4 text-left text-[16px] font-black uppercase tracking-[0.18em] text-[#8A7CA8]">
              Library
            </p>

            <div className="mb-4 grid grid-cols-3 gap-3">
              {["claimed", "seen", "collection"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setCollectionTab(tab)}
                  className={`h-[50px] rounded-[22px] text-[15px] font-black capitalize ${
                    collectionTab === tab
                      ? "bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4] text-white shadow-sm"
                      : "bg-[#F8F6FD] text-[#6B5C96]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {collectionTab === "claimed" ? (
              <div className="rounded-[24px] border border-[#E6DEF8] bg-[#F8F6FD] p-4 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[18px] font-black text-[#30215A]">
                      {displayName}
                    </p>
                    <p className="mt-1 text-[14px] font-bold text-[#7D729B]">
                      {ownershipText}
                    </p>
                  </div>
                  <p className="shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-black text-[#6B5C96] shadow-sm">
                    {viewerState.isOwner
  ? "Google"
  : viewerState.isClaimed
  ? "Claimed"
  : "Open"}
                  </p>
                </div>
              </div>
            ) : collectionTab === "seen" ? (
              <div className="rounded-[24px] bg-[#F8F6FD] p-5 text-center">
                <p className="text-[17px] font-black text-[#30215A]">
                  {displayName} has been seen.
                </p>
                <p className="mx-auto mt-2 max-w-[280px] text-[14px] font-bold leading-6 text-[#7D729B]">
                  Seen Mevas will become a fuller collection later. For now, this page shows the Meva you opened.
                </p>
              </div>
            ) : (
              <div className="rounded-[24px] bg-[#F8F6FD] p-5 text-center">
                <p className="text-[17px] font-black text-[#30215A]">
                  Collection progress
                </p>
                <div className="mx-auto mt-4 h-[10px] max-w-[250px] overflow-hidden rounded-full bg-[#E7DFFF]">
                  <div
                    className={`h-full rounded-full bg-[#8D76F6] ${
                      viewerState.isOwner
                        ? "w-[18%]"
                        : "w-[4%]"
                    }`}
                  />
                </div>
                <p className="mt-3 text-[14px] font-bold leading-6 text-[#7D729B]">
                  {viewerState.isOwner
                    ? "1 Meva saved. More collection features come later."
                    : "Save this Meva to start your collection."}
                </p>
              </div>
            )}
          </ModalShell>
        ) : null}

        {panel === "shop" ? (
          <ModalShell large>
            <p className="mb-6 text-[22px] font-black text-[#30215A]">Looks & extras</p>
            <p className="mb-4 text-left text-[16px] font-black uppercase tracking-[0.18em] text-[#8A7CA8]">
              Browse
            </p>
            <div className="mb-5 grid grid-cols-2 gap-3">
              {["wardrobe", "shop"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setShopTab(tab)}
                  className={`h-[52px] rounded-[22px] text-[16px] font-black capitalize ${
                    shopTab === tab
                      ? "bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4] text-white shadow-sm"
                      : "bg-[#F8F6FD] text-[#6B5C96]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="rounded-[24px] bg-[#F8F6FD] p-5 text-left text-[16px] leading-7 text-[#7D729B]">
              {shopTab === "wardrobe"
                ? "Equipped cosmetics, tags, and themes will go here."
                : "Shop items, accessories, and themes will go here."}
            </div>
          </ModalShell>
        ) : null}

        {panel === "more" ? (
          <ModalShell large>
            <p className="mb-5 text-[22px] font-black text-[#30215A]">More to explore</p>

            {moreMode === "main" ? (
              <>
                <p className="mb-3 text-[16px] font-black uppercase tracking-[0.18em] text-[#8A7CA8]">
                  Info
                </p>
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <button className="h-[50px] rounded-[22px] bg-[#F8F6FD] text-[15px] font-black text-[#5A4D82]" onClick={() => setMoreMode("about")}>
                    About Meva
                  </button>
                  <button className="h-[50px] rounded-[22px] bg-[#F8F6FD] text-[15px] font-black text-[#5A4D82]" onClick={() => setMoreMode("guide")}>
                    Help
                  </button>
                </div>

                <p className="mb-3 text-[16px] font-black uppercase tracking-[0.18em] text-[#8A7CA8]">
                  Actions
                </p>
                <div className="mb-4 space-y-2.5">
                  <div className="rounded-[22px] bg-[#F8F6FD] px-4 py-3 text-center">
                    <p className="text-[13px] font-black text-[#5A4D82]">
                    {ownershipTitle}
                    </p>
                    <p className="mt-1 text-[12px] font-bold leading-5 text-[#8A7CA8]">
                    {ownershipText}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => {

                      if (isDesktop) {
                        showNotice(
                          "Use phone or tablet",
                          "Claiming and unclaiming is only available on phone or tablet."
                        );
                        return;
                      }
                    
                      if (viewerState.isOwner) {
                        setMoreMode("unclaimConfirm");
                      } else if (viewerState.isClaimed) {
                        showNotice("Already claimed", "This Meva is saved to another Google account.");
                      } else {
                        handleClaim();
                      }
                    }}
                    className="h-[50px] w-full rounded-[20px] bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4] text-[14px] font-black text-white shadow-sm disabled:opacity-50"
                  >
                    {actionLoading
                      ? "Please wait..."
                      : viewerState.isOwner
                      ? "Unclaim Google ownership"
                      : viewerState.isClaimed
                      ? "Already claimed"
                      : "Claim with Google"}
                  </button>

                  <button
                    className="h-[46px] w-full rounded-[20px] bg-[#F8F6FD] text-[14px] font-black text-[#5A4D82]"
                    onClick={() => setMoreMode("support")}
                  >
                    Support / Contact
                  </button>
                </div>

                <div className="mb-5 rounded-[22px] bg-[#F8F6FD] px-4 py-3 text-center text-[14px] font-semibold text-[#7D729B]">
                  Leaderboard:{" "}
                  <span className="font-black text-[#5A4D82]">
                    {leaderboardProfile?.leaderboardName || "KiboCloud142"}
                  </span>{" "}
                  <span>
                    ({user?.email ? maskEmail(user.email) : "not signed in"})
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button className="h-[50px] rounded-[22px] bg-[#F8F6FD] text-[15px] font-black text-[#5A4D82]" onClick={() => setMoreMode("play")}>
                    Play Mode
                  </button>
                  <button className="h-[50px] rounded-[22px] bg-[#F8F6FD] text-[15px] font-black text-[#5A4D82]" onClick={() => { setRenameDraft(displayName); setRenameMessage(""); setMoreMode("rename"); }}>
                    Rename Meva
                  </button>
                </div>
              </>
            ) : null}

  {moreMode === "unclaimConfirm" ? (
              <div className="text-center">
                <img
                  src={MEVA_LOGO_URL}
                  alt="Meva"
                  className="mx-auto mb-3 h-[76px] w-auto pointer-events-none"
                  draggable="false"
                />
                <p className="mb-2 text-[22px] font-black text-[#30215A]">
                  Unclaim {displayName}?
                </p>
                <p className="mx-auto mb-4 max-w-[310px] text-[14px] font-bold leading-6 text-[#6B5C96]">
                  This removes Google ownership from your account. Other people may be able to claim this Meva after.
                </p>
                <input
                  ref={unclaimInputRef}
                  defaultValue=""
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.toLowerCase();
                    if (unclaimButtonRef.current) {
                      unclaimButtonRef.current.classList.toggle("opacity-40", e.currentTarget.value !== "confirm" || actionLoading);
                    }
                  }}
                  placeholder="type confirm"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  className="mb-3 h-[50px] w-full rounded-[18px] border border-[#E6DEF8] bg-white px-4 text-center text-[16px] font-black text-[#5A4D82] outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMoreMode("main")}
                    className="h-[48px] rounded-[18px] bg-white text-[15px] font-black text-[#6B5C96] shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    ref={unclaimButtonRef}
                    type="button"
                    onClick={() => {

                      if (isDesktop) {
                        showNotice(
                          "Use phone or tablet",
                          "Unclaiming is only available on phone or tablet."
                        );
                        return;
                      }
                    
                      if (unclaimInputRef.current?.value !== "confirm") return;
                      handleUnclaim();
                    }}
                    className="h-[48px] rounded-[18px] bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4] text-[15px] font-black text-white opacity-40"
                  >
                    Unclaim
                  </button>
                </div>
              </div>
            ) : null}

            {moreMode === "about" ? (
              <InnerInfo
                title="About Meva"
                lines={[
                  "Meva started as a small thing I built by hand.",
                  "It’s meant to feel a little alive — something you can feed, linger with, and leave a tiny fingerprint on.",
                  "Given time, each Meva picks up its own little history.",
                  "Still early. Still finding its voice.",
                  "Glad you’re here for the quiet beginnings.",
                ]}
                onClose={() => setMoreMode("main")}
              />
            ) : null}

            {moreMode === "guide" ? (
              <InnerInfo
                title="A little guide"
                lines={[
                  "Tap to feed — they usually answer back.",
                  "Hold a little longer and they may respond more softly.",
                  "Drag the active Meva if you want them closer.",
                  "You can keep up to four on screen at once.",
                  "Device claim keeps it here. Google claim protects it across phones.",
                  "Everything builds slowly over time.",
                ]}
                onClose={() => setMoreMode("main")}
              />
            ) : null}

            {moreMode === "support" ? (
              <div className="text-center">
                <img src={MEVA_LOGO_URL} alt="Meva" className="mx-auto mb-3 h-[76px] w-auto pointer-events-none" draggable="false" />
                <p className="mb-1 text-[22px] font-black text-[#30215A]">Support / Contact Us</p>
                <p className="mx-auto mb-4 max-w-[320px] text-[15px] leading-6 text-[#6B5C96]">
                  Report a bug, ask a question, or send a quick message.
                </p>
                <input className="mb-3 h-[48px] w-full rounded-[18px] border border-[#E6DEF8] px-4 text-[15px] outline-none" placeholder="Short summary" />
                <textarea className="mb-3 h-[100px] w-full resize-none rounded-[18px] border border-[#E6DEF8] p-4 text-[15px] outline-none" placeholder="What were you doing, and what went wrong?" />
                <label className="mb-3 flex h-[48px] w-full cursor-pointer items-center justify-center rounded-[18px] border border-dashed border-[#CDBDFF] bg-[#F8F6FD] text-[14px] font-black text-[#6B5C96]">
                  Add image / screenshot optional
                  <input type="file" accept="image/*" className="hidden" />
                </label>
                <input className="mb-4 h-[48px] w-full rounded-[18px] border border-[#E6DEF8] px-4 text-[15px] outline-none" placeholder="Contact email optional" />
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setMoreMode("main")} className="h-[48px] rounded-[18px] bg-white text-[15px] font-black text-[#6B5C96] shadow-sm">Cancel</button>
                  <button onClick={() => setMoreMode("main")} className="h-[48px] rounded-[18px] bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4] text-[15px] font-black text-white">Send</button>
                </div>
              </div>
            ) : null}

            {moreMode === "play" ? (
              <div className="text-center">
                <img src={MEVA_LOGO_URL} alt="Meva" className="mx-auto mb-3 h-[76px] w-auto pointer-events-none" draggable="false" />
                <p className="mb-2 text-[22px] font-black text-[#30215A]">Play Mode</p>
                <p className="mx-auto mb-4 max-w-[320px] text-[15px] leading-6 text-[#6B5C96]">
                  Lock menus and controls so Mevas can be played with safely.
                </p>
                <input className="mb-4 h-[52px] w-full rounded-[18px] border border-[#CDBDFF] px-4 text-[16px] outline-none" placeholder="Optional 4-digit PIN" maxLength={4} inputMode="numeric" />
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setMoreMode("main")} className="h-[48px] rounded-[18px] bg-white text-[15px] font-black text-[#6B5C96] shadow-sm">Cancel</button>
                  <button onClick={() => setMoreMode("main")} className="h-[48px] rounded-[18px] bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4] text-[15px] font-black text-white">Start</button>
                </div>
              </div>
            ) : null}

            {moreMode === "rename" ? (
              <div className="text-center">
                <p className="mb-1 text-[22px] font-black text-[#30215A]">Rename Meva</p>
                <p className="mb-4 text-[15px] font-semibold text-[#6B5C96]">Preview: {displayName}</p>
                <input
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 12))}
                  className="mb-3 h-[54px] w-full rounded-[18px] border border-[#E6DEF8] px-4 text-center text-[16px] font-black text-[#5A4D82] outline-none"
                  placeholder={`Nickname for ${mevaData?.realName || "Kibo"}`}
                />
                {renameMessage ? (
                  <p className="mb-3 text-[13px] font-bold text-[#6B5C96]">{renameMessage}</p>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => saveMevaNickname({ generate: true })}
                    disabled={renamingMeva}
                    className="h-[50px] rounded-[18px] bg-white text-[15px] font-black text-[#6B5C96] shadow-sm disabled:opacity-50"
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => saveMevaNickname({ nickname: renameDraft })}
                    disabled={renamingMeva}
                    className="h-[50px] rounded-[18px] bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4] text-[15px] font-black text-white disabled:opacity-50"
                  >
                    {renamingMeva ? "Saving..." : "Save"}
                  </button>
                </div>
                <button onClick={() => setMoreMode("main")} className="mt-4 text-[14px] font-bold text-[#7D729B]">Cancel</button>
              </div>
            ) : null}
          </ModalShell>
        ) : null}

<style>{`
          html, body, #root {
            background: #EAF1FB;
          }
          @keyframes mevaFloat {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
            100% { transform: translateY(0px); }
          }

          @keyframes mevaHappy {
            0% { transform: translateY(0px) scale(1) rotate(0deg); }
            22% { transform: translateY(-8px) scale(1.08) rotate(2deg); }
            48% { transform: translateY(2px) scale(0.98) rotate(-1deg); }
            72% { transform: translateY(-3px) scale(1.03) rotate(1deg); }
            100% { transform: translateY(0px) scale(1) rotate(0deg); }
          }
        `}</style>
      </>
    );
  }

  function InnerInfo({ title, lines, onClose }) {
    return (
      <div className="text-center">
        <img
          src={MEVA_LOGO_URL}
          alt="Meva"
          className="mx-auto mb-3 h-[76px] w-auto pointer-events-none"
          draggable="false"
        />
        <p className="mb-4 text-[22px] font-black text-[#30215A]">{title}</p>
        <div className="space-y-3">
          {lines.map((line) => (
            <p key={line} className="text-[15px] leading-6 text-[#625F7A]">
              {line}
            </p>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-[50px] rounded-[20px] bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4] px-10 text-[16px] font-black text-white"
        >
          Close
        </button>
      </div>
    );
  }