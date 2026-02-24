# Browser Protocol Sampling (DevTools-equivalent via Resource Timing)

Time: 2026-02-24 14:33-14:36 (Asia/Shanghai)

Method:
- Controlled Chrome tab via Browser Relay
- Navigate to:
  - `https://xgvst.com/?probe=1`
  - `https://xgvst.com/market?probe=2`
  - `https://xgvst.com/detail/600519?probe=3`
  - `https://xgvst.com/market?probe=5`
- Collect `performance.getEntriesByType('navigation')[0].nextHopProtocol`
- Collect per-page resource `nextHopProtocol` tally (first 3 samples)

Results:
- Navigation protocol samples (4/4): all `h2`
- Resource protocol tally (3 pages):
  - h2: 42
  - unknown: 4

Per-page details:
- `/?probe=1`: nav=h2, resources={h2:4, unknown:1}
- `/market?probe=2`: nav=h2, resources={h2:19, unknown:2}
- `/detail/600519?probe=3`: nav=h2, resources={h2:19, unknown:1}
- `/market?probe=5`: nav=h2

Conclusion:
- Under current browser sampling path, effective negotiated protocol appears as `h2` (not `h3`) for tested navigations.
- DoD1 cannot be marked PASS yet; requires additional HAR/DevTools protocol evidence from direct local browser workflow and/or Cloudflare log-level `http_version` statistics.
