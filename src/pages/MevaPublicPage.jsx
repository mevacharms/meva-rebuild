import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const KIBO_IMAGE_URL =
  "https://firebasestorage.googleapis.com/v0/b/meva-clean.firebasestorage.app/o/mevas%2FKibo%2FKibo.png?alt=media&token=82c12f12-2989-49dc-ae73-59ee0577c3a8";

const MEVA_LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/meva-clean.firebasestorage.app/o/brand%2FLogo.png?alt=media&token=dc0fef03-4c72-4a08-967e-0ffa9b55c39a";

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

export default function MevaPublicPage() {
  const mevaId = getMevaIdFromPath();
  const isTestMeva = mevaId === "TEST";
  const isValidRealId = /^[A-Z0-9]{8,12}$/.test(mevaId);

  const [loading, setLoading] = useState(!isTestMeva);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [mevaData, setMevaData] = useState(null);

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
          bio: "This is the test Meva used to preview the public Meva experience.",
          ownerName: "Meva",
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
  }, [isTestMeva, isValidRealId, mevaId]);

  const displayName =
    mevaData?.nickname && mevaData?.realName
      ? `${mevaData.nickname} (${mevaData.realName})`
      : mevaData?.nickname ||
        mevaData?.realName ||
        (isTestMeva ? "Test Meva" : "Unnamed Meva");

  const bio =
    mevaData?.bio ||
    (isTestMeva
      ? "This is the test Meva used to preview the public Meva experience."
      : "This Meva is here, but it does not have a public bio yet.");

  return (
    <div className="min-h-screen bg-[#F5F0FB] px-4 py-5 sm:px-5 sm:py-7">
      <div className="mx-auto w-full max-w-[470px] sm:max-w-[500px]">
        <div className="mb-4 flex justify-start pl-1 sm:pl-2">
          <a href="/hub" aria-label="Go to Meva hub">
            <img
              src={MEVA_LOGO_URL}
              alt="Meva logo"
              className="h-[72px] w-auto object-contain sm:h-[78px]"
              draggable="false"
            />
          </a>
        </div>

        <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
          <div className="w-full rounded-[34px] border border-white/80 bg-[#FFFDFE] px-5 pb-6 pt-5 shadow-[0_20px_70px_rgba(95,72,150,0.11)] sm:px-6 sm:pt-6">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full border border-[#E9E0F7] bg-[#FBF8FF] px-4 py-1 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#6B5C96]">
                {isTestMeva ? "Test Meva" : "Public Meva Page"}
              </div>
            </div>

            <div className="mt-2 flex justify-center">
              <div className="relative flex h-[146px] w-[146px] items-center justify-center">
                <div className="absolute h-[122px] w-[122px] rounded-full bg-[radial-gradient(circle_at_32%_28%,#F8F2FF_0%,#E7D8FF_34%,#BEBEFF_68%,#9BCFFF_100%)]" />
                <img
                  src={KIBO_IMAGE_URL}
                  alt="Kibo"
                  draggable="false"
                  className="relative z-10 h-[108px] w-auto select-none object-contain"
                />
              </div>
            </div>

            {loading ? (
              <>
                <h1 className="mx-auto mt-5 max-w-[320px] text-center text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-[#30215A] sm:text-[34px]">
                  Loading Meva...
                </h1>

                <p className="mx-auto mt-4 max-w-[330px] text-center text-[15px] leading-8 text-[#766F91] sm:text-[17px]">
                  Please wait while we load this Meva page.
                </p>
              </>
            ) : error ? (
              <>
                <h1 className="mx-auto mt-5 max-w-[320px] text-center text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-[#30215A] sm:text-[34px]">
                  Couldn’t load Meva.
                </h1>

                <p className="mx-auto mt-4 max-w-[330px] text-center text-[15px] leading-8 text-[#766F91] sm:text-[17px]">
                  {error}
                </p>

                <div className="mt-5">
                  <a
                    href="/hub"
                    className="flex h-[56px] w-full items-center justify-center rounded-[20px] bg-gradient-to-r from-[#B7A2FA] to-[#A994F2] text-[16px] font-extrabold text-white shadow-[0_12px_24px_rgba(171,150,242,0.24)] transition duration-200 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    Go to Hub
                  </a>
                </div>
              </>
            ) : notFound ? (
              <>
                <h1 className="mx-auto mt-5 max-w-[320px] text-center text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-[#30215A] sm:text-[34px]">
                  Meva page not found.
                </h1>

                <p className="mx-auto mt-4 max-w-[330px] text-center text-[15px] leading-8 text-[#766F91] sm:text-[17px]">
                  This Meva ID does not exist yet. Check the code on the back of
                  the Meva and try again.
                </p>

                <div className="mt-6 rounded-[26px] border border-[#F0D5DD] bg-[#FFF7F9] p-5 text-center">
                  <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#B27A8A]">
                    Attempted ID
                  </p>
                  <p className="mt-2 break-all text-[22px] font-black tracking-[0.08em] text-[#8E4D62]">
                    {mevaId || "UNKNOWN"}
                  </p>
                </div>

                <div className="mt-5">
                  <a
                    href="/hub"
                    className="flex h-[56px] w-full items-center justify-center rounded-[20px] bg-gradient-to-r from-[#B7A2FA] to-[#A994F2] text-[16px] font-extrabold text-white shadow-[0_12px_24px_rgba(171,150,242,0.24)] transition duration-200 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    Go to Hub
                  </a>
                </div>
              </>
            ) : (
              <>
                <h1 className="mx-auto mt-5 max-w-[320px] text-center text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-[#30215A] sm:text-[34px]">
                  {displayName}
                </h1>

                <p className="mx-auto mt-4 max-w-[330px] text-center text-[15px] leading-8 text-[#766F91] sm:text-[17px]">
                  {bio}
                </p>

                <div className="mt-6 rounded-[26px] border border-[#E9E1F4] bg-[#F6F1FB] p-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                  <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#8A82A3]">
                    Meva ID
                  </p>
                  <p className="mt-2 break-all text-[24px] font-black tracking-[0.08em] text-[#31205F]">
                    {mevaId}
                  </p>

                  {mevaData?.ownerName ? (
                    <>
                      <p className="mt-4 text-[13px] font-bold uppercase tracking-[0.14em] text-[#8A82A3]">
                        Owner
                      </p>
                      <p className="mt-2 text-[18px] font-bold text-[#4E416F]">
                        {mevaData.ownerName}
                      </p>
                    </>
                  ) : null}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    className="h-[56px] w-full rounded-[20px] bg-gradient-to-r from-[#7958F2] to-[#8B6BFF] text-[16px] font-extrabold text-white shadow-[0_16px_30px_rgba(122,87,242,0.24)] transition duration-200 hover:scale-[1.01] active:scale-[0.99]"
                    onClick={() => alert("Next: build Meva interaction actions here")}
                  >
                    Interact with Meva
                  </button>

                  <a
                    href="/hub"
                    className="flex h-[56px] w-full items-center justify-center rounded-[20px] bg-[#EFE8FB] text-[16px] font-extrabold text-[#5A4D82] transition duration-200 hover:bg-[#E9E0FA]"
                  >
                    Back to Hub
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}