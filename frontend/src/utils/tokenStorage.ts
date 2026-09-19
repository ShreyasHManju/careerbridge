/**
 * Centralized Authentication Token Storage Abstraction
 *
 * SECURITY TRADEOFF DOCUMENTATION:
 * --------------------------------
 * This module stores the JWT access token in browser localStorage.
 *
 * Tradeoffs:
 * 1. Accessibility: Allows client-side JavaScript to attach Authorization Bearer headers
 *    on outbound REST requests and WebSocket connections without requiring cookie coordination.
 * 2. Security Considerations:
 *    - localStorage is vulnerable to Cross-Site Scripting (XSS) if malicious scripts execute.
 *    - To mitigate this risk, CareerBridge enforces strict Content Security Policy (CSP),
 *      sanitizes untrusted inputs, forbids inline scripts, and backend sets defense headers
 *      (X-Content-Type-Options: nosniff, X-Frame-Options: DENY, X-XSS-Protection: 1; mode=block).
 * 3. Future Architecture:
 *    - If the CareerBridge backend adds server-side session management or HttpOnly cookie
 *      refresh tokens in a future milestone, this abstraction can be swapped without
 *      modifying business components.
 */

const TOKEN_KEY = 'cb_access_token';

export const tokenStorage = {
  /**
   * Retrieve the current stored JWT access token, or null if none exists.
   */
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      // In private browsing or restricted environments, localStorage may throw
      return null;
    }
  },

  /**
   * Persist the JWT access token in browser storage.
   */
  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (err) {
      console.error('Failed to save access token to storage:', err);
    }
  },

  /**
   * Remove the stored JWT access token.
   */
  clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (err) {
      console.error('Failed to clear access token from storage:', err);
    }
  },

  /**
   * Check if a token currently exists in storage.
   */
  hasToken(): boolean {
    return Boolean(this.getToken());
  },
};
