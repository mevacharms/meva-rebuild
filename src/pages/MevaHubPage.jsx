import { useMemo, useState } from "react";

const KIBO_IMAGE_URL =
  "https://firebasestorage.googleapis.com/v0/b/meva-clean.firebasestorage.app/o/mevas%2FKibo%2FKibo.png?alt=media&token=82c12f12-2989-49dc-ae73-59ee0577c3a8";

const MEVA_LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/meva-clean.firebasestorage.app/o/brand%2FLogo.png?alt=media&token=dc0fef03-4c72-4a08-967e-0ffa9b55c39a";

export default function MevaHubPage() {
  const [mevaId, setMevaId] = useState("");
  const [touched, setTouched] = useState(false);

  const cleanedId = useMemo(() => mevaId.trim().toUpperCase(), [mevaId]);
  const isValidId = /^[A-Z0-9]{8,12}$/.test(cleanedId);
  const showError = touched && cleanedId.length > 0 && !isValidId;

  const handleFeedTestMeva = () => {
    window.location.href = "/m/test";
  };

  const handleOpenMeva = () => {
    setTouched(true);

    if (!isValidId) return;

    window.location.href = `/m/${cleanedId}`;
  };

  const handleChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setMevaId(value);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleOpenMeva();
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#F5F0FB] px-4 py-5 sm:px-5 sm:py-7">
        <div className="mx-auto flex min-h-screen w-full max-w-[470px] items-center justify-center sm:max-w-[500px]">
          <div className="relative w-full rounded-[34px] border border-white/80 bg-[#FFFDFE] px-5 pb-5 pt-7 shadow-[0_20px_70px_rgba(95,72,150,0.11)] sm:px-6 sm:pb-6 sm:pt-8">
            <a
              href="/"
              aria-label="Go to Meva landing page"
              className="absolute left-6 top-6 sm:left-7 sm:top-7"
            >
              <img
                src={MEVA_LOGO_URL}
                alt="Meva logo"
                className="h-[44px] w-auto object-contain sm:h-[50px]"
                draggable="false"
              />
            </a>

            <div className="mb-4 flex justify-center">
              <div className="rounded-full border border-[#E9E0F7] bg-[#FBF8FF] px-4 py-1 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#6B5C96]">
                Meva Hub
              </div>
            </div>

            <h1 className="mx-auto max-w-[330px] text-center text-[28px] font-black leading-[0.98] tracking-[-0.03em] text-[#30215A] sm:max-w-[380px] sm:text-[35px]">
              Open a Meva page or try feeding the test Meva.
            </h1>

            <p className="mx-auto mt-4 max-w-[350px] text-center text-[15px] leading-8 text-[#766F91] sm:max-w-[390px] sm:text-[17px]">
              Use the real test Meva to experience the interactive public page,
              or enter a Meva ID to open one directly.
            </p>

            <div className="mt-6 flex justify-center">
              <div className="relative flex h-[146px] w-[146px] items-center justify-center">
                <div className="absolute h-[122px] w-[122px] rounded-full bg-[radial-gradient(circle_at_32%_28%,#F8F2FF_0%,#E7D8FF_34%,#BEBEFF_68%,#9BCFFF_100%)]" />
                <img
                  src={KIBO_IMAGE_URL}
                  alt="Kibo"
                  draggable="false"
                  className="relative z-10 h-[108px] w-auto select-none object-contain"
                  style={{
                    animation: "mevaFloat 3.6s ease-in-out infinite",
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleFeedTestMeva}
              className="mt-5 h-[58px] w-full rounded-[20px] bg-gradient-to-r from-[#7958F2] to-[#8B6BFF] text-[17px] font-extrabold text-white transition duration-200 hover:scale-[1.01] active:scale-[0.99]"
            >
              Feed the Test Meva
            </button>

            <div className="mt-5 rounded-[28px] border border-[#E9E1F4] bg-[#F6F1FB] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:p-5">
              <h2 className="text-center text-[17px] font-extrabold tracking-[-0.02em] text-[#4D406D]">
                Open a Meva by ID
              </h2>

              <div className="mt-4">
                <input
                  type="text"
                  value={mevaId}
                  onChange={handleChange}
                  onBlur={() => setTouched(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter Meva ID"
                  maxLength={12}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className={`h-[62px] w-full rounded-[18px] bg-white px-5 text-[17px] font-medium uppercase tracking-[0.02em] text-[#31205F] outline-none transition placeholder:normal-case placeholder:tracking-normal placeholder:text-[#8E87A3] ${
                    showError
                      ? "border border-[#E49AAA] ring-4 ring-[#F6C8D1]/40"
                      : "border border-[#E8E1F3] focus:border-[#B79CFF] focus:ring-4 focus:ring-[#B79CFF]/20"
                  }`}
                />
              </div>

              <div className="mt-3 text-[14px] leading-6 text-[#8A82A3]">
                <p>Example: P1K8XJ6Z</p>
                <p>Meva IDs are generally on the back of the Meva.</p>
                {showError ? (
                  <p className="mt-1 font-medium text-[#C45C77]">
                    Enter a valid Meva ID using 8–12 letters or numbers.
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleOpenMeva}
                className="mt-5 h-[58px] w-full rounded-[20px] bg-gradient-to-r from-[#B7A2FA] to-[#A994F2] text-[17px] font-extrabold text-white shadow-[0_12px_24px_rgba(171,150,242,0.24)] transition duration-200 hover:scale-[1.01] active:scale-[0.99]"
              >
                Open Meva
              </button>
            </div>
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