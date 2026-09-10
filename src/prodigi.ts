/**
 * Minimal Prodigi Sandbox API Client
 * 
 * Provides thin wrappers around the Prodigi API for product catalog
 * and order management operations.
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
    this.baseUrl = config.baseUrl || process.env.PRODIGI_BASE_URL || 'https://api.sandbox.prodigi.com';
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
