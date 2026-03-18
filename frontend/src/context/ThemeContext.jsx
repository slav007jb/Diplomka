import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Загружаем тему из localStorage или ставим чёрную по умолчанию
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('app-theme');
    return savedTheme || 'dark';
  });

  // Сохраняем тему при изменении
  useEffect(() => {
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  // Конфигурация тем
  const themes = {
    dark: {
      name: 'Чорна',
      background: '#0a0a0a',
      particles: '#ffffff',
      icon: '🌙'
    },
    gray: {
      name: 'Сіра',
      background: '#2a2a2a',
      particles: '#e0e0e0',
      icon: '🌫️'
    },
    light: {
      name: 'Біла',
      background: '#f5f5f5',
      particles: '#333333',
      icon: '☀️'
    }
  };

  const currentTheme = themes[theme];

  const cycleTheme = () => {
    const themeOrder = ['dark', 'gray', 'light'];
    const currentIndex = themeOrder.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    setTheme(themeOrder[nextIndex]);
  };

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, cycleTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
};