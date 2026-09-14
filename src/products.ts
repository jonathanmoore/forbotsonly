import type { Product } from './types';
import { DEFAULT_MARK, MARK_SHAPES, MARK_COLORS } from './types';

const PRODIGI_SKU = process.env.PRODIGI_SKU || 'GLOBAL-TEE-BC-3001';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';

// Prodigi GLOBAL-TEE-BC-3001 supported sizes (lowercase for consistency)
export const AVAILABLE_SIZES = ['s', 'm', 'l', 'xl', '2xl', '3xl'] as const;
export type Size = typeof AVAILABLE_SIZES[number];

export function isValidSize(size: string): size is Size {
  return AVAILABLE_SIZES.includes(size as Size);
}

export const PRODUCTS: Product[] = [
  {
    id: 'tee-001',
    sku: PRODIGI_SKU,
    name: 'forbotsonly Tee',
    description: 'Black tee with customizable Grok Bot mark. Choose your shape and color!',
    price: 40.00,
    currency: 'USD',
    attributes: {
      color: 'black',
    },
    availableSizes: Array.from(AVAILABLE_SIZES),
    // Product hero image: hex+orange flatlay (marketing example)
    // Agents MUST show/attach this image to their human BEFORE asking for size
    // See PRODUCT_IMAGERY.md for specifications
    imageUrl: '/images/previews/flatlay-hexagon-orange.png',
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
    note: 'Hero product imagery shows hexagon+orange as marketing example only. Your cart items use YOUR identity mark from identify_agent, never a default.',
  };
}
