import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { Prisma } from '@/generated/prisma/client';

import { buildErrorResponse } from '../utils';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter<Prisma.PrismaClientKnownRequestError> {
    private readonly logger = new Logger(PrismaExceptionFilter.name);

    catch(
        exception: Prisma.PrismaClientKnownRequestError,
        host: ArgumentsHost,
    ) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = exception.message;
        let error = 'Internal Server Error';

        switch (exception.code) {
            case 'P2000': {
                const column =
                    (exception.meta?.column_name as string) || 'field';

                statusCode = HttpStatus.BAD_REQUEST;
                message = `The value provided for "${column}" is too long.`;
                error = 'Bad Request';
                break;
            }

            case 'P2002': {
                const fields =
                    (exception.meta?.target as string[])?.join(', ') || 'field';

                statusCode = HttpStatus.CONFLICT;
                message = `A record with the same ${fields} already exists.`;
                error = 'Conflict';
                break;
            }

            case 'P2025': {
                const modelName =
                    (exception.meta?.modelName as string) ?? 'Resource';

                statusCode = HttpStatus.NOT_FOUND;
                message = `${modelName} not found. Please check the provided data.`;
                error = 'Not Found';
                break;
            }
        }

        // Log the error if it's a server error (5xx)
        if (statusCode >= 500) {
            this.logger.error(
                `PRISMA ${exception.code}: ${message} | ${request.method} ${request.url}`,
                exception.stack,
            );
        }

        // Log warnings for client errors (4xx)
        if (statusCode >= 400 && statusCode < 500) {
            this.logger.warn(
                `PRISMA ${exception.code}: ${message} | ${request.method} ${request.url}`,
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
}
