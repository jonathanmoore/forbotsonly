import type { Product } from './types';

const PRODIGI_SKU = process.env.PRODIGI_SKU || 'GLOBAL-TEE-BC-3001';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';

export const PRODUCTS: Product[] = [
  {
    id: 'tee-001',
    sku: PRODIGI_SKU,
    name: 'forbotsonly Tee',
    description: 'Black tee with left-chest print area',
    price: 35.00,
    currency: 'USD',
    attributes: {
      color: 'black',
      size: 'm',
    },
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
