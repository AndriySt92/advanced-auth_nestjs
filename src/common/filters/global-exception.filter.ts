import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { buildErrorResponse } from '../utils';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        const message = 'Internal server error';
        const error = 'Internal Server Error';

        this.logger.error(
            `Unhandled exception ${statusCode}: ${message} | ${request.method} ${request.url}`,
            exception instanceof Error ? exception.stack : undefined,
        );

        const errorResponse = buildErrorResponse({
            statusCode,
            message,
            error,
            path: request.url,
        });

        response.status(statusCode).json(errorResponse);
    }
}
