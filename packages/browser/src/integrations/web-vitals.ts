import type { Integration, Client } from '@logtide/types';

/**
 * Core Web Vitals integration — reports LCP, INP, CLS via the `web-vitals` library.
 *
 * `web-vitals` is an optional peer dependency. If not installed, this integration
 * silently does nothing.
 *
 * Metrics are sent as structured info-level log entries with performance metadata.
 */
export class WebVitalsIntegration implements Integration {
  name = 'web-vitals';
  private sampleRate: number;

  constructor(options?: { sampleRate?: number }) {
    this.sampleRate = options?.sampleRate ?? 1.0;
  }

  setup(client: Client): void {
    if (typeof window === 'undefined') return;
    if (Math.random() > this.sampleRate) return;

    import('web-vitals')
      .then(({ onLCP, onINP, onCLS }) => {
        const report = (
          name: string,
          value: number,
          rating: string,
          id: string,
        ) => {
          client.captureLog('info', `Web Vital: ${name} = ${value}`, {
            'performance.metric': name,
            'performance.value': value,
            'performance.rating': rating,
            'performance.id': id,
          });
        };

        onLCP((metric) =>
          report('LCP', metric.value, metric.rating, metric.id),
        );
        onINP((metric) =>
          report('INP', metric.value, metric.rating, metric.id),
        );
        onCLS((metric) =>
          report('CLS', metric.value, metric.rating, metric.id),
        );
      })
      .catch(() => {
        // web-vitals not installed — silently skip
      });
  }
}
