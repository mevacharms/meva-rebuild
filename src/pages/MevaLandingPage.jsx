import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function MevaLandingPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      setSubmitError("Please enter your name and email.");
      return;
    }

    if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      setSubmitError("Please enter a valid email address.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");
      setIsSuccess(false);

      await addDoc(collection(db, "earlyAccess"), {
        name: trimmedName,
        email: trimmedEmail,
        source: "landing-page",
        createdAt: serverTimestamp(),
      });

      setIsSuccess(true);
      setName("");
      setEmail("");
    } catch (error) {
      console.error("Error joining early access:", error);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#eef5ff] text-[#574a6d]">
      <style>{`
        @keyframes float {
          0% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0); }
        }
      `}</style>

      <div className="relative mx-auto min-h-screen max-w-[1600px] overflow-hidden px-5 pb-14 pt-5 sm:px-8 sm:pb-20 sm:pt-7 md:px-10 lg:px-12">
        {/* soft background glows */}
        <div className="pointer-events-none absolute left-[-2%] top-[8%] h-28 w-28 rounded-full bg-white/30 blur-2xl sm:h-40 sm:w-40 md:h-52 md:w-52" />
        <div className="pointer-events-none absolute right-[8%] top-[16%] h-24 w-24 rounded-full bg-white/25 blur-2xl sm:h-32 sm:w-32 md:h-44 md:w-44" />
        <div className="pointer-events-none absolute bottom-[10%] right-[-1%] h-28 w-28 rounded-full bg-white/25 blur-2xl sm:h-40 sm:w-40 md:h-52 md:w-52" />

        <header className="mx-auto flex w-full max-w-[1180px] items-center justify-center lg:justify-start">
          <div className="rounded-full bg-white/85 px-6 py-3 text-lg font-extrabold tracking-tight text-[#7c68ff] shadow-[0_10px_30px_rgba(148,163,184,0.08)] sm:px-7 sm:text-xl">
            meva
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1180px] flex-col items-center pt-7 text-center sm:pt-9 md:pt-10">
          {/* hero circle */}
          <div
            className="
              mb-6 flex h-[138px] w-[138px] items-center justify-center rounded-full
              bg-[radial-gradient(circle_at_36%_30%,#ddd1ff_0%,#d4c7ff_28%,#c8bcff_55%,#b6c6ff_100%)]
              shadow-[0_22px_56px_rgba(132,116,234,0.16)]
              ring-[1px] ring-white/35
              transition-transform duration-300 md:hover:scale-[1.03]
              sm:mb-7 sm:h-[162px] sm:w-[162px]
              md:h-[188px] md:w-[188px]
            "
          >
            <img
              src="https://firebasestorage.googleapis.com/v0/b/meva-clean.firebasestorage.app/o/mevas%2FKibo%2FKibo.png?alt=media&token=82c12f12-2989-49dc-ae73-59ee0577c3a8"
              alt="Meva character"
              className="h-[72%] w-[72%] object-contain drop-shadow-[0_6px_16px_rgba(87,74,109,0.14)] animate-[float_3.4s_ease-in-out_infinite]"
            />
          </div>

          <div className="max-w-[780px]">
            <h1 className="font-black leading-[0.96] tracking-[-0.05em] text-[#574a6d] text-[2.45rem] sm:text-[3rem] md:text-[3.8rem] lg:text-[4.35rem]">
              <span className="block sm:hidden">A tiny charm</span>
              <span className="block sm:hidden">that comes to life.</span>

              <span className="hidden sm:block">A tiny charm that</span>
              <span className="hidden sm:block">comes to life.</span>
            </h1>

            <p className="mx-auto mt-4 max-w-[560px] text-sm font-medium leading-relaxed text-[#726682] sm:text-base md:text-[1.05rem]">
              Not an app. Not just a toy.
            </p>

            <p className="mx-auto mt-4 max-w-[660px] text-sm leading-relaxed text-[#7f7496] sm:text-base md:text-[1.1rem]">
              A small companion you can interact with — in real life and on your phone.
            </p>

            <p className="mx-auto mt-5 max-w-[560px] text-xs font-semibold tracking-[0.02em] text-[#9488ac] sm:text-sm">
              First drop is limited. Early supporters get the first look.
            </p>
          </div>

          <div className="mt-7 flex w-full max-w-[520px] flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a
              href="#early-access"
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#baa7ff] to-[#836cff] px-6 text-sm font-extrabold text-white shadow-[0_14px_32px_rgba(124,104,255,0.22)] transition duration-200 hover:-translate-y-0.5 sm:h-13 sm:flex-1 sm:text-base"
            >
              Join early access
            </a>

            <a
              href="https://instagram.com/mevacharms"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-full border border-[#d8d0f3] bg-white/55 px-5 text-xs font-semibold text-[#7f73a1] transition duration-200 hover:bg-white/70 sm:h-12 sm:min-w-[190px] sm:text-sm"
            >
              Follow the journey
            </a>
          </div>

          <section className="mt-7 w-full max-w-[560px] px-1 sm:mt-8">
            <div className="rounded-[1.2rem] border border-white/60 bg-white/38 px-4 py-3 text-center shadow-[0_12px_28px_rgba(140,153,180,0.08)] backdrop-blur-[8px] sm:rounded-[1.4rem] sm:px-5 sm:py-4">
              <p className="mx-auto max-w-[520px] text-balance text-sm font-medium leading-relaxed text-[#786d8f] sm:text-base">
                Tap in real life. Interact on your phone.
              </p>
            </div>
          </section>

          <section
            id="early-access"
            className="mt-9 w-full max-w-[680px] rounded-[1.5rem] border border-white/55 bg-[rgba(255,255,255,0.42)] px-4 py-6 shadow-[0_18px_45px_rgba(140,153,180,0.10)] backdrop-blur-[8px] sm:mt-10 sm:rounded-[1.9rem] sm:px-6 sm:py-8 md:px-8 md:py-9"
          >
            <div className="mx-auto max-w-[560px] text-center">
              <h2 className="text-[1.8rem] font-black tracking-[-0.04em] text-[#574a6d] sm:text-[2.15rem] md:text-[2.5rem]">
                Join early access
              </h2>

              <p className="mx-auto mt-3 max-w-[520px] text-balance text-sm leading-relaxed text-[#7d7295] sm:text-base">
                Be first to hear when Meva launches and when the first drop opens.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mx-auto mt-6 flex max-w-[560px] flex-col gap-4 sm:mt-7">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSubmitError("");
                }}
                placeholder="What should we call you?"
                autoComplete="name"
                className="h-13 rounded-[1rem] border border-[#e5def8] bg-white/85 px-4 text-[15px] text-[#574a6d] outline-none placeholder:text-[#938aa6] focus:border-[#baa7ff] focus:ring-4 focus:ring-[#cfc3ff]/30 sm:h-14 sm:px-5 sm:text-base"
              />

              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSubmitError("");
                }}
                placeholder="Email"
                autoComplete="email"
                inputMode="email"
                className="h-13 rounded-[1rem] border border-[#e5def8] bg-white/85 px-4 text-[15px] text-[#574a6d] outline-none placeholder:text-[#938aa6] focus:border-[#baa7ff] focus:ring-4 focus:ring-[#cfc3ff]/30 sm:h-14 sm:px-5 sm:text-base"
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-13 items-center justify-center rounded-[1rem] bg-gradient-to-r from-[#baa7ff] to-[#836cff] px-6 text-[15px] font-extrabold text-white shadow-[0_16px_34px_rgba(124,104,255,0.22)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(124,104,255,0.28)] disabled:cursor-not-allowed disabled:opacity-70 sm:h-14 sm:text-base"
              >
                {isSubmitting ? "Joining..." : "Join waitlist"}
              </button>

              {submitError ? (
                <p className="text-center text-sm font-semibold text-[#c2577c]">
                  {submitError}
                </p>
              ) : null}

              {isSuccess ? (
                <div className="rounded-[1rem] border border-[#ddd4ff] bg-white/70 px-4 py-3 text-center shadow-[0_10px_24px_rgba(140,153,180,0.06)]">
                  <p className="text-sm font-bold text-[#625777] sm:text-base">
                    You’re in. We’ll let you know when Meva opens early access.
                  </p>
                </div>
              ) : null}
            </form>

            <p className="mt-5 text-center text-sm font-extrabold text-[#8b79f0] sm:text-base">
              Limited first drop coming soon.
            </p>
          </section>

          <footer className="mt-8 pb-3 text-center sm:mt-9">
            <p className="text-sm text-[#6f6487] sm:text-base">
              Questions? DM us on Instagram
            </p>

            <a
              href="https://instagram.com/mevacharms"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-lg font-black text-[#7d69ff] transition hover:opacity-85 sm:text-[1.4rem]"
            >
              @mevacharms
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}