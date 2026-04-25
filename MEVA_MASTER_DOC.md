# MEVA PROJECT MASTER DOC (UPDATED)

---

## CORE PRODUCT

Meva is a tap-to-experience collectible platform.

A physical object (keychain/charm) opens a digital interactive Meva page via NFC or QR.

### Core loop:

1. User taps/scans physical Meva
2. Opens `/m/:mevaId`
3. User interacts with Meva
4. User can claim ownership
5. Backend tracks activity securely
6. Leaderboards + future systems use trusted backend data

---

## CURRENT STATUS

### Stable

* Mobile viewing works
* Mobile claim works (CRITICAL)
* Mobile unclaim works (CRITICAL)
* Google sign-in works on mobile
* Desktop viewing works
* Desktop claim/unclaim intentionally disabled
* Cloud Functions handle all protected actions
* Tap tracking exists
* Anti-bot tap protection exists
* Leaderboards (All Time / Weekly / Most Visited)
* Leaderboard name system exists
* Meva nickname system exists
* Waitlist system exists (backend secured)
* Firebase App Check is implemented (reCAPTCHA v3)

---

## SECURITY & APP CHECK (CRITICAL)

### App Check

* Firebase App Check is ACTIVE
* Uses **reCAPTCHA v3 (non-enterprise)**
* Tokens auto-refresh enabled
* Protects:

  * Firestore
  * Cloud Functions


## RECAPTCHA CONFIG (FINAL)

### Using:

* Google Cloud reCAPTCHA v3 (score-based)


### Domains:

* mevacharms.com
* [www.mevacharms.com](http://www.mevacharms.com)
* mevacharm.com
* [www.mevacharm.com](http://www.mevacharm.com)
* meva-rebuild.vercel.app
* localhost


## ENV VARIABLES

### Required (Vercel)

```env
VITE_RECAPTCHA_V3_SITE_KEY=your_site_key_here
```
---

## IMPORTANT RULE

Do not redesign or break the UI unless explicitly asked. Should only be adding to or extending, not changing.

Always:

* preserve layout
* preserve claim/unclaim
* keep mobile-first
* avoid overengineering
* protect backend

---

## FILE TREE

```txt
/
├── functions/
│   └── index.js
│
├── src/
│   ├── firebase.js
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   └── pages/
│       ├── MevaLandingPage.jsx
│       ├── MevaHubPage.jsx
│       ├── MevaPublicPage.jsx
│       └── MevaIdPage.jsx
```

---

## FILE PURPOSES

### /functions/index.js

Backend (SECURITY CRITICAL)

Handles:

* claim/unclaim
* tap tracking
* anti-bot logic
* leaderboard
* nickname
* waitlist submission

---

### /src/firebase.js

Handles:

* Firebase init
* Auth
* Firestore
* Functions
* App Check

Must include:

```js
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(
    import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY
  ),
  isTokenAutoRefreshEnabled: true,
});
```

---

## CLAIM / UNCLAIM SYSTEM

### Mobile (CRITICAL)

* Works fully
* Must NEVER break

### Desktop

* Disabled intentionally
* Shows message instead

---

## DESKTOP VS MOBILE RULE

### Mobile:

* Full functionality
* Counts taps

### Desktop:

* View only
* No claim/unclaim
* No leaderboard tap contribution

### REQUIRED UI (pending):

> “Only phone/tablet taps count toward feeding and leaderboards.”

---

## BACKEND SECURITY RULES

### NEVER allow frontend to write:

* ownership
* leaderboard
* taps
* waitlist
* user identity

ALL must go through Cloud Functions.

---

## WAITLIST SYSTEM

### Flow:

1. User submits form
2. Calls `submitEarlyAccess`
3. Backend:

   * validates
   * blocks duplicates
   * rate limits
   * stores data

---

## FIRESTORE COLLECTIONS

### mevas

* Meva data

### mevaClaims

* Ownership

### users

* Profiles + leaderboard identity

### mevaEvents

* Event logs

### mevaTapGuards

* Anti-bot

### mevaLeaderboardAllTime

### mevaLeaderboardWeekly

---

### NEW: earlyAccess

* email
* name
* createdAt

---

### NEW: earlyAccessRateLimits

* emailHash
* lastSubmitAt

---

### NEW: earlyAccessIpRateLimits

* ipHash
* lastSubmitAt

---

## TAP TRACKING

Events:

* tap
* feed
* hold
* drag
* menu
* claim/unclaim

Backend decides valid taps.

---

## ANTI-BOT SYSTEM

Checks:

* device type
* timing patterns
* session validity

Frontend animates ALL taps
Backend decides what counts

---

## LEADERBOARD SYSTEM

Types:

* All Time
* Weekly

Rules:

* Only claimed users show
* Fast load required
* Backend stores names

---

## LEADERBOARD NAME SYSTEM

Rules:

* 3–12 chars
* alphanumeric
* cooldown (14 days)
* one free change

---

## MEVA NICKNAME SYSTEM

* Owner only
* Stored on Meva
* fallback: "Kibo"

---

## DESIGN RULES

* minimal
* emotional
* soft
* clean
* mobile-first
* no clutter

---

## MAIN PAGE RULES

Must fit:

* iPhone 14 screen
* no scroll

---

## CURRENT ROADMAP

### Immediate

* verify UI
* fix spacing
* confirm claim/unclaim

### Next

* collection system
* multi-meva screen
* better drag
* hold interactions

### Later

* cosmetics
* themes
* collabs
* NFC unlock features

---

## DEV RULES

Always:

* protect backend
* mobile first
* simple code

Never:

* break claim/unclaim
* move logic to frontend
* redesign UI randomly


## CLEAN CHECKPOINT SUMMARY

You now have:

* secure backend
* App Check protection
* working claim system
* anti-bot logic
* waitlist secured
* leaderboards
* mobile-first UX

### MOST IMPORTANT

* Do NOT break mobile claim/unclaim
* Do NOT remove App Check
* Do NOT move backend logic to frontend
* Keep Meva minimal + emotional

---

END OF MASTER DOC
