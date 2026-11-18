# ELA Route

Caregiver mileage tracker and route optimizer: ranks caregivers by drive time to a client, shows car / transit / walking
options, plans multi-stop routes and keeps a mileage log for reimbursement.

## Data and privacy
- The site contains **no personal data**. After signing in, import the OPEN SHIFT `.xlsx` from **Data & settings**
  (or the Dispatch start screen). The file is read inside the browser and stored only in that browser (localStorage).
- Use **Download backup / Restore from backup** to move data between computers.
- The sign-in screen keeps casual visitors out, but on a static site it is not real security.
- Maps and routing use free public services (OpenStreetMap, Nominatim, Photon, OSRM, FOSSGIS). Addresses are sent to
  them once to be placed on the map; route lookups send map points only.

## Development
```bash
npm install
npm run dev        # http://localhost:5173
npm run build
node scripts/import-xlsx.mjs "path/to/OPEN SHIFT.xlsx"   # preview what an import would contain
```

Drive-time model and its calibration against Google Maps: `docs/eta-calibration/`.

## Deploy
Pushing to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.
