# Incident Fix: Prodigi Orders Shipping to Fake Placeholder Addresses

**Status:** ✅ FIXED  
**Date:** 2026-09-12  
**Severity:** CRITICAL  
**PR:** [#76](https://github.com/jonathanmoore/forbotsonly/pull/76)

## Incident Summary

Prodigi order `ord_14507530` was shipped to a fake placeholder address instead of the customer's real shipping address:

- **Fake address used:** 1234 Main St, San Francisco, CA 94102
- **Real customer address:** Jonathan Moore, Dripping Springs, TX
- **Impact:** Customer never receives product, order lost, poor customer experience

## Root Cause Analysis

### Primary Issue: Dangerous Fallback Values

The `createProdigiOrderForOrder` function in `src/server.ts` contained fallback values for address fields:

```typescript
// ❌ BEFORE (DANGEROUS)
const line1 = shippingAddress?.line1 || customerDetails?.address?.line1 || '1234 Main St';
const city = shippingAddress?.city || customerDetails?.address?.city || 'San Francisco';
const state = shippingAddress?.state || customerDetails?.address?.state || 'CA';
const postalCode = shippingAddress?.postal_code || customerDetails?.address?.postal_code || '94102';
const country = shippingAddress?.country || customerDetails?.address?.country || 'US';
const recipientName = shippingAddress?.name || customerDetails?.name || 'Test Customer';
```

**Problem:** If Stripe session had partial address data (e.g., only `postal_code`), the code would create a Frankenstein address combining real and fake fields:

```
Real postal code: 78739 (Dripping Springs, TX)
Fake city: San Francisco
Fake state: CA
Fake street: 1234 Main St
Result: Shipment goes to wrong address
```

### Secondary Issue: Missing Stripe Configuration

Stripe Checkout was **not configured** to collect shipping addresses via `shipping_address_collection`. This meant many sessions had empty `shipping_details`, making the fallback problem even worse.

### Tertiary Issue: Hardcoded Size in Recovery

The `recover_paid_checkout` tool hardcoded size as `'l'`:

```typescript
// ❌ BEFORE
size: 'l', // Default size for recovery
```

This meant even if the customer originally ordered Size M, recovery would create a Size L order.

## Fix Implementation

### 1. ✅ Enable Shipping Address Collection

**File:** `src/stripe.ts`

```typescript
// ✅ AFTER
const session = await stripe.checkout.sessions.create({
  // ... other config
  shipping_address_collection: {
    allowed_countries: ['US', 'CA', 'GB', 'AU', ...], // 34 countries
  },
});
```

**Result:** Every Stripe checkout now collects complete shipping address before payment.

### 2. ✅ Add Strict Address Validation

**File:** `src/server.ts`

New function `validateShippingAddress()`:

```typescript
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
  const city = shippingAddress?.city || customerDetails?.address?.city;
  const postalCode = shippingAddress?.postal_code || customerDetails?.address?.postal_code;
  const country = shippingAddress?.country || customerDetails?.address?.country;
  const recipientName = shippingAddress?.name || customerDetails?.name;
  
  // Validate required fields - NEVER allow empty/missing fields
  const missingFields: string[] = [];
  if (!line1) missingFields.push('line1');
  if (!city) missingFields.push('city');
  if (!postalCode) missingFields.push('postal_code');
  if (!country) missingFields.push('country');
  if (!recipientName) missingFields.push('name');
  
  if (missingFields.length > 0) {
    throw new Error(
      `Incomplete shipping address from Stripe session ${session.id}. ` +
      `Missing fields: ${missingFields.join(', ')}. ` +
      `Cannot create Prodigi order without complete address.`
    );
  }
  
  return { line1: line1!, line2, city: city!, state: state || '', 
           postalCode: postalCode!, country: country!, recipientName: recipientName! };
}
```

**Key Features:**
- ✅ Validates all required fields exist
- ✅ Throws explicit error if incomplete
- ✅ No placeholder fallbacks
- ✅ Clear error message for debugging

### 3. ✅ Remove All Placeholder Values

**Deleted from `createProdigiOrderForOrder`:**
- ❌ `'1234 Main St'`
- ❌ `'San Francisco'`
- ❌ `'CA'`
- ❌ `'94102'`
- ❌ `'US'`
- ❌ `'Test Customer'`

**Replaced with:**

```typescript
// ✅ AFTER
const validatedAddress = validateShippingAddress(session);
const { line1, line2, city, state, postalCode, country, recipientName } = validatedAddress;
```

### 4. ✅ Fix Size in Recovery

**File:** `src/server.ts` - `recover_paid_checkout` handler

```typescript
// ✅ AFTER
// Extract size from Stripe metadata (NEVER hardcode)
let size = session.metadata?.size?.toLowerCase() as 's' | 'm' | 'l' | 'xl' | '2xl' | '3xl' | undefined;

// If not in metadata, try line items
if (!size && session.line_items?.data?.[0]) {
  const lineItem = session.line_items.data[0];
  if (lineItem.price?.metadata?.size) {
    size = lineItem.price.metadata.size.toLowerCase() as 's' | 'm' | 'l' | 'xl' | '2xl' | '3xl';
  }
}

// If still no size, fail explicitly
if (!size || !isValidSize(size)) {
  throw new Error(
    `Cannot recover order: size not found in Stripe session metadata. ` +
    `Session ${stripeCheckoutSessionId} has metadata: ${JSON.stringify(session.metadata)}`
  );
}
```

### 5. ✅ Store Size in Checkout Metadata

**File:** `src/server.ts` - `create_checkout` handler

```typescript
// ✅ AFTER
const checkoutSession = await createCheckoutSession(
  priceId,
  firstItem.quantity,
  { 
    orderId: order.id,
    size: firstItem.size,           // ✅ NEW
    productId: firstItem.productId, // ✅ NEW
    markShape: firstItem.mark.shape, // ✅ NEW
    markColor: firstItem.mark.color, // ✅ NEW
  },
  successUrl,
  cancelUrl
);
```

**Result:** Recovery can now extract original size from metadata.

## Verification & Testing

### Unit Tests

Created comprehensive test suite: `tests/address-validation.test.ts`

**Test Coverage:**
- ✅ Complete `shipping_details` address → passes
- ✅ Complete `customer_details` address → passes
- ❌ Missing `line1` → throws error
- ❌ Missing `city` → throws error
- ❌ Missing `postal_code` → throws error
- ❌ Missing `country` → throws error
- ❌ Missing `name` → throws error
- ❌ Multiple missing fields → throws error with all fields listed
- ✅ Optional `line2` → allowed to be empty
- ✅ Optional `state` → allowed to be empty (for UK, etc.)
- ✅ CRITICAL: Never falls back to '1234 Main St'
- ✅ CRITICAL: Never falls back to 'San Francisco'
- ✅ CRITICAL: Never falls back to 'Test Customer'

**Run tests:**
```bash
bun test tests/address-validation.test.ts
```

### Integration Testing

#### Test Case 1: Complete Address (Happy Path)

**Setup:**
1. Create Stripe test checkout with shipping address:
   ```
   Name: Test Customer
   Address: 123 Real Street, Apt 4
   City: Austin
   State: TX
   Postal Code: 78701
   Country: US
   ```
2. Complete payment
3. Webhook triggers order fulfillment

**Expected Result:**
- ✅ Prodigi order created successfully
- ✅ Address matches: `123 Real Street, Austin, TX 78701`
- ✅ No placeholder values used

#### Test Case 2: Incomplete Address (Error Path)

**Setup:**
1. Manually create Stripe session with partial address (for testing only):
   ```javascript
   // Missing line1
   const session = {
     id: 'cs_test_incomplete',
     shipping_details: {
       address: {
         line1: '',  // EMPTY
         city: 'Houston',
         postal_code: '77001',
         country: 'US',
       },
       name: 'Test User',
     },
   };
   ```
2. Attempt to create Prodigi order

**Expected Result:**
- ❌ Prodigi order creation fails
- ✅ Clear error logged:
  ```
  [Prodigi] ❌ Failed to create order for ord_xxx:
  Incomplete shipping address from Stripe session cs_test_incomplete.
  Missing fields: line1.
  Cannot create Prodigi order without complete address.
  ```
- ✅ Order status remains `pending` (not marked `paid`)
- ✅ No fake address sent to Prodigi

#### Test Case 3: Recovery with Size

**Setup:**
1. Create order with size M
2. Complete Stripe checkout (stores `size: 'm'` in metadata)
3. Simulate orphaned order (delete from store)
4. Call `recover_paid_checkout`

**Expected Result:**
- ✅ Order recreated with Size M (not hardcoded 'l')
- ✅ Prodigi order uses Size M
- ✅ Address validated and complete

#### Test Case 4: Recovery without Size

**Setup:**
1. Create old Stripe session without size in metadata
2. Call `recover_paid_checkout`

**Expected Result:**
- ❌ Recovery fails with clear error:
  ```
  Cannot recover order: size not found in Stripe session metadata.
  Original size must be stored in session.metadata.size during checkout.
  ```
- ✅ No hardcoded size used
- ✅ Admin must manually specify size

## Deployment Checklist

- [x] Code changes committed
- [x] Unit tests created
- [x] Address validation enforced
- [x] Placeholder fallbacks removed
- [x] Stripe checkout collects shipping
- [x] Recovery extracts size from metadata
- [x] PR created and reviewed
- [ ] Test with real Stripe test checkout session
- [ ] Verify error message on incomplete address
- [ ] Deploy to staging/preview
- [ ] Smoke test on staging
- [ ] Deploy to production
- [ ] Monitor first production order
- [ ] Verify Prodigi order has real address

## Monitoring & Alerts

### Success Indicators

Monitor these after deployment:

1. **Prodigi Order Success Rate**
   - Should be 100% when Stripe checkout completes
   - Log search: `[Prodigi] ✅ Successfully created`

2. **No Placeholder Addresses**
   - Search Prodigi orders for `1234 Main St` → should be ZERO results
   - Search for `San Francisco` in non-California orders → should be ZERO results

3. **Explicit Failures (Good)**
   - Log search: `Incomplete shipping address` → these are GOOD failures
   - Indicates validation is working correctly

### Alert Conditions

Set up alerts for:

- ❌ Prodigi order created with fake address (should never happen now)
- ❌ Stripe checkout completing without shipping address
- ✅ Multiple `Incomplete shipping address` errors (indicates Stripe config issue)

## Rollback Plan

If issues occur in production:

1. **Immediate:** Revert PR #76
2. **Temporary Fix:** Manually process orders with correct addresses
3. **Investigation:** Check Stripe webhook logs and session data
4. **Re-deploy:** After root cause identified and tested

## Prevention

To prevent similar issues in the future:

1. ✅ Never use placeholder/default values in production code
2. ✅ Always validate external data (Stripe, APIs) before use
3. ✅ Fail-fast with clear error messages
4. ✅ Add unit tests for critical validation logic
5. ✅ Store all critical data in Stripe metadata for recovery
6. ✅ Review all code paths that create Prodigi orders

## Related Documentation

- [PR #76](https://github.com/jonathanmoore/forbotsonly/pull/76) - Fix implementation
- `tests/address-validation.test.ts` - Test suite
- `src/server.ts` - `validateShippingAddress()` function
- `src/stripe.ts` - `shipping_address_collection` config

## Contact

For questions about this fix:
- **Developer:** Cloud Agent
- **Date Fixed:** 2026-09-12
- **Original Incident:** ord_14507530 (fake address to San Francisco)
