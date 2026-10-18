# scripts/bench — speed-axis measurement harness

Harness for **Axis 1 (Speed)** of the Global-Elite Benchmark Round
(`docs/GLOBAL_ELITE_BENCHMARK_ROUND.md`). Rule of the round: every number in
`docs/ELITE_BENCHMARK_REPORT.md` is produced by a command in this repo and pasted with it; a
value that has not been measured says PENDING, never an estimate.

## Run it

```bash
node scripts/bench/perf.mjs                  # every metric
node scripts/bench/perf.mjs --only=popup     # popup open -> painted (cold + warm)
node scripts/bench/perf.mjs --only=scan      # content-script scan cost per sweep
node scripts/bench/perf.mjs --only=latency   # detect -> click latency
node scripts/bench/perf.mjs --only=sw        # service-worker cold start + wake
node scripts/bench/perf.mjs --only=writes    # storage write amplification
node scripts/bench/perf.mjs --only=memory    # JS heap footprint
```

Flags: `--popup-n=20 --sweep-n=12 --lat-n=12 --sw-n=5 --cards=200 --nodes=5000`.
Env: `MAA_CHROME` (chrome.exe path), `MAA_EXT_DIR` (alternate extension tree), `MAA_PORT`.

Run it **foreground, unpiped** — a non-TTY / background shell kills the Chrome/CDP suite with
`stdin is not a tty` (rc 1). Run **one Chrome instance at a time** (memory-constrained host).

The harness prints a human summary plus one JSON block containing every raw sample.

## How it works

It reuses the `test/e2e.mjs` launcher: the **installed** Chrome (installed Chrome ignores
`--load-extension`; `--enable-unsafe-extension-debugging` is required) is started detached via
PowerShell with a **scratch profile**, and the extension is loaded from a **temp copy** whose
manifest additionally matches `http://127.0.0.1/*` so the local fixture pages get the content
script (the shipped manifest stays pinned to its real host set — muse.ai + chatgpt.com; no
localhost entry ships). A tiny static server serves the repo root.

Content-script internals are reached by evaluating in the content script's **isolated world**
(the CDP execution context whose `auxData.isDefault === false` and where
`window.__museAutoAllow` exists) — the main world cannot see it.

| Metric | How it is measured |
|---|---|
| popup open → painted | `Target.createTarget` on `popup.html`; read the in-page `first-contentful-paint` paint entry (ms since navigation start). Cold = first open in the fresh profile; warm = the next N. |
| scan cost per sweep | inject a 5,000-node DOM with 200 approval-like cards (the Allow/Deny pair sits inside a `<form>` so the engine's `unsafeTarget()` refuses it and a sweep traverses the whole tree instead of clicking) + 300 filler buttons; time `window.__museAutoAllow.sweep()` in the isolated world. |
| detect → click | inject one clickable approval card at a known timestamp; the card's own click listener records the click time; latency = click − inject. Two configs: `minDelayMs=0` (quiet, isolates the engine's reaction) and `minDelayMs=300` (shipped default pacing). |
| service-worker cold start | `Extensions.loadUnpacked` → poll `Target.getTargets` for the `service_worker` target and read its `performance.timeOrigin` (worker global creation, epoch ms). Wake = `Target.closeTarget` the worker, re-trigger with `runtime.sendMessage`, read the new `timeOrigin`. |
| storage writes | wrap `chrome.storage.local.set`/`get` **in the content script's isolated world** and count the calls a real click / follow-up send produces. |
| memory | `Performance.getMetrics` → `JSHeapUsedSize` on the popup target and on the fixture page (idle → heavy DOM → during sweeps), with a forced `HeapProfiler.collectGarbage` before each read. |

`scan-fixture.html` is the deliberately empty page the harness injects its synthetic DOM into.

## Adding a metric

Add a `want('<key>')` block in `perf.mjs`, give it `cmd: cmdFor('<key>')` so the report can paste
its exact command, and keep the raw samples in the returned object.
