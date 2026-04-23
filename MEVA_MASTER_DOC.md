MEVA MASTER DOC — CURRENT SOURCE OF TRUTH
Core rules for this project
Mobile-first always.
Prioritize in this order: iPhone 14, Samsung S24 Ultra, Tablet, Desktop.
Keep the visual style soft, minimal, premium, and centered.
Do not redesign the brand direction unless explicitly asked.
Keep code simple and beginner-friendly.
Do not break imports.
When changing files, preserve existing imports unless a real update is needed.
Keep route handling simple unless React Router is explicitly requested later.
---
Current app structure
```text
MEVA-REBUILD/
  public/
  src/
    assets/
    pages/
      MevaLandingPage.jsx
      MevaPublicPage.jsx
    App.css
    App.jsx
    firebase.js
    index.css
    main.jsx
  .env.local
  .gitignore
  eslint.config.js
  index.html
  package-lock.json
  package.json
  README.md
  vercel.json
  vite.config.js
```
---
What each file does
`src/App.jsx`
Main route switcher for the app.
Current purpose:
`/` → `MevaLandingPage`
`/m` → `MevaPublicPage`
`/m/test` and `/m/:id` → `MevaPublicPage`
Important:
This file must contain React code.
Do not accidentally paste React code into `App.css`.
Typical structure:
```jsx
import MevaLandingPage from "./pages/MevaLandingPage";
import MevaPublicPage from "./pages/MevaPublicPage";

export default function App() {
  const rawPath = window.location.pathname;
  const path =
    rawPath.length > 1 && rawPath.endsWith("/")
      ? rawPath.slice(0, -1)
      : rawPath;

  if (path === "/m" || path.startsWith("/m/")) {
    return <MevaPublicPage />;
  }

  return <MevaLandingPage />;
}
```
`src/pages/MevaLandingPage.jsx`
Soft launch / waitlist landing page.
Current purpose:
teaser page
early access form
brand intro
waitlist signup flow
Important:
This is the marketing / intro page at `/`
It should not contain Meva routing logic
It should not import itself or `MevaPublicPage`
`src/pages/MevaPublicPage.jsx`
Main Meva app shell.
Current purpose:
handles `/m`
handles `/m/test`
handles `/m/P1K8XJ6Z` style routes
reads from Firestore collection `mevas`
shows loading state
shows not found state
shows placeholder public Meva content for now
also acts as the Meva entry page when the route is exactly `/m`
`src/firebase.js`
Firebase app + Firestore setup.
Current purpose:
initialize Firebase
export `db`
Current structure should remain like this:
```jsx
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default app;
export { db };
```
`src/main.jsx`
React app entry file.
Typical structure:
```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```
`src/index.css`
Global CSS / Tailwind base styling.
`src/App.css`
Should not contain React code.
Keep minimal or empty if not needed.
`vercel.json`
Required so deep links work on Vercel.
Current purpose:
allow direct visits to `/m`
allow direct visits to `/m/test`
allow direct visits to `/m/:id`
Structure:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
---
Current route map
Landing
`/`
Meva
`/m`
`/m/test`
`/m/P1K8XJ6Z`
`/m/<REAL_ID>`
---
Current Firestore rules direction
Current known rule pattern:
`mevas/{mevaId}` is readable publicly
writes are blocked for now
Example rule direction:
```jsx
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /mevas/{mevaId} {
      allow read: if true;
      allow write: if false;
    }

    match /earlyAccess/{entryId} {
      allow create: if true;
      allow read, update, delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```
---
Current branding / UI direction
Visual direction
soft, premium, calm
minimal clutter
centered layout
mobile first
light blue page background that matches the landing page direction
white / very pale blue card background
purple CTA buttons in the same general family as the landing page CTA
Current Meva styling direction
page background should lean soft blue, not heavy purple
card background should feel airy and slightly blue-tinted rather than pure white
Kibo circle should stay clean with no muddy shadow
logo is inside the card in the top-left area
logo on mobile should be larger than earlier versions
Current logo preference
keep logo near the top-left area inside the card
do not place it floating above the card
do not overlap headline
current adjustment preference was:
larger on mobile
a bit more top and left on mobile
Current wording preference
section title: `Open a Meva by ID`
primary button under input: `Open Meva`
test button: `Feed the Test Meva`
Current navigation preference
logo inside Meva pages should route to `/m`
back buttons inside Meva pages should route to `/m`
all Meva navigation should stay within the `/m` system
---
Current Meva asset URLs
Kibo image
```text
https://firebasestorage.googleapis.com/v0/b/meva-clean.firebasestorage.app/o/mevas%2FKibo%2FKibo.png?alt=media&token=82c12f12-2989-49dc-ae73-59ee0577c3a8
```
Meva logo
```text
https://firebasestorage.googleapis.com/v0/b/meva-clean.firebasestorage.app/o/brand%2FLogo.png?alt=media&token=dc0fef03-4c72-4a08-967e-0ffa9b55c39a
```
---
Current MevaPublicPage responsibilities
`MevaPublicPage.jsx` should currently do all of this:
detect Meva ID from URL path
support `/m` as the Meva entry page
support `/m/test`
support real Meva IDs
validate real ID pattern
load real documents from Firestore using:
```jsx
const mevaRef = doc(db, "mevas", mevaId);
const mevaSnap = await getDoc(mevaRef);
```
show loading state
show error state
show not found state
show placeholder / basic content for now
allow opening Meva pages by entered ID from the `/m` screen
Current page states
root Meva entry page
loading
firestore error
not found
valid loaded Meva
Current display fallback logic
display `nickname (realName)` if both exist
otherwise show nickname
otherwise show realName
otherwise show fallback name
---
Current imports that must stay correct
`src/App.jsx`
```jsx
import MevaLandingPage from "./pages/MevaLandingPage";
import MevaPublicPage from "./pages/MevaPublicPage";
```
`src/pages/MevaPublicPage.jsx`
```jsx
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
```
`src/main.jsx`
```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
```
`src/firebase.js`
```jsx
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
```
---
Important mistakes to avoid
1. Do not paste JSX into `App.css`
React code belongs in `.jsx` files only.
2. Do not break import paths
Use exact file names:
`./pages/MevaLandingPage`
`./pages/MevaPublicPage`
`../firebase`
3. Do not rename files casually
Only rename if the project is being intentionally reorganized.
4. Do not remove `vercel.json`
Without it, deep links on Vercel can 404.
5. Do not make desktop drive layout decisions
Phone-first always.
6. Keep the Meva entry page and public page visually consistent
Same general shell, spacing language, color family, and rounded card style.
7. Do not add separate Meva entry routing outside `/m`
The Meva system should stay unified under:
`/m`
`/m/test`
`/m/<REAL_ID>`
---
How to preview locally
Run:
```bash
npm run dev
```
Then open:
```text
http://localhost:5173/
http://localhost:5173/m
http://localhost:5173/m/test
http://localhost:5173/m/P1K8XJ6Z
```
---
How to preview online
After deploy:
```text
https://meva-rebuild.vercel.app/
https://meva-rebuild.vercel.app/m
https://meva-rebuild.vercel.app/m/test
https://meva-rebuild.vercel.app/m/P1K8XJ6Z
```
---
Current status summary
Working / established
landing page exists
Meva entry page exists at `/m`
public Meva page exists
simple path-based routing exists
Vercel rewrite solution exists
Firestore config exists
Firestore reads are wired into `MevaPublicPage`
branding direction is established
logo placement direction is established
test Meva route is established
Still in progress / being polished
exact final Meva button purple tone
exact final logo size and top-left offset on mobile
exact final card/background tone matching landing page perfectly
real interactive Meva experience on `/m/test`
upgraded real Meva page content beyond placeholder data
---
What we need to do next
Highest priority next step
Upgrade `/m/test` into the real interactive test Meva page
make it feel like the interactive mockup
add feed / react / personality behavior
keep the current shell and brand styling
After that
Upgrade the real public Meva page
render actual Meva fields from Firestore
add image support if stored in Firestore
show real nickname / realName / owner state
show any future public metadata cleanly
Then
Add the actual interaction layer
tap/interact button behavior
public-safe interaction tracking
backend-controlled writes later
Then
Add stronger backend architecture
Cloud Functions for protected writes
remove sensitive client-side write paths
secure ownership-related actions
Then
Build claim / rename / leaderboard systems
claim flow
rename cooldown
owner vs visitor logic
leaderboard expansion later
---
Recommended near-term implementation order
Final `/m/test` interaction layer
Final public page shell polish
Firestore field rendering on public page
Public interaction write flow design
Backend-protected Cloud Functions
Claim system
Event tracking / analytics
Leaderboards
---
Beginner-safe workflow notes
When editing:
save files before testing
if styles do not seem updated, hard refresh browser
if Vite acts stale, restart dev server
if a deep route 404s online, verify `vercel.json` is still present
When something breaks:
check file extension is `.jsx`
check imports first
check if code accidentally went into `App.css`
check browser console and terminal for exact line number
---
Git workflow preference
Use grouped commits for each meaningful change.
Typical pattern:
```bash
git add src/App.jsx src/pages/MevaPublicPage.jsx vercel.json
git commit -m "Describe the change clearly"
git push
```
---
Current system summary
The Meva app is now structured as one unified flow:
`/` = landing page
`/m` = Meva entry page
`/m/test` = test Meva experience
`/m/<REAL_ID>` = public Meva pages
`MevaPublicPage.jsx` is now the single Meva app shell and should remain the central file for Meva route behavior unless the app is intentionally re-architected later.