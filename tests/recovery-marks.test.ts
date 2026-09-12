/**
 * Recovery Mark Validation Tests
 * 
 * Tests for recover_paid_checkout to ensure:
 * 1. Mark shape/color extracted from Stripe metadata
 * 2. Never defaults to hexagon/orange
 * 3. Fails explicitly if mark missing from metadata
 * 
 * Run with: bun test tests/recovery-marks.test.ts
 */

import { describe, test, expect } from 'bun:test';
import type Stripe from 'stripe';

// Mark validation functions from src/types.ts
const MARK_SHAPES = ['circle', 'vertical-oval', 'rounded-square', 'horizontal-pill', 'rounded-triangle', 'hexagon', 'cloud', 'teardrop'] as const;
const MARK_COLORS = ['white', 'brown', 'red', 'orange', 'gold', 'light-green', 'teal', 'blue', 'purple', 'hot-pink', 'grey'] as const;

function isValidMarkShape(shape: string): boolean {
  return MARK_SHAPES.includes(shape as any);
}

function isValidMarkColor(color: string): boolean {
  return MARK_COLORS.includes(color as any);
}

/**
 * Simulates the recovery logic from src/server.ts recover_paid_checkout handler
 * 
 * HARD RULE: Never default to hexagon/orange. Extract from metadata or fail.
 */
function extractMarkFromSessionForRecovery(
  session: Stripe.Checkout.Session,
  overrideShape?: string,
  overrideColor?: string
): { markShape: string; markColor: string } {
  // Use provided shape/color from tool args, or extract from session metadata
  const markShape = overrideShape || session.metadata?.markShape;
  const markColor = overrideColor || session.metadata?.markColor;
  
  // HARD RULE: If mark not found, fail explicitly (never invent/default)
  if (!markShape || !isValidMarkShape(markShape)) {
    throw new Error(
      `Cannot recover order: mark shape not found or invalid in Stripe session metadata. ` +
      `Original mark shape must be stored in session.metadata.markShape during checkout. ` +
      `Session ${session.id} has metadata: ${JSON.stringify(session.metadata)}`
    );
  }
  
  if (!markColor || !isValidMarkColor(markColor)) {
    throw new Error(
      `Cannot recover order: mark color not found or invalid in Stripe session metadata. ` +
      `Original mark color must be stored in session.metadata.markColor during checkout. ` +
      `Session ${session.id} has metadata: ${JSON.stringify(session.metadata)}`
    );
  }
  
  return { markShape, markColor };
}

describe('recover_paid_checkout mark validation', () => {
  test('extracts mark from session metadata', () => {
    const session = {
      id: 'cs_test_with_marks',
      metadata: {
        orderId: 'ord_123',
        size: 'm',
        markShape: 'circle',
        markColor: 'blue',
      },
    } as Stripe.Checkout.Session;

    const result = extractMarkFromSessionForRecovery(session);

    expect(result.markShape).toBe('circle');
    expect(result.markColor).toBe('blue');
  });

  test('uses override shape/color when provided', () => {
    const session = {
      id: 'cs_test_override',
      metadata: {
        orderId: 'ord_123',
        size: 'm',
        markShape: 'circle',
        markColor: 'blue',
      },
    } as Stripe.Checkout.Session;

    const result = extractMarkFromSessionForRecovery(session, 'hexagon', 'orange');

    expect(result.markShape).toBe('hexagon');
    expect(result.markColor).toBe('orange');
  });

  test('HARD RULE: fails if markShape missing from metadata', () => {
    const session = {
      id: 'cs_test_no_shape',
      metadata: {
        orderId: 'ord_123',
        size: 'm',
        // markShape missing
        markColor: 'blue',
      },
    } as Stripe.Checkout.Session;

    expect(() => extractMarkFromSessionForRecovery(session)).toThrow(
      'Cannot recover order: mark shape not found or invalid'
    );
  });

  test('HARD RULE: fails if markColor missing from metadata', () => {
    const session = {
      id: 'cs_test_no_color',
      metadata: {
        orderId: 'ord_123',
        size: 'm',
        markShape: 'circle',
        // markColor missing
      },
    } as Stripe.Checkout.Session;

    expect(() => extractMarkFromSessionForRecovery(session)).toThrow(
      'Cannot recover order: mark color not found or invalid'
    );
  });

  test('HARD RULE: fails if both marks missing from metadata', () => {
    const session = {
      id: 'cs_test_no_marks',
      metadata: {
        orderId: 'ord_123',
        size: 'm',
        // Both markShape and markColor missing
      },
    } as Stripe.Checkout.Session;

    expect(() => extractMarkFromSessionForRecovery(session)).toThrow(
      'Cannot recover order: mark shape not found or invalid'
    );
  });

  test('HARD RULE: fails if markShape is invalid', () => {
    const session = {
      id: 'cs_test_invalid_shape',
      metadata: {
        orderId: 'ord_123',
        size: 'm',
        markShape: 'invalid-shape', // Not in allowed list
        markColor: 'blue',
      },
    } as Stripe.Checkout.Session;

    expect(() => extractMarkFromSessionForRecovery(session)).toThrow(
      'mark shape not found or invalid'
    );
  });

  test('HARD RULE: fails if markColor is invalid', () => {
    const session = {
      id: 'cs_test_invalid_color',
      metadata: {
        orderId: 'ord_123',
        size: 'm',
        markShape: 'circle',
        markColor: 'invalid-color', // Not in allowed list
      },
    } as Stripe.Checkout.Session;

    expect(() => extractMarkFromSessionForRecovery(session)).toThrow(
      'mark color not found or invalid'
    );
  });

  test('CRITICAL: never defaults to hexagon when shape missing', () => {
    const session = {
      id: 'cs_test_no_default_shape',
      metadata: {
        orderId: 'ord_123',
        size: 'm',
        // markShape missing - should NOT default to 'hexagon'
        markColor: 'blue',
      },
    } as Stripe.Checkout.Session;

    // Must throw error, NOT use hexagon default
    expect(() => extractMarkFromSessionForRecovery(session)).toThrow(
      'Cannot recover order'
    );
  });

  test('CRITICAL: never defaults to orange when color missing', () => {
    const session = {
      id: 'cs_test_no_default_color',
      metadata: {
        orderId: 'ord_123',
        size: 'm',
        markShape: 'circle',
        // markColor missing - should NOT default to 'orange'
      },
    } as Stripe.Checkout.Session;

    // Must throw error, NOT use orange default
    expect(() => extractMarkFromSessionForRecovery(session)).toThrow(
      'Cannot recover order'
    );
  });

  test('accepts all valid mark shapes', () => {
    MARK_SHAPES.forEach(shape => {
      const session = {
        id: `cs_test_shape_${shape}`,
        metadata: {
          orderId: 'ord_123',
          size: 'm',
          markShape: shape,
          markColor: 'blue',
        },
      } as Stripe.Checkout.Session;

      const result = extractMarkFromSessionForRecovery(session);
      expect(result.markShape).toBe(shape);
    });
  });

  test('accepts all valid mark colors', () => {
    MARK_COLORS.forEach(color => {
      const session = {
        id: `cs_test_color_${color}`,
        metadata: {
          orderId: 'ord_123',
          size: 'm',
          markShape: 'circle',
          markColor: color,
        },
      } as Stripe.Checkout.Session;

      const result = extractMarkFromSessionForRecovery(session);
      expect(result.markColor).toBe(color);
    });
  });

  test('empty metadata fails with clear error', () => {
    const session = {
      id: 'cs_test_empty_metadata',
      metadata: {}, // Empty metadata
    } as Stripe.Checkout.Session;

    expect(() => extractMarkFromSessionForRecovery(session)).toThrow(
      'Cannot recover order: mark shape not found or invalid'
    );
  });

  test('null metadata fails with clear error', () => {
    const session = {
      id: 'cs_test_null_metadata',
      metadata: null,
    } as any;

    expect(() => extractMarkFromSessionForRecovery(session)).toThrow(
      'Cannot recover order: mark shape not found or invalid'
    );
  });
});
