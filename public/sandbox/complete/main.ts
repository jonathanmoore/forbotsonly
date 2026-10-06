/**
 * Checkout form sandbox return page: /sandbox/complete?session_id=cs_...
 * Shows the Checkout Session's result. Fulfillment never happens for sandbox sessions.
 */

import { clearCart } from '../cart';

const statusEl = document.getElementById('status') as HTMLParagraphElement;
const sessionId = new URLSearchParams(location.search).get('session_id') ?? '';

async function showResult(): Promise<void> {
  if (!sessionId.startsWith('cs_')) {
    statusEl.textContent = 'Payment failed: no session_id in the URL.';
    return;
  }

  try {
    const response = await fetch(`/api/sandbox/session-status?session_id=${encodeURIComponent(sessionId)}`);
    const json = await response.json();
    console.log('[sandbox] session status', json);
    if (!response.ok) {
      throw new Error(json.error ?? `HTTP ${response.status}`);
    }

    if (json.status === 'complete' && json.payment_status === 'paid') {
      statusEl.textContent = `Payment succeeded: ${sessionId}`;
      clearCart();
    } else {
      statusEl.textContent = `Payment not completed: ${sessionId} (status: ${json.status}, payment_status: ${json.payment_status})`;
    }
  } catch (error: any) {
    statusEl.textContent = `Payment failed: ${sessionId} (${error?.message ?? error})`;
  }
}

showResult();
