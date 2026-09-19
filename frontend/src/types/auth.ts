/**
 * Authentication and User Types for CareerBridge
 * Strictly aligned with backend schemas in app/schemas/user.py and app/schemas/auth.py
 */

export type UserRole = 'student' | 'recruiter' | 'admin';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role?: UserRole;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
