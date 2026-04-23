import { useMemo, useState } from "react";

const KIBO_IMAGE_URL =
  "https://firebasestorage.googleapis.com/v0/b/meva-clean.firebasestorage.app/o/mevas%2FKibo%2FKibo.png?alt=media&token=82c12f12-2989-49dc-ae73-59ee0577c3a8";

const MEVA_LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/meva-clean.firebasestorage.app/o/brand%2FLogo.png?alt=media&token=dc0fef03-4c72-4a08-967e-0ffa9b55c39a";

export default function MevaHubPage() {
  const [enteredId, setEnteredId] = useState("");

  const cleanedEnteredId = useMemo(
    () => enteredId.trim().toUpperCase(),
    [enteredId]
  );

  const hasAnyInput = cleanedEnteredId.length > 0;

  const handleEnteredIdChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setEnteredId(value);
  };

  const handleOpenEnteredMeva = () => {
    if (!hasAnyInput) return;
    window.location.href = `/m/${cleanedEnteredId}`;
  };

  const handleEnteredIdKeyDown = (e) => {
    if (e.key === "Enter") {
      handleOpenEnteredMeva();
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#EAF1FB] px-4 py-5 sm:px-5 sm:py-7">
        <div className="mx-auto flex min-h-screen w-full max-w-[470px] items-center justify-center sm:max-w-[500px]">
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

            <div className="mb-4 flex justify-center">
              <div className="rounded-full border border-[#DBDDF0] bg-[#F4F6FD] px-4 py-1 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#6B5C96]">
                Meva Hub
              </div>
            </div>

            <h1 className="mx-auto max-w-[330px] text-center text-[28px] font-black leading-[0.98] tracking-[-0.03em] text-[#30215A] sm:max-w-[380px] sm:text-[35px]">
              Open a Meva page or try feeding the test Meva.
            </h1>

            <p className="mx-auto mt-4 max-w-[350px] text-center text-[15px] leading-7 text-[#766F91] sm:max-w-[390px] sm:text-[17px] sm:leading-8">
              Use the real test Meva to experience the interactive public page,
              or enter a Meva ID to open one directly.
            </p>

            <div className="mt-6 flex justify-center">
              <div className="relative flex h-[146px] w-[146px] items-center justify-center">
                <div className="absolute h-[122px] w-[122px] rounded-full bg-[radial-gradient(circle_at_32%_28%,#F2ECFF_0%,#DDD2FF_38%,#C6C7FF_70%,#AECFFF_100%)]" />
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
                  onKeyDown={handleEnteredIdKeyDown}
                  placeholder="Enter Meva ID"
                  maxLength={12}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-[62px] w-full rounded-[18px] border border-[#D9E1F0] bg-[#FCFDFF] px-5 text-[17px] font-medium uppercase tracking-[0.02em] text-[#31205F] outline-none transition placeholder:normal-case placeholder:tracking-normal placeholder:text-[#8E87A3] focus:border-[#A9B8F8] focus:ring-4 focus:ring-[#A9B8F8]/20"
                />
              </div>

              <div className="mt-3 text-[14px] leading-6 text-[#7E83A0]">
                <p>Example: P1K8XJ6Z</p>
                <p>Meva IDs are generally on the back of the keychain.</p>
              </div>

              <button
                type="button"
                onClick={handleOpenEnteredMeva}
                className={`mt-5 h-[58px] w-full rounded-[20px] text-[17px] font-extrabold text-white transition duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                  hasAnyInput
                    ? "bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4]"
                    : "bg-gradient-to-r from-[#B8A7F4] via-[#A18CF7] to-[#907AF4]"
                }`}
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