# HARD RULES: Prodigi Order Fulfillment

**Owner:** Jonathan Moore  
**Enforcement:** Codified in `src/server.ts` `validateShippingAddress()`  
**Status:** ✅ LOCKED IN PR #76

These rules are **non-negotiable** and **permanently enforced** in the codebase. No exceptions.

---

## Rule 1: NEVER Create Prodigi Orders with Fake Addresses

**NEVER** create a Prodigi order unless you have a **complete real shipping address**.

### ❌ FORBIDDEN
- No sandbox/placeholder fallbacks
- No invented addresses
- No "test" addresses on live orders

### ❌ SPECIFICALLY BANNED VALUES
These values must **NEVER** appear in production Prodigi orders:
- `1234 Main St`
- `San Francisco` (unless real customer address)
- `CA` (unless real customer state)
- `94102` (unless real customer ZIP)
- `Test Customer`
- Any other placeholder/default values

### ✅ ENFORCEMENT
Code throws explicit error if address is incomplete. No silent fallbacks.

```typescript
// ✅ CORRECT: Validate and fail if incomplete
const validatedAddress = validateShippingAddress(session);
// Throws error if missing any required field

// ❌ WRONG: Fallback to fake address
const line1 = address?.line1 || '1234 Main St'; // FORBIDDEN
```

---

## Rule 2: Address Source Priority Order

When collecting shipping address for Prodigi orders, use this **exact priority**:

### Priority Order
1. **Stripe Checkout `shipping_details`** (if complete)
2. **Link saved shipping address** (if flow can read it - future integration)
3. **ASK the human user** (collect explicitly, do not invent)

### ❌ DO NOT
- Do **NOT** invent addresses
- Do **NOT** guess or extrapolate
- Do **NOT** use system defaults

### ✅ ENFORCEMENT
```typescript
// Priority 1: Stripe shipping_details
const line1 = shippingAddress?.line1 || 
// Priority 2: Stripe customer_details (fallback)
              customerDetails?.address?.line1;
// Priority 3: Link (TODO - requires integration)
// Priority 4: If still missing → FAIL with error instructing to collect from user

if (!line1) {
  throw new Error('Missing line1. REQUIRED: Collect from customer.');
}
```

---

## Rule 3: US Orders ONLY

Prodigi fulfillment is **US-only**. Reject all non-US shipping addresses.

### ✅ ALLOWED
- `country: 'US'` only

### ❌ REJECTED
- Canada (`CA`)
- United Kingdom (`GB`)
- Australia (`AU`)
- **ALL other countries**

### ✅ ENFORCEMENT
```typescript
if (country && country.toUpperCase() !== 'US') {
  throw new Error(
    `Non-US shipping address rejected. Prodigi fulfillment is US-only. ` +
    `Session has country: ${country}.`
  );
}
```

### Configuration
```typescript
// src/stripe.ts - Checkout configuration
shipping_address_collection: {
  allowed_countries: ['US'], // HARD RULE: US only
}
```

---

## Rule 4: Incomplete Address → Fail Clearly

If shipping address is incomplete, **fail immediately** with a clear error. Do **NOT** call Prodigi API.

### Required Fields (US Orders)
- ✅ `line1` (street address)
- ✅ `city`
- ✅ `state` (2-letter code)
- ✅ `postal_code` (ZIP code)
- ✅ `country` (must be 'US')
- ✅ `name` (recipient name)
- ⚠️ `line2` (optional - apartment/suite)

### ✅ ENFORCEMENT
```typescript
const missingFields: string[] = [];
if (!line1) missingFields.push('line1');
if (!city) missingFields.push('city');
if (!state) missingFields.push('state'); // Required for US
if (!postalCode) missingFields.push('postal_code');
if (!country) missingFields.push('country');
if (!recipientName) missingFields.push('name');

if (missingFields.length > 0) {
  throw new Error(
    `Incomplete shipping address. Missing: ${missingFields.join(', ')}. ` +
    `REQUIRED: Collect complete US shipping address from customer. ` +
    `Do NOT invent or use placeholder addresses.`
  );
}
```

### Error Message Requirements
Error must:
1. List **ALL** missing fields
2. Instruct to **collect from customer**
3. Explicitly state **do NOT invent**

---

## Rule 5: recover_paid_checkout - No Hardcoded Size

`recover_paid_checkout` tool must follow **same address rules** as normal checkout, plus:

### ❌ FORBIDDEN
- No hardcoded size (was: `size: 'l'`)
- No guessed/assumed size

### ✅ REQUIRED
- Extract size from Stripe `session.metadata.size`
- If size not in metadata, extract from line items
- If size still missing → **FAIL** with explicit error

### ✅ ENFORCEMENT
```typescript
// Extract size from Stripe metadata (NEVER hardcode)
let size = session.metadata?.size?.toLowerCase() as 's' | 'm' | 'l' | 'xl' | '2xl' | '3xl';

// Fallback: Try line items
if (!size && session.line_items?.data?.[0]) {
  size = lineItem.price?.metadata?.size?.toLowerCase();
}

// If still no size, fail explicitly
if (!size || !isValidSize(size)) {
  throw new Error(
    `Cannot recover order: size not found in Stripe session metadata. ` +
    `Original size must be stored during checkout.`
  );
}
```

### Checkout Metadata Storage
To enable recovery, checkout must store size:

```typescript
// src/server.ts - create_checkout handler
const checkoutSession = await createCheckoutSession(
  priceId,
  quantity,
  { 
    orderId: order.id,
    size: firstItem.size,           // ✅ REQUIRED for recovery
    productId: firstItem.productId,
    markShape: firstItem.mark.shape,
    markColor: firstItem.mark.color,
  },
  successUrl,
  cancelUrl
);
```

---

## Verification

### ✅ All Rules Enforced In Code
- `src/server.ts` - `validateShippingAddress()` function
- `src/stripe.ts` - `shipping_address_collection` config
- `tests/address-validation.test.ts` - Unit tests for all rules
- `scripts/verify-address-fix.ts` - Verification script

### Run Tests
```bash
# Unit tests
bun test tests/address-validation.test.ts

# Verification script
bun run scripts/verify-address-fix.ts
```

### Expected Test Results
```
✅ Complete US addresses → pass
❌ Incomplete addresses → explicit error
❌ Non-US addresses → explicit error
❌ Missing state → explicit error
❌ Placeholder fallbacks → NEVER occur
✅ recover_paid_checkout extracts size from metadata
```

---

## Monitoring

After deployment, verify rules are enforced:

### ✅ Success Indicators
1. **Zero fake addresses** in Prodigi orders
   - Search for "1234 Main St" → 0 results
   - Search for "San Francisco" in non-CA orders → 0 results
2. **Zero non-US orders** in Prodigi
   - All Prodigi orders have `country: 'US'`
3. **Explicit failures logged** (these are GOOD)
   - "Incomplete shipping address" errors
   - "Non-US shipping address rejected" errors

### 🔴 Alert Conditions
- Prodigi order created with placeholder address → **CRITICAL BUG**
- Prodigi order created with non-US address → **CRITICAL BUG**
- Stripe checkout completes without shipping address → **CONFIG ERROR**

---

## Consequences of Violation

Breaking these rules results in:
1. 🔴 Customer never receives product (wrong address)
2. 🔴 Lost revenue (shipping cost wasted)
3. 🔴 Poor customer experience (broken trust)
4. 🔴 Wasted international shipping cost (non-US orders)

**These rules exist to prevent production incidents.** They are non-negotiable.

---

## Document History

- **2026-09-12**: Rules codified by Jonathan Moore
- **2026-09-12**: Enforced in PR #76
- **Status**: ✅ ACTIVE - All rules enforced in code
