# Clawd Achievements Hub — Build Spec

Frontend + backend for the Clawd Achievements system. Contracts are live and verified on Base
mainnet (LeftClaw job 292). This spec is written to be handed to Cursor phase-by-phase.

**Stack:** Next.js 14 (App Router) · Vercel · Upstash Redis · RainbowKit + wagmi + viem ·
Tailwind. New standalone repo (e.g. `clawd-achievements-hub`). Deployed to Vercel as usual.

---

## 0. Manual setup (before any code — no CLI needed, all browser)

1. **Create two fresh wallets** (in MetaMask/Rabby: "Add account", then export each private key):
   - **Signer wallet** — signs vouchers. Needs NO ETH, never submits transactions.
   - **Relayer wallet** — submits claim transactions and pays gas. Send it ~$5 of ETH on Base
     (thousands of claims worth).
   - Never reuse your main wallet's key for either. These two keys go in Vercel env vars only.

2. **Rotate the voucher signer** (one-time, via Basescan — no CLI):
   - Go to https://basescan.org/address/0x79350955160a24bE0FA18243Af6FA5F53CBEcCCa#writeContract
   - Connect your OWNER wallet (0xf2c4...a0Fc)
   - Call `setVoucherSigner` with the **signer wallet's address** (not private key)
   - Until this is done, no real vouchers will verify. This is the one required pre-launch step
     LeftClaw flagged.

3. **Get an Alchemy RPC URL for Base** (you already have Alchemy from I've Seen Things — create
   a Base mainnet app, copy the HTTPS URL).

4. **(When ready for rewards)** fund the pool: Basescan → AchievementBadge → `fundPool`, or for
   CLAWD: approve first on the CLAWD token contract, then fundPool. Can wait until Phase 3+.

---

## 1. Architecture

```
Your apps (CoverageKit, Talk Normie, ...)          Hub (this repo)
        |                                               |
        | POST /api/report  (shared secret)             |
        |  { wallet, appId, key, eventId }              |
        +----------------------------------------->  Redis: earned-but-unclaimed store
                                                        |
User in app sees overlay (embed snippet) <--- GET /api/pending?wallet=0x..
        |
        | taps Claim
        +----------------------------------------->  POST /api/claim
                                                        | 1. verify earned in Redis
                                                        | 2. check hasClaimed on-chain (idempotent)
                                                        | 3. signer key signs EIP-712 voucher
                                                        | 4. relayer key submits claimAchievement()
                                                        | 5. mark claimed in Redis
                                                        v
                                              Badge + reward land in user's wallet
```

**Key principles:**
- **Apps never hold keys.** They only know the Hub URL + a shared secret (`REPORT_SECRET`).
- **Owner actions (create/edit achievements, fund pools) happen in the browser** via the admin
  page with your connected wallet — no owner key on any server.
- **Contract reads via viem `publicClient`, cached in Redis** (achievements list: 60s TTL +
  manual "refresh" button in admin; per-wallet holdings: 15s TTL). No subgraph, no indexer.
- **eventHash = keccak256(`${appId}:${key}:${wallet}`)** — deterministic, globally unique,
  idempotent. A retry of the same claim reverts harmlessly with EventHashAlreadyConsumed.

---

## 2. Repo structure

```
lib/
  contracts.ts        addresses, chain id, ABIs (paste from deployedContracts.ts in job-292 repo)
  clients.ts          viem publicClient (Alchemy Base RPC); server-only walletClient for relayer
  redis.ts            Upstash client (same pattern as your other apps)
  achievements.ts     typed read helpers: getAllAchievements(), getWalletBadges(), remainingSupply()
  voucher.ts          server-only: signVoucher(), submitClaim() — port of INTEGRATION.md §4
  tiers.ts            tier names, colors, animation intensity mapping
app/
  page.tsx                      Directory (public)
  achievement/[id]/page.tsx     Achievement detail (public)
  trophy-case/[address]/page.tsx  Trophy Case (public, shareable)
  me/page.tsx                   My Profile (wallet-connected)
  admin/page.tsx                Admin panel (owner wallet only)
  api/report/route.ts           apps report earned events (shared secret)
  api/pending/route.ts          list unclaimed achievements for a wallet
  api/claim/route.ts            sign voucher + relay transaction
  api/showcase/route.ts         opt-in public showcase + featured badges (Redis)
components/
  AchievementCard.tsx           directory card (normal / capped / hidden-silhouette variants)
  SupplyBar.tsx                 "3 of 10 claimed" visual
  TierBadge.tsx
  UnlockOverlay.tsx             THE magic moment component (see §5)
  embed/clawd-achievements.js   copy-paste snippet for your other apps (see §6)
```

**Env vars (Vercel):** `ALCHEMY_RPC_URL`, `VOUCHER_SIGNER_PRIVATE_KEY`, `RELAYER_PRIVATE_KEY`,
`REPORT_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
`NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`.

---

## 3. Pages

### 3.1 Directory `/` (public, no wallet needed)
- Fetch: iterate `1..totalAchievements()` → `getAchievement(id)` (server-side, Redis-cached 60s).
  Also `remainingSupply(id)` per achievement.
- Grid grouped by `appId`. Filters: app, tier, "still available".
- Card variants:
  - **Normal:** art, name, tier badge, one-line description, app label.
  - **Capped:** adds SupplyBar — "7 of 10 claimed" — plus 🔒 "capped forever" icon if `capLocked`.
  - **Hidden (`hidden == true`):** dark silhouette card, "???" as name, description shown as the
    hint in italics. (Note: hidden is a display convention — the data is on-chain and readable by
    anyone on Basescan. Fine at our scale; put only hint-safe text in hidden descriptions.)
  - **Inactive (`active == false`):** grayed out, "no longer claimable" ribbon.
- Tier visual language: Common = bronze/copper tones, Rare = silver-blue, Legendary = gold with
  a subtle glow/shine animation. Dark background, retro-arcade-inspired but clean (no pixel-art
  parody). Plain English everywhere, zero raw hex in user-facing UI.

### 3.2 Achievement detail `/achievement/[id]`
- Everything from the card, plus: full description, reward (if `rewardAmount > 0`, show
  "Comes with X CLAWD" in plain English — resolve token address → symbol via a small hardcoded
  map: CLAWD, ETH sentinel, else "tokens"), prerequisites rendered as a chain of mini-cards
  (each linking to its own detail page), edition info, and the holder list:
  `holdersOfAchievement(id)` → truncated addresses (0xf2c4…a0Fc), each linking to that wallet's
  Trophy Case. Show `earnedAt` per holder via `tokenMeta` where cheap; otherwise skip timestamps
  in v1.
- Hidden achievements: detail page shows the silhouette treatment unless the connected wallet
  holds it.

### 3.3 Trophy Case `/trophy-case/[address]`
- Public + shareable. Accepts any address in the URL; also an input box on the page.
- Fetch: `achievementsOfWallet(address)` → for each id, achievement def (from the same cached
  list) — one RPC call for the id list, zero extra calls for defs.
- Header: total badges, per-app breakdown, tier counts ("2 Legendary · 5 Rare · 11 Common").
- Grid grouped by app, tier styling, edition numbers ("#3 of 10") on capped badges.
- If the wallet opted into public showcase (Redis), show their featured badges pinned at top.
  If a wallet has zero badges: friendly empty state pointing to the Directory.
- Canvas-generated share card PNG (your standard pattern) — "X's Trophy Case" with top badges.

### 3.4 My Profile `/me`
- RainbowKit connect. Shows own Trophy Case plus:
  - **Public showcase toggle** (Redis via `/api/showcase`, wallet-signature verified — same
    verification pattern as Larvae admin). First time a wallet turns it ON, the backend fires an
    internal report for a "Proud Collector" achievement (create it in admin first; appId `hub`,
    key `showman`). That's the system awarding an achievement for using the system — good demo.
  - **Featured badges picker** — pin up to 3, stored in Redis.
  - **Pending tray** — `/api/pending?wallet=` → any earned-but-unclaimed achievements render
    with a Claim button using the same UnlockOverlay. This is the safety net for closed tabs:
    nothing earned is ever lost.

### 3.5 Admin `/admin` (owner only)
- Gate: page loads only when connected wallet == owner address (client check), and every Redis
  write verifies a wallet signature server-side (Larvae pattern). Contract writes are inherently
  gated — they revert for non-owner.
- **Create achievement:** form with every AchievementDef field, live preview of the badge card
  as you type, and a wagmi `writeContract(createAchievement, [def])` from your connected wallet.
  Sensible defaults: tier 1, maxSupply 0, capLocked false, rewardToken none, active true.
  Guardrails in the UI: warn loudly before submitting `capLocked: true` (permanent); warn if
  lowering maxSupply below current claimCount; prerequisites picker only offers existing ids.
- **Edit / activate / deactivate / setMaxSupply / lockSupplyCap** per achievement.
- **Pool panel:** current contract balances (ETH + CLAWD via balanceOf), fundPool / withdrawPool
  buttons (fundPool for CLAWD needs an approve step first — do the two-step in UI).
- **Activity feed:** recent `AchievementClaimed` / `RewardPaid` / `RewardShortfall` events via
  `publicClient.getLogs` (last ~50k blocks is plenty). RewardShortfall rows highlighted red —
  that's your "pool ran dry" alarm.
- **Cache refresh button** — busts the Redis achievements cache after creates/edits.

---

## 4. API routes

### POST `/api/report` — apps report an earned achievement
- Auth: `Authorization: Bearer ${REPORT_SECRET}`.
- Body: `{ wallet, appId, key, eventId? }`. Look up achievementId by (appId, key) from the cached
  achievements list. Reject unknown pairs.
- Redis: `SADD earned:${wallet}` ← `${achievementId}`, plus `earnedAt:${wallet}:${id}` timestamp.
  Idempotent by design (set semantics).
- Returns `{ ok, achievementId, alreadyEarned }` so the app knows whether to pop the overlay.

### GET `/api/pending?wallet=0x..`
- Diff of Redis `earned:${wallet}` minus on-chain `achievementsOfWallet(wallet)` (cached 15s).
- Returns array of full achievement defs ready to render in the overlay.

### POST `/api/claim`
- Body: `{ wallet, achievementId }`. No auth needed beyond the earned-check — claiming can only
  ever mint to the earning wallet, so there is nothing to steal.
- Steps: (1) confirm id ∈ Redis `earned:${wallet}`; (2) `hasClaimed(id, wallet)` on-chain —
  if true, return success (idempotent); (3) build voucher with
  `eventHash = keccak256(toBytes(\`${appId}:${key}:${wallet}\`))`, 10-min deadline; sign with
  signer key; (4) relayer submits `claimAchievement(voucher, sig)`, wait for receipt;
  (5) return `{ ok, txHash, edition }` (edition from the AchievementClaimed log).
- Error mapping: decode custom errors → plain-English messages
  (SupplyCapExceeded → "All editions of this badge have been claimed 😢", etc. — full table in
  INTEGRATION.md §5). One in-flight claim per (wallet,id): Redis `SET NX` lock with 60s expiry.

### POST/GET `/api/showcase`
- GET: `{ public: bool, featured: [ids] }` for a wallet.
- POST: wallet-signature verified; writes Redis; first-ever enable triggers internal report of
  the `hub:showman` achievement.

---

## 5. UnlockOverlay — the magic moment

One component, three intensities keyed off tier:

- **Common → toast/slide-in card** (bottom corner): badge art slides in with a small shine sweep,
  "Achievement Unlocked — {name}", Claim button. Non-blocking.
- **Rare → centered modal:** background dims, badge does a flip-in with ring pulse, name + tier +
  reward line, Claim button.
- **Legendary → full-screen:** dim → badge silhouette → burst reveal (scale-in with overshoot +
  particle confetti) → name in big letters → edition number if capped ("You are #3 of 10") →
  Claim.

**Claim button states:** idle → "Claiming…" (spinner, disabled) → success swap: "Added to your
Trophy Case ✓" + confetti tick + "View my trophies" link → auto-dismiss after a beat (toast) or
on click (modal/full). On error: plain-English message + Retry. The mint is backend-submitted, so
the user NEVER sees a wallet transaction popup — one tap, done. (Wallet connection is still
needed once so we know their address — the embed reads it from the host app's wagmi context.)

Sound: one short chime per tier (optional, muted by default, respects a localStorage-free
in-memory toggle). CSS/Framer-free: plain CSS keyframes to keep the embed light.

---

## 6. Embed snippet for your other apps

Ship `public/embed/clawd-achievements.js` — a small self-contained script any of your Next.js
apps includes once. API:

```js
// in the host app, after an achievement-worthy action:
await fetch("https://<hub-domain>/api/report", { method: "POST",
  headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
  body: JSON.stringify({ wallet, appId: "coveragekit", key: "first_scan" }) });   // server-side!

// client-side, anywhere after wallet connect:
window.ClawdAchievements.check(walletAddress);   // polls /api/pending, pops overlay if anything's waiting
```

- The report call happens **from the host app's server route** (secret stays server-side) —
  one line added wherever the trigger already fires.
- The client `check()` renders the same UnlockOverlay (bundled inline in the script) into a
  portal div, calls `/api/claim` on tap. CORS: allow your vercel.app domains on the three public
  routes.
- Result: integrating a new app = 1 server line + 1 script tag + 1 check() call.

---

## 7. Build phases (each independently deployable)

**Phase 1 — Foundation + Directory.** lib/* files, Directory page, Achievement detail. Deployable
immediately; empty state until achievements exist.
*Cursor: Sonnet 4.6, Low effort, thinking off.*

**Phase 2 — Admin panel.** So you can create achievements from a real UI instead of Basescan
tuple-wrangling. Create your first real achievements here (suggest starting with the retroactive
OG badges + `hub:showman`). *Cursor: Sonnet 4.6, Medium effort + thinking on for the
wagmi-write + signature-verification wiring; Low for the form UI.*

**Phase 3 — Claim pipeline + overlay + embed.** The three API routes, UnlockOverlay, embed
script. Test end-to-end with a `hub:test` achievement on your own wallet, then revoke it via
Basescan (`revokeBadge`) once verified. *Cursor: Sonnet 4.6, Medium effort + thinking on — this
is the multi-file, key-handling phase. Escalate to High only if something repeatedly fails.*

**Phase 4 — Trophy Case + My Profile + share cards + polish.** Public pages, showcase opt-in,
pending tray, canvas share card, sounds. *Cursor: Sonnet 4.6, Low effort.*

**Phase 5 — Rollout.** Wire the report call into one real app (CoverageKit is the best fit — the
scan-complete moment is a natural trigger), watch it work, then repeat per app. Then the OG
retroactive drop + a Clawd Explains episode.

---

## 8. Design tokens

```
bg          #0d0f14        (near-black, slight blue)
surface     #161a22
text        #e8e6df
Common      #b0713b / #d99a5b     (bronze/copper)
Rare        #7fa8c9 / #b9d4ea     (silver-blue)
Legendary   #d4a017 / #ffd75e     (gold; glow: 0 0 24px rgba(255,215,94,.35))
hidden card #1a1a1f with 60% blur silhouette + "???" in mono font
font        Inter or system-ui for body; a chunky display font (e.g. "Bungee" or similar
            arcade-adjacent) for badge names only — retro flavor without pixel parody
```

## 9. Known constraints & honest notes

- `hidden` is cosmetic — on-chain data is public. Hint-safe descriptions only.
- RewardShortfall never blocks a mint; the admin activity feed is your alarm to refill.
- The relayer wallet is a hot wallet holding a few dollars of gas ETH. Keep it small; top up
  as needed. The signer key holds nothing and can be rotated in one Basescan call if ever leaked
  (instantly invalidating all outstanding vouchers).
- View helpers loop over all achievements — a documented non-issue until ~10,000 achievements.
- Badge art: start with Vercel-hosted `https://` imageURIs (they're editable later via
  editAchievement), migrate to IPFS pinning when the set stabilizes.
