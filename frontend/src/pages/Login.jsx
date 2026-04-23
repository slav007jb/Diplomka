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

  // ── 2FA стейти ──────────────────────────────────────────
  const [needsMFA, setNeedsMFA] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

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

    if (!formData.email || !formData.password) {
      setError('Заповніть всі поля');
      return;
    }

    setLoading(true);

    try {
      // Крок 1: Вхід через email + пароль
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (authError) throw authError;

      // Крок 2: Перевіряємо чи потрібен 2FA
      const { data: aalData, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) throw aalError;

      if (aalData.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2') {
        // У користувача увімкнено 2FA — запитуємо код
        setNeedsMFA(true);
        setLoading(false);
        return;
      }

      // 2FA не потрібен — одразу на dashboard
      navigate('/dashboard');

    } catch (error) {
      console.error('Помилка входу:', error);

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

  // ── Верифікація 2FA коду ─────────────────────────────────
  const verifyMFA = async (e) => {
    e.preventDefault();
    setError('');

    if (mfaCode.length !== 6) {
      setError('Введіть 6-значний код');
      return;
    }

    setLoading(true);

    try {
      // Отримуємо список факторів
      const { data: factorsData, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const totpFactor = factorsData.totp.find(f => f.status === 'verified');
      if (!totpFactor) throw new Error('2FA фактор не знайдено');

      // Створюємо challenge
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: totpFactor.id });

      if (challengeError) throw challengeError;

      // Верифікуємо код
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code: mfaCode
      });

      if (verifyError) throw verifyError;

      // Успіх — заходимо
      navigate('/dashboard');

    } catch (error) {
      console.error('Помилка 2FA:', error);
      setError('Невірний код. Спробуйте ще раз');
      setMfaCode('');
    } finally {
      setLoading(false);
    }
  };

  // ── Скасувати 2FA та повернутись до входу ─────────────────
  const cancelMFA = async () => {
    await supabase.auth.signOut();
    setNeedsMFA(false);
    setMfaCode('');
    setError('');
    setFormData({ email: '', password: '' });
  };

  return (
    <Particles quantity={150} staticity={50} color="#ffffff" size={0.6}>
      <div className="login-page">
        <div className="login-container">

          <div className="login-header">
            <TextType
              text={[needsMFA ? "2FA" : "Вхід"]}
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
            {needsMFA
              ? 'Введіть код з додатка-автентифікатора'
              : 'Увійдіть у свій акаунт'}
          </p>

          {error && (
            <div className="message message-error">
              {error}
            </div>
          )}

          {/* ── ФОРМА ВХОДУ ─────────────────────────────────── */}
          {!needsMFA && (
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
          )}

          {/* ── ФОРМА 2FA КОДУ ──────────────────────────────── */}
          {needsMFA && (
            <form onSubmit={verifyMFA}>
              <div className="login-form-group">
                <label className="login-form-label">6-значний код</label>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  disabled={loading}
                  autoFocus
                  className="login-form-input"
                  style={{
                    fontSize: '24px',
                    letterSpacing: '12px',
                    textAlign: 'center',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || mfaCode.length !== 6}
                className="login-button"
              >
                {loading ? 'Перевірка...' : 'Підтвердити'}
              </button>

              <button
                type="button"
                onClick={cancelMFA}
                disabled={loading}
                className="login-button"
                style={{
                  marginTop: '10px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}
              >
                Повернутись назад
              </button>
            </form>
          )}

          {!needsMFA && (
            <p className="login-footer">
              Немає акаунту?{' '}
              <Link to="/register" className="login-footer-link">
                Зареєструватися
              </Link>
            </p>
          )}
        </div>
      </div>
    </Particles>
  );
}

export default Login;