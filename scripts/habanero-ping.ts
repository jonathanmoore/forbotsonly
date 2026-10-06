#!/usr/bin/env bun

/**
 * Checkout form (Habanero) eligibility ping
 *
 * Creates one ui_mode: 'form' Checkout Session with the exact params the /sandbox route uses,
 * prints what came back, then expires it. If the account isn't enabled for Checkout form, the
 * Stripe error is printed as-is.
 *
 * Usage:
 *   bun run scripts/habanero-ping.ts
 *
 * Environment:
 *   STRIPE_SECRET_KEY, STRIPE_PRICE_ID (read from .env by Bun)
 *   PUBLIC_URL - Optional; used only to build the return_url
 */

import { createSandboxCheckoutSession, expireSandboxCheckoutSession, SANDBOX_API_VERSION } from '../src/stripe';
import { getStripePriceId } from '../src/products';

const key = process.env.STRIPE_SECRET_KEY || '';
const priceId = getStripePriceId();

if (!key || !priceId) {
  console.error('❌ STRIPE_SECRET_KEY and STRIPE_PRICE_ID must be set');
  process.exit(1);
}

const mode = key.startsWith('sk_live_') ? 'LIVE' : key.startsWith('sk_test_') ? 'test' : `unknown (${key.slice(0, 8)}…)`;
const returnUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/sandbox/complete?session_id={CHECKOUT_SESSION_ID}`;

console.log(`🌶️  Checkout form ping`);
console.log(`   key mode:    ${mode}`);
console.log(`   API version: ${SANDBOX_API_VERSION}`);
console.log(`   price:       ${priceId}`);

try {
  const session = await createSandboxCheckoutSession(priceId, 1, 'hexagon-orange:m:1', returnUrl);
  if (!session) throw new Error('Stripe client not configured');

  console.log(`✅ Session created`);
  console.log(`   id:            ${session.id}`);
  console.log(`   ui_mode:       ${session.uiMode}`);
  console.log(`   client_secret: ${session.clientSecret ? 'present' : 'MISSING'}`);
  console.log(`   livemode:      ${session.livemode}`);

  await expireSandboxCheckoutSession(session.id);
  console.log(`   (expired ${session.id})`);
} catch (err: any) {
  console.error(`❌ Checkout Session create failed`);
  console.error(`   message:    ${err.message}`);
  console.error(`   type:       ${err.type}`);
  console.error(`   code:       ${err.code}`);
  console.error(`   param:      ${err.param}`);
  console.error(`   statusCode: ${err.statusCode}`);
  console.error(`   requestId:  ${err.requestId}`);
  process.exit(1);
}
