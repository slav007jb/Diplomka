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

  const checkTwoFA = () => {
    const saved = localStorage.getItem('2fa_enabled');
    setTwoFAEnabled(saved === 'true');
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
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: 'error', text: 'Паролі не співпадають' });
      return;
    }
    
    if (passwordData.new_password.length < 6) {
      setMessage({ type: 'error', text: 'Пароль має бути не менше 6 символів' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.new_password
      });

      if (error) throw error;
      
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
                    <div className="settings-twofa">
                      <div className="settings-twofa-info">
                        <h3 className="settings-section-title">Двофакторна автентифікація (2FA)</h3>
                        <p className="settings-twofa-description">
                          Додатковий рівень захисту вашого акаунту. Після увімкнення 2FA, 
                          при вході потрібно буде вводити код з додатку-автентифікатора.
                        </p>
                      </div>
                      <button
                        onClick={toggleTwoFA}
                        className={`settings-toggle ${twoFAEnabled ? 'active' : ''}`}
                      >
                        {twoFAEnabled ? 'Увімкнено' : 'Вимкнено'}
                      </button>
                    </div>
                  </div>
                </>
              )}

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
                        <div className="settings-theme-name">🌙 Тёмная</div>
                        <div className="settings-theme-desc">Классическая тёмная тема</div>
                      </div>
                      {theme === 'dark' && <div className="settings-theme-check">✓</div>}
                    </div>

                    <div 
                      className={`settings-theme-card ${theme === 'gray' ? 'active' : ''}`}
                      onClick={() => theme !== 'gray' && cycleTheme()}
                    >
                      <div className="settings-theme-preview theme-gray-preview"></div>
                      <div className="settings-theme-info">
                        <div className="settings-theme-name">🌫️ Серая</div>
                        <div className="settings-theme-desc">Спокойная серая тема</div>
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