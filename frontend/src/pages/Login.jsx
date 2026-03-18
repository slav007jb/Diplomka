import { Link, useNavigate } from 'react-router-dom';
import TextType from '../components/TextType';
import { Particles } from '../components/Particles';
import { useState } from 'react';
import { supabase } from '../services/SupaBaseClient';
import '../css/Login.css';

function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Очищаем ошибку при вводе
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Валидация
    if (!formData.email || !formData.password) {
      setError('Заповніть всі поля');
      return;
    }

    setLoading(true);

    try {
      // Вход через Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (authError) throw authError;

      console.log('Успішний вхід:', data);

      // Перенаправляем на дашборд
      navigate('/dashboard');

    } catch (error) {
      console.error('Помилка входу:', error);
      
      // Обработка разных типов ошибок
      if (error.message.includes('Invalid login credentials')) {
        setError('Невірний email або пароль');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Підтвердіть email перед входом');
      } else {
        setError(error.message || 'Помилка при вході');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Particles quantity={150} staticity={50} color="#ffffff" size={0.6}>
      <div className="login-page">
        <div className="login-container">
          
          <div className="login-header">
            <TextType 
              text={["Вхід"]}
              as="h1"
              typingSpeed={75}
              pauseDuration={3500}
              deletingSpeed={50}
              showCursor={true}
              cursorCharacter="_"
              cursorBlinkDuration={0.5}
              loop={true}
            />
          </div>
          
          <p className="login-subtitle">
            Увійдіть у свій акаунт
          </p>

          {/* Сообщение об ошибке */}
          {error && (
            <div className="message message-error">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="login-form-group">
              <label className="login-form-label">Email</label>
              <input 
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="example@mail.com"
                disabled={loading}
                className="login-form-input"
              />
            </div>
            
            <div className="login-form-group">
              <label className="login-form-label">Пароль</label>
              <input 
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                disabled={loading}
                className="login-form-input"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="login-button"
            >
              {loading ? 'Вхід...' : 'Увійти'}
            </button>
          </form>
          
          <p className="login-footer">
            Немає акаунту?{' '}
            <Link to="/register" className="login-footer-link">
              Зареєструватися
            </Link>
          </p>
        </div>
      </div>
    </Particles>
  );
}

export default Login;