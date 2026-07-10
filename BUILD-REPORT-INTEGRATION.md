# Build Report Integration + Odds Setup Guide

## Step 1: Create two achievements in /admin

Both should have `appId: build-report` (lowercase, no spaces).

**Achievement 1 — the common one (most people get this):**
- App ID: `build-report`
- Key: `first_scan`
- Name: something like "First Scan" or "On the Board"
- Tier: 1 (Common)
- No reward, uncapped, active

**Achievement 2 — the rare lucky one:**
- App ID: `build-report`
- Key: `lucky_scan`
- Name: something like "Lucky Scanner" or "Golden Eye" — your call
- Tier: 2 (Rare) or 3 (Legendary) for maximum drama
- Optional: add a small CLAWD reward to make the luck feel real
- Uncapped, active

## Step 2: Configure odds in /admin → Manage → "🎲 Randomize this achievement"

Open the `first_scan` achievement in Manage Achievements.
Click "🎲 Randomize this achievement".
Set two outcomes:
- `first_scan` → weight 95
- `lucky_scan` → weight 5

Click "Save odds". Takes effect immediately on the next /api/report call.

Note: if you save a config with only one outcome pointing to itself, the Hub
will store it but it's functionally identical to no config — just wastes a
Redis read. Always configure at least two distinct outcome keys.

## Step 3: Add to Build Report's SERVER code

This is the critical part. The report must only fire ONCE per wallet — on
their first scan ever. Without the guard, a user doing multiple scans could
roll again and collect both badges from separate scans.

Find wherever a scan completes in Build Report's server route/action (after
the result is ready, before responding to the user). Add:

```ts
// One-time first-scan achievement report — fire and forget.
// Guard ensures we only report once per wallet, even if they scan many times.
const scanReportedKey = `br:scan-reported:${userWalletAddress.toLowerCase()}`;
const alreadyReported = await redis.get(scanReportedKey);
if (!alreadyReported) {
  // Mark first — before the fetch — so a retry can't double-fire.
  await redis.set(scanReportedKey, "1");
  void fetch(`${process.env.ACHIEVEMENT_HUB_URL}/api/report`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.REPORT_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      wallet: userWalletAddress,
      appId: "build-report",
      key: "first_scan",
    }),
  }).catch((e) => {
    // Never let a Hub failure affect Build Report's own response.
    console.error("Achievement report failed:", e instanceof Error ? e.message : e);
  });
}
```

Build Report already uses Redis for CLAWDGate and rescore persistence,
so `redis` here is your existing Upstash client — no new dependency.

Add two env vars to Build Report's Vercel project:
- `ACHIEVEMENT_HUB_URL` = `https://community-achievement-hub.vercel.app`
- `REPORT_SECRET` = same value as in the Hub's Vercel env vars

## Step 4: Add the embed snippet to Build Report's frontend

In Build Report's layout or wherever you have the connected wallet address
on the client side (after RainbowKit connects), add once per page load:

```html
<script src="https://community-achievement-hub.vercel.app/embed/clawd-achievements.js"></script>
```

Then call check() when the wallet connects:

```ts
if (typeof window !== "undefined") {
  window.ClawdAchievements?.check(connectedWalletAddress);
}
```

The embed polls /api/pending and pops the overlay if anything is waiting.
It's idempotent — safe to call on every page load or wallet connect.

## How the lucky roll works end-to-end

1. User completes their FIRST scan in Build Report
2. Build Report server checks Redis — `br:scan-reported:${wallet}` not set
3. Sets the Redis key, then fires Hub /api/report with key: `first_scan`
4. Hub finds the odds config (95/5 split)
5. Hub rolls: 95% chance records `first_scan` earned,
   5% chance records `lucky_scan` earned instead
6. Hub returns { ok: true } — Build Report doesn't know which was awarded
7. On the client, ClawdAchievements.check() sees the pending achievement
   and pops the correct overlay (Common toast or Rare/Legendary full-screen)
8. User claims → badge mints to their wallet, relayer pays gas

The lucky 1-in-20 user scanned a repo, got a surprise rare badge they
weren't expecting. They didn't hunt for it, didn't know it existed, didn't
do anything special — they just used the app and something magical happened.
That's the moment.

## Resetting a wallet for testing

If you want to re-trigger the first scan event for your own wallet during
testing (e.g. after revoking the test badge), delete the Redis guard key:

```
Key to delete: br:scan-reported:${yourWalletAddress.toLowerCase()}
```

You can do this from Upstash's dashboard (Data Browser → search for the key
→ delete), or add a one-off delete call in your test console.
