import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';

// CRITICAL: Use stable API version for main client (Checkout, refunds, webhooks)
// SPT operations use per-request apiVersion to avoid breaking production
let stripe: Stripe | null = null;

if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });
}

export function isStripeConfigured(): boolean {
  return !!stripe;
}

export async function createCheckoutSession(
  priceId: string,
  quantity: number,
  metadata: Record<string, string>,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string; sessionId: string; livemode: boolean } | null> {
  if (!stripe) {
    return null;
  }

  const session = await stripe.checkout.sessions.create({
    // Omit payment_method_types to enable Stripe Dashboard dynamic payment methods + Link
    line_items: [
      {
        price: priceId,
        quantity,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    shipping_address_collection: {
      allowed_countries: ['US'], // HARD RULE: US orders only
    },
  });

  return {
    url: session.url ?? '',
    sessionId: session.id,
    livemode: session.livemode,
  };
}

export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
  if (!stripe) return null;
  return await stripe.checkout.sessions.retrieve(sessionId);
}

export async function refundPayment(paymentIntentId: string): Promise<{ refundId: string; status: string }> {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }
  
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
    });
    
    return {
      refundId: refund.id,
      status: refund.status ?? 'pending',
    };
  } catch (err: any) {
    console.error('[Stripe] Refund failed:', err.message);
    throw err;
  }
}

export function getPublishableKey(): string {
  return STRIPE_PUBLISHABLE_KEY;
}

/**
 * Verify a Shared Payment Token (SPT) before charging.
 * Checks usage limits: amount, currency, expiration, and active status.
 * Uses rawRequest with preview API version to avoid SDK dependency on sharedPayment.
 * Returns error message if invalid, null if valid.
 */
export async function verifySharedPaymentToken(
  sharedPaymentToken: string,
  amountInCents: number,
  currency: string
): Promise<{ valid: boolean; error?: string; grantedToken?: any }> {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  // Validate SPT is not empty before Stripe call
  if (!sharedPaymentToken || !sharedPaymentToken.trim()) {
    return {
      valid: false,
      error: 'Shared Payment Token is required. Please provide a valid SPT from your Link spend request.',
    };
  }

  try {
    // Retrieve the granted token using rawRequest with preview API version (per-request)
    // CRITICAL: Per-request apiVersion to avoid breaking Checkout/refunds on stable version
    // Uses rawRequest because stripe.sharedPayment.grantedTokens doesn't exist in stripe@^17.5.0
    const grantedToken = await stripe.rawRequest(
      'GET',
      `/v1/shared_payment/granted_tokens/${sharedPaymentToken.trim()}`,
      null,
      { apiVersion: '2026-04-22.preview' }
    ) as any;

    // Check if deactivated
    if (grantedToken.deactivated_at) {
      return {
        valid: false,
        error: `Shared Payment Token is deactivated (reason: ${grantedToken.deactivated_reason || 'unknown'})`,
      };
    }

    // Check usage limits
    const limits = grantedToken.usage_limits;
    
    // Verify currency
    if (limits.currency.toLowerCase() !== currency.toLowerCase()) {
      return {
        valid: false,
        error: `Currency mismatch: token allows ${limits.currency.toUpperCase()}, requested ${currency.toUpperCase()}`,
      };
    }

    // Verify amount
    if (amountInCents > limits.max_amount) {
      return {
        valid: false,
        error: `Amount exceeds limit: max ${limits.max_amount / 100} ${limits.currency.toUpperCase()}, requested ${amountInCents / 100} ${currency.toUpperCase()}`,
      };
    }

    // Verify expiration
    if (limits.expires_at && Date.now() / 1000 > limits.expires_at) {
      return {
        valid: false,
        error: `Shared Payment Token expired at ${new Date(limits.expires_at * 1000).toISOString()}`,
      };
    }

    return { valid: true, grantedToken };
  } catch (err: any) {
    console.error('[Stripe] Failed to verify SPT:', err.message);
    
    // Handle specific error codes for better error messages
    if (err.statusCode === 404 || err.code === 'resource_missing') {
      return {
        valid: false,
        error: `Shared Payment Token not found or invalid: ${sharedPaymentToken}. Please verify the SPT from your Link spend request.`,
      };
    }
    
    if (err.statusCode === 401 || err.statusCode === 403 || err.code === 'authentication_required') {
      return {
        valid: false,
        error: `Shared Payment Token authentication failed: ${err.message}. This SPT may be expired, revoked, or not authorized for this merchant.`,
      };
    }
    
    return {
      valid: false,
      error: `Failed to verify token: ${err.message}`,
    };
  }
}

/**
 * Create a PaymentIntent using a Shared Payment Token (SPT).
 * This is the server-side agent checkout flow - no browser Checkout UI needed.
 * Uses rawRequest with preview API version to avoid SDK dependency issues.
 */
export async function createPaymentIntentWithSPT(
  sharedPaymentToken: string,
  amountInCents: number,
  currency: string,
  metadata: Record<string, string>,
  idempotencyKey: string
): Promise<{ success: boolean; paymentIntentId?: string; error?: string }> {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  try {
    // Verify token first
    const verification = await verifySharedPaymentToken(sharedPaymentToken, amountInCents, currency);
    if (!verification.valid) {
      return {
        success: false,
        error: verification.error,
      };
    }

    // Create PaymentIntent with SPT using rawRequest with preview API version (per-request)
    // CRITICAL: Per-request apiVersion to avoid breaking Checkout/refunds on stable version
    // Uses rawRequest because payment_method_data.shared_payment_granted_token needs preview API
    const paymentIntent = await stripe.rawRequest(
      'POST',
      '/v1/payment_intents',
      {
        amount: amountInCents,
        currency,
        payment_method_data: {
          type: 'card',
          shared_payment_granted_token: sharedPaymentToken.trim(),
        },
        confirm: true,
        metadata,
      },
      {
        apiVersion: '2026-04-22.preview',
        idempotencyKey,
      }
    ) as any;

    if (paymentIntent.status === 'succeeded') {
      return {
        success: true,
        paymentIntentId: paymentIntent.id,
      };
    } else if (paymentIntent.status === 'requires_action') {
      return {
        success: false,
        error: `Payment requires additional action (status: ${paymentIntent.status}). This may require 3D Secure authentication or other verification.`,
      };
    } else {
      return {
        success: false,
        error: `Payment failed with status: ${paymentIntent.status}`,
      };
    }
  } catch (err: any) {
    console.error('[Stripe] PaymentIntent with SPT failed:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Retrieve customer contact and shipping details from a PaymentIntent.
 * Used to extract contact/shipping after SPT payment succeeds.
 */
export async function getPaymentIntentDetails(paymentIntentId: string): Promise<{
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  shippingAddress?: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
} | null> {
  if (!stripe) return null;

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    // PaymentIntent doesn't directly have shipping, but we can get from the charge
    const charges = paymentIntent.charges?.data?.[0];
    const billingDetails = charges?.billing_details;
    
    return {
      customerEmail: billingDetails?.email || undefined,
      customerName: billingDetails?.name || undefined,
      customerPhone: billingDetails?.phone || undefined,
      // Note: SPT flow may not have shipping address on PaymentIntent
      // Shipping must come from Link confirmation (part of #84)
    };
  } catch (err: any) {
    console.error('[Stripe] Failed to retrieve PaymentIntent:', err.message);
    return null;
  }
}
