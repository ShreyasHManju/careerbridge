import { useContext } from 'react';
import { AuthContext, AuthContextType } from './AuthContext';

/**
 * Custom hook to consume the CareerBridge authentication context.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
