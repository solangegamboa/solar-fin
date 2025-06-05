
'use client';

import type { UserProfile } from '@/types';
import { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
}

// Define a default local user
const DEFAULT_USER_ID = 'default_user';
const defaultUser: UserProfile = {
  uid: DEFAULT_USER_ID,
  email: 'user@example.local',
  displayName: 'Local User',
  photoURL: null, // No photo for local user
  createdAt: Date.now(),
  lastLoginAt: Date.now(),
};

const AuthContext = createContext<AuthContextType>({
  user: null, // Will be set to defaultUser
  loading: true, // Will be set to false
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Simulate an always "logged-in" local user
  const [user, setUser] = useState<UserProfile | null>(defaultUser);
  const [loading, setLoading] = useState(false); // No actual loading, user is always present

  // In a real scenario without auth, you might fetch initial user data here if needed.
  // For this setup, the defaultUser is static.

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
