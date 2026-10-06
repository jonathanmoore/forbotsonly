# Plan: Checkout form (Habanero) agent sandbox route

**Audience:** an implementing agent running at high effort, starting with no prior context.
**Owner:** Jonathan Moore
**Status:** Plan only. Nothing here is built yet.

---

## 1. Why this exists

The new Stripe Press site (`~/stripe/stripe-wpp/press`, deployed at
`press-git-press-new.vercelapp.stripe.dev/checkout`) uses **Stripe Checkout form**
(`ui_mode: "form"`, internally called Project Habanero). Browser agents (Muse, Instinct,
and others) fail on that checkout page:

- **New Press deployment, `/checkout`:** stuck on "Loading checkout…" for 30+ seconds,
  then every observation call (AX snapshot, text, HTML, screenshot) fails. The page paints
  for humans, but the agent gets no accessibility tree.
- **Same deployment, `/cart`:** observable and readable.
- **Old Press deployment (`press-env-qa`), `/checkout`:** the AX tree builds and fields
  are readable, but every fill is rejected at input dispatch (cross-origin Stripe iframe).

The Press page mixes several suspects: a WebGL 3D book viewer, password gating, Next.js,
and Stripe's iframe. We can't tell which one breaks agents. **The goal is a minimal,
isolated reproduction in forbotsonly:** one plain page with a Checkout form for the tee
and nothing else. If agents still fail there, the problem is Checkout form itself, and we
have a clean repro to send to the OCS team. If they succeed, the problem is in the Press
page.

**Don't build:** card art, the mark/shape picker, 3D or physics visuals, cart UI, or
styling beyond the minimum. Jonathan refunds the test orders by hand.

---

## 2. Authoritative sources (read before coding)

Fetch these and treat them as the source of truth over memory. Checkout form is new, and
training data probably describes `embedded`/`custom` instead.

1. https://docs.stripe.com/checkout/form/quickstart
2. https://docs.stripe.com/api/checkout/sessions/create
3. https://docs.stripe.com/api/checkout/sessions
4. https://docs.stripe.com/elements/appearance-api
5. https://docs.stripe.com/llms.txt

Optionally, use Toolshed internal search (`execute_internal_search`, Trailhead, or
Sourcegraph) for "Habanero" or "Checkout form" to find internal docs on account gating,
the required API version, and known agent/automation issues.

### Hard requirements

- Use **Checkout Sessions**, not a direct PaymentIntents integration.
- Create the Session **server-side** with `ui_mode: "form"`.
- Return **only** the Session `client_secret` to the browser.
- **Don't** substitute `ui_mode: "embedded"` or the older `ui_mode: "custom"`. Those are
  different integrations and would invalidate the test.
- Fulfill from **verified** Stripe webhooks (`checkout.session.completed`).
- Keep secret keys server-side.
- Use the conventions of the Stripe SDK that's actually installed (upgrade if needed;
  see §4), and **verify the target Stripe account is enabled for Checkout form** before
  building UI.
- Follow the quickstart's **vanilla JS** path (Stripe.js, `stripe.initCheckout…`, or
  whatever the quickstart names it). forbotsonly has **no React**, so don't add React just
  for this. `CheckoutFormProvider`/`CheckoutForm` from `@stripe/react-stripe-js/checkout`
  only matter if a React version is wanted later, for example to mirror Press exactly.
  §9 covers that as an optional variant.

---

## 3. Step 0: inspect, then summarize before coding

Read these and post a short summary covering relevant files, the current payment flow,
the API version, and the required migration. **Stop for Jonathan's confirmation before
writing code.**

### forbotsonly (this repo)

| File | What it does |
|---|---|
| `package.json` | Bun + Vite. `stripe@^17.5.0`. No React. `bun run server` (port 3001), `bun run dev` (Vite on 3000, proxies `/api`, `/mcp`, `/health`, `/.well-known` to 3001). |
| `vite.config.ts` | `root: 'public'`, single input `public/index.html`. A new page needs a new `rollupOptions.input` entry. If it lives under a new prefix (e.g. `/sandbox`), it may also need a proxy entry. |
| `src/stripe.ts` | Stripe client pinned to `apiVersion: '2025-02-24.acacia'`. `createCheckoutSession()` makes a **hosted** session (redirect `url`), `mode: 'payment'`, `shipping_address_collection: US`. |
| `src/server.ts` (~2.2k lines) | Bun `serve()` with hand-rolled `url.pathname` routing. `/webhook/stripe` → `handleWebhook()` (~L1617), which verifies the signature **only if** `STRIPE_WEBHOOK_SECRET` is set and otherwise trusts raw JSON. On `checkout.session.completed` it reads `metadata.orderId` and calls `fulfillPaidOrder()`, which can **create a real Prodigi order** (`createProdigiOrderForOrder`, ~L224). Also serves static files, `/pay/:orderId`, `/mcp`, and `/admin/orders`. |
| `src/products.ts` | One product, `tee-001`, $40, price from `STRIPE_PRICE_ID`, sizes s–3xl. |
| `src/store.ts` | Order store (in-memory or Postgres). |
| `docs/HARD_RULES.md`, `HARD_RULES.md` | **Read fully.** Non-negotiable Prodigi rules: never fake addresses, US only, etc. |
| `.env.example` | Env vars: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_URL`, Prodigi keys. |
| `tests/` | `bun test`. Add tests here. |

### Press (`~/stripe/stripe-wpp/press`), read-only reference

Don't modify Press. Find its Checkout form integration (search for `ui_mode`,
`CheckoutFormProvider`, `CheckoutForm`, `initCheckout`, `client_secret`) and record:
- the `stripe` / `@stripe/stripe-js` / `@stripe/react-stripe-js` versions and the API
  version (including any preview/beta header),
- the exact `sessions.create` params,
- how the form mounts (provider options, appearance, `elementsOptions`).

Mirror its Session params and SDK versions as closely as possible. That makes the repro
faithful: if agents work here but fail on Press, the difference is the Press page.

---

## 4. Step 1: SDK/API version and account eligibility

1. From the quickstart, find the **minimum `stripe` (Node) and Stripe.js versions** and
   the **API version** (or preview version / beta header) that support `ui_mode: "form"`.
2. `stripe@17.5` with `2025-02-24.acacia` is almost certainly too old. **Don't bump the
   global client:** the comment in `src/stripe.ts` says the pinned version protects the
   live Checkout/refund/webhook paths. Choose one of:
   - **Preferred:** a separate Stripe client instance (or a per-request `apiVersion`
     override, which the file already uses for SPT) used only by the sandbox route.
   - Upgrade the `stripe` package only if the installed SDK can't send the needed
     params/version at all. If you upgrade, run `bun test` and confirm the existing hosted
     flow still type-checks and works.
3. **Verify account eligibility** with a throwaway script (`scripts/habanero-ping.ts`)
   that calls `checkout.sessions.create({ ui_mode: 'form', ... })` against the configured
   key and prints `id`, `ui_mode`, and whether `client_secret` exists. If the account
   isn't enabled, **stop and report the exact error**. Jonathan has to get the account
   gated in, and none of the rest matters until then.
4. Check whether `STRIPE_SECRET_KEY` is test or live (`sk_test_` vs `sk_live_`). Jonathan
   plans to place **real orders and refund them**, so a live key is expected. Confirm
   with him before the first live charge.

---

## 5. Step 2: server route

Add to `src/server.ts`, following its existing `if (url.pathname === …)` style. Ideally
put the Stripe logic in `src/stripe.ts` next to `createCheckoutSession`.

### `POST /api/sandbox/checkout-session`

- Body: `{ size }`, validated with `isValidSize()`, defaulting to `m`. Nothing else is
  client-controlled. The server fixes price and quantity.
- Creates a Session with:
  - `ui_mode: 'form'`
  - `mode: 'payment'`
  - `line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }]`
  - `shipping_address_collection: { allowed_countries: ['US'] }` (HARD RULE)
  - email/phone collection, matching Press if it does that
  - `return_url: ${PUBLIC_URL}/sandbox/complete?session_id={CHECKOUT_SESSION_ID}`
    (or whatever completion param the form docs specify)
  - `metadata: { sandbox: 'habanero', size }`, with **no `orderId`** (see §6)
- Responds `{ clientSecret }` and nothing else. No session object, no secret key.

### `GET /api/sandbox/session-status?session_id=…`

Returns `{ status, payment_status, customer_email }` for the completion page.

### Publishable key

The browser needs `STRIPE_PUBLISHABLE_KEY`. Either include it in the session response as
`{ clientSecret, publishableKey }` or serve it from a tiny `GET /api/sandbox/config`.
Never inline a secret.

---

## 6. Step 3: webhook and fulfillment safety (most important)

The existing `handleWebhook` already handles `checkout.session.completed` and can create
**real Prodigi print orders**. Sandbox purchases must **not** print and ship tees unless
Jonathan says so.

- Branch on `session.metadata.sandbox === 'habanero'` **before** the `orderId` lookup.
  For sandbox sessions, log the event (session id, amount, email, shipping address
  presence, `ui_mode`) to a small sandbox log or the console, return `200
  { received: true, sandbox: true }`, and **don't** call `fulfillPaidOrder` or Prodigi.
- Today a session without `orderId` returns 400, which makes Stripe retry forever. The
  sandbox branch has to come first.
- Signature verification: the sandbox path must reject unsigned events. Ideally fix the
  "no secret → trust raw JSON" fallback for all events, but that changes behavior for
  live orders, so **ask Jonathan** before changing it globally. At minimum, the sandbox
  branch requires a verified event.
- If the webhook client needs the newer API version to parse the event, use the same
  separate client from §4.
- Add a test in `tests/` showing that a sandbox `checkout.session.completed` never
  reaches the Prodigi path.

---

## 7. Step 4: sandbox page

A new static page, `public/sandbox/index.html` (+ `public/sandbox/main.ts`), served at
`/sandbox`. Add it to `vite.config.ts` `rollupOptions.input` with an absolute
`resolve(import.meta.dirname, …)` path, like the existing entry. Check that the
production static handler in `server.ts` (~L2114) serves `/sandbox` and
`/sandbox/complete`.

Requirements, chosen to make agent testing clean:

- **Plain semantic HTML.** One `<h1>`, one product line ("forbotsonly Tee — $40"), a
  native `<select>` for size with a `<label>`, and a "Continue to payment" `<button>`.
  No canvas, WebGL, Matter.js, animation loops, or `aria-busy` left on. This removes
  every non-Stripe suspect from the Press diagnosis.
- On click (or on load with default size): POST to `/api/sandbox/checkout-session`, then
  mount the Checkout form into `<div id="checkout">` following the quickstart's vanilla
  JS steps exactly. Load Stripe.js from `https://js.stripe.com` as the docs require. Don't
  self-host it.
- Use the Appearance API with minimal theming, or none. Keep it near default so the repro
  is the stock form.
- Visible status text: "Loading checkout…" → "Ready" (or an error message), plus
  `console.log` milestones (`session created`, `checkout mounted`, `ready` event,
  `confirm result`). Agents and humans can then tell how far it got.
- If the vanilla API has a separate confirm/pay step, render our own `<button>` that
  calls it, so the agent's final click lands on a first-party element.
- `/sandbox/complete`: reads `session_id`, calls the status endpoint, and shows "Payment
  succeeded: {session id}" or the failure.
- Add `<meta name="robots" content="noindex">`. Don't link it from the main site.
- Optionally show a short line of instructions for agents ("Buy one tee in size M, ship
  to [Jonathan's real address]"). **Never** hardcode or invent an address (HARD RULES).
  The agent's operator provides it.

### Optional diagnostic toggles (cheap, high value for OCS)

Query params on `/sandbox`, all off by default:
- `?appearance=none` vs. default: tests whether theming matters.
- `?autoload=1`: mounts on page load instead of waiting for a button click, to match
  Press's behavior.

Don't add the 3D viewer. Bisecting Press is Jonathan's job. This page is the
"Stripe only" baseline.

---

## 8. Step 5: verify

1. `bun test` passes, including the new webhook-safety test.
2. Local run: `bun run server` + `bun run dev`, open `/sandbox`, and complete a purchase
   with a test card if the key is a test key. Use the `preview` skill to take a screenshot
   and collect console errors.
3. Webhooks locally: `stripe listen --forward-to localhost:3001/webhook/stripe`. Confirm
   the sandbox branch logs the event and **no Prodigi order is created**.
4. **Agent observability check.** In Chrome DevTools → Accessibility pane on `/sandbox`:
   does the tree build, and does it descend into the `js.stripe.com` iframe? Record it.
5. Hand off for deploy. Deploys go through Railway (see `server.ts` logs and the
   `PUBLIC_URL` env var). **Ask before deploying or placing any live charge.**

---

## 9. Optional variant: React parity with Press

If the vanilla page **works** for agents and Press **doesn't**, the next question is
whether the React wrapper causes it. Only then add `/sandbox/react`: a separate Vite
entry using React + `@stripe/react-stripe-js/checkout` `CheckoutFormProvider` +
`<CheckoutForm />`, pinned to Press's exact versions. Same server endpoint. Don't build
this up front.

---

## 10. Agent test protocol (what Jonathan runs after deploy)

For each agent (Muse, Instinct, plus a control like Claude in Chrome):

| Step | Record |
|---|---|
| Open `/sandbox` | Did the AX snapshot succeed? Time to "Ready"? |
| Pick size, click Continue | Did the click dispatch? |
| Observe the form | Can the agent **see** the email/name/address/card fields inside the iframe? |
| Fill contact + shipping | Accepted or rejected at dispatch? Exact error text. |
| Fill card (test card on test keys) | Same. |
| Submit | Session `completed`? Webhook received? |

Write results to `docs/HABANERO-AGENT-RESULTS.md` as a table per agent, with exact error
strings and screenshots. That file becomes the OCS writeup. It should separate the two
failure modes from the Press diagnosis: **(a) not observable** and **(b) observable but
not fillable**. It should also say whether a plain page reproduces either one.

---

## 11. Done when

- [x] Step 0 summary posted and confirmed by Jonathan
- [ ] Account confirmed enabled for `ui_mode: "form"` (or the blocker reported). No local keys (Railway CLI is blocked on Stripe laptops), so this gets checked on the deployed site.
- [x] `/api/sandbox/checkout-session` returns only `clientSecret` (+ publishable key)
- [ ] `/sandbox` mounts the stock Checkout form on a plain page; `/sandbox/complete` works. Built and smoke-tested without keys; verify on the deployed site.
- [x] Sandbox webhooks are signature-verified, logged, and **never** reach Prodigi (tested in `tests/sandbox-webhook.test.ts`)
- [x] Existing hosted checkout, MCP tools, and `bun test` unaffected (store code paths unchanged; the 7 `bun test` failures predate this work)
- [x] No React added (unless §9 was triggered), no secrets in the browser, no `embedded`/`custom` ui_mode
- [x] Changes on a branch, not `main`. Commit only when Jonathan asks, with **no** Claude attribution trailers (per his global CLAUDE.md)

### Changes from this plan (Jonathan's calls during the build)

- **Store UI instead of a single product line.** `/sandbox` is a small shop (4 tee variants, Add to cart), `/sandbox/cart`, and `/sandbox/checkout`, mirroring Press's cart → checkout steps. Still plain HTML: no canvas, WebGL, or animation. All variants are the same `STRIPE_PRICE_ID`; the cart (max 5 tees) is recorded in `metadata.items`. Checkout mounts on arrival at `/sandbox/checkout`, so there's no `?autoload` toggle.
- **Versions.** Sandbox-only Stripe client on `2026-04-22.dahlia` (Press's version; `ui_mode: "form"` needs `2026-03-25.dahlia`+). Stripe.js defaults to Press's setup (dahlia + `custom_checkout_payment_form_1`, `webmcp_internal_beta`), with `?stripejs=endive`, `?betas=none`, `?appearance=none`, `?layout=expanded|compact` toggles.
- **No first-party Pay button.** Checkout form's Pay button is inside Stripe's iframe and `confirm` needs its `formConfirmEvent`, so the agent's final click has to land in the iframe.
- **Store webhook left as is**, including two known issues: unsigned events are trusted when the `stripe-signature` header is missing, and under Bun the sync `constructEvent()` always throws (stripe resolves to its worker build), so signed store webhooks fail verification. The sandbox branch uses `constructEventAsync()`.
