import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';

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
    payment_method_types: ['card'],
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
 * Retrieve and validate a Shared Payment Token (SPT) from Link.
 * Uses Stripe preview API version 2026-04-22.preview via rawRequest.
 * Returns granted token data or throws on validation/auth errors.
 */
export async function retrieveSharedPaymentToken(
  sharedPaymentToken: string
): Promise<{
  id: string;
  payment_method_data: any;
}> {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  // Validate SPT is not empty before Stripe call
  if (!sharedPaymentToken || !sharedPaymentToken.trim()) {
    throw new Error(
      'Shared Payment Token is required. Please provide a valid SPT from your Link spend request.'
    );
  }

  try {
    // Use rawRequest to call preview API endpoint with custom version header
    // Endpoint: GET /v1/shared_payment/granted_tokens/:id
    const response = await stripe.rawRequest('GET', `/v1/shared_payment/granted_tokens/${sharedPaymentToken}`, {
      headers: {
        'Stripe-Version': '2026-04-22.preview',
      },
    });

    return response as any;
  } catch (err: any) {
    // Handle Stripe errors with clean user-facing messages
    if (err.statusCode === 404 || err.code === 'resource_missing') {
      throw new Error(
        `Shared Payment Token not found or invalid: ${sharedPaymentToken}. ` +
        'Please verify the SPT from your Link spend request and try again.'
      );
    }
    
    if (err.statusCode === 401 || err.statusCode === 403 || err.code === 'authentication_required') {
      throw new Error(
        `Shared Payment Token authentication failed: ${err.message}. ` +
        'This SPT may be expired, revoked, or not authorized for this merchant.'
      );
    }

    // Generic Stripe error
    console.error('[Stripe SPT] Retrieval failed:', err);
    throw new Error(
      `Failed to validate Shared Payment Token: ${err.message || 'Unknown error'}. ` +
      'Please verify your SPT and try again.'
    );
  }
}

/**
 * Create a PaymentIntent using a Shared Payment Token (SPT).
 * Uses Stripe preview API version 2026-04-22.preview for SPT support.
 * Does NOT auto-confirm - returns PaymentIntent in requires_confirmation state.
 */
export async function createPaymentIntentWithSPT(
  amount: number, // in cents
  currency: string,
  sharedPaymentToken: string,
  metadata: Record<string, string>
): Promise<{
  paymentIntentId: string;
  clientSecret: string | null;
  status: string;
}> {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  try {
    // Create PaymentIntent with payment_method_data.shared_payment_granted_token
    // using preview API version
    const response = await stripe.rawRequest('POST', '/v1/payment_intents', {
      headers: {
        'Stripe-Version': '2026-04-22.preview',
      },
      data: {
        amount,
        currency,
        payment_method_data: {
          type: 'card',
          shared_payment_granted_token: sharedPaymentToken,
        },
        metadata,
        capture_method: 'automatic',
        confirm: false, // Do NOT auto-confirm - wait for manual approval
      },
    });

    const paymentIntent = response as any;
    
    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    };
  } catch (err: any) {
    console.error('[Stripe SPT] PaymentIntent creation failed:', err);
    throw new Error(
      `Failed to create payment with SPT: ${err.message || 'Unknown error'}. ` +
      'Please try again or use create_checkout as fallback.'
    );
  }
}
