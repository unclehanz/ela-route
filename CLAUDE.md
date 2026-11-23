# ELA Route

Caregiver dispatch tool (React + Vite; Firebase Auth + Firestore for sign-in and data, no other backend).

UI style profile: friendly (rounded radius scale 4/8/12/16/24; console layout kept with compact 40px table rows)

- Visual direction: "dispatch console" — dense, precise, hairline borders, heavy Manrope (500 body, 700 labels, 800 headings and figures, tabular numbers).
- Follow the UI Guidelines skill (light/dark, footer component), except the brand colour: the user chose a pink theme (2026-11-21). Brand tokens in src/index.css are pink (#c2185b / #ad1457 / #880e4f; dark-mode accent #f48fb1) — keep them pink, not the skill's blue.
- Free services only: OpenStreetMap tiles, Nominatim/Photon geocoding, OSRM routing, Firebase Spark (free) plan.
- Data: none ships with the app. The OPEN SHIFT .xlsx (src/lib/parseWorkbook.js) and caregiver/client CSVs (src/lib/caregiverCsv.js, clientCsv.js, shared csv.js) are imported in the browser and saved to one shared team pool in Firestore teams/main/sections/* (every signed-in user reads and edits it; personal settings in users/{uid}/sections/prefs) (src/lib/store.js; rules in firestore.rules). Never commit or deploy personal data (src/data/seed.json is git-ignored and must not be imported by app code).
- Matching: client CareFinder criteria (Required/Preferred) and caregiver credentials/experience live in src/lib/criteria.js. Dispatch ranks by driving distance (miles first, time secondary).
- Sign-in: Firebase Authentication email/password (src/lib/auth.js); accounts are created in the Firebase console. Config via VITE_FIREBASE_* (.env.example).
- Deploy: GitHub Pages via .github/workflows/deploy.yml (BASE_PATH and VITE_FIREBASE_* repository variables set there).
