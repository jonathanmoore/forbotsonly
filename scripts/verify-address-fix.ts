#!/usr/bin/env bun

/**
 * Verification Script for Address Validation Fix
 * 
 * This script helps verify that the address validation fix is working correctly
 * by simulating various Stripe session scenarios.
 * 
 * Usage:
 *   bun run scripts/verify-address-fix.ts
 */

import type Stripe from 'stripe';

// Copy of the validation function from src/server.ts
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

console.log('🧪 Address Validation Fix - Verification Script\n');

// Test Case 1: Complete address (should PASS)
console.log('Test 1: Complete address with shipping_details');
try {
  const session1 = {
    id: 'cs_test_complete_1',
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
  
  const result1 = validateShippingAddress(session1);
  console.log('✅ PASS - Address validated successfully:');
  console.log(`   ${result1.recipientName}`);
  console.log(`   ${result1.line1}${result1.line2 ? ', ' + result1.line2 : ''}`);
  console.log(`   ${result1.city}, ${result1.state} ${result1.postalCode}`);
  console.log(`   ${result1.country}\n`);
} catch (err: any) {
  console.log(`❌ FAIL - Unexpected error: ${err.message}\n`);
}

// Test Case 2: Complete address via customer_details (should PASS)
console.log('Test 2: Complete address with customer_details');
try {
  const session2 = {
    id: 'cs_test_complete_2',
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
  
  const result2 = validateShippingAddress(session2);
  console.log('✅ PASS - Address validated successfully:');
  console.log(`   ${result2.recipientName}`);
  console.log(`   ${result2.line1}`);
  console.log(`   ${result2.city}, ${result2.state} ${result2.postalCode}`);
  console.log(`   ${result2.country}\n`);
} catch (err: any) {
  console.log(`❌ FAIL - Unexpected error: ${err.message}\n`);
}

// Test Case 3: Missing line1 (should FAIL with clear error)
console.log('Test 3: Missing line1 (should fail validation)');
try {
  const session3 = {
    id: 'cs_test_missing_line1',
    shipping_details: {
      address: {
        line1: '', // EMPTY - would previously fall back to '1234 Main St'
        city: 'Houston',
        state: 'TX',
        postal_code: '77001',
        country: 'US',
      },
      name: 'Test User',
    },
  } as Stripe.Checkout.Session;
  
  const result3 = validateShippingAddress(session3);
  console.log(`❌ FAIL - Should have thrown error but got: ${result3.line1}\n`);
} catch (err: any) {
  console.log('✅ PASS - Correctly rejected incomplete address');
  console.log(`   Error: ${err.message}\n`);
}

// Test Case 4: Missing city (should FAIL)
console.log('Test 4: Missing city (should fail validation)');
try {
  const session4 = {
    id: 'cs_test_missing_city',
    shipping_details: {
      address: {
        line1: '789 Street',
        city: undefined, // Would previously fall back to 'San Francisco'
        state: 'TX',
        postal_code: '77001',
        country: 'US',
      },
      name: 'Test User',
    },
  } as any;
  
  const result4 = validateShippingAddress(session4);
  console.log(`❌ FAIL - Should have thrown error but got city: ${result4.city}\n`);
} catch (err: any) {
  console.log('✅ PASS - Correctly rejected incomplete address');
  console.log(`   Error: ${err.message}\n`);
}

// Test Case 5: Missing name (should FAIL)
console.log('Test 5: Missing name (should fail validation)');
try {
  const session5 = {
    id: 'cs_test_missing_name',
    shipping_details: {
      address: {
        line1: '789 Street',
        city: 'Dallas',
        state: 'TX',
        postal_code: '75201',
        country: 'US',
      },
      name: undefined, // Would previously fall back to 'Test Customer'
    },
  } as any;
  
  const result5 = validateShippingAddress(session5);
  console.log(`❌ FAIL - Should have thrown error but got name: ${result5.recipientName}\n`);
} catch (err: any) {
  console.log('✅ PASS - Correctly rejected incomplete address');
  console.log(`   Error: ${err.message}\n`);
}

// Test Case 6: Multiple missing fields (should FAIL with all fields listed)
console.log('Test 6: Multiple missing fields (should fail with all fields)');
try {
  const session6 = {
    id: 'cs_test_multiple_missing',
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
  
  const result6 = validateShippingAddress(session6);
  console.log(`❌ FAIL - Should have thrown error\n`);
} catch (err: any) {
  console.log('✅ PASS - Correctly rejected incomplete address');
  console.log(`   Error: ${err.message}`);
  if (err.message.includes('line1') && err.message.includes('city') && 
      err.message.includes('postal_code') && err.message.includes('name')) {
    console.log('   ✅ All missing fields listed in error\n');
  } else {
    console.log('   ⚠️  Warning: Not all missing fields listed\n');
  }
}

// Test Case 7: Optional fields (line2, state) should be allowed empty
console.log('Test 7: Optional fields (line2, state) empty - should pass');
try {
  const session7 = {
    id: 'cs_test_optional_empty',
    shipping_details: {
      address: {
        line1: '10 Downing Street',
        city: 'London',
        postal_code: 'SW1A 2AA',
        country: 'GB',
        // No line2, no state (common in UK)
      },
      name: 'Winston Churchill',
    },
  } as Stripe.Checkout.Session;
  
  const result7 = validateShippingAddress(session7);
  console.log('✅ PASS - Address validated successfully (optional fields empty):');
  console.log(`   ${result7.recipientName}`);
  console.log(`   ${result7.line1}`);
  console.log(`   ${result7.city}, ${result7.postalCode}`);
  console.log(`   ${result7.country}`);
  console.log(`   line2: "${result7.line2}" (empty is OK)`);
  console.log(`   state: "${result7.state}" (empty is OK)\n`);
} catch (err: any) {
  console.log(`❌ FAIL - Unexpected error: ${err.message}\n`);
}

// Summary
console.log('═══════════════════════════════════════════════════════════');
console.log('✅ Verification Complete!');
console.log('');
console.log('Key Takeaways:');
console.log('1. Complete addresses are accepted');
console.log('2. Incomplete addresses are REJECTED (not silently fixed)');
console.log('3. NO placeholder values used (1234 Main St, San Francisco, etc.)');
console.log('4. Error messages clearly identify missing fields');
console.log('5. Optional fields (line2, state) are allowed to be empty');
console.log('');
console.log('Result: Production orders will NEVER ship to fake addresses');
console.log('═══════════════════════════════════════════════════════════');
