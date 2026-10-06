/**
 * Sandbox store cart, kept in localStorage so /sandbox, /sandbox/cart, and /sandbox/checkout share it
 * across reloads. Cleared by /sandbox/complete after a successful payment.
 */

import { SANDBOX_MAX_QUANTITY, SANDBOX_PRODUCTS, SANDBOX_UNIT_PRICE_USD } from '../../src/sandbox';

export interface CartLine {
  product: string;
  size: string;
  quantity: number;
}

const STORAGE_KEY = 'forbotsonly-sandbox-cart';

export function loadCart(): CartLine[] {
  try {
    const lines = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(lines) ? lines : [];
  } catch {
    return [];
  }
}

export function saveCart(lines: CartLine[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
}

export function clearCart(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function cartQuantity(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function formatUsd(dollars: number): string {
  return `$${dollars.toFixed(0)}`;
}

export function lineTotal(line: CartLine): number {
  return line.quantity * SANDBOX_UNIT_PRICE_USD;
}

export function productFor(line: CartLine) {
  return SANDBOX_PRODUCTS.find((p) => p.id === line.product);
}

/** Add one tee. Returns an error message instead when the order would exceed the per-order cap. */
export function addToCart(product: string, size: string): string | null {
  const lines = loadCart();
  if (cartQuantity(lines) >= SANDBOX_MAX_QUANTITY) {
    return `At most ${SANDBOX_MAX_QUANTITY} tees per order`;
  }
  const existing = lines.find((line) => line.product === product && line.size === size);
  if (existing) {
    existing.quantity += 1;
  } else {
    lines.push({ product, size, quantity: 1 });
  }
  saveCart(lines);
  return null;
}
