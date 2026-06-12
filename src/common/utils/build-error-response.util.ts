import type { ErrorResponse } from '../types';

type BuildErrorResponseParams = {
    statusCode: number;
    message: string;
    error: string;
    path: string;
};

export function buildErrorResponse(
    params: BuildErrorResponseParams,
): ErrorResponse {
    return {
        ...params,
        timestamp: new Date().toISOString(),
    };
}
