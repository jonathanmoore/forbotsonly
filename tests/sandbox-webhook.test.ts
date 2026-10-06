/**
 * Agent sandbox webhook safety tests
 *
 * Sandbox Checkout form sessions (metadata.sandbox = 'habanero') must never reach store
 * fulfillment (fulfillPaidOrder) or Prodigi:
 * 1. Signed sandbox events are acknowledged with 200 { received, sandbox } and stop there,
 *    even when the metadata also carries an orderId
 * 2. Unsigned sandbox events are rejected
 * 3. Non-sandbox events still take the store path
 *
 * The end-to-end tests spawn the real server with fake keys, no database, no Prodigi key, and
 * no .env, so nothing here can touch real Stripe, Postgres, or Prodigi.
 *
 * Run with: bun test tests/sandbox-webhook.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Stripe from 'stripe';
import { handleSandboxWebhook, parseSandboxCart, SANDBOX_MAX_QUANTITY } from '../src/sandbox';

const WEBHOOK_SECRET = 'whsec_test_sandbox_webhook';
const stripe = new Stripe('sk_test_dummy');

function checkoutCompletedEvent(metadata: Record<string, string>) {
  return {
    id: 'evt_test_sandbox',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_sandbox',
        object: 'checkout.session',
        ui_mode: 'form',
        livemode: false,
        status: 'complete',
        payment_status: 'paid',
        amount_total: 4000,
        currency: 'usd',
        customer_details: { email: 'agent@example.com' },
        metadata,
      },
    },
  };
}

describe('handleSandboxWebhook', () => {
  const quiet = () => {};

  test('ignores non-sandbox events so the store path handles them', async () => {
    const body = JSON.stringify(checkoutCompletedEvent({ orderId: 'ord_123' }));
    let verifyCalled = false;
    const result = await handleSandboxWebhook(body, async () => { verifyCalled = true; }, quiet);
    expect(result).toBeNull();
    expect(verifyCalled).toBe(false);
  });

  test('ignores bodies that are not JSON', async () => {
    expect(await handleSandboxWebhook('not json', async () => ({}), quiet)).toBeNull();
  });

  test('rejects sandbox events that fail verification', async () => {
    const body = JSON.stringify(checkoutCompletedEvent({ sandbox: 'habanero', items: 'hexagon-orange:m:1' }));
    const result = await handleSandboxWebhook(body, async () => { throw new Error('No signatures found'); }, quiet);
    expect(result?.status).toBe(400);
  });

  test('acknowledges and logs verified sandbox events', async () => {
    const logs: unknown[][] = [];
    const event = checkoutCompletedEvent({ sandbox: 'habanero', items: 'hexagon-orange:m:1' });
    const result = await handleSandboxWebhook(JSON.stringify(event), async () => event, (...args) => logs.push(args));
    expect(result).toEqual({ status: 200, body: { received: true, sandbox: true } });
    expect(logs[0][1]).toMatchObject({ sessionId: 'cs_test_sandbox', uiMode: 'form', amountTotal: 4000 });
  });
});

describe('parseSandboxCart', () => {
  const sizes = ['s', 'm', 'l', 'xl', '2xl', '3xl'];

  test('merges lines and summarizes them for metadata', () => {
    const body = { items: [
      { product: 'hexagon-orange', size: 'M', quantity: 1 },
      { product: 'blob-blue', size: 'l', quantity: 2 },
      { product: 'hexagon-orange', size: 'm', quantity: 1 },
    ] };
    expect(parseSandboxCart(body, sizes)).toEqual({ quantity: 4, items: 'hexagon-orange:m:2,blob-blue:l:2' });
  });

  test('rejects empty carts, unknown products, bad sizes and quantities', () => {
    expect(parseSandboxCart(null, sizes)).toEqual({ error: 'Cart is empty' });
    expect(parseSandboxCart({ items: [] }, sizes)).toEqual({ error: 'Cart is empty' });
    expect(parseSandboxCart({ items: [{ product: 'nope', size: 'm', quantity: 1 }] }, sizes)).toHaveProperty('error');
    expect(parseSandboxCart({ items: [{ product: 'blob-blue', size: 'xxl', quantity: 1 }] }, sizes)).toHaveProperty('error');
    expect(parseSandboxCart({ items: [{ product: 'blob-blue', size: 'm', quantity: 0 }] }, sizes)).toHaveProperty('error');
    expect(parseSandboxCart({ items: [{ product: 'blob-blue', size: 'm', quantity: 1.5 }] }, sizes)).toHaveProperty('error');
  });

  test('caps the order size', () => {
    const body = { items: [{ product: 'blob-blue', size: 'm', quantity: SANDBOX_MAX_QUANTITY + 1 }] };
    expect(parseSandboxCart(body, sizes)).toEqual({ error: `At most ${SANDBOX_MAX_QUANTITY} tees per order` });
  });
});

describe('POST /webhook/stripe (real server)', () => {
  const port = 40000 + Math.floor(Math.random() * 10000);
  const baseUrl = `http://localhost:${port}`;
  const workDir = mkdtempSync(join(tmpdir(), 'forbotsonly-sandbox-test-'));
  let server: ReturnType<typeof Bun.spawn>;
  let output = '';

  beforeAll(async () => {
    server = Bun.spawn(['bun', '--no-env-file', resolve(import.meta.dir, '../src/server.ts')], {
      cwd: workDir,
      env: {
        PATH: process.env.PATH ?? '',
        PORT: String(port),
        DATA_DIR: workDir,
        STRIPE_SECRET_KEY: 'sk_test_dummy',
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
        DATABASE_URL: '',
        PRODIGI_API_KEY: '',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });

    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`${baseUrl}/health`)).ok) return;
      } catch {
        // not listening yet
      }
      await Bun.sleep(100);
    }
    throw new Error('server did not start');
  }, 15000);

  afterAll(async () => {
    server.kill();
    await server.exited;
    rmSync(workDir, { recursive: true, force: true });
  });

  async function postEvent(event: unknown, sign: 'valid' | 'none' | 'wrong-secret') {
    const payload = JSON.stringify(event);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sign !== 'none') {
      headers['stripe-signature'] = await stripe.webhooks.generateTestHeaderStringAsync({
        payload,
        secret: sign === 'valid' ? WEBHOOK_SECRET : 'whsec_wrong',
      });
    }
    const res = await fetch(`${baseUrl}/webhook/stripe`, { method: 'POST', headers, body: payload });
    return { status: res.status, body: await res.json() };
  }

  test('signed sandbox checkout.session.completed is acknowledged before the orderId lookup', async () => {
    // orderId is present but must be ignored: the store path would 404 on it ("Order not found")
    const event = checkoutCompletedEvent({ sandbox: 'habanero', items: 'hexagon-orange:m:1', orderId: 'ord_must_not_be_used' });
    const res = await postEvent(event, 'valid');
    expect(res).toEqual({ status: 200, body: { received: true, sandbox: true } });
  });

  test('unsigned sandbox event is rejected', async () => {
    const res = await postEvent(checkoutCompletedEvent({ sandbox: 'habanero', items: 'hexagon-orange:m:1' }), 'none');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('signature');
  });

  test('sandbox event with a bad signature is rejected', async () => {
    const res = await postEvent(checkoutCompletedEvent({ sandbox: 'habanero', items: 'hexagon-orange:m:1' }), 'wrong-secret');
    expect(res.status).toBe(400);
  });

  test('non-sandbox event still takes the store path', async () => {
    // Unsigned on purpose: the store path's existing fallback parses it and rejects the missing orderId
    const res = await postEvent(checkoutCompletedEvent({}), 'none');
    expect(res).toEqual({ status: 400, body: { error: 'No order ID in session metadata' } });
  });

  test('server never logged fulfillment or Prodigi activity', async () => {
    server.kill();
    await server.exited;
    output = (await new Response(server.stdout as ReadableStream).text()) + (await new Response(server.stderr as ReadableStream).text());

    expect(output).toContain('[Sandbox] Webhook event (not fulfilled)');
    expect(output).not.toContain('[Order]');
    expect(output).not.toContain('[Prodigi]');
    expect(output).not.toContain('Order fulfillment failed');
  });
});
