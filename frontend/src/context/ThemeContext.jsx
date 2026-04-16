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
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('app-theme');
    return savedTheme || 'dark';
  });

  // Применяем CSS переменные при смене темы
  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    
    const themesColors = {
      dark: {
        // Тёмная тема
        '--bg-primary': '#000000',
        '--bg-secondary': '#0a0a0a',
        '--bg-card': '#111111',
        '--bg-hover': '#1a1a1a',
        '--text-primary': '#ffffff',
        '--text-secondary': '#cccccc',
        '--text-muted': '#888888',
        '--border-color': '#222222',
        '--border-hover': '#333333',
        '--accent-primary': '#667eea',
        '--accent-secondary': '#764ba2',
        '--accent-gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        '--accent-glow': 'rgba(102, 126, 234, 0.4)',
        '--success': '#00ff9d',
        '--error': '#ff4444',
        '--withdraw': '#ff6b6b',
        '--withdraw-gradient': 'linear-gradient(135deg, #ff6b6b 0%, #ff4444 100%)',
        '--modal-bg': '#0a0a0a',
        '--particles': '#ffffff'
      },
      gray: {
        // Серая тема
        '--bg-primary': '#1a1a1a',
        '--bg-secondary': '#242424',
        '--bg-card': '#2a2a2a',
        '--bg-hover': '#353535',
        '--text-primary': '#e5e5e5',
        '--text-secondary': '#b0b0b0',
        '--text-muted': '#7a7a7a',
        '--border-color': '#333333',
        '--border-hover': '#444444',
        '--accent-primary': '#8b5cf6',
        '--accent-secondary': '#7c3aed',
        '--accent-gradient': 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
        '--accent-glow': 'rgba(139, 92, 246, 0.4)',
        '--success': '#52c41a',
        '--error': '#ff4d4f',
        '--withdraw': '#fa8c16',
        '--withdraw-gradient': 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)',
        '--modal-bg': '#242424',
        '--particles': '#b0b0b0'
      }
    };
    
    const colors = themesColors[theme];
    const root = document.documentElement;
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
  }, [theme]);

  const themes = {
    dark: {
      name: 'Тёмная',
      background: '#000000',
      particles: '#ffffff',
      icon: '🌙'
    },
    gray: {
      name: 'Серая',
      background: '#1a1a1a',
      particles: '#b0b0b0',
      icon: '🌫️'
    }
  };

  const currentTheme = themes[theme];

  const cycleTheme = () => {
    const themeOrder = ['dark', 'gray'];
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