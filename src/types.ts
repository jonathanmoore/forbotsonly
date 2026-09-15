export interface AgentIdentity {
  name: string;
  mark: MarkConfig;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  attributes: {
    color: string;
  };
  availableSizes: string[];
  imageUrl?: string;
}

export interface MarkConfig {
  shape: string;
  color: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
  mark: MarkConfig;
  size: string;
}

export interface Cart {
  items: CartItem[];
  sessionId: string;
}

export interface Order {
  id: string;
  sessionId: string;
  stripeCheckoutSessionId?: string;
  stripeCheckoutUrl?: string;
  stripePaymentIntentId?: string;
  prodigiOrderId?: string;
  status: 'pending' | 'awaiting_approval' | 'paid' | 'fulfilled' | 'refunded' | 'cancelled';
  items: CartItem[];
  createdAt: number;
  approvedAt?: number;
  deniedAt?: number;
  refundId?: string;
  shippingAddress?: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  shippingConfirmed?: boolean;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
}

/**
 * PRIMARY MARK IDS: Product API / Grok Bot profile (avatarShape / avatarColor)
 * Source: /workspace/merch/refs/grok-bot-research/SHAPE-COLOR-IDS.md (Research canonical table)
 * Bots pass profile values straight through. Pack/picker names are ALIASES that normalize to product ids.
 */
export const MARK_SHAPES = [
  // Product primary shapes (18 total, from Research canonical table)
  'blob',
  'pebble',
  'bean',
  'egg',
  'squircle',
  'tablet',
  'capsule',
  'cylinder',
  'hex',
  'gem',
  'crystal',
  'wedge',
  'shield',
  'dome',
  'arch',
  'cloud',
  'teardrop',
  'leaf',
] as const;

/**
 * CHARACTER PICKER SHAPES: The 9 shapes available in Grok Bot character picker
 * These are presented to users when they have custom/missing marks (Issue #85)
 * Subset of MARK_SHAPES, excluding catalog-only shapes (pebble, tablet, cylinder, gem, crystal, shield, dome, arch, leaf)
 */
export const CHARACTER_PICKER_SHAPES = [
  'blob',
  'egg',
  'bean',
  'squircle',
  'capsule',
  'wedge',
  'hex',
  'cloud',
  'teardrop',
] as const;

export const MARK_COLORS = [
  // Product primary colors (11 total: 9 standard + black/gray for Grok Bot)
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'cyan',
  'blue',
  'violet',
  'magenta',
  'black',  // Grok Bot profile only
  'gray',   // Grok Bot profile only
] as const;

/**
 * Asset filename mapping: Product id → pack filename (for existing assets on disk)
 * Source: Research canonical table SHAPE-COLOR-IDS.md
 * Example: wedge (product) → rounded-triangle (pack file: grok-bot-rounded-triangle-*.png)
 * 
 * FIX #130: Catalog-only shapes (pebble, tablet, cylinder, gem, crystal, shield, dome, arch, leaf)
 * are aliased to nearest existing pack shapes to ensure preview_cart returns 200 URLs.
 * Pack has assets for: blob, circle, vertical-oval, rounded-square, horizontal-pill, 
 * rounded-triangle, hexagon, cloud, teardrop
 */
export const SHAPE_TO_ASSET_FILENAME: Record<string, string> = {
  // Product id → pack filename
  'blob': 'blob',
  'pebble': 'blob',                      // catalog-only → alias to blob (rounded, organic)
  'bean': 'vertical-oval',               // bean → vertical-oval.svg
  'egg': 'circle',                       // egg → circle.svg
  'squircle': 'rounded-square',          // squircle → rounded-square.svg
  'tablet': 'rounded-square',            // catalog-only → alias to rounded-square (rectangular)
  'capsule': 'horizontal-pill',          // capsule → horizontal-pill.svg
  'cylinder': 'horizontal-pill',         // catalog-only → alias to horizontal-pill (elongated)
  'hex': 'hexagon',                      // hex → hexagon.svg
  'gem': 'hexagon',                      // catalog-only → alias to hexagon (faceted, geometric)
  'crystal': 'hexagon',                  // catalog-only → alias to hexagon (faceted, geometric)
  'wedge': 'rounded-triangle',           // wedge → rounded-triangle.svg (Shoppy #81)
  'shield': 'rounded-triangle',          // catalog-only → alias to rounded-triangle (pointed top)
  'dome': 'circle',                      // catalog-only → alias to circle (rounded dome)
  'arch': 'rounded-square',              // catalog-only → alias to rounded-square (architectural)
  'cloud': 'cloud',
  'teardrop': 'teardrop',
  'leaf': 'teardrop',                    // catalog-only → alias to teardrop (pointed, organic)
};

export const COLOR_TO_ASSET_FILENAME: Record<string, string> = {
  // Product id → pack filename
  'brown': 'brown',
  'red': 'red',
  'orange': 'orange',
  'yellow': 'gold',                      // yellow → gold.svg (pack filename)
  'green': 'light-green',                // green → light-green.svg (Shoppy #81)
  'cyan': 'teal',                        // cyan → teal.svg
  'blue': 'blue',
  'violet': 'purple',                    // violet → purple.svg
  'magenta': 'hot-pink',                 // magenta → hot-pink.svg (pack filename)
  'black': 'black',
  'gray': 'grey',                        // gray → grey.svg (pack spelling)
};

/**
 * Shape aliases: Pack/picker names + old store names → Product id
 * Allows backward compatibility and profile enum variations.
 */
export const SHAPE_ALIASES: Record<string, MarkShape> = {
  // Product primary shapes (pass-through)
  'blob': 'blob',
  'pebble': 'pebble',
  'bean': 'bean',
  'egg': 'egg',
  'squircle': 'squircle',
  'tablet': 'tablet',
  'capsule': 'capsule',
  'cylinder': 'cylinder',
  'hex': 'hex',
  'gem': 'gem',
  'crystal': 'crystal',
  'wedge': 'wedge',
  'shield': 'shield',
  'dome': 'dome',
  'arch': 'arch',
  'cloud': 'cloud',
  'teardrop': 'teardrop',
  'leaf': 'leaf',
  
  // Pack/picker names → Product id
  'circle': 'egg',                       // pack circle → product egg
  'vertical-oval': 'bean',               // pack vertical-oval → product bean
  'rounded-square': 'squircle',          // pack rounded-square → product squircle
  'horizontal-pill': 'capsule',          // pack horizontal-pill → product capsule
  'rounded-triangle': 'wedge',           // pack rounded-triangle → product wedge
  'hexagon': 'hex',                      // pack hexagon → product hex
};

/**
 * Color aliases: Pack/picker names + old store names → Product id
 * Allows backward compatibility and profile enum variations.
 */
export const COLOR_ALIASES: Record<string, MarkColor> = {
  // Product primary colors (pass-through)
  'brown': 'brown',
  'red': 'red',
  'orange': 'orange',
  'yellow': 'yellow',
  'green': 'green',
  'cyan': 'cyan',
  'blue': 'blue',
  'violet': 'violet',
  'magenta': 'magenta',
  'black': 'black',
  'gray': 'gray',
  
  // Pack/picker names → Product id
  'gold': 'yellow',                      // pack gold → product yellow
  'light-green': 'green',                // pack light-green → product green
  'teal': 'cyan',                        // pack teal → product cyan
  'purple': 'violet',                    // pack purple → product violet
  'pink': 'magenta',                     // pack/picker pink → product magenta
  'hot-pink': 'magenta',                 // pack hot-pink → product magenta
  'grey': 'gray',                        // British spelling → product gray
};

// DEFAULT_MARK is ONLY used as admin recovery fallback in recover_paid_checkout
// when original order mark is lost. NOT for buyer bot identity - bots must verify
// their own profile mark or get random assignment via identify_agent.
// Uses product ids (hex, not hexagon).
export const DEFAULT_MARK: MarkConfig = {
  shape: 'hex',
  color: 'orange',
};

export type MarkShape = typeof MARK_SHAPES[number];
export type MarkColor = typeof MARK_COLORS[number];

/**
 * Normalize shape using alias map: accepts old store names + picker names → returns PRIMARY picker name
 * Returns PRIMARY picker shape (wedge, hex, blob, etc.) or null if invalid.
 */
export function normalizeMarkShape(shape: string): MarkShape | null {
  const normalized = SHAPE_ALIASES[shape.toLowerCase()];
  return normalized || null;
}

/**
 * Normalize color using alias map: accepts old store names + picker names → returns PRIMARY picker name
 * Returns PRIMARY picker color (green, pink, etc.) or null if invalid.
 */
export function normalizeMarkColor(color: string): MarkColor | null {
  const normalized = COLOR_ALIASES[color.toLowerCase()];
  return normalized || null;
}

/**
 * Get asset filename for a PRIMARY picker shape (maps to filesystem name)
 * Example: 'wedge' → 'rounded-triangle' (for SVG/PNG paths)
 */
export function getShapeAssetFilename(shape: MarkShape): string {
  return SHAPE_TO_ASSET_FILENAME[shape] || shape;
}

/**
 * Get asset filename for a PRIMARY picker color (maps to filesystem name)
 * Example: 'green' → 'light-green' (for SVG/PNG paths)
 */
export function getColorAssetFilename(color: MarkColor): string {
  return COLOR_TO_ASSET_FILENAME[color] || color;
}

export function isValidMarkShape(shape: string): shape is MarkShape {
  return MARK_SHAPES.includes(shape as MarkShape);
}

export function isValidMarkColor(color: string): color is MarkColor {
  return MARK_COLORS.includes(color as MarkColor);
}
