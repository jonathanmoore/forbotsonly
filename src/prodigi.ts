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
 * 4. Same code, different env: PRODIGI_BASE_URL (or PRODIGI_API_BASE_URL) + PRODIGI_API_KEY switch between sandbox/live
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
    // Default to sandbox for safety; live deployments must explicitly set PRODIGI_BASE_URL or PRODIGI_API_BASE_URL
    // Support both PRODIGI_BASE_URL (preferred) and PRODIGI_API_BASE_URL (GitHub Actions)
    // Strip /v4.0 suffix if present to avoid path doubling
    const envBaseUrl = config.baseUrl || process.env.PRODIGI_BASE_URL || process.env.PRODIGI_API_BASE_URL || 'https://api.sandbox.prodigi.com';
    this.baseUrl = envBaseUrl.replace(/\/v4\.0\/?$/, '');
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
   * Prodigi v4 Orders POST returns: { order: { id: "ord_...", ... }, outcome: "...", ... }
   * We unwrap the nested order object for the caller
   */
  async createOrder(payload: ProdigiOrderPayload): Promise<ProdigiOrder> {
    const response = await this.request<any>('/v4.0/Orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    
    // Unwrap nested order object if present (Prodigi v4 envelope structure)
    // Response structure: { order: { id, ... }, outcome, ... }
    if (response.order && typeof response.order === 'object') {
      return response.order as ProdigiOrder;
    }
    
    // Fallback: return raw response if already flat
    return response as ProdigiOrder;
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
