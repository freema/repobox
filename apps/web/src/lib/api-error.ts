import { NextResponse } from "next/server";

/**
 * Standard API error codes
 */
export enum ApiErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  BAD_REQUEST = "BAD_REQUEST",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  RATE_LIMITED = "RATE_LIMITED",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

/**
 * API error response structure
 */
export interface ApiErrorResponse {
  error: string;
  code: ApiErrorCode;
  details?: unknown;
}

/**
 * Create a standardized API error response
 */
export function apiError(
  message: string,
  code: ApiErrorCode,
  status: number,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    error: message,
    code,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return NextResponse.json(response, { status });
}

/**
 * Common error responses
 */
export const ApiErrors = {
  unauthorized: (message = "Unauthorized") => apiError(message, ApiErrorCode.UNAUTHORIZED, 401),

  forbidden: (message = "Forbidden") => apiError(message, ApiErrorCode.FORBIDDEN, 403),

  notFound: (message = "Not found") => apiError(message, ApiErrorCode.NOT_FOUND, 404),

  badRequest: (message = "Bad request", details?: unknown) =>
    apiError(message, ApiErrorCode.BAD_REQUEST, 400, details),

  validationError: (message = "Validation error", details?: unknown) =>
    apiError(message, ApiErrorCode.VALIDATION_ERROR, 400, details),

  internalError: (message = "Internal server error") =>
    apiError(message, ApiErrorCode.INTERNAL_ERROR, 500),

  rateLimited: (message = "Too many requests") => apiError(message, ApiErrorCode.RATE_LIMITED, 429),

  serviceUnavailable: (message = "Service unavailable") =>
    apiError(message, ApiErrorCode.SERVICE_UNAVAILABLE, 503),
};
