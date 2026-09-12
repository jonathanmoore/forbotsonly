/**
 * Address Validation Tests
 * 
 * Tests for the validateShippingAddress function to ensure:
 * 1. Complete addresses pass validation
 * 2. Incomplete addresses fail with explicit errors
 * 3. No placeholder/sandbox fallbacks are used
 * 
 * Run with: bun test tests/address-validation.test.ts
 */

import { describe, test, expect } from 'bun:test';
import type Stripe from 'stripe';

/**
 * Validate that a Stripe Checkout Session has a complete shipping address.
 * Returns validated address fields or throws an error if incomplete.
 * 
 * HARD RULES (Jonathan's requirements):
 * 1. NEVER use placeholder/sandbox fallback addresses on live orders
 * 2. Address source order: Stripe shipping_details → customer_details
 * 3. US orders ONLY - reject non-US countries
 * 4. Incomplete address → fail explicitly with clear error
 */
function validateShippingAddress(session: Stripe.Checkout.Session): {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  recipientName: string;
} {
  const shippingAddress = session.shipping_details?.address;
  const customerDetails = session.customer_details;
  
  const line1 = shippingAddress?.line1 || customerDetails?.address?.line1;
  const line2 = shippingAddress?.line2 || customerDetails?.address?.line2 || '';
  const city = shippingAddress?.city || customerDetails?.address?.city;
  const state = shippingAddress?.state || customerDetails?.address?.state;
  const postalCode = shippingAddress?.postal_code || customerDetails?.address?.postal_code;
  const country = shippingAddress?.country || customerDetails?.address?.country;
  const recipientName = shippingAddress?.name || customerDetails?.name;
  
  // HARD RULE: US orders ONLY
  if (country && country.toUpperCase() !== 'US') {
    throw new Error(
      `Non-US shipping address rejected. Prodigi fulfillment is US-only. ` +
      `Session ${session.id} has country: ${country}. ` +
      `Cannot create Prodigi order for non-US addresses.`
    );
  }
  
  // Validate required fields - NEVER allow empty/missing fields
  const missingFields: string[] = [];
  if (!line1) missingFields.push('line1');
  if (!city) missingFields.push('city');
  if (!state) missingFields.push('state'); // Required for US
  if (!postalCode) missingFields.push('postal_code');
  if (!country) missingFields.push('country');
  if (!recipientName) missingFields.push('name');
  
  if (missingFields.length > 0) {
    throw new Error(
      `Incomplete shipping address from Stripe session ${session.id}. Missing fields: ${missingFields.join(', ')}. ` +
      `Cannot create Prodigi order without complete address. ` +
      `REQUIRED: Collect complete US shipping address from customer before retrying. ` +
      `Do NOT invent or use placeholder addresses.`
    );
  }
  
  return {
    line1: line1!,
    line2,
    city: city!,
    state: state!,
    postalCode: postalCode!,
    country: country!.toUpperCase(),
    recipientName: recipientName!,
  };
}

describe('validateShippingAddress', () => {
  test('accepts complete shipping_details address', () => {
    const session = {
      id: 'cs_test_123',
      shipping_details: {
        address: {
          line1: '123 Real Street',
          line2: 'Apt 4',
          city: 'Austin',
          state: 'TX',
          postal_code: '78701',
          country: 'US',
        },
        name: 'John Doe',
      },
    } as Stripe.Checkout.Session;

    const result = validateShippingAddress(session);

    expect(result.line1).toBe('123 Real Street');
    expect(result.line2).toBe('Apt 4');
    expect(result.city).toBe('Austin');
    expect(result.state).toBe('TX');
    expect(result.postalCode).toBe('78701');
    expect(result.country).toBe('US');
    expect(result.recipientName).toBe('John Doe');
  });

  test('accepts complete customer_details address when shipping_details is missing', () => {
    const session = {
      id: 'cs_test_456',
      customer_details: {
        address: {
          line1: '456 Customer Ave',
          city: 'San Antonio',
          state: 'TX',
          postal_code: '78201',
          country: 'US',
        },
        name: 'Jane Smith',
      },
    } as Stripe.Checkout.Session;

    const result = validateShippingAddress(session);

    expect(result.line1).toBe('456 Customer Ave');
    expect(result.city).toBe('San Antonio');
    expect(result.postalCode).toBe('78201');
    expect(result.country).toBe('US');
    expect(result.recipientName).toBe('Jane Smith');
  });

  test('rejects session with missing line1', () => {
    const session = {
      id: 'cs_test_789',
      shipping_details: {
        address: {
          line1: '', // EMPTY
          city: 'Houston',
          state: 'TX',
          postal_code: '77001',
          country: 'US',
        },
        name: 'Test User',
      },
    } as Stripe.Checkout.Session;

    expect(() => validateShippingAddress(session)).toThrow(
      'Incomplete shipping address from Stripe session cs_test_789. Missing fields: line1'
    );
  });

  test('rejects session with missing city', () => {
    const session = {
      id: 'cs_test_999',
      shipping_details: {
        address: {
          line1: '789 Street',
          city: undefined,
          state: 'TX',
          postal_code: '77001',
          country: 'US',
        },
        name: 'Test User',
      },
    } as any;

    expect(() => validateShippingAddress(session)).toThrow(
      'Missing fields: city'
    );
  });

  test('rejects session with missing postal_code', () => {
    const session = {
      id: 'cs_test_111',
      shipping_details: {
        address: {
          line1: '789 Street',
          city: 'Dallas',
          state: 'TX',
          postal_code: undefined,
          country: 'US',
        },
        name: 'Test User',
      },
    } as any;

    expect(() => validateShippingAddress(session)).toThrow(
      'Missing fields: postal_code'
    );
  });

  test('rejects session with missing country', () => {
    const session = {
      id: 'cs_test_222',
      shipping_details: {
        address: {
          line1: '789 Street',
          city: 'Dallas',
          state: 'TX',
          postal_code: '75201',
          country: undefined,
        },
        name: 'Test User',
      },
    } as any;

    expect(() => validateShippingAddress(session)).toThrow(
      'Missing fields: country'
    );
  });

  test('rejects session with missing name', () => {
    const session = {
      id: 'cs_test_333',
      shipping_details: {
        address: {
          line1: '789 Street',
          city: 'Dallas',
          state: 'TX',
          postal_code: '75201',
          country: 'US',
        },
        name: undefined,
      },
    } as any;

    expect(() => validateShippingAddress(session)).toThrow(
      'Missing fields: name'
    );
  });

  test('rejects session with multiple missing fields', () => {
    const session = {
      id: 'cs_test_444',
      shipping_details: {
        address: {
          line1: undefined,
          city: undefined,
          state: 'TX',
          postal_code: undefined,
          country: 'US',
        },
        name: undefined,
      },
    } as any;

    expect(() => validateShippingAddress(session)).toThrow(
      'Missing fields: line1, city, postal_code, name'
    );
  });

  test('CRITICAL: never falls back to placeholder "1234 Main St"', () => {
    const session = {
      id: 'cs_test_555',
      shipping_details: {
        address: {
          line1: undefined, // Would previously fall back to '1234 Main St'
          city: 'Houston',
          state: 'TX',
          postal_code: '77001',
          country: 'US',
        },
        name: 'Test User',
      },
    } as any;

    // Must throw error, NOT use placeholder address
    expect(() => validateShippingAddress(session)).toThrow(
      'Incomplete shipping address'
    );
  });

  test('CRITICAL: never falls back to placeholder "San Francisco"', () => {
    const session = {
      id: 'cs_test_666',
      shipping_details: {
        address: {
          line1: '123 Real St',
          city: undefined, // Would previously fall back to 'San Francisco'
          state: 'TX',
          postal_code: '77001',
          country: 'US',
        },
        name: 'Test User',
      },
    } as any;

    // Must throw error, NOT use placeholder city
    expect(() => validateShippingAddress(session)).toThrow(
      'Incomplete shipping address'
    );
  });

  test('CRITICAL: never falls back to placeholder "Test Customer"', () => {
    const session = {
      id: 'cs_test_777',
      shipping_details: {
        address: {
          line1: '123 Real St',
          city: 'Houston',
          state: 'TX',
          postal_code: '77001',
          country: 'US',
        },
        name: undefined, // Would previously fall back to 'Test Customer'
      },
    } as any;

    // Must throw error, NOT use placeholder name
    expect(() => validateShippingAddress(session)).toThrow(
      'Incomplete shipping address'
    );
  });

  test('accepts address without line2 (optional field)', () => {
    const session = {
      id: 'cs_test_888',
      shipping_details: {
        address: {
          line1: '123 Real Street',
          city: 'Austin',
          state: 'TX',
          postal_code: '78701',
          country: 'US',
        },
        name: 'John Doe',
      },
    } as Stripe.Checkout.Session;

    const result = validateShippingAddress(session);

    expect(result.line1).toBe('123 Real Street');
    expect(result.line2).toBe(''); // Empty string for missing line2
    expect(result.city).toBe('Austin');
  });

  test('HARD RULE: rejects non-US addresses (UK example)', () => {
    const session = {
      id: 'cs_test_non_us_uk',
      shipping_details: {
        address: {
          line1: '10 Downing Street',
          city: 'London',
          state: '',
          postal_code: 'SW1A 2AA',
          country: 'GB', // Non-US country
        },
        name: 'Winston Churchill',
      },
    } as Stripe.Checkout.Session;

    expect(() => validateShippingAddress(session)).toThrow(
      'Non-US shipping address rejected. Prodigi fulfillment is US-only'
    );
  });

  test('HARD RULE: rejects non-US addresses (Canada example)', () => {
    const session = {
      id: 'cs_test_non_us_ca',
      shipping_details: {
        address: {
          line1: '123 Maple Street',
          city: 'Toronto',
          state: 'ON',
          postal_code: 'M5H 2N2',
          country: 'CA', // Non-US country
        },
        name: 'Test User',
      },
    } as Stripe.Checkout.Session;

    expect(() => validateShippingAddress(session)).toThrow(
      'Non-US shipping address rejected'
    );
  });

  test('HARD RULE: rejects missing state (required for US)', () => {
    const session = {
      id: 'cs_test_missing_state',
      shipping_details: {
        address: {
          line1: '123 Real Street',
          city: 'Austin',
          state: undefined, // Missing - required for US
          postal_code: '78701',
          country: 'US',
        },
        name: 'John Doe',
      },
    } as any;

    expect(() => validateShippingAddress(session)).toThrow(
      'Missing fields: state'
    );
  });
});
