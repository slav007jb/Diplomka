import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/SupaBaseClient';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { Particles } from '../components/Particles';
import '../css/Settings.css';


function Settings() {
  const { currentTheme, cycleTheme, theme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    avatar_url: ''
  });
  const [loading, setLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [notifications, setNotifications] = useState({
    email_transactions: true,
    email_login: true,
    email_crypto: false
  });
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [twoFAFactors, setTwoFAFactors] = useState([]);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [qrCodeSvg, setQrCodeSvg] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchProfile();
    loadNotifications();
    checkTwoFA();
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email, avatar_url')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile({
        full_name: data?.full_name || '',
        email: data?.email || user.email,
        avatar_url: data?.avatar_url || ''
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const loadNotifications = () => {
    const saved = localStorage.getItem('notifications');
    if (saved) {
      setNotifications(JSON.parse(saved));
    }
  };

  const checkTwoFA = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      
      const verified = data.totp.filter(f => f.status === 'verified');
      setTwoFAFactors(verified);
      setTwoFAEnabled(verified.length > 0);
    } catch (error) {
      console.error('Error checking 2FA:', error);
    }
  };

  const verify2FACode = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      setMessage({ type: 'error', text: 'Введіть 6-значний код з додатка' });
      return;
    }
  
    setLoading(true);
    try {
      const { data: challengeData, error: challengeError } = 
        await supabase.auth.mfa.challenge({ factorId });
      
      if (challengeError) throw challengeError;
  
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode
      });
  
      if (verifyError) throw verifyError;
  
      setMessage({ type: 'success', text: '2FA успішно увімкнено!' });
      setIsEnrolling(false);
      setVerifyCode('');
      setQrCodeUrl('');
      setSecret('');
      await checkTwoFA();
    } catch (error) {
      setMessage({ type: 'error', text: 'Невірний код. Спробуйте ще раз' });
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: profile.full_name })
        .eq('id', user.id);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Профіль успішно оновлено!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Помилка при оновленні профілю' });
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    
    if (!passwordData.current_password) {
      setMessage({ type: 'error', text: 'Введіть поточний пароль' });
      return;
    }
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: 'error', text: 'Паролі не співпадають' });
      return;
    }
    
    if (passwordData.new_password.length < 6) {
      setMessage({ type: 'error', text: 'Пароль має бути не менше 6 символів' });
      return;
    }
  
    if (passwordData.current_password === passwordData.new_password) {
      setMessage({ type: 'error', text: 'Новий пароль не може співпадати з поточним' });
      return;
    }
  
    setLoading(true);
    setMessage({ type: '', text: '' });
  
    try {
      // Крок 1: Перевіряємо поточний пароль через спробу входу
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordData.current_password
      });
  
      if (signInError) {
        setMessage({ type: 'error', text: 'Невірний поточний пароль' });
        setLoading(false);
        return;
      }
  
      // Крок 2: Оновлюємо пароль
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.new_password
      });
  
      if (updateError) throw updateError;
      
      setMessage({ type: 'success', text: 'Пароль успішно змінено!' });
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Помилка при зміні пароля' });
    } finally {
      setLoading(false);
    }
  };

  const saveNotifications = () => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
    setMessage({ type: 'success', text: 'Налаштування сповіщень збережено!' });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const toggleTwoFA = () => {
    const newValue = !twoFAEnabled;
    setTwoFAEnabled(newValue);
    localStorage.setItem('2fa_enabled', newValue.toString());
    setMessage({ type: 'success', text: newValue ? '2FA увімкнено!' : '2FA вимкнено!' });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const startEnroll2FA = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `PaymentApp-${Date.now()}`
      });
  
      if (error) throw error;
  
      setFactorId(data.id);
      setQrCodeUrl(data.totp.uri);
      setQrCodeSvg(data.totp.qr_code);  // ← додав цей рядок
      setSecret(data.totp.secret);
      setIsEnrolling(true);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      console.error('Enroll error:', error);
    } finally {
      setLoading(false);
    }
  };

  const cancelEnroll = async () => {
    if (factorId) {
      await supabase.auth.mfa.unenroll({ factorId });
    }
    setIsEnrolling(false);
    setVerifyCode('');
    setQrCodeUrl('');
    setSecret('');
    setFactorId('');
  };

  const disable2FA = async () => {
    if (!confirm('Ви впевнені що хочете вимкнути двофакторну автентифікацію?')) return;
    
    setLoading(true);
    try {
      for (const factor of twoFAFactors) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (error) throw error;
      }
      
      setMessage({ type: 'success', text: '2FA вимкнено' });
      await checkTwoFA();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const sections = [
    { id: 'profile', name: 'Профіль', icon: '👤' },
    { id: 'security', name: 'Безпека', icon: '🔒' },
    { id: 'notifications', name: 'Сповіщення', icon: '🔔' },
    { id: 'appearance', name: 'Зовнішній вигляд', icon: '🎨' },
    { id: 'session', name: 'Сесія', icon: '🚪' }
  ];

  if (!user) return null;

  return (
    <div className="settings-page">
      <div className="settings-background">
        <Particles quantity={100} staticity={50} color={currentTheme.particles} size={0.5} />
      </div>

      <div className="settings-container">
        {/* Навигация */}
        <nav className="settings-navbar">
          <div className="settings-navbar-logo">PaymentApp</div>
          <div className="settings-navbar-avatar" onClick={handleSignOut} title="Вийти">
            {user?.email?.charAt(0).toUpperCase() || 'A'}
          </div>
        </nav>

        <div className="settings-content-wrapper">
          {/* Боковое меню */}
          <aside className="settings-sidebar">
            <h3 className="settings-sidebar-title">Налаштування</h3>
            <nav className="settings-sidebar-nav">
              {sections.map(section => (
                <button
                  key={section.id}
                  className={`settings-sidebar-link ${activeSection === section.id ? 'active' : ''}`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <span className="settings-sidebar-icon">{section.icon}</span>
                  <span className="settings-sidebar-text">{section.name}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Основной контент */}
          <main className="settings-main">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="settings-card"
            >
              {activeSection === 'profile' && (
                <>
                  <h2 className="settings-card-title">Профіль користувача</h2>
                  <p className="settings-card-subtitle">Керуйте вашою особистою інформацією</p>

                  {message.text && (
                    <div className={`settings-message ${message.type}`}>
                      {message.text}
                    </div>
                  )}

                  <form onSubmit={updateProfile} className="settings-form">
                    <div className="settings-form-group">
                      <label className="settings-label">Email</label>
                      <input
                        type="email"
                        value={profile.email}
                        disabled
                        className="settings-input settings-input-disabled"
                      />
                      <p className="settings-hint">Email не може бути змінено</p>
                    </div>

                    <div className="settings-form-group">
                      <label className="settings-label">Повне ім'я</label>
                      <input
                        type="text"
                        value={profile.full_name}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        placeholder="Введіть ваше ім'я"
                        className="settings-input"
                      />
                    </div>

                    <div className="settings-form-group">
                      <label className="settings-label">ID користувача</label>
                      <input
                        type="text"
                        value={user.id}
                        disabled
                        className="settings-input settings-input-disabled"
                      />
                    </div>

                    <button type="submit" disabled={loading} className="settings-btn settings-btn-primary">
                      {loading ? 'Збереження...' : 'Зберегти зміни'}
                    </button>
                  </form>
                </>
              )}

              {activeSection === 'security' && (
                <>
                  <h2 className="settings-card-title">Безпека</h2>
                  <p className="settings-card-subtitle">Налаштування безпеки вашого акаунту</p>

                  {message.text && (
                    <div className={`settings-message ${message.type}`}>
                      {message.text}
                    </div>
                  )}

                  <div className="settings-section">
                    <h3 className="settings-section-title">Зміна пароля</h3>
                    <form onSubmit={changePassword} className="settings-form">
                      <div className="settings-form-group">
                        <label className="settings-label">Поточний пароль</label>
                        <input
                          type="password"
                          value={passwordData.current_password}
                          onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                          placeholder="Введіть поточний пароль"
                          className="settings-input"
                          required
                        />
                      </div>

                      <div className="settings-form-group">
                        <label className="settings-label">Новий пароль</label>
                        <input
                          type="password"
                          value={passwordData.new_password}
                          onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                          placeholder="Введіть новий пароль"
                          className="settings-input"
                          required
                        />
                      </div>

                      <div className="settings-form-group">
                        <label className="settings-label">Підтвердження пароля</label>
                        <input
                          type="password"
                          value={passwordData.confirm_password}
                          onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                          placeholder="Підтвердіть новий пароль"
                          className="settings-input"
                          required
                        />
                      </div>

                      <button type="submit" disabled={loading} className="settings-btn settings-btn-primary">
                        {loading ? 'Зміна...' : 'Змінити пароль'}
                      </button>
                    </form>
                  </div>

                  <div className="settings-divider"></div>

                  <div className="settings-section">
                  <h3 className="settings-section-title">Двофакторна автентифікація (2FA)</h3>
                  <p className="settings-twofa-description">
                    Додатковий рівень захисту акаунту. Після увімкнення 2FA при вході 
                    потрібно буде вводити 6-значний код з додатка-автентифікатора 
                    (Google Authenticator, Authy, Microsoft Authenticator).
                  </p>

                  {!isEnrolling && !twoFAEnabled && (
                    <button 
                      onClick={startEnroll2FA} 
                      disabled={loading}
                      className="settings-btn settings-btn-primary"
                    >
                      {loading ? 'Налаштування...' : 'Увімкнути 2FA'}
                    </button>
                  )}

                  {!isEnrolling && twoFAEnabled && (
                    <div>
                      <div className="settings-2fa-enabled">
                        <span style={{ color: '#4ade80', fontSize: '14px' }}>
                          ✓ Двофакторна автентифікація увімкнена
                        </span>
                      </div>
                      <button 
                        onClick={disable2FA} 
                        disabled={loading}
                        className="settings-btn settings-btn-danger"
                        style={{ marginTop: '12px' }}
                      >
                        Вимкнути 2FA
                      </button>
                    </div>
                  )}

                  {isEnrolling && (
                    <div className="settings-2fa-enroll">
                      <div className="settings-2fa-step">
                        <h4>Крок 1: Відскануйте QR-код</h4>
                        <p>Відкрийте додаток Google Authenticator та відскануйте код:</p>
                        {qrCodeSvg && (
                        <div style={{ 
                          background: 'white', 
                          padding: '16px', 
                          borderRadius: '8px',
                          width: 'fit-content',
                          margin: '16px 0'
                        }}>
                          <img 
                            src={qrCodeSvg} 
                            alt="QR Code для 2FA" 
                            style={{ width: 200, height: 200 }} 
                          />
                        </div>
                      )}
                        
                        <p style={{ fontSize: '13px', color: '#888' }}>
                          Не можете відсканувати? Введіть код вручну:
                        </p>
                        <code style={{ 
                          display: 'block',
                          background: 'rgba(255,255,255,0.05)',
                          padding: '10px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          wordBreak: 'break-all',
                          marginBottom: '16px'
                        }}>
                          {secret}
                        </code>
                      </div>

                      <div className="settings-2fa-step">
                        <h4>Крок 2: Введіть 6-значний код</h4>
                        <input
                          type="text"
                          value={verifyCode}
                          onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          maxLength={6}
                          className="settings-input"
                          style={{ 
                            fontSize: '20px', 
                            letterSpacing: '8px', 
                            textAlign: 'center',
                            fontFamily: 'monospace'
                          }}
                        />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                          <button 
                            onClick={verify2FACode}
                            disabled={loading || verifyCode.length !== 6}
                            className="settings-btn settings-btn-primary"
                          >
                            {loading ? 'Перевірка...' : 'Підтвердити'}
                          </button>
                          <button 
                            onClick={cancelEnroll}
                            className="settings-btn settings-btn-secondary"
                          >
                            Скасувати
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </>
              )
              }

              {activeSection === 'notifications' && (
                <>
                  <h2 className="settings-card-title">Сповіщення</h2>
                  <p className="settings-card-subtitle">Налаштування сповіщень про операції</p>

                  <div className="settings-notifications">
                    <div className="settings-notification-item">
                      <div className="settings-notification-info">
                        <div className="settings-notification-title">Сповіщення про транзакції</div>
                        <div className="settings-notification-desc">
                          Отримувати email при поповненні, переказі або виведенні коштів
                        </div>
                      </div>
                      <label className="settings-switch">
                        <input
                          type="checkbox"
                          checked={notifications.email_transactions}
                          onChange={(e) => setNotifications({ ...notifications, email_transactions: e.target.checked })}
                        />
                        <span className="settings-switch-slider"></span>
                      </label>
                    </div>

                    <div className="settings-notification-item">
                      <div className="settings-notification-info">
                        <div className="settings-notification-title">Сповіщення про вхід</div>
                        <div className="settings-notification-desc">
                          Отримувати email при вході в акаунт з нового пристрою
                        </div>
                      </div>
                      <label className="settings-switch">
                        <input
                          type="checkbox"
                          checked={notifications.email_login}
                          onChange={(e) => setNotifications({ ...notifications, email_login: e.target.checked })}
                        />
                        <span className="settings-switch-slider"></span>
                      </label>
                    </div>

                    <div className="settings-notification-item">
                      <div className="settings-notification-info">
                        <div className="settings-notification-title">Крипто-сповіщення</div>
                        <div className="settings-notification-desc">
                          Отримувати сповіщення про зміну цін на криптовалюти
                        </div>
                      </div>
                      <label className="settings-switch">
                        <input
                          type="checkbox"
                          checked={notifications.email_crypto}
                          onChange={(e) => setNotifications({ ...notifications, email_crypto: e.target.checked })}
                        />
                        <span className="settings-switch-slider"></span>
                      </label>
                    </div>
                  </div>

                  <button onClick={saveNotifications} className="settings-btn settings-btn-primary">
                    Зберегти налаштування
                  </button>
                </>
              )}

              {activeSection === 'appearance' && (
                <>
                  <h2 className="settings-card-title">Зовнішній вигляд</h2>
                  <p className="settings-card-subtitle">Налаштування теми оформлення</p>

                  <div className="settings-themes">
                    <div 
                      className={`settings-theme-card ${theme === 'dark' ? 'active' : ''}`}
                      onClick={() => theme !== 'dark' && cycleTheme()}
                    >
                      <div className="settings-theme-preview theme-dark-preview"></div>
                      <div className="settings-theme-info">
                        <div className="settings-theme-name">🌙 Нічна</div>
                        <div className="settings-theme-desc">Класична нічна тема</div>
                      </div>
                      {theme === 'dark' && <div className="settings-theme-check">✓</div>}
                    </div>

                    <div 
                      className={`settings-theme-card ${theme === 'gray' ? 'active' : ''}`}
                      onClick={() => theme !== 'gray' && cycleTheme()}
                    >
                      <div className="settings-theme-preview theme-gray-preview"></div>
                      <div className="settings-theme-info">
                        <div className="settings-theme-name">🌫️ Сіра</div>
                        <div className="settings-theme-desc">Спокійна сіра тема</div>
                      </div>
                      {theme === 'gray' && <div className="settings-theme-check">✓</div>}
                    </div>
                  </div>

                  <div className="settings-info-box">
                    <div className="settings-info-icon">ℹ️</div>
                    <div className="settings-info-text">
                      Тема зберігається в налаштуваннях браузера та застосовується при наступних відвідуваннях
                    </div>
                  </div>
                </>
              )}

              {activeSection === 'session' && (
                <>
                  <h2 className="settings-card-title">Керування сесією</h2>
                  <p className="settings-card-subtitle">Управління активними сесіями та вихід із системи</p>

                  <div className="settings-session-info">
                    <div className="settings-session-detail">
                      <div className="settings-session-label">Поточний пристрій</div>
                      <div className="settings-session-value">Браузер • {new Date().toLocaleDateString('uk-UA')}</div>
                    </div>
                    <div className="settings-session-detail">
                      <div className="settings-session-label">Email користувача</div>
                      <div className="settings-session-value">{user.email}</div>
                    </div>
                  </div>

                  <div className="settings-divider"></div>

                  <button onClick={handleSignOut} className="settings-btn settings-btn-danger">
                    <span className="settings-btn-icon">🚪</span>
                    Вийти з акаунту
                  </button>

                  <div className="settings-warning-box">
                    <div className="settings-warning-icon">⚠️</div>
                    <div className="settings-warning-text">
                      Після виходу з системи вам потрібно буде знову ввести email та пароль для входу
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </main>
        </div>
      </div>

      <ThemeToggle />
    </div>
  );
}

export default Settings;