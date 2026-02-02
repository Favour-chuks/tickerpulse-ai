/**
 * Validation utilities
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateTicker(ticker: string): boolean {
  // Ticker should be 1-5 uppercase letters
  const tickerRegex = /^[A-Z]{1,5}$/;
  return tickerRegex.test(ticker);
}

export function validatePassword(password: string): boolean {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
}

export function validateFilingType(
  type: string
): type is '10-K' | '10-Q' | '8-K' | 'DEF 14A' | 'S-1' {
  return ['10-K', '10-Q', '8-K', 'DEF 14A', 'S-1'].includes(type);
}

export function validateSeverity(severity: string): severity is 'low' | 'medium' | 'high' | 'critical' {
  return ['low', 'medium', 'high', 'critical'].includes(severity);
}

/**
 * Data transformation utilities
 */
export function normalizeTickerToupper(ticker: string): string {
  return ticker.toUpperCase().trim();
}

export function truncateText(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

export function camelCaseToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function snakeCaseToCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Date utilities
 */
export function isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date <= endDate;
}

export function getHoursBack(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export function getDaysBack(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function formatDate(date: Date): string | undefined {
 if(!date) return '';
  return date.toISOString().split('T')[0];
}

/**
 * Numeric utilities
 */
export function calculatePercentageChange(old: number, current: number): number {
  return ((current - old) / old) * 100;
}

export function roundToDecimals(num: number, decimals: number): number {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Rate limiting utilities
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests
    const recentRequests = requests.filter((time) => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
      return true;
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(key, recentRequests);

    return false;
  }

  reset(key: string): void {
    this.requests.delete(key);
  }
}

/**
 * Retry utilities
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, i)));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Batch processing utilities
 */
export async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Caching utilities
 */
export class SimpleCache<T> {
  private cache: Map<string, { value: T; expireAt: number }> = new Map();

  set(key: string, value: T, ttlMs: number = 3600000): void {
    this.cache.set(key, { value, expireAt: Date.now() + ttlMs });
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expireAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
