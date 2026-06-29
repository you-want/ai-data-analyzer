import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

interface RequestWithResponse {
  method: string;
  originalUrl: string;
}

interface ResponseWithStatus {
  statusCode: number;
}

interface ErrorWithName {
  name?: string;
}

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithResponse>();
    const { method, originalUrl } = request;
    const startTime = Date.now();

    this.metricsService.incrementActiveRequests(method, originalUrl);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (Date.now() - startTime) / 1000;
          const response = context
            .switchToHttp()
            .getResponse<ResponseWithStatus>();
          this.metricsService.recordRequest(
            method,
            originalUrl,
            response.statusCode,
            duration,
          );
          this.metricsService.decrementActiveRequests(method, originalUrl);
        },
        error: (err: ErrorWithName) => {
          this.metricsService.recordError(
            method,
            originalUrl,
            err.name ?? 'Error',
          );
          this.metricsService.decrementActiveRequests(method, originalUrl);
        },
      }),
    );
  }
}
