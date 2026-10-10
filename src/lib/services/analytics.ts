/**
 * Privacy-friendly, zero-cookie analytics utility for YolPay.
 * Works seamlessly with Umami, PostHog, or local telemetry fallback.
 */

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, any>) => void;
    };
    posthog?: {
      capture: (eventName: string, eventData?: Record<string, any>) => void;
    };
  }
}

export type AnalyticsEvent =
  | 'calculation_completed'
  | 'route_selected'
  | 'share_clicked'
  | 'car_changed'
  | 'language_toggled'
  | 'theme_toggled'
  | 'feedback_opened';

class AnalyticsService {
  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  track(eventName: AnalyticsEvent, eventData: Record<string, any> = {}) {
    if (!this.isBrowser()) return;

    // 1. Umami integration (if script is present on window)
    try {
      if (window.umami && typeof window.umami.track === 'function') {
        window.umami.track(eventName, eventData);
      }
    } catch (e) {
      // safe silent
    }

    // 2. PostHog integration (if initialized on window)
    try {
      if (window.posthog && typeof window.posthog.capture === 'function') {
        window.posthog.capture(eventName, eventData);
      }
    } catch (e) {
      // safe silent
    }

    // 3. Local anonymous event logging in localStorage for development/diagnostic metrics
    try {
      const storageKey = 'yolpay_metrics_v1';
      const raw = localStorage.getItem(storageKey);
      const metrics = raw ? JSON.parse(raw) : { counts: {}, recent: [] };

      metrics.counts[eventName] = (metrics.counts[eventName] || 0) + 1;
      metrics.recent.unshift({
        event: eventName,
        data: eventData,
        timestamp: new Date().toISOString(),
      });

      // Keep only last 50 events in local storage to prevent bloating
      if (metrics.recent.length > 50) {
        metrics.recent = metrics.recent.slice(0, 50);
      }

      localStorage.setItem(storageKey, JSON.stringify(metrics));
    } catch (e) {
      // local storage quota or private browsing mode
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] ${eventName}:`, eventData);
    }
  }

  getLocalMetrics(): { counts: Record<string, number>; recent: Array<{ event: string; timestamp: string }> } {
    if (!this.isBrowser()) return { counts: {}, recent: [] };
    try {
      const raw = localStorage.getItem('yolpay_metrics_v1');
      return raw ? JSON.parse(raw) : { counts: {}, recent: [] };
    } catch {
      return { counts: {}, recent: [] };
    }
  }
}

export const analytics = new AnalyticsService();
