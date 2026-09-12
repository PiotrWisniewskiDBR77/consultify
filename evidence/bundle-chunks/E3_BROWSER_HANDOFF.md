# E3 browser handoff — 2026-09-12

Harness: `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/e3-browser.mjs`.
Run from codex4 worktree: `node ../codex4-scratch/e3-browser.mjs before` or `after`.
Preview 5214 is controlled by integrator; API 4214 and isolated cx4 DB remain local.
Private session/card input JSON stay in scratch. No credentials are copied into evidence.

One fresh Chromium process/context per phase, 1440×900 light through Zustand, same context across all phase navigation. Inventory is 15 actual sidebar buttons, plus cold My Work and 3 cards = 19 captures. Do not invent a sixteenth module.

`readyFromTriggerMs`: trigger to changed content and three stable checks 400ms apart. It excludes screenshots and the following observation window. `timing.firstChangedMs/stableMs` start after trigger resolution and are not complete click-to-ready times. `sameTarget` deliberately has no navigation latency.

After readiness, every capture waits an explicit `observationWindowMs=2000` to retain debounced HTTP/console failures. `observedFromTriggerMs` marks the end of that window. ResourceTiming JS sizes are taken then. Cursor moves outside the sidebar before PNG capture. `totalCaptureMs` includes screenshot overhead and must not be called render time.

JS sizes: decodedBodySize describes uncompressed resource payload; encodedBodySize the response body; transferSize includes transfer overhead. Later routes share browser cache. A zero transfer can be cache or unavailable timing, not zero JS execution. Only completed entries at observation end are included; no claim that these are every eventual background resource. Per-resource timings are retained. Cold sum is observed authenticated first-screen JS, distinct from manifest common boot closure.

HTTP errors retain method and URL. A pre-existing CLOSED initiative auto-PUT403 must stay classified as a real product defect, not an instrument error. No product source changes were made for this harness correction.

Superseded before directories were moved outside tracked evidence to `codex4-artefakty/e3-before-superseded-*`. The first corrected run without an observation window exited before the initiative debounce and is not the final error-acceptance proof. Its superseded directory is explicitly named `e3-before-superseded-no-observation-*`.

Both phases completed; final results follow. API4214 is now owned by E4; do not restart it for E3.

## BEFORE completed

19 captures, 15 sidebar items. Cold ready: 2455 ms. Cold JS: {"requestCount": 54, "decodedBodyBytes": 7010816, "encodedBodyBytes": 1858454, "transferBytes": 1874354, "zeroTransferCount": 1, "zeroBodySizeCount": 1}.

Errors: [{"name": "Initiative card", "http": [{"method": "PUT", "status": 403, "url": "/api/initiatives/e33b0b36-f9c9-5cc9-b516-ae04f7311de2"}, {"method": "PUT", "status": 403, "url": "/api/initiatives/e33b0b36-f9c9-5cc9-b516-ae04f7311de2"}], "pageErrors": [], "instrumentError": null}].

Harness SHA256: fb284a452aeb836bee3df959e19c8214a6c0f98eef26d23867e8d96394769f0d. BEFORE summary SHA256: 71d903f27f036181aa927bc50692d07a2112031d4c99c6f8114bdb7080191fa9.

## AFTER completed

Preview commit `375660f7d1b8bd171bf52a9f271eefdd2b986c1e`; 19 captures. Cold ready2462ms versus BEFORE2455ms: one pair, no demonstrated speedup. Cold decoded JS7010816→5788473B; encoded1858454→1704016B; transfer1874354→1782616B. Script entries54→263 (53→262 same-origin). Local scripts below10KB:38→232; below50KB:48→251. The additional entries are many small split chunks, not more total payload. Request overhead partly offsets encoded payload savings.

Instrumentation correction: the first AFTER had ResourceTiming default-buffer overflow (263finished script URLs,232timings). It was stopped and preserved as superseded-timing-overflow outside evidence. AFTER was rerun with buffer10000 and missing URL detection. BEFORE has54cold requests/timings and ZERO missing completed script URLs across all19samples, so its data were not truncated; no BEFORE rerun was required for this capacity-only correction. Harness AFTER SHA256: 82a3eec7bc67d21b79a9f33161525b16203639da132c9de00f06f1cbf28b4178. BEFORE hash above refers to the otherwise identical instrument before capacity correction.

Both phases contain one opaque third-party gtag script with0body/transfer timing; known body totals therefore do not quantify that third-party payload. All observed same-origin script URLs have timing entries. Later phases share cache; sizes are completed resources within the fixed observation window, not a total session estimate.

Detailed per-screen comparison: `E3_BROWSER_COMPARISON.json`. Final BEFORE/AFTER evidence remains in worktree `evidence/bundle-chunks/{before,after}`. Logs: `e3-browser-before-observed.log` and `e3-browser-after-final.log`.

AFTER exceptions: [{"name": "Initiative card", "beforeReadyMs": 1312, "afterReadyMs": 1317, "beforeHttpErrors": [{"method": "PUT", "status": 403, "url": "/api/initiatives/e33b0b36-f9c9-5cc9-b516-ae04f7311de2"}, {"method": "PUT", "status": 403, "url": "/api/initiatives/e33b0b36-f9c9-5cc9-b516-ae04f7311de2"}], "afterHttpErrors": [{"method": "PUT", "status": 403, "url": "/api/initiatives/e33b0b36-f9c9-5cc9-b516-ae04f7311de2"}, {"method": "PUT", "status": 403, "url": "/api/initiatives/e33b0b36-f9c9-5cc9-b516-ae04f7311de2"}], "beforePageErrors": [], "afterPageErrors": [], "beforeInstrumentError": null, "afterInstrumentError": null}].
