import axios from 'axios';
import { EvolutionCallResult } from './whatsapp-types';

/**
 * Thin HTTP client for the locally hosted Evolution API.
 *
 * All requests carry the server-side API key from environment configuration.
 * The key is never exposed to the browser; the frontend talks to the Shopi
 * backend, and only this client talks to Evolution API.
 */
export class EvolutionApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/+$/, '');
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
  }

  /** True when a URL and API key are configured. */
  isConfigured(): boolean {
    return this.baseUrl.startsWith('http') && this.apiKey.trim().length > 0;
  }

  /** Sanitized description of the runtime config (never leaks the key). */
  describeConfig(): { baseUrl: string; configured: boolean } {
    return { baseUrl: this.baseUrl, configured: this.isConfigured() };
  }

  private async call<T>(
    method: 'get' | 'post' | 'delete',
    path: string,
    body?: unknown,
    timeoutMs = 10000,
    _attempt = 0
  ): Promise<EvolutionCallResult<T>> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'Evolution API is not configured (EVOLUTION_API_URL / EVOLUTION_API_KEY).' };
    }
    try {
      const res = await axios.request<T>({
        method,
        url: `${this.baseUrl}${path}`,
        headers: { apikey: this.apiKey, 'Content-Type': 'application/json' },
        data: body,
        timeout: timeoutMs
      });
      return { ok: true, data: res.data, status: res.status };
    } catch (err: any) {
      // Render cold-start resilience: a waking Evolution service briefly
      // answers 502/503/504/429 before it is ready. Retry a few times with a
      // short backoff instead of surfacing a dead-end error to the merchant.
      const retryableStatuses = [429, 502, 503, 504];
      const isRetryableHttp =
        err.response && retryableStatuses.includes(err.response.status);
      const isRetryableNetwork =
        err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET';
      if (_attempt < 3 && (isRetryableHttp || isRetryableNetwork)) {
        await new Promise(r => setTimeout(r, 4000 * (_attempt + 1)));
        return this.call<T>(method, path, body, timeoutMs, _attempt + 1);
      }
      if (err.response) {
        const msg =
          (err.response.data && (err.response.data.response?.message || err.response.data.message)) ||
          `Evolution API responded with HTTP ${err.response.status}`;
        return { ok: false, status: err.response.status, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
      }
      return { ok: false, error: err.code || err.message || 'Evolution API request failed' };
    }
  }

  /** Lists all instances. GET /instance/fetchInstances */
  async fetchInstances(): Promise<EvolutionCallResult<any[]>> {
    return this.call<any[]>('get', '/instance/fetchInstances');
  }

  /** Lists one instance by name (returns [] when missing). */
  async fetchInstanceByName(instanceName: string): Promise<any | null> {
    const res = await this.call<any[]>('get', `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`);
    if (!res.ok || !Array.isArray(res.data)) return null;
    return res.data.length > 0 ? res.data[0] : null;
  }

  /**
   * Raw connection state for an instance. GET /instance/connectionState/:instanceName
   * Response shape: { instance: { instanceName, state } }
   */
  async getConnectionState(instanceName: string): Promise<string | null> {
    const res = await this.call<{ instance?: { state?: string } }>('get', `/instance/connectionState/${encodeURIComponent(instanceName)}`);
    if (!res.ok || !res.data) return null;
    return res.data.instance?.state ?? null;
  }

  /**
   * Connect flow: triggers the QR generation for an unconnected instance.
   * GET /instance/connect/:instanceName → { pairingCode, code, base64 }
   */
  async connectInstance(instanceName: string): Promise<EvolutionCallResult<any>> {
    return this.call<any>('get', `/instance/connect/${encodeURIComponent(instanceName)}`, undefined, 25000);
  }

  /**
   * Deletes an instance entirely (DB row + session). DELETE /instance/delete/:instanceName
   */
  async deleteInstance(instanceName: string): Promise<EvolutionCallResult<any>> {
    return this.call<any>('delete', `/instance/delete/${encodeURIComponent(instanceName)}`, undefined, 20000);
  }

  /**
   * Logs the connected WhatsApp session out. DELETE /instance/logout/:instanceName
   * Clears the paired session; the instance needs a fresh QR scan to reconnect.
   */
  async logoutInstance(instanceName: string): Promise<EvolutionCallResult<any>> {
    return this.call<any>('delete', `/instance/logout/${encodeURIComponent(instanceName)}`, undefined, 20000);
  }

  /**
   * Creates a WhatsApp Web (Baileys) instance. POST /instance/create
   */
  async createInstance(instanceName: string): Promise<EvolutionCallResult<any>> {
    return this.call<any>('post', '/instance/create', {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS'
    }, 30000);
  }

  /**
   * Sends a plain text message. POST /message/sendText/:instanceName
   * Response contains the provider message id (key.id).
   */
  async sendText(instanceName: string, number: string, text: string): Promise<EvolutionCallResult<any>> {
    return this.call<any>('post', `/message/sendText/${encodeURIComponent(instanceName)}`, {
      number,
      text
    }, 20000);
  }

  /**
   * Checks whether a list of numbers exist on WhatsApp.
   * POST /chat/whatsappNumbers/:instanceName — body { numbers: string[] }
   * Requires a connected sender instance; guarded by a short timeout because an
   * unconnected instance never resolves this call.
   */
  async checkNumbersOnWhatsapp(instanceName: string, numbers: string[]): Promise<EvolutionCallResult<any[]>> {
    return this.call<any[]>('post', `/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`, { numbers }, 15000);
  }
}

export const evolutionApiClient = new EvolutionApiClient();
