/**
 * Manual test script for GET /admin/orders?status=awaiting_approval
 * 
 * This script:
 * 1. Creates a mock order with awaiting_approval status
 * 2. Queries the admin list endpoint
 * 3. Verifies the response structure
 * 
 * Run with:
 *   FULFILLMENT_REVIEW_SECRET=test-secret bun run scripts/test-admin-list.ts
 */

import { 
  createOrderAsync, 
  listOrdersByStatus,
  updateOrderStatus,
  updateOrderShippingAddress,
  isUsingPostgres,
} from '../src/store';
import type { Cart } from '../src/types';

const ADMIN_SECRET = process.env.FULFILLMENT_REVIEW_SECRET || 'test-secret';
const BASE_URL = process.env.PUBLIC_URL || 'http://localhost:3001';

async function testAdminListEndpoint() {
  console.log('🧪 Testing GET /admin/orders?status=awaiting_approval\n');
  
  // Create a test order
  console.log('📝 Creating test order...');
  const testCart: Cart = {
    items: [
      {
        productId: 'tee-001',
        quantity: 1,
        mark: { shape: 'wedge', color: 'green' },
        size: 'l',
      },
    ],
    sessionId: 'test-session',
  };
  
  const testOrder = await createOrderAsync('test-session', testCart);
  console.log(`✅ Created order: ${testOrder.id}`);
  
  // Update to awaiting_approval status
  updateOrderStatus(testOrder.id, 'awaiting_approval');
  
  // Add shipping address (required for full order data)
  updateOrderShippingAddress(testOrder.id, {
    name: 'Test User',
    line1: '123 Test St',
    line2: 'Apt 4',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    country: 'US',
  });
  console.log('✅ Updated order to awaiting_approval with shipping address\n');
  
  // Test 1: Direct store function
  console.log('📋 Test 1: Direct store query');
  const orders = await listOrdersByStatus('awaiting_approval');
  console.log(`Found ${orders.length} awaiting_approval order(s)`);
  
  if (orders.length > 0) {
    const order = orders[0];
    console.log('Sample order:', {
      id: order.id,
      status: order.status,
      createdAt: new Date(order.createdAt).toISOString(),
      items: order.items,
    });
  }
  console.log('');
  
  // Test 2: HTTP endpoint (if server is running)
  console.log('🌐 Test 2: HTTP endpoint');
  console.log(`Querying: ${BASE_URL}/admin/orders?status=awaiting_approval`);
  
  try {
    const response = await fetch(`${BASE_URL}/admin/orders?status=awaiting_approval`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_SECRET}`,
      },
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Response: ${data.count} order(s)`);
      
      if (data.orders && data.orders.length > 0) {
        const summary = data.orders[0];
        console.log('\nSample order summary:');
        console.log(JSON.stringify(summary, null, 2));
        
        // Verify required fields
        console.log('\n🔍 Verification:');
        const requiredFields = ['orderId', 'status', 'createdAt', 'size', 'mark', 'artworkUrl'];
        const presentFields = requiredFields.filter(field => summary.hasOwnProperty(field));
        console.log(`Required fields present: ${presentFields.length}/${requiredFields.length}`);
        console.log(`✓ ${presentFields.join(', ')}`);
        
        // Verify excluded fields
        const excludedFields = ['shippingAddress', 'customerEmail', 'customerName', 'customerPhone'];
        const absentFields = excludedFields.filter(field => !summary.hasOwnProperty(field));
        console.log(`Excluded fields absent: ${absentFields.length}/${excludedFields.length}`);
        console.log(`✓ ${absentFields.join(', ')}`);
        
        if (presentFields.length === requiredFields.length && absentFields.length === excludedFields.length) {
          console.log('\n✅ All checks passed! Endpoint works correctly.');
        } else {
          console.log('\n⚠️ Some checks failed. Review response structure.');
        }
      }
    } else {
      const error = await response.text();
      console.log(`❌ Request failed: ${error}`);
    }
  } catch (err: any) {
    console.log(`❌ HTTP request failed: ${err.message}`);
    console.log('Make sure the server is running with:');
    console.log(`  FULFILLMENT_REVIEW_SECRET=${ADMIN_SECRET} bun run src/server.ts`);
  }
  
  console.log('\n✅ Test complete!');
  console.log('\nTo manually test with curl:');
  console.log(`  curl -H "Authorization: Bearer ${ADMIN_SECRET}" \\`);
  console.log(`    "${BASE_URL}/admin/orders?status=awaiting_approval"`);
}

// Run test
testAdminListEndpoint().catch(console.error);
