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
    <div className="min-h-screen overflow-x-hidden bg-[#eaf2ff] text-[#574a6d]">
      <div className="relative mx-auto min-h-screen max-w-[1600px] px-5 pb-16 pt-6 sm:px-8 sm:pb-24 sm:pt-8">
        <div className="pointer-events-none absolute left-[3%] top-[10%] h-28 w-28 rounded-full bg-white/35 blur-2xl sm:h-44 sm:w-44" />
        <div className="pointer-events-none absolute right-[10%] top-[16%] h-24 w-24 rounded-full bg-white/30 blur-2xl sm:h-36 sm:w-36" />
        <div className="pointer-events-none absolute bottom-[10%] right-[2%] h-28 w-28 rounded-full bg-white/30 blur-2xl sm:h-44 sm:w-44" />

        <header className="mx-auto flex w-full max-w-[1180px] items-center justify-center lg:justify-start">
          <div className="rounded-full bg-white px-7 py-3 text-xl font-extrabold tracking-tight text-[#7c68ff] shadow-[0_12px_35px_rgba(148,163,184,0.12)]">
            meva
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1180px] flex-col items-center pt-10 text-center sm:pt-14 lg:pt-16">
          <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#d8ccff, #a9c4ff_60%, #9aaeff)] shadow-[0_20px_60px_rgba(124,104,255,0.25)] sm:mb-8 sm:h-36 sm:w-36 md:h-44 md:w-44">
            <img
              src="https://firebasestorage.googleapis.com/v0/b/meva-clean.firebasestorage.app/o/mevas%2FKibo%2FKibo.png?alt=media&token=82c12f12-2989-49dc-ae73-59ee0577c3a8"
              alt="Meva character"
              className="h-[72%] w-[72%] object-contain drop-shadow-[0_4px_12px_rgba(87,74,109,0.15)]"
            />
          </div>

          <div className="max-w-[980px]">
            <h1 className="font-black leading-[1.02] tracking-[-0.04em] text-[#544668] text-[1.9rem] sm:text-[2.6rem] md:text-[3.2rem] lg:text-[3.8rem]">
              <span className="block sm:hidden">A tiny charm</span>
              <span className="block sm:hidden">that comes to life.</span>
              <span className="hidden sm:block">A tiny charm that comes to life</span>
            </h1>

            <p className="mx-auto mt-4 max-w-[520px] text-balance text-sm font-medium leading-relaxed text-[#706381] sm:text-base md:text-lg">
              Not an app. Not just a toy.
            </p>

            <p className="mx-auto mt-5 max-w-[620px] text-balance text-sm leading-relaxed text-[#7b6f92] sm:text-base md:text-lg">
              A small companion you can interact with — in real life and on your phone.
            </p>

            <p className="mx-auto mt-6 max-w-[520px] text-balance text-xs font-semibold tracking-[0.02em] text-[#9386ab] sm:text-sm">
              First drop is limited. Early supporters get the first look.
            </p>
          </div>

          <div className="mt-7 flex w-full max-w-[520px] flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a
              href="#early-access"
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#baa7ff] to-[#836cff] px-6 text-sm font-extrabold text-white shadow-[0_16px_35px_rgba(124,104,255,0.28)] transition duration-200 hover:-translate-y-0.5 sm:h-14 sm:flex-1 sm:text-base"
            >
              Join early access
            </a>

            <a
              href="https://instagram.com/mevacharms"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-full border border-[#cfc4f3] bg-white/55 px-5 text-xs font-semibold text-[#7f73a1] transition duration-200 hover:bg-white/75 sm:h-12 sm:text-sm"
            >
              Follow the journey
            </a>
          </div>

          <div className="mt-12 h-px w-full max-w-[980px] bg-gradient-to-r from-transparent via-[#c8bcf3] to-transparent sm:mt-14" />

          <section className="mt-10 w-full max-w-[980px] px-1 sm:mt-12">
            <div className="mx-auto max-w-[760px] text-center">
              <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#8b79f0] sm:text-base">
                How it works
              </p>
              <h2 className="mt-3 text-[2.05rem] font-black tracking-[-0.04em] text-[#544668] sm:text-[3rem]">
                Tap. Meet. Collect.
              </h2>
              <p className="mx-auto mt-4 max-w-[700px] text-balance text-base leading-relaxed text-[#796d91] sm:text-[1.2rem]">
                A Meva starts as a real charm you can carry, then opens a tiny interactive experience on your phone.
              </p>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-3 sm:mt-8 md:grid-cols-3 md:gap-4">
              <div className="rounded-[1.5rem] border border-white/60 bg-white/40 px-4 py-5 text-center shadow-[0_16px_35px_rgba(140,153,180,0.10)] backdrop-blur-[8px] sm:rounded-[2rem] sm:px-6 sm:py-7">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#c9bcff] to-[#9db8ff] text-sm font-black text-white shadow-[0_10px_25px_rgba(124,104,255,0.22)] sm:h-12 sm:w-12 sm:text-lg">
                  1
                </div>
                <h3 className="mt-4 text-xl font-black tracking-[-0.03em] text-[#544668] sm:mt-5 sm:text-2xl">
                  Tap
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#7a6e92] sm:mt-3 sm:text-base">
                  Scan or tap your Meva to open its page instantly.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/60 bg-white/40 px-4 py-5 text-center shadow-[0_16px_35px_rgba(140,153,180,0.10)] backdrop-blur-[8px] sm:rounded-[2rem] sm:px-6 sm:py-7">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#c9bcff] to-[#9db8ff] text-sm font-black text-white shadow-[0_10px_25px_rgba(124,104,255,0.22)] sm:h-12 sm:w-12 sm:text-lg">
                  2
                </div>
                <h3 className="mt-4 text-xl font-black tracking-[-0.03em] text-[#544668] sm:mt-5 sm:text-2xl">
                  Meet
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#7a6e92] sm:mt-3 sm:text-base">
                  Interact with your tiny companion right on your phone.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/60 bg-white/40 px-4 py-5 text-center shadow-[0_16px_35px_rgba(140,153,180,0.10)] backdrop-blur-[8px] sm:rounded-[2rem] sm:px-6 sm:py-7">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#c9bcff] to-[#9db8ff] text-sm font-black text-white shadow-[0_10px_25px_rgba(124,104,255,0.22)] sm:h-12 sm:w-12 sm:text-lg">
                  3
                </div>
                <h3 className="mt-4 text-xl font-black tracking-[-0.03em] text-[#544668] sm:mt-5 sm:text-2xl">
                  Collect
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#7a6e92] sm:mt-3 sm:text-base">
                  Claim it, name it, and grow your collection over time.
                </p>
              </div>
            </div>
          </section>

          <section
            id="early-access"
            className="mt-10 w-full max-w-[980px] rounded-[1.75rem] border border-white/55 bg-[rgba(255,255,255,0.42)] px-4 py-6 shadow-[0_20px_50px_rgba(140,153,180,0.12)] backdrop-blur-[8px] sm:mt-12 sm:rounded-[2.25rem] sm:px-8 sm:py-10 lg:px-12 lg:py-12"
          >
            <div className="mx-auto max-w-[760px] text-center">
              <h2 className="text-[1.9rem] font-black tracking-[-0.04em] text-[#544668] sm:text-[2.5rem] md:text-[3rem]">
                Join early access
              </h2>
              <p className="mx-auto mt-3 max-w-[560px] text-balance text-sm leading-relaxed text-[#796d91] sm:mt-4 sm:text-base md:text-[1.15rem]">
                Be first to hear when Meva launches and when the first drop opens.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mx-auto mt-6 flex max-w-[760px] flex-col gap-4 sm:mt-8 sm:gap-5">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
                autoComplete="name"
                className="h-14 rounded-[1.2rem] border border-[#e0daf4] bg-white/85 px-5 text-base text-[#544668] outline-none placeholder:text-[#8f879f] focus:border-[#baa7ff] focus:ring-4 focus:ring-[#cfc3ff]/35 sm:h-16 sm:rounded-[1.4rem] sm:px-6 sm:text-[1.05rem]"
              />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                inputMode="email"
                className="h-14 rounded-[1.2rem] border border-[#e0daf4] bg-white/85 px-5 text-base text-[#544668] outline-none placeholder:text-[#8f879f] focus:border-[#baa7ff] focus:ring-4 focus:ring-[#cfc3ff]/35 sm:h-16 sm:rounded-[1.4rem] sm:px-6 sm:text-[1.05rem]"
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 inline-flex h-14 items-center justify-center rounded-[1.2rem] bg-gradient-to-r from-[#baa7ff] to-[#836cff] px-6 text-base font-extrabold text-white shadow-[0_16px_35px_rgba(124,104,255,0.28)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(124,104,255,0.33)] disabled:cursor-not-allowed disabled:opacity-70 sm:h-16 sm:rounded-[1.4rem] sm:text-[1.15rem]"
              >
                {isSubmitting ? "Joining..." : "Join waitlist"}
              </button>
            {submitError ? (
                <p className="-mt-1 text-center text-sm font-semibold text-[#c2577c] sm:text-base">
                  {submitError}
                </p>
              ) : null}

              {isSuccess ? (
                <div className="rounded-[1.6rem] border border-[#d9d0ff] bg-white/70 px-5 py-4 text-center shadow-[0_16px_35px_rgba(140,153,180,0.08)]">
                  <p className="text-base font-bold text-[#5f5276] sm:text-lg">
                    You’re in. We’ll let you know when Meva opens early access.
                  </p>
                </div>
              ) : null}
            </form>

            <p className="mt-5 text-center text-base font-extrabold text-[#8b79f0] sm:mt-6 sm:text-[1.25rem]">
              Limited first drop coming soon.
            </p>
          </section>

          <footer className="mt-8 text-center sm:mt-10">
            <p className="text-sm text-[#675b7f] sm:text-base">Questions? DM us on Instagram</p>
            <a
              href="https://instagram.com/mevacharms"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xl font-black text-[#7d69ff] transition hover:opacity-85 sm:mt-4 sm:text-[1.6rem]"
            >
              @mevacharms
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
