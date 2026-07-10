# Phase 3 — Claim Pipeline: Install & Test Guide

## What's in this package

```
lib/claimAbi.ts                     claim function + custom-error ABI, plain-English error map
lib/voucher.ts                      EIP-712 signing + relayed submission (server-only)
lib/earned.ts                       Redis earned-event store + claim locks
lib/cors.ts                         CORS for the public routes
lib/pendingTypes.ts                 shared client-safe pending shape
app/api/report/route.ts             apps report earns (Bearer REPORT_SECRET, server-to-server)
app/api/pending/route.ts            earned-but-unclaimed list (public, CORS)
app/api/claim/route.ts              sign + relay the mint (public, CORS)
app/api/admin/test-report/route.ts  owner-only browser test hook (wallet-signature auth)
components/UnlockOverlay.tsx        the magic moment (toast / modal / full-screen by tier)
app/test/page.tsx                   owner test console — full E2E test in the browser
public/embed/clawd-achievements.js  vanilla-JS snippet for your other apps
```

Nothing in Phase 1/2 is modified — these are all new files. Unzip at the repo
root (folders merge), commit with GitHub Desktop, and Vercel deploys as usual.

## One new env var

Add **`REPORT_SECRET`** in Vercel (Production + Preview): any long random
string, 40+ characters — use a password generator. This is the shared secret
your other apps will use to report earns. Redeploy after adding.

## Browser test (no curl, ~5 minutes)

1. In **/admin**, create an achievement: App ID `hub`, key `test_claim`,
   tier 3 if you want the full fireworks, no reward, supply 0, active.
2. Open **/test** with your owner wallet connected.
3. Press **"Report to my wallet"** (sign the popup — it's a free signature,
   not a transaction).
4. Press **"Check pending"** — the achievement appears.
5. Press **"Unlock"**, then **Claim** in the overlay. The relayer submits the
   real mint; in a few seconds you get the success state with the tx.
6. Verify on Basescan that the badge landed in your wallet, then clean up:
   Basescan → AchievementBadge → `revokeBadge(tokenId)` from the owner wallet
   (the tokenId is in the /test log and the tx's AchievementClaimed event).

If claiming fails with a signature error, the `VOUCHER_SIGNER_PRIVATE_KEY` in
Vercel doesn't match the signer address you set on-chain — re-check both.

## Wiring a real app (CoverageKit example)

Server-side, wherever the trigger already fires (e.g. scan completes):

```ts
await fetch("https://<hub-domain>/api/report", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.REPORT_SECRET}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ wallet, appId: "coveragekit", key: "first_scan" }),
});
```

Client-side, once per app (layout or after wallet connect):

```html
<script src="https://<hub-domain>/embed/clawd-achievements.js"></script>
<script>window.ClawdAchievements.check(connectedWalletAddress);</script>
```

Add `REPORT_SECRET` to that app's Vercel env too. That's the entire
integration: one server line, one script tag, one check() call.

## Design notes / guarantees

- Claims are idempotent three ways: the Redis earned-set, an on-chain
  `hasClaimed` pre-check, and the deterministic eventHash
  (`appId:key:wallet`, lowercased) — double-fires can never double-mint.
- Claims are simulated before submission, so failed claims cost the relayer
  nothing in gas.
- A `RewardShortfall` never blocks a mint; the badge still lands and the
  admin activity feed shows the red row telling you to refill the pool.
- Private keys never leave the server modules; error responses are
  plain-English only, raw RPC errors are logged server-side, never returned.
- `/api/report` has no CORS on purpose — it must only ever be called
  server-to-server, because the browser must never hold the secret.
