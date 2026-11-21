# ELA Route

Caregiver dispatch tool: ranks caregivers by driving distance to a client, checks them against the client's
CareFinder match criteria (Required / Preferred), tracks caregiver certifications & credentials with expiry alerts,
and shows car / transit / walking options.

## Live site
**https://unclehanz.github.io/ela-route/**

- **Sign in:** with an email + password account created in Firebase (see *Firebase setup*). There is no self sign-up.
- **First time:** sign in, then **Import spreadsheet** (Dispatch start screen or **Data & settings**) and choose
  `OPEN SHIFT.xlsx`. Re-importing later adds new people and fills blanks; your edits are kept.
- **CSV import / export:** the **CSV** button on the Caregivers and Clients pages (also in Data & settings) has
  *Import*, *Export* and *Download blank template*. Fill in one person per row, save as CSV, then import. People are
  matched by name: new ones are added, existing ones only get blanks filled. Lists inside a cell are separated by `;`.
  - Caregivers: credentials are written `Type: yyyy-mm-dd` (e.g. `Driver's License: 2028-03-28; Tuberculosis Test: 2028-02-05`).
  - Clients: match criteria go in *Required Criteria* and *Preferred Criteria* by name (e.g. `Cooking; Level 3 Service`).
    `G-Tube` exists twice, so write `G-Tube (Certifications)` or `G-Tube (Other/Misc)`.
  - Each template comes with an `…-allowed-values.csv` listing what every column accepts. Rows starting with `EXAMPLE` are skipped.
- **Data syncs** to your Firebase account, so it's the same on every computer you sign in on. Signing out also clears
  this device's offline copy.

### Things to know
- If the browser had data from before Firebase (localStorage), it is uploaded once on first sign-in to an empty
  account, then removed from the browser.
- Commits use the GitHub no-reply email (`222508882+unclehanz@users.noreply.github.com`).
- On this computer the project lives on `D:`, which doesn't record file ownership, so Git refuses to run there until
  you allow the folder once:
  `git config --global --add safe.directory D:/projects/personal/ela-route`

## Data and privacy
- The site itself contains **no personal data**. Caregiver/client records live in Firestore under
  `users/{uid}/sections/*`; `firestore.rules` lets each signed-in user read and write only their own data.
- Each account has its own data (accounts don't share records).
- Maps and routing use free public services (OpenStreetMap, Nominatim, Photon, OSRM, FOSSGIS). Addresses are sent to
  them once to be placed on the map; route lookups send map points only.

## Firebase setup (one time, free Spark plan)
1. https://console.firebase.google.com → **Add project**.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
   Then **Users → Add user** for each person who should have access.
3. **Build → Firestore Database → Create database** (production mode, a region near you).
4. Publish the rules: paste `firestore.rules` into **Firestore → Rules → Publish**
   (or `npx firebase-tools deploy --only firestore:rules --project <project-id>`).
5. **Project settings → General → Your apps → Add app → Web.** Copy the config values:
   - local: copy `.env.example` to `.env.local` and fill it in;
   - GitHub Pages: repository **Settings → Secrets and variables → Actions → Variables**, add the same six
     `VITE_FIREBASE_*` names, then re-run the deploy.
6. Authentication → Settings → **Authorized domains**: add `unclehanz.github.io` (needed for password-reset links).

## Development
```bash
npm install
npm run dev        # http://localhost:5173 (needs .env.local, see Firebase setup)
npm run build
node scripts/import-xlsx.mjs "path/to/OPEN SHIFT.xlsx"   # preview what an import would contain
```

Drive-time model and its calibration against Google Maps: `docs/eta-calibration/`.

## Deploy
Pushing to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.
