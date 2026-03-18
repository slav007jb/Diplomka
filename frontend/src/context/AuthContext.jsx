import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/SupaBaseClient';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Проверяем текущую сессию при загрузке
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Помилка перевірки сесії:', error);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Слушаем изменения авторизации (вход/выход)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Отписываемся при размонтировании
    return () => subscription.unsubscribe();
  }, []);

  // Функция выхода
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Помилка виходу:', error);
    }
  };

  const value = {
    user,        // Текущий пользователь
    loading,     // Загрузка проверки сессии
    signOut      // Функция выхода
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};