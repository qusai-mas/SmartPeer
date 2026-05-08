import { createContext, useContext, useState, useEffect } from 'react';
import { loginWithEmail, signupUser, logoutUser, getCurrentUser } from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch of user
    const initAuth = async () => {
      try {
        const u = await getCurrentUser();
        setUser(u);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    const u = await loginWithEmail(email, password);
    setUser(u);
    return u;
  };

  const signup = async (email, password, role, otp) => {
    const u = await signupUser(email, password, role, otp);
    setUser(u);
    return u;
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    signup,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
