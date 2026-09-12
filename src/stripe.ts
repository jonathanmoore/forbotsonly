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
