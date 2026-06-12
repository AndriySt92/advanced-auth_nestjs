import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { buildErrorResponse } from '../utils';

type HttpExceptionResponseBody = {
    message?: string | string[];
    error?: string;
    statusCode?: number;
};

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: HttpException, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const statusCode = exception.getStatus();
        const exceptionResponse = exception.getResponse();

        let message = 'HTTP exception';
        let error = exception.name;

        if (typeof exceptionResponse === 'string') {
            message = exceptionResponse;
        } else if (this.isHttpExceptionResponseBody(exceptionResponse)) {
            if (Array.isArray(exceptionResponse.message)) {
                message = exceptionResponse.message.join(', ');
            } else if (typeof exceptionResponse.message === 'string') {
                message = exceptionResponse.message;
            }

            if (typeof exceptionResponse.error === 'string') {
                error = exceptionResponse.error;
            }
        }

        // Log the error if it's a server error (5xx)
        if (statusCode >= 500) {
            this.logger.error(
                `HTTP ${statusCode}: ${message} | ${request.method} ${request.url}`,
            );
        }

        // Log warnings for client errors (4xx)
        if (statusCode >= 400 && statusCode < 500) {
            this.logger.warn(
                `HTTP ${statusCode}: ${message} | ${request.method} ${request.url}`,
            );
        }

        const errorResponse = buildErrorResponse({
            statusCode,
            message,
            error,
            path: request.url,
        });

        response.status(statusCode).json(errorResponse);
    }

    private isHttpExceptionResponseBody(
        value: unknown,
    ): value is HttpExceptionResponseBody {
        return (
            typeof value === 'object' &&
            value !== null &&
            ('message' in value || 'error' in value)
        );
    }
}
