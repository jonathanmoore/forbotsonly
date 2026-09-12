# Admin Order Review Guide

## Overview

After a customer completes Stripe Checkout payment, orders are placed in **`awaiting_approval`** status and held for manual review. Orders and customer shipping addresses are **never exposed publicly**. Jonathan (or authorized admins) must review and approve each order before it's sent to Prodigi for fulfillment.

## Security

All admin endpoints require authentication via `FULFILLMENT_REVIEW_SECRET` environment variable.

### Authentication Methods

**Option 1: Authorization Header (Recommended)**
```bash
curl -H "Authorization: Bearer YOUR_SECRET_HERE" \
  https://forbotsonly.com/admin/orders/ord_123
```

**Option 2: X-Admin-Secret Header**
```bash
curl -H "X-Admin-Secret: YOUR_SECRET_HERE" \
  https://forbotsonly.com/admin/orders/ord_123
```

## Order Workflow

```
Customer Payment → awaiting_approval → Admin Review → approve/deny

Approve: awaiting_approval → paid → fulfilled (Prodigi order created)
Deny:    awaiting_approval → refunded (Stripe refund issued, no Prodigi)
```

## Admin Endpoints

### 1. View Order Details

**GET** `/admin/orders/:orderId`

Returns order details including status, shipping address, tee size, mark, and artwork URL.

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_SECRET" \
  https://forbotsonly.com/admin/orders/ord_1789089764884_abc123
```

**Response:**
```json
{
  "order": {
    "id": "ord_1789089764884_abc123",
    "status": "awaiting_approval",
    "createdAt": 1789089764884,
    "stripeCheckoutSessionId": "cs_live_...",
    "prodigiOrderId": null
  },
  "items": [
    {
      "productId": "tee-001",
      "productName": "Grok Bot Tee",
      "quantity": 1,
      "size": "l",
      "mark": {
        "shape": "hexagon",
        "color": "orange"
      }
    }
  ],
  "artworkUrl": "https://forbotsonly.com/images/prodigi-positioned/grok-bot-hexagon-orange-positioned.png",
  "shippingAddress": {
    "name": "John Doe",
    "line1": "123 Main St",
    "line2": "Apt 4B",
    "city": "San Francisco",
    "state": "CA",
    "postalCode": "94102",
    "country": "US"
  }
}
```

### 2. Approve Order

**POST** `/admin/orders/:orderId/approve`

Approves the order and creates a Prodigi fulfillment order. Idempotent - safe to call multiple times.

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SECRET" \
  https://forbotsonly.com/admin/orders/ord_1789089764884_abc123/approve
```

**Success Response:**
```json
{
  "success": true,
  "message": "Order ord_1789089764884_abc123 approved",
  "order": {
    "id": "ord_1789089764884_abc123",
    "status": "fulfilled",
    "prodigiOrderId": "ord_14501989",
    "approvedAt": 1789089800000
  }
}
```

**Idempotent Response (already approved):**
```json
{
  "success": true,
  "message": "Order ord_1789089764884_abc123 already approved and fulfilled",
  "order": {
    "id": "ord_1789089764884_abc123",
    "status": "paid",
    "prodigiOrderId": "ord_14501989",
    "approvedAt": 1789089800000
  }
}
```

### 3. Deny Order

**POST** `/admin/orders/:orderId/deny`

Denies the order and issues a Stripe refund. No Prodigi order is created. Idempotent - safe to call multiple times.

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SECRET" \
  https://forbotsonly.com/admin/orders/ord_1789089764884_abc123/deny
```

**Success Response:**
```json
{
  "success": true,
  "message": "Order ord_1789089764884_abc123 denied and refunded",
  "order": {
    "id": "ord_1789089764884_abc123",
    "status": "refunded",
    "refundId": "re_abc123xyz",
    "deniedAt": 1789089900000
  }
}
```

## Order Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Checkout session created, payment not yet completed |
| `awaiting_approval` | Payment completed, waiting for admin review (POST-PAYMENT HOLD) |
| `paid` | Approved by admin, Prodigi order in progress |
| `fulfilled` | Prodigi order created successfully |
| `refunded` | Denied by admin, Stripe refund issued |
| `cancelled` | Cancelled (reserved for future use) |

## US-Only Shipping

The system **only accepts US shipping addresses**. Orders with non-US addresses are rejected during payment processing with an error. There are **no sandbox fallback addresses** - all fields must be present and valid.

## Error Handling

### Non-US Address
If a customer somehow bypasses Stripe's address validation and submits a non-US address:
```json
{
  "error": "Only US shipping addresses are supported. Received country: CA"
}
```

### Missing Address Fields
```json
{
  "error": "Missing required shipping address fields"
}
```

### Invalid Admin Secret
```json
{
  "error": "Unauthorized: Invalid or missing admin secret"
}
```

### Order Not Found
```json
{
  "error": "Order not found"
}
```

### Wrong Order Status
```json
{
  "error": "Order ord_123 is not awaiting approval (status: fulfilled)"
}
```

## Review Workflow

1. **Receive notification** (webhook, email, or manual check) that a new order is `awaiting_approval`
2. **View order details**: `GET /admin/orders/:orderId`
3. **Review shipping address, tee size, and mark/artwork**
4. **Decision:**
   - Valid order → `POST /admin/orders/:orderId/approve`
   - Suspicious/invalid → `POST /admin/orders/:orderId/deny`
5. **Result:**
   - Approve: Prodigi order created, customer receives tee
   - Deny: Stripe refund issued, customer receives refund, no tee shipped

## Security Best Practices

1. **Never commit `FULFILLMENT_REVIEW_SECRET` to version control**
2. **Set in Railway environment variables** (Cloud Agents > Secrets)
3. **Use a strong, randomly generated secret** (e.g., 32+ character alphanumeric)
4. **Rotate secret periodically**
5. **Never expose admin endpoints publicly** without authentication
6. **Log all approve/deny actions** for audit trail

## Example: Complete Review Flow

```bash
# 1. Check order details
ORDER_ID="ord_1789089764884_abc123"
SECRET="your_secret_here"

curl -H "Authorization: Bearer $SECRET" \
  "https://forbotsonly.com/admin/orders/$ORDER_ID"

# 2. Review the response:
#    - Check shipping address looks valid
#    - Check tee size makes sense
#    - Verify mark/artwork URL is correct

# 3a. If valid, approve:
curl -X POST \
  -H "Authorization: Bearer $SECRET" \
  "https://forbotsonly.com/admin/orders/$ORDER_ID/approve"

# 3b. If suspicious, deny:
curl -X POST \
  -H "Authorization: Bearer $SECRET" \
  "https://forbotsonly.com/admin/orders/$ORDER_ID/deny"
```

## Notes

- **Idempotent operations**: Approve and deny endpoints are safe to call multiple times. If an order is already approved/denied, the operation returns success with the existing state.
- **No public order listing**: There is no public endpoint to list all orders. You must know the order ID to view/manage an order.
- **Address privacy**: Shipping addresses are never exposed through public MCP tools or the storefront. They are only accessible via authenticated admin endpoints.
- **Stripe checkout configuration**: Consider adding address validation rules in Stripe Dashboard to reject non-US addresses at checkout time for better UX.

## Troubleshooting

**Q: I approved an order but no Prodigi order was created**
- Check server logs for Prodigi API errors
- Verify `PRODIGI_API_KEY` is set and valid
- Check that address is US-only and has all required fields
- Try calling `GET /admin/orders/:id` again - reconciliation may have retried

**Q: Customer wants refund but order already approved/shipped**
- Contact Prodigi support to cancel the shipment if not yet printed
- Issue manual Stripe refund if needed (outside this system)
- Do NOT call `/deny` endpoint after approval - it will fail

**Q: Order stuck in `awaiting_approval` - payment not visible**
- Use `recover_paid_checkout` MCP tool with Stripe session ID
- Or call `GET /orders/:id` - reconciliation will check Stripe status automatically
