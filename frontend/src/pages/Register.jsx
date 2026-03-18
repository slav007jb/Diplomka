import { Particles } from '../components/Particles';
import TextType from '../components/TextType';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '../services/SupaBaseClient';
import '../css/Register.css';

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError('Заповніть всі поля');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Паролі не співпадають');
      return;
    }

    if (formData.password.length < 6) {
      setError('Пароль має бути не менше 6 символів');
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password
      });

      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            email: formData.email,
            full_name: null,
            avatar_url: null
          }
        ]);

      if (profileError) throw profileError;

      const { error: walletsError } = await supabase
        .from('wallets')
        .insert([
          { user_id: authData.user.id, currency: 'USD', balance: 0 },
          { user_id: authData.user.id, currency: 'EUR', balance: 0 },
          { user_id: authData.user.id, currency: 'UAH', balance: 0 }
        ]);

      if (walletsError) throw walletsError;

      setSuccess('Реєстрація успішна! Перехід на сторінку входу...');
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (error) {
      console.error('Помилка реєстрації:', error);
      setError(error.message || 'Помилка при реєстрації');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Particles quantity={150} staticity={50} color="#ffffff" size={0.6}>
      <div className="register-page">
        <div className="register-container">
          
          <div className="register-header">
            <TextType 
              text={["Реєстрація"]}
              as="h1"
              typingSpeed={75}
              pauseDuration={1500}
              deletingSpeed={50}
              showCursor={true}
              cursorCharacter="_"
              cursorBlinkDuration={0.5}
              loop={true}
            />
          </div>
          
          <p className="register-subtitle">
            Створіть акаунт для продовження
          </p>

          {error && <div className="message message-error">{error}</div>}
          {success && <div className="message message-success">{success}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input 
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="example@mail.com"
                disabled={loading}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Пароль</label>
              <input 
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                disabled={loading}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Повторіть пароль</label>
              <input 
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                disabled={loading}
                className="form-input"
              />
            </div>
            
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Реєстрація...' : 'Зареєструватися'}
            </button>
          </form>
          
          <p className="register-footer">
            Вже є акаунт?{' '}
            <Link to="/login" className="register-footer-link">
              Увійти
            </Link>
          </p>
        </div>
      </div>
    </Particles>
  );
}

export default Register;