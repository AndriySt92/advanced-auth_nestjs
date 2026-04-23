import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import { Prisma } from '@/generated/prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter<Prisma.PrismaClientKnownRequestError> {
    catch(
        exception: Prisma.PrismaClientKnownRequestError,
        host: ArgumentsHost,
    ) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        // P2000 – value too long for column type
        if (exception.code === 'P2000') {
            const column = (exception.meta?.column_name as string) || 'field';
            return response.status(400).json({
                statusCode: 400,
                message: `The value provided for "${column}" is too long.`,
                error: 'Bad Request',
            });
        }

        // P2002 – unique constraint failed
        if (exception.code === 'P2002') {
            const fields =
                (exception.meta?.target as string[])?.join(', ') || 'field';
            return response.status(409).json({
                statusCode: 409,
                message: `A record with the same ${fields} already exists.`,
                error: 'Conflict',
            });
        }

        // P2025 – record not found
        if (exception.code === 'P2025') {
            const modelName =
                (exception.meta?.modelName as string) ?? 'Resource';
            return response.status(404).json({
                statusCode: 404,
                message: `${modelName} not found. Please check the provided data.`,
                error: 'Not Found',
            });
        }
        throw exception;
    }
}
