const KIBO_IMAGE_URL =
  "https://firebasestorage.googleapis.com/v0/b/meva-clean.firebasestorage.app/o/mevas%2FKibo%2FKibo.png?alt=media&token=82c12f12-2989-49dc-ae73-59ee0577c3a8";

function getMevaIdFromPath() {
  const path = window.location.pathname;
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
  const isValidPage = isTestMeva || isValidRealId;

  return (
    <div className="min-h-screen bg-[#F5F0FB] px-4 py-4 sm:px-5 sm:py-5">
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <a
          href="/hub"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#CDAEFF] via-[#B3B7FF] to-[#8FD6FF] shadow-[0_12px_30px_rgba(137,111,201,0.20)] ring-1 ring-white/70"
          aria-label="Go to Meva hub"
        >
          <span className="text-sm font-black italic tracking-tight text-white">
            meva
          </span>
        </a>
      </div>

      <div className="mx-auto flex min-h-screen max-w-[430px] items-center justify-center">
        <div className="w-full rounded-[34px] border border-white/80 bg-[#FFFDFE] px-5 pb-6 pt-6 shadow-[0_20px_70px_rgba(95,72,150,0.11)] sm:px-6 sm:pt-7">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full border border-[#E9E0F7] bg-[#FBF8FF] px-4 py-1 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#6B5C96]">
              {isTestMeva ? "Test Meva" : "Public Meva Page"}
            </div>
          </div>

          <div className="mt-2 flex justify-center">
            <div className="relative flex h-[150px] w-[150px] items-center justify-center">
              <div className="absolute h-[138px] w-[138px] rounded-full bg-[#CDBBFF]/18 blur-md" />
              <div className="absolute h-[126px] w-[126px] rounded-full bg-[radial-gradient(circle_at_32%_28%,#F8F2FF_0%,#E7D8FF_34%,#BEBEFF_68%,#9BCFFF_100%)] shadow-[0_14px_30px_rgba(159,138,228,0.22)]" />
              <img
                src={KIBO_IMAGE_URL}
                alt="Kibo"
                draggable="false"
                className="relative z-10 h-[112px] w-auto select-none object-contain drop-shadow-[0_8px_14px_rgba(90,66,135,0.10)]"
              />
            </div>
          </div>

          {isValidPage ? (
            <>
              <h1 className="mx-auto mt-5 max-w-[320px] text-center text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-[#30215A] sm:text-[34px]">
                {isTestMeva ? "This is the test Meva." : "This Meva page is live."}
              </h1>

              <p className="mx-auto mt-4 max-w-[330px] text-center text-[15px] leading-8 text-[#766F91] sm:text-[17px]">
                {isTestMeva
                  ? "You can use this page to test the public Meva experience before connecting real Mevas."
                  : "You’ve opened a real Meva page. This is the placeholder public page until we build the full interaction layer."}
              </p>

              <div className="mt-6 rounded-[26px] border border-[#E9E1F4] bg-[#F6F1FB] p-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#8A82A3]">
                  Meva ID
                </p>
                <p className="mt-2 break-all text-[24px] font-black tracking-[0.08em] text-[#31205F]">
                  {mevaId}
                </p>
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
                  Back to Meva Hub
                </a>
              </div>
            </>
          ) : (
            <>
              <h1 className="mx-auto mt-5 max-w-[320px] text-center text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-[#30215A] sm:text-[34px]">
                Meva page not found.
              </h1>

              <p className="mx-auto mt-4 max-w-[330px] text-center text-[15px] leading-8 text-[#766F91] sm:text-[17px]">
                This Meva ID does not look valid yet. Check the code on the back
                of the Meva and try again.
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
                  Go to Meva Hub
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}