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
 * NEVER use placeholder/sandbox fallback addresses on live orders.
 * If address is incomplete, we MUST fail explicitly rather than ship to a fake address.
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
  
  // Prefer shipping_details, fallback to customer_details
  const line1 = shippingAddress?.line1 || customerDetails?.address?.line1;
  const line2 = shippingAddress?.line2 || customerDetails?.address?.line2 || '';
  const city = shippingAddress?.city || customerDetails?.address?.city;
  const state = shippingAddress?.state || customerDetails?.address?.state;
  const postalCode = shippingAddress?.postal_code || customerDetails?.address?.postal_code;
  const country = shippingAddress?.country || customerDetails?.address?.country;
  const recipientName = shippingAddress?.name || customerDetails?.name;
  
  // Validate required fields - NEVER allow empty/missing fields to fall back to placeholders
  const missingFields: string[] = [];
  if (!line1) missingFields.push('line1');
  if (!city) missingFields.push('city');
  if (!postalCode) missingFields.push('postal_code');
  if (!country) missingFields.push('country');
  if (!recipientName) missingFields.push('name');
  
  if (missingFields.length > 0) {
    throw new Error(
      `Incomplete shipping address from Stripe session ${session.id}. Missing fields: ${missingFields.join(', ')}. ` +
      `Cannot create Prodigi order without complete address. Check that Stripe Checkout is configured to collect shipping addresses.`
    );
  }
  
  return {
    line1: line1!,
    line2,
    city: city!,
    state: state || '', // State is optional for some countries
    postalCode: postalCode!,
    country: country!,
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

  test('accepts address without state (optional for some countries)', () => {
    const session = {
      id: 'cs_test_999',
      shipping_details: {
        address: {
          line1: '10 Downing Street',
          city: 'London',
          postal_code: 'SW1A 2AA',
          country: 'GB',
        },
        name: 'Winston Churchill',
      },
    } as Stripe.Checkout.Session;

    const result = validateShippingAddress(session);

    expect(result.line1).toBe('10 Downing Street');
    expect(result.city).toBe('London');
    expect(result.state).toBe(''); // Empty string for missing state
    expect(result.country).toBe('GB');
  });
});
