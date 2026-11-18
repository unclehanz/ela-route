# ELA Route

Caregiver mileage tracker & route optimizer (React + Vite, no backend; data in localStorage).

UI style profile: friendly (rounded radius scale 4/8/12/16/24; console layout kept with compact 40px table rows)

- Visual direction: "dispatch console" — dense, precise, hairline borders, heavy Manrope (500 body, 700 labels, 800 headings and figures, tabular numbers).
- Follow the UI Guidelines skill (brand-blue tokens, light/dark, footer component).
- Free services only: OpenStreetMap tiles, Nominatim/Photon geocoding, OSRM routing.
- Data: none ships with the app. The OPEN SHIFT .xlsx is imported in the browser (src/lib/parseWorkbook.js); never commit or deploy personal data (src/data/seed.json is git-ignored and must not be imported by app code).
- Sign-in: client-side gate only (src/lib/auth.js stores a SHA-256 hash, not the password).
- Deploy: GitHub Pages via .github/workflows/deploy.yml (BASE_PATH set there).
