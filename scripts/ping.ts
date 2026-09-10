#!/usr/bin/env bun

/**
 * Prodigi API Ping Script
 * 
 * Tests connectivity to the Prodigi sandbox API by fetching a product SKU.
 * 
 * Usage:
 *   bun run prodigi:ping
 * 
 * Requires PRODIGI_API_KEY to be set in .env
 */

import { createProdigiClient } from '../src/prodigi';

// TODO: Jonathan will update this with a real black tee / left-chest SKU from the Prodigi dashboard
const PLACEHOLDER_SKU = 'GLOBAL-TSHT-BLCK-XXL';

async function ping() {
  console.log('🔌 Pinging Prodigi sandbox API...\n');

  try {
    const client = createProdigiClient();
    
    console.log(`📦 Fetching product: ${PLACEHOLDER_SKU}`);
    const product = await client.getProduct(PLACEHOLDER_SKU);
    
    console.log('✅ Success! Product retrieved:\n');
    console.log(JSON.stringify(product, null, 2));
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error:', error.message);
      
      if (error.message.includes('PRODIGI_API_KEY')) {
        console.error('\n💡 Tip: Copy .env.example to .env and add your API key');
        console.error('   Get your key at https://dashboard.prodigi.com → Settings → Integrations → API');
      }
    } else {
      console.error('❌ Unknown error:', error);
    }
    process.exit(1);
  }
}

ping();
