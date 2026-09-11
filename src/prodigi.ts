/**
 * Minimal Prodigi API Client
 * 
 * Provides thin wrappers around the Prodigi API for product catalog
 * and order management operations.
 * 
 * Architecture:
 * - SANDBOX (api.sandbox.prodigi.com): Rehearsal environment for testing
 * - LIVE (api.prodigi.com): Production environment for real orders
 * 
 * Intended Flow:
 * 1. Customer completes payment via Stripe Checkout / Link (live mode)
 * 2. Stripe webhook fires `checkout.session.completed`
 * 3. Webhook handler places LIVE Prodigi order using this client
 * 4. Same code, different env: PRODIGI_BASE_URL + PRODIGI_API_KEY switch between sandbox/live
 * 
 * CRITICAL: Live API key must NEVER be committed to version control.
 */

export interface ProdigiConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface ProdigiProduct {
  sku: string;
  [key: string]: unknown;
}

export interface ProdigiOrder {
  id: string;
  [key: string]: unknown;
}

export interface ProdigiOrderPayload {
  [key: string]: unknown;
}

export class ProdigiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ProdigiConfig) {
    this.apiKey = config.apiKey;
    // Default to sandbox for safety; live deployments must explicitly set PRODIGI_BASE_URL
    // IMPORTANT: baseUrl must be HOST ONLY (e.g., https://api.prodigi.com), NOT including /v4.0
    // Paths in request methods already include /v4.0/Orders, etc.
    this.baseUrl = config.baseUrl || process.env.PRODIGI_BASE_URL || 'https://api.sandbox.prodigi.com';
    
    // Strip any trailing /v4.0 or similar path suffixes to prevent double-path issues
    this.baseUrl = this.baseUrl.replace(/\/v\d+\.\d+.*$/, '');
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Prodigi API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get product details by SKU
   */
  async getProduct(sku: string): Promise<ProdigiProduct> {
    return this.request<ProdigiProduct>(`/v4.0/Products/${sku}`);
  }

  /**
   * Create a new order
   */
  async createOrder(payload: ProdigiOrderPayload): Promise<ProdigiOrder> {
    return this.request<ProdigiOrder>('/v4.0/Orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Get order details by ID
   */
  async getOrder(id: string): Promise<ProdigiOrder> {
    return this.request<ProdigiOrder>(`/v4.0/Orders/${id}`);
  }
}

/**
 * Create a Prodigi client instance from environment variables
 */
export function createProdigiClient(config?: Partial<ProdigiConfig>): ProdigiClient {
  const apiKey = config?.apiKey || process.env.PRODIGI_API_KEY;
  
  if (!apiKey) {
    throw new Error('PRODIGI_API_KEY is required. Set it in .env or pass it to createProdigiClient()');
  }

  return new ProdigiClient({
    apiKey,
    baseUrl: config?.baseUrl,
  });
}
