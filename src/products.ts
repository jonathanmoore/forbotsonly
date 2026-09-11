import type { Product } from './types';
import { DEFAULT_MARK, MARK_SHAPES, MARK_COLORS } from './types';

const PRODIGI_SKU = process.env.PRODIGI_SKU || 'GLOBAL-TEE-BC-3001';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';

export const PRODUCTS: Product[] = [
  {
    id: 'tee-001',
    sku: PRODIGI_SKU,
    name: 'forbotsonly Tee',
    description: 'Black tee with customizable Grok Bot mark. Choose your shape and color!',
    // Price policy: Target $40 all-in (moving from $35)
    // Use STRIPE_PRICE_ID env var (set by CoS/team) - never hardcode
    price: 35.00, // Display price (actual Stripe price comes from STRIPE_PRICE_ID)
    currency: 'USD',
    attributes: {
      color: 'black',
      size: 'm',
    },
    // TODO: Add product image URL when flat lay photography is available
    // See PRODUCT_IMAGERY.md for specifications
    // imageUrl: '/images/products/forbotsonly-tee-flatlay.jpg',
  },
];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find(p => p.id === id);
}

export function listProducts(): Product[] {
  return PRODUCTS;
}

export function getStripePriceId(): string {
  return STRIPE_PRICE_ID;
}

export function getMarkOptions() {
  return {
    shapes: Array.from(MARK_SHAPES),
    colors: Array.from(MARK_COLORS),
    default: DEFAULT_MARK,
  };
}
