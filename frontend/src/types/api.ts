/**
 * Centralized API and Error Handling Types
 * Strictly aligned with CareerBridge's standardized error envelope:
 * { success: false, message: string, error_code: string, detail: ... }
 */

export interface ValidationErrorDetail {
  type: string;
  loc: (string | number)[];
  msg: string;
  input?: unknown;
}

export interface ApiErrorResponse {
  success: boolean;
  message: string;
  error_code: string;
  detail?: string | ValidationErrorDetail[] | Record<string, unknown>;
  status?: number;
  retry_after?: number;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_REQUIRED'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'RESOURCE_OWNERSHIP_ERROR'
  | 'NOT_FOUND'
  | 'RESOURCE_CONFLICT'
  | 'DUPLICATE_APPLICATION'
  | 'INVALID_STATE'
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'BAD_REQUEST'
  | 'INTERNAL_SERVER_ERROR'
  | 'UNKNOWN_ERROR';
