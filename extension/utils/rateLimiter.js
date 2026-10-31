/**
 * Quản lý delay và rate limiting giữa các request
 */

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class RateLimiter {
  constructor(defaultDelayMs = 350) {
    this.defaultDelayMs = defaultDelayMs;
    this.lastRequestTime = 0;
  }

  async wait(customDelayMs = null) {
    const delayTarget = customDelayMs !== null ? customDelayMs : this.defaultDelayMs;
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < delayTarget) {
      const waitTime = delayTarget - elapsed;
      await delay(waitTime);
    }

    this.lastRequestTime = Date.now();
  }
}
