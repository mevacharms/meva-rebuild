import { useEffect } from "react";

const MEVA_LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/meva-clean.firebasestorage.app/o/brand%2FLogo.png?alt=media&token=dc0fef03-4c72-4a08-967e-0ffa9b55c39a";

const KIBO_IMAGE_URL =
  "https://firebasestorage.googleapis.com/v0/b/meva-clean.firebasestorage.app/o/mevas%2FKibo%2FKibo.png?alt=media&token=82c12f12-2989-49dc-ae73-59ee0577c3a8";

export default function MevaLandingPage() {
  useEffect(() => {
    // optional: future animations or preload
  }, []);

  return (
    <>
      <div className="min-h-screen bg-[#EAF1FB] px-4 py-6">
        <div className="mx-auto flex min-h-screen w-full max-w-[470px] items-center justify-center">
          <div className="relative w-full rounded-[34px] border border-white/80 bg-[#F7FAFF] px-6 pb-6 pt-10 shadow-[0_20px_70px_rgba(95,72,150,0.08)]">
            
            {/* Logo */}
            <div className="absolute -left-[12px] -top-[12px]">
              <img
                src={MEVA_LOGO_URL}
                alt="Meva logo"
                className="h-[110px] w-auto object-contain"
                draggable="false"
              />
            </div>

            {/* Title */}
            <h1 className="mx-auto max-w-[300px] text-center text-[32px] font-black leading-[1.05] tracking-[-0.03em] text-[#30215A]">
              Bring your Meva to life.
            </h1>

            {/* Subtitle */}
            <p className="mx-auto mt-4 max-w-[320px] text-center text-[16px] leading-7 text-[#766F91]">
              Tap, interact, and experience your Meva in real time.
            </p>

            {/* Kibo */}
            <div className="mt-8 flex justify-center">
              <div className="relative flex h-[160px] w-[160px] items-center justify-center">
                <div className="absolute h-[130px] w-[130px] rounded-full bg-[radial-gradient(circle_at_32%_28%,#F2ECFF_0%,#DDD2FF_38%,#C6C7FF_70%,#AECFFF_100%)]" />
                <img
                  src={KIBO_IMAGE_URL}
                  alt="Kibo"
                  className="relative z-10 h-[115px] w-auto object-contain"
                  draggable="false"
                  style={{
                    animation: "mevaFloat 3.6s ease-in-out infinite",
                  }}
                />
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => {
                window.location.href = "/m";
              }}
              className="mt-8 h-[60px] w-full rounded-[20px] bg-gradient-to-r from-[#A894F0] via-[#8D76F6] to-[#7E66F4] text-[18px] font-extrabold text-white transition duration-200 hover:scale-[1.01] active:scale-[0.99]"
            >
              Enter Meva
            </button>

            {/* Secondary text */}
            <p className="mt-4 text-center text-[14px] text-[#8A82A3]">
              Already have a Meva? Open it inside.
            </p>
          </div>
        </div>
      </div>

      {/* Floating animation */}
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