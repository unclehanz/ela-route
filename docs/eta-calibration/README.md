# Drive-time calibration (Nov 2026)

The app routes with the free OSRM server, which returns free-flow (no traffic) minutes.
`src/lib/geo.js` turns those into realistic times with the model below, calibrated against
Google Maps "typical" travel times.

## Data
- 16 routes across the South Bay / Long Beach / Southeast LA, 1.3–15 mi (`pairs.mjs`, made-up public points, no real addresses).
- Each route checked in Google Maps at four departure times on a Tuesday: 8:00 AM, 12:30 PM, 5:30 PM, 10:00 PM.
- 63 usable Google readings (`google.txt`: `route|time,low,high,miles`). Google's "typically low–high" range midpoint is the target.
- OSRM free-flow results: `osrm.json`; OSRM alternatives with intersection counts: `alts.json`.

## Model (typical = overhead + factor × free-flow minutes)

| Setting | Low | Typical | High |
|---|---|---|---|
| Night | 2.2 + 0.83× | 5.2 + 0.92× | 8.2 + 1.01× |
| Midday | 2.2 + 0.90× | 5.2 + 1.32× | 8.2 + 1.75× |
| 8 AM rush | 2.2 + 1.06× | 5.2 + 1.65× | 8.2 + 2.25× |
| 5:30 PM rush | 2.2 + 1.02× | 5.2 + 1.54× | 8.2 + 2.07× |

## Results (leave-one-route-out)
| Model | Avg error vs Google typical | Within Google range |
|---|---|---|
| Old factors (×1 / 1.15 / 1.4 / 1.55) | 6.4 min | 65% |
| Factor per time of day | 3.6 min | 86% |
| **Shared overhead + factor (chosen)** | **3.4 min** | 83% |
| + √ length overhead | 3.35 min | 83% |
| + intersection count | 3.1 min | 84% (needs a full route per caregiver; not used) |

- Google's typical time falls inside the app's low–high range for 97% of readings.
- Caregiver ranking order matches Google for 94% of pairs (the model never changes the order).
- Route distance: 9/16 routes identical to Google's (±0.1 mi); average difference 6.6%. Google sometimes picks a
  longer, faster freeway route (e.g. 11.9 vs 7.9 mi) that OSRM does not offer even among its alternatives.

## Re-running
`node final.mjs` refits the coefficients; `node cv.mjs` prints the cross-validation table.
Limits: one region, one weekday, Google "typical" ranges (not live traffic), 16 routes.
