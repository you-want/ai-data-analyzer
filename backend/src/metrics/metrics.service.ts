import { Injectable, OnModuleInit } from '@nestjs/common';
import * as prometheus from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly requestCounter: prometheus.Counter<string>;
  private readonly requestDuration: prometheus.Histogram<string>;
  private readonly activeRequests: prometheus.Gauge<string>;
  private readonly errorCounter: prometheus.Counter<string>;

  constructor() {
    prometheus.register.clear();

    this.requestCounter = new prometheus.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.requestDuration = new prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });

    this.activeRequests = new prometheus.Gauge({
      name: 'http_active_requests',
      help: 'Number of active HTTP requests',
      labelNames: ['method', 'route'],
    });

    this.errorCounter = new prometheus.Counter({
      name: 'http_errors_total',
      help: 'Total number of HTTP errors',
      labelNames: ['method', 'route', 'error_type'],
    });
  }

  onModuleInit() {
    prometheus.collectDefaultMetrics();
  }

  recordRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
  ) {
    this.requestCounter.labels(method, route, statusCode.toString()).inc();
    this.requestDuration.labels(method, route).observe(duration);
  }

  incrementActiveRequests(method: string, route: string) {
    this.activeRequests.labels(method, route).inc();
  }

  decrementActiveRequests(method: string, route: string) {
    this.activeRequests.labels(method, route).dec();
  }

  recordError(method: string, route: string, errorType: string) {
    this.errorCounter.labels(method, route, errorType).inc();
  }

  async getMetrics(): Promise<string> {
    return prometheus.register.metrics();
  }
}
