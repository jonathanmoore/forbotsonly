import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';

let stripe: Stripe | null = null;

if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2024-11-20.acacia',
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
    url: session.url || '',
    sessionId: session.id,
    livemode: session.livemode,
  };
}

export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
  if (!stripe) return null;
  return await stripe.checkout.sessions.retrieve(sessionId);
}

export function getPublishableKey(): string {
  return STRIPE_PUBLISHABLE_KEY;
}
