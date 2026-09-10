#!/usr/bin/env bun

/**
 * Prodigi API Ping Script
 * 
 * Tests connectivity to the Prodigi API by fetching a product SKU.
 * 
 * Usage:
 *   bun run prodigi:ping
 * 
 * Environment:
 *   PRODIGI_API_KEY - Your API key (sandbox or live)
 *   PRODIGI_BASE_URL - Optional; defaults to sandbox (api.sandbox.prodigi.com)
 * 
 * For testing sandbox:
 *   PRODIGI_API_KEY=sk_sandbox_... bun run prodigi:ping
 * 
 * For testing live (use with caution):
 *   PRODIGI_BASE_URL=https://api.prodigi.com PRODIGI_API_KEY=sk_live_... bun run prodigi:ping
 */

import { createProdigiClient } from '../src/prodigi';

// TODO: Jonathan will update this with a real black tee / left-chest SKU from the Prodigi dashboard
const PLACEHOLDER_SKU = 'GLOBAL-TSHT-BLCK-XXL';

async function ping() {
  const baseUrl = process.env.PRODIGI_BASE_URL || 'https://api.sandbox.prodigi.com';
  const environment = baseUrl.includes('sandbox') ? 'SANDBOX' : 'LIVE';
  
  console.log(`🔌 Pinging Prodigi ${environment} API...`);
  console.log(`   Base URL: ${baseUrl}\n`);

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
