/**
 * Checkout form (Habanero) agent sandbox store: /sandbox (shop) → /sandbox/cart → /sandbox/checkout.
 *
 * The checkout step follows the vanilla JS path in https://docs.stripe.com/checkout/form/quickstart.
 * Like Press, it mounts as soon as you arrive at /sandbox/checkout.
 *
 * Diagnostic query params, all off by default (kept across views):
 *   ?appearance=none   pass no appearance at all (default: the stock 'stripe' theme)
 *   ?stripejs=endive   Stripe.js release train (default: dahlia, what Press's @stripe/stripe-js 9.x loads)
 *   ?betas=none        drop Press's Stripe.js betas (default: the same two betas Press passes)
 *   ?layout=expanded   form layout, expanded or compact (default: Stripe picks; Press uses expanded)
 */

import { SANDBOX_MAX_QUANTITY, SANDBOX_PRODUCTS, SANDBOX_UNIT_PRICE_USD } from '../../src/sandbox';
import { addToCart, cartQuantity, formatUsd, lineTotal, loadCart, productFor, saveCart, type CartLine } from './cart';

declare const Stripe: any;

const PRESS_BETAS = ['custom_checkout_payment_form_1', 'webmcp_internal_beta'];
const SIZES = ['s', 'm', 'l', 'xl', '2xl', '3xl'];

const params = new URLSearchParams(location.search);
const layoutParam = params.get('layout');
const config = {
  stripeJs: params.get('stripejs') === 'endive' ? 'endive' : 'dahlia',
  betas: params.get('betas') === 'none' ? [] : PRESS_BETAS,
  appearance: params.get('appearance') === 'none' ? null : { theme: 'stripe' },
  layout: layoutParam === 'expanded' || layoutParam === 'compact' ? layoutParam : null,
};

type View = 'shop' | 'cart' | 'checkout';
const VIEW_PATHS: Record<View, string> = { shop: '/sandbox', cart: '/sandbox/cart', checkout: '/sandbox/checkout' };

const views: Record<View, HTMLElement> = {
  shop: document.getElementById('shop-view')!,
  cart: document.getElementById('cart-view')!,
  checkout: document.getElementById('checkout-view')!,
};
const cartLink = document.getElementById('cart-link')!;
const shopStatus = document.getElementById('shop-status')!;
const statusEl = document.getElementById('status')!;
const checkoutButton = document.getElementById('checkout-button') as HTMLButtonElement;

document.getElementById('config')!.textContent =
  `Config: Stripe.js ${config.stripeJs} · betas: ${config.betas.join(', ') || 'none'} · ` +
  `appearance: ${config.appearance ? config.appearance.theme : 'none'} · layout: ${config.layout ?? 'auto'}`;

function milestone(name: string, detail?: unknown): void {
  console.log(`[sandbox] ${name}`, detail ?? '');
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// Always from js.stripe.com, never bundled or self-hosted. Loaded on every view, as Stripe recommends.
const stripeJs: Promise<any> = new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = `https://js.stripe.com/${config.stripeJs}/stripe.js`;
  script.onload = () => resolve(Stripe);
  script.onerror = () => reject(new Error(`Failed to load Stripe.js (${config.stripeJs})`));
  document.head.appendChild(script);
});

// ---- Navigation ----

function currentView(): View {
  const path = location.pathname.replace(/\/$/, '');
  if (path === VIEW_PATHS.cart) return 'cart';
  if (path === VIEW_PATHS.checkout) return 'checkout';
  return 'shop';
}

function navigate(view: View): void {
  history.pushState(null, '', VIEW_PATHS[view] + location.search);
  render();
}

// Keep the diagnostic params on every link
for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href^="/sandbox"]')) {
  link.href = link.getAttribute('href') + location.search;
}

document.addEventListener('click', (event) => {
  const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-view-link]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
  event.preventDefault();
  navigate(link.dataset.viewLink as View);
});

window.addEventListener('popstate', render);

// ---- Shop ----

function renderShop(): void {
  const grid = document.getElementById('product-grid')!;
  if (grid.childElementCount) return;

  for (const product of SANDBOX_PRODUCTS) {
    const sizeId = `size-${product.id}`;
    const select = el('select', { id: sizeId, name: 'size' }, SIZES.map((size) =>
      el('option', { value: size, textContent: size.toUpperCase(), selected: size === 'm' })
    ));
    const button = el('button', { type: 'button', className: 'primary', textContent: 'Add to cart' });
    button.addEventListener('click', () => {
      const error = addToCart(product.id, select.value);
      shopStatus.textContent = error ?? `Added ${product.name} (${select.value.toUpperCase()}) to your cart.`;
      milestone(error ? 'add to cart refused' : 'added to cart', { product: product.id, size: select.value });
      renderCartLink();
    });

    grid.append(el('article', { className: 'card' }, [
      el('img', { src: product.image, alt: `${product.name}, black tee, flat lay` }),
      el('h3', { textContent: product.name }),
      el('p', { textContent: formatUsd(SANDBOX_UNIT_PRICE_USD) }),
      el('div', { className: 'row' }, [el('label', { htmlFor: sizeId, textContent: 'Size' }), select]),
      button,
    ]));
  }
}

// ---- Cart ----

function renderCartLink(): void {
  cartLink.textContent = `Cart (${cartQuantity(loadCart())})`;
}

function renderCart(): void {
  const lines = loadCart();
  const container = document.getElementById('cart-lines')!;
  container.replaceChildren();

  if (!lines.length) {
    container.append(el('p', { textContent: 'Your cart is empty.' }));
  }

  lines.forEach((line, index) => {
    const product = productFor(line);
    const quantityId = `quantity-${index}`;
    const maxForLine = SANDBOX_MAX_QUANTITY - (cartQuantity(lines) - line.quantity);
    const quantity = el('select', { id: quantityId }, Array.from({ length: maxForLine }, (_, i) =>
      el('option', { value: String(i + 1), textContent: String(i + 1), selected: i + 1 === line.quantity })
    ));
    quantity.addEventListener('change', () => {
      line.quantity = Number(quantity.value);
      saveCart(lines);
      render();
    });
    const remove = el('button', { type: 'button', className: 'link', textContent: 'Remove' });
    remove.addEventListener('click', () => {
      saveCart(lines.filter((_, i) => i !== index));
      render();
    });

    container.append(el('div', { className: 'cart-line' }, [
      el('img', { src: product?.image ?? '', alt: product?.name ?? line.product }),
      el('div', { className: 'details' }, [
        el('div', { textContent: product?.name ?? line.product }),
        el('div', { textContent: `Size ${line.size.toUpperCase()}` }),
        el('div', { className: 'row' }, [el('label', { htmlFor: quantityId, textContent: 'Qty' }), quantity, remove]),
      ]),
      el('div', { textContent: formatUsd(lineTotal(line)) }),
    ]));
  });

  document.getElementById('cart-subtotal')!.textContent = formatUsd(lines.reduce((sum, line) => sum + lineTotal(line), 0));
  checkoutButton.disabled = !lines.length;
}

checkoutButton.addEventListener('click', () => navigate('checkout'));

// ---- Checkout ----

let mountedCart: string | null = null;

function renderCheckout(): void {
  const lines = loadCart();
  const summary = document.getElementById('summary-lines')!;
  summary.replaceChildren(...lines.map((line) =>
    el('div', { className: 'summary-line' }, [
      el('span', { textContent: `${productFor(line)?.name ?? line.product} · ${line.size.toUpperCase()} × ${line.quantity}` }),
      el('span', { textContent: formatUsd(lineTotal(line)) }),
    ])
  ));
  document.getElementById('summary-subtotal')!.textContent = formatUsd(lines.reduce((sum, line) => sum + lineTotal(line), 0));

  if (!lines.length) {
    statusEl.textContent = 'Your cart is empty.';
    return;
  }

  const cartKey = JSON.stringify(lines);
  if (mountedCart === null) {
    mountedCart = cartKey;
    startCheckout(lines);
  } else if (mountedCart !== cartKey) {
    // The mounted form belongs to a Session for the old cart. Start over with a fresh page.
    location.reload();
  }
}

async function startCheckout(lines: CartLine[]): Promise<void> {
  statusEl.textContent = 'Loading checkout…';

  try {
    const response = await fetch('/api/sandbox/checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: lines }),
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error ?? `Checkout Session request failed (HTTP ${response.status})`);
    }
    milestone('session created');

    const StripeJs = await stripeJs;
    const stripe = StripeJs(json.publishableKey, config.betas.length ? { betas: config.betas } : undefined);

    const checkout = stripe.initCheckoutFormSdk({
      clientSecret: json.clientSecret,
      ...(config.appearance ? { appearance: config.appearance } : {}),
    });

    const form = checkout.createForm(config.layout ? { layout: config.layout } : undefined);
    form.on('ready', () => {
      milestone('ready event');
      statusEl.textContent = 'Ready';
    });
    form.on('loaderror', (event: any) => {
      milestone('loaderror event', event);
      statusEl.textContent = `Error: ${event?.error?.message ?? 'Checkout form failed to load'}`;
    });
    form.mount('#checkout-form');
    milestone('checkout mounted');

    // Checkout form's Pay button lives inside Stripe's iframe; it emits 'confirm' and we confirm with that event.
    const loadActionsResult = await checkout.loadActions();
    if (loadActionsResult.type !== 'success') {
      throw new Error(loadActionsResult.error?.message ?? 'Checkout actions failed to load');
    }
    form.on('confirm', async (event: any) => {
      milestone('confirm event');
      statusEl.textContent = 'Confirming payment…';
      try {
        const result = await loadActionsResult.actions.confirm({ formConfirmEvent: event });
        milestone('confirm result', result);
        if (result?.type === 'error') {
          statusEl.textContent = `Payment error: ${result.error?.message}`;
        }
      } catch (error: any) {
        console.error('Payment confirmation error:', error);
        statusEl.textContent = `Payment error: ${error?.message ?? error}`;
      }
    });
  } catch (error: any) {
    milestone('error', error);
    statusEl.textContent = `Error: ${error?.message ?? error}`;
    // Let the next visit to checkout try again
    mountedCart = null;
  }
}

// ---- Render ----

function render(): void {
  const view = currentView();
  for (const [name, section] of Object.entries(views)) {
    section.hidden = name !== view;
  }
  renderCartLink();
  if (view === 'shop') renderShop();
  if (view === 'cart') renderCart();
  if (view === 'checkout') renderCheckout();
}

render();
