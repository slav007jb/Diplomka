import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

function ThemeToggle() {
  const { currentTheme, cycleTheme } = useTheme();

  // Добавляем проверку на случай, если currentTheme еще не загружен
  if (!currentTheme) {
    return null;
  }

  return (
    <motion.button
      onClick={cycleTheme}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '28px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
        transition: 'all 0.3s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(102, 126, 234, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
      }}
    >
      {currentTheme.icon}
    </motion.button>
  );
}

export default ThemeToggle;