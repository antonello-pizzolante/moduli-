import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSession, RegisterFormData } from '../types';
import {
  getCurrentUser,
  loginUser,
  demoLoginUser,
  registerUser,
  logoutUser,
  verifyCurrentSession,
  changeUserPassword,
  adminLogin,
} from '../services/apiService';

interface AuthContextType {
  user: UserSession | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isDemo: boolean;
  isAdmin: boolean;
  mustChangePassword: boolean;
  login: (identifier: string, password: string, remember: boolean, isDemo?: boolean) => Promise<void>;
  loginAdmin: (password: string) => Promise<void>;
  enterDemo: () => Promise<void>;
  register: (formData: RegisterFormData) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  useEffect(() => {
    async function initAuth() {
      try {
        const verified = await verifyCurrentSession();
        if (verified) {
          setUser(verified);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.warn('Could not verify session on start', err);
        const active = getCurrentUser();
        if (active) setUser(active);
      } finally {
        setIsLoadingAuth(false);
      }
    }

    initAuth();
  }, []);

  const handleLogin = async (identifier: string, password: string, remember: boolean, isDemo = false) => {
    const result = await loginUser(identifier, password, remember, isDemo);
    setUser(result.user);
  };

  const handleLoginAdmin = async (password: string) => {
    const result = await adminLogin(password);
    setUser(result.user);
  };

  const handleEnterDemo = async () => {
    const result = await demoLoginUser();
    setUser(result.user);
  };

  const handleRegister = async (formData: RegisterFormData) => {
    const result = await registerUser(formData);
    setUser(result.user);
  };

  const handleChangePassword = async (oldPassword: string, newPassword: string) => {
    await changeUserPassword(oldPassword, newPassword);
    if (user) {
      setUser({ ...user, mustChangePassword: false });
    }
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoadingAuth,
        isDemo: !!user?.isDemo,
        isAdmin: user?.role === 'admin',
        mustChangePassword: !!user?.mustChangePassword,
        login: handleLogin,
        loginAdmin: handleLoginAdmin,
        enterDemo: handleEnterDemo,
        register: handleRegister,
        changePassword: handleChangePassword,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
