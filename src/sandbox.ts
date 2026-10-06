/**
 * Checkout form (Habanero) agent sandbox. See docs/HABANERO-AGENT-SANDBOX-PLAN.md.
 *
 * A plain page with only a Stripe Checkout form on it, used to test whether browser agents can
 * observe and fill Checkout form. Sandbox purchases are tagged with metadata.sandbox and are never
 * fulfilled: no store order, no Prodigi order. Jonathan refunds them by hand.
 *
 * No imports on purpose: vite.config.ts, the sandbox page itself, and the tests load this file too.
 */

export const SANDBOX_METADATA_VALUE = 'habanero';

// Sandbox pages are their own Vite entries. The static handler and the Vite dev server map these
// paths explicitly so they don't fall through to the main site's SPA index.html.
export const SANDBOX_PAGES: Record<string, string> = {
  '/sandbox': '/sandbox/index.html',
  '/sandbox/': '/sandbox/index.html',
  '/sandbox/cart': '/sandbox/index.html',
  '/sandbox/checkout': '/sandbox/index.html',
  '/sandbox/complete': '/sandbox/complete/index.html',
  '/sandbox/complete/': '/sandbox/complete/index.html',
};

// The sandbox store's catalog. Every tee is the same Stripe price (STRIPE_PRICE_ID); the variant
// only picks the picture and is recorded in metadata. Nothing is printed.
export const SANDBOX_PRODUCTS = [
  { id: 'hexagon-orange', name: 'Orange Hexagon Tee', image: '/images/previews/flatlay-hexagon-orange.png' },
  { id: 'blob-blue', name: 'Blue Blob Tee', image: '/images/previews/flatlay-blob-blue.png' },
  { id: 'circle-hot-pink', name: 'Pink Circle Tee', image: '/images/previews/flatlay-circle-hot-pink.png' },
  { id: 'cloud-light-green', name: 'Green Cloud Tee', image: '/images/previews/flatlay-cloud-light-green.png' },
] as const;

// Display only. Stripe charges whatever STRIPE_PRICE_ID is ($40 today).
export const SANDBOX_UNIT_PRICE_USD = 40;

// Every tee is refunded by hand, so keep orders small.
export const SANDBOX_MAX_QUANTITY = 5;

/**
 * Validate the cart the sandbox page posts: { items: [{ product, size, quantity }] }. Price is never
 * client-controlled. Returns the total quantity and a summary for metadata, e.g.
 * "hexagon-orange:m:2,blob-blue:l:1".
 */
export function parseSandboxCart(
  body: any,
  validSizes: readonly string[]
): { quantity: number; items: string } | { error: string } {
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Cart is empty' };
  }

  const lines = new Map<string, number>();
  for (const item of items) {
    const product = String(item?.product ?? '');
    const size = String(item?.size ?? '').toLowerCase();
    const quantity = Number(item?.quantity);
    if (!SANDBOX_PRODUCTS.some((p) => p.id === product)) {
      return { error: `Unknown product: ${item?.product}` };
    }
    if (!validSizes.includes(size)) {
      return { error: `Invalid size: ${item?.size}. Use one of: ${validSizes.join(', ')}` };
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { error: `Invalid quantity for ${product} size ${size}: ${item?.quantity}` };
    }
    const key = `${product}:${size}`;
    lines.set(key, (lines.get(key) ?? 0) + quantity);
  }

  const quantity = [...lines.values()].reduce((sum, qty) => sum + qty, 0);
  if (quantity > SANDBOX_MAX_QUANTITY) {
    return { error: `At most ${SANDBOX_MAX_QUANTITY} tees per order` };
  }

  return { quantity, items: [...lines].map(([key, qty]) => `${key}:${qty}`).join(',') };
}

export interface SandboxWebhookResult {
  status: number;
  body: Record<string, unknown>;
}

function isSandboxEvent(event: any): boolean {
  return event?.data?.object?.metadata?.sandbox === SANDBOX_METADATA_VALUE;
}

/**
 * Sandbox branch of POST /webhook/stripe. Runs first, before the store's signature check and
 * orderId lookup.
 *
 * Returns null for non-sandbox events (or unparseable bodies), so the caller continues down the
 * store path unchanged. Sandbox events stop here: ones that fail `verify` are rejected, verified
 * ones are logged and acknowledged with a 200 so Stripe doesn't retry them.
 *
 * `verify` must check the Stripe signature and return the event (constructEventAsync).
 */
export async function handleSandboxWebhook(
  rawBody: string,
  verify: () => Promise<any>,
  log: (...args: unknown[]) => void = console.log
): Promise<SandboxWebhookResult | null> {
  // Unverified parse is only for routing. Everything logged comes from the verified event.
  let unverified: any;
  try {
    unverified = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!isSandboxEvent(unverified)) {
    return null;
  }

  let event: any;
  try {
    event = await verify();
  } catch (err: any) {
    log(`[Sandbox] Rejected ${unverified?.type} event for ${unverified?.data?.object?.id}: ${err?.message}`);
    return { status: 400, body: { error: 'Sandbox webhook events must have a valid Stripe signature' } };
  }

  const session = event.data.object;
  // Newer API versions moved shipping to collected_information; the endpoint's version decides the shape.
  const shipping = session.collected_information?.shipping_details ?? session.shipping_details ?? null;

  log('[Sandbox] Webhook event (not fulfilled):', {
    type: event.type,
    eventId: event.id,
    sessionId: session.id,
    uiMode: session.ui_mode,
    livemode: session.livemode,
    status: session.status,
    paymentStatus: session.payment_status,
    amountTotal: session.amount_total,
    currency: session.currency,
    email: session.customer_details?.email ?? null,
    hasShippingAddress: Boolean(shipping?.address?.line1),
    items: session.metadata?.items ?? null,
  });

  return { status: 200, body: { received: true, sandbox: true } };
}
