import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { Particles } from '../components/Particles';
import { supabase } from '../services/SupaBaseClient';
import { useNavigate } from 'react-router-dom';
import '../css/Dashboard.css';

function Dashboard() {

  const { currentTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Додавання валюти
  const [isAddWalletModalOpen, setIsAddWalletModalOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [addWalletLoading, setAddWalletLoading] = useState(false);

  // Переказ
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferData, setTransferData] = useState({ fromWallet: null, recipientEmail: '', amount: '' });
  const [transferLoading, setTransferLoading] = useState(false);
  const [recipientSearchResults, setRecipientSearchResults] = useState([]);
  const [searchingRecipient, setSearchingRecipient] = useState(false);

  // Поповнення
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpStep, setTopUpStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [cardData, setCardData] = useState({ number: '', expiry: '', cvv: '', name: '' });

  // ── ВИВЕДЕННЯ КОШТІВ ──────────────────────────────────────────────────────
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawWallet, setWithdrawWallet] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawStep, setWithdrawStep] = useState(1);
  const [withdrawCardData, setWithdrawCardData] = useState({ number: '', expiry: '', name: '' });
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    if (user) fetchWallets();
  }, [user]);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('wallets').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
      if (error) throw error;
      setWallets(data || []);
    } catch (err) {
      console.error('Помилка завантаження гаманців:', err);
      setError('Не вдалося завантажити гаманці');
    } finally {
      setLoading(false);
    }
  };

  // ── Поповнення ────────────────────────────────────────────────────────────
  const openTopUpModal = (wallet) => {
    setSelectedWallet(wallet); setTopUpAmount(''); setTopUpStep(1);
    setPaymentMethod(''); setCardData({ number: '', expiry: '', cvv: '', name: '' });
    setIsTopUpModalOpen(true);
  };
  const closeTopUpModal = () => {
    setIsTopUpModalOpen(false); setSelectedWallet(null); setTopUpAmount('');
    setTopUpStep(1); setPaymentMethod(''); setCardData({ number: '', expiry: '', cvv: '', name: '' });
  };
  const goToNextStep = (e) => {
    e.preventDefault();
    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0) { alert('Введіть коректну суму'); return; }
    if (amount > 100000) { alert('Максимальна сума: 100,000'); return; }
    if (!paymentMethod) { alert('Оберіть спосіб оплати'); return; }
    setTopUpStep(2);
  };
  const goToPreviousStep = () => setTopUpStep(1);

  const handleTopUp = async (e) => {
    e.preventDefault();
    if (cardData.number.replace(/\s/g, '').length !== 16) { alert('Введіть коректний номер карти (16 цифр)'); return; }
    if (cardData.expiry.length !== 5) { alert('Введіть термін дії у форматі MM/YY'); return; }
    if (cardData.cvv.length !== 3) { alert('Введіть коректний CVV (3 цифри)'); return; }
    if (!cardData.name || cardData.name.length < 3) { alert('Введіть ім\'я власника карти'); return; }
    setTopUpLoading(true);
    try {
      const amount = parseFloat(topUpAmount);
      const newBalance = parseFloat(selectedWallet.balance) + amount;
      const { error } = await supabase.from('wallets').update({ balance: newBalance }).eq('id', selectedWallet.id);
      if (error) throw error;
      await supabase.from('transactions').insert([{
        sender_id: user.id, receiver_id: user.id, amount,
        currency: selectedWallet.currency, type: 'topup', status: 'completed'
      }]);
      setWallets(wallets.map(w => w.id === selectedWallet.id ? { ...w, balance: newBalance } : w));
      closeTopUpModal();
      alert(`Гаманець успішно поповнено на ${amount} ${selectedWallet.currency}`);
    } catch (err) {
      alert('Помилка при поповненні гаманця');
    } finally {
      setTopUpLoading(false);
    }
  };

  // ── ВИВЕДЕННЯ — хендлери ──────────────────────────────────────────────────
  const openWithdrawModal = (wallet) => {
    setWithdrawWallet(wallet);
    setWithdrawAmount('');
    setWithdrawStep(1);
    setWithdrawCardData({ number: '', expiry: '', name: '' });
    setIsWithdrawModalOpen(true);
  };

  const closeWithdrawModal = () => {
    setIsWithdrawModalOpen(false);
    setWithdrawWallet(null);
    setWithdrawAmount('');
    setWithdrawStep(1);
    setWithdrawCardData({ number: '', expiry: '', name: '' });
  };

  const goToWithdrawStep2 = (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) { alert('Введіть коректну суму'); return; }
    if (amount > parseFloat(withdrawWallet.balance)) {
      alert(`Недостатньо коштів. Доступно: ${parseFloat(withdrawWallet.balance).toFixed(2)} ${withdrawWallet.currency}`);
      return;
    }
    if (amount < 1) { alert('Мінімальна сума виведення: 1'); return; }
    setWithdrawStep(2);
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (withdrawCardData.number.replace(/\s/g, '').length !== 16) { alert('Введіть коректний номер карти (16 цифр)'); return; }
    if (withdrawCardData.expiry.length !== 5) { alert('Введіть термін дії у форматі MM/YY'); return; }
    if (!withdrawCardData.name || withdrawCardData.name.length < 3) { alert('Введіть ім\'я власника карти'); return; }

    setWithdrawLoading(true);
    try {
      const amount = parseFloat(withdrawAmount);
      const newBalance = parseFloat(withdrawWallet.balance) - amount;

      const { error: walletErr } = await supabase
        .from('wallets').update({ balance: newBalance }).eq('id', withdrawWallet.id);
      if (walletErr) throw walletErr;

      await supabase.from('transactions').insert([{
        sender_id: user.id, receiver_id: user.id, amount,
        currency: withdrawWallet.currency, type: 'withdraw', status: 'completed'
      }]);

      setWallets(wallets.map(w => w.id === withdrawWallet.id ? { ...w, balance: newBalance } : w));
      closeWithdrawModal();
      alert(`✅ Виведено ${amount} ${withdrawWallet.currency} на картку **** ${withdrawCardData.number.slice(-4)}`);
    } catch (err) {
      console.error('Помилка виведення:', err);
      alert('Помилка при виведенні коштів: ' + (err.message || 'Невідома помилка'));
    } finally {
      setWithdrawLoading(false);
    }
  };

  // ── Переказ ───────────────────────────────────────────────────────────────
  const openTransferModal = (wallet) => {
    setTransferData({ fromWallet: wallet, recipientEmail: '', amount: '' });
    setRecipientSearchResults([]);
    setIsTransferModalOpen(true);
  };
  const closeTransferModal = () => {
    setIsTransferModalOpen(false);
    setTransferData({ fromWallet: null, recipientEmail: '', amount: '' });
    setRecipientSearchResults([]);
  };
  const searchRecipient = async (email) => {
    if (!email || email.length < 3) { setRecipientSearchResults([]); return; }
    setSearchingRecipient(true);
    try {
      const { data, error } = await supabase.from('profiles').select('id, email, full_name')
        .ilike('email', `%${email}%`).neq('id', user.id).limit(5);
      if (error) throw error;
      setRecipientSearchResults(data || []);
    } catch { setRecipientSearchResults([]); }
    finally { setSearchingRecipient(false); }
  };
  const handleRecipientEmailChange = (e) => {
    const email = e.target.value;
    setTransferData({ ...transferData, recipientEmail: email });
    searchRecipient(email);
  };
  const selectRecipient = (email) => {
    setTransferData({ ...transferData, recipientEmail: email });
    setRecipientSearchResults([]);
  };
  const handleTransfer = async (e) => {
    e.preventDefault();
    const amount = parseFloat(transferData.amount);
    if (!transferData.recipientEmail) { alert('Введіть email отримувача'); return; }
    if (transferData.recipientEmail === user.email) { alert('Не можна відправити кошти самому собі'); return; }
    if (!amount || amount <= 0) { alert('Введіть коректну суму'); return; }
    if (amount > parseFloat(transferData.fromWallet.balance)) { alert('Недостатньо коштів на балансі'); return; }
    setTransferLoading(true);
    try {
      const { data: recipientProfiles, error: rErr } = await supabase.from('profiles').select('id, email').eq('email', transferData.recipientEmail);
      if (rErr) throw rErr;
      if (!recipientProfiles?.length) { alert('Отримувача не знайдено'); return; }
      const recipient = recipientProfiles[0];
      if (recipient.id === user.id) { alert('Не можна відправити кошти самому собі'); return; }
      const { data: rWallets, error: wErr } = await supabase.from('wallets').select('*').eq('user_id', recipient.id).eq('currency', transferData.fromWallet.currency);
      if (wErr) throw wErr;
      if (!rWallets?.length) { alert(`У отримувача немає гаманця ${transferData.fromWallet.currency}`); return; }
      const rWallet = rWallets[0];
      const newSender = parseFloat(transferData.fromWallet.balance) - amount;
      const newReceiver = parseFloat(rWallet.balance) + amount;
      const { error: e1 } = await supabase.from('wallets').update({ balance: newSender }).eq('id', transferData.fromWallet.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('wallets').update({ balance: newReceiver }).eq('id', rWallet.id);
      if (e2) throw e2;
      await supabase.from('transactions').insert([{ sender_id: user.id, receiver_id: recipient.id, amount, currency: transferData.fromWallet.currency, type: 'transfer', status: 'completed' }]);
      setWallets(wallets.map(w => w.id === transferData.fromWallet.id ? { ...w, balance: newSender } : w));
      closeTransferModal();
      alert(`Переказ ${amount} ${getCurrencySymbol(transferData.fromWallet.currency)} успішно виконано`);
      await fetchWallets();
    } catch (err) {
      alert('Помилка переказу: ' + (err.message || 'Невідома помилка'));
    } finally { setTransferLoading(false); }
  };

  // ── Форматування ──────────────────────────────────────────────────────────
  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const match = (v.match(/\d{4,16}/g)?.[0]) || '';
    const parts = [];
    for (let i = 0; i < match.length; i += 4) parts.push(match.substring(i, i + 4));
    return parts.length ? parts.join(' ') : value;
  };
  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    return v.length >= 2 ? `${v.slice(0, 2)}/${v.slice(2, 4)}` : v;
  };
  const handleCardNumberChange = (e) => {
    const f = formatCardNumber(e.target.value);
    if (f.replace(/\s/g, '').length <= 16) setCardData({ ...cardData, number: f });
  };
  const handleExpiryChange = (e) => {
    const f = formatExpiry(e.target.value);
    if (f.replace('/', '').length <= 4) setCardData({ ...cardData, expiry: f });
  };
  const handleCvvChange = (e) => {
    const v = e.target.value.replace(/[^0-9]/gi, '');
    if (v.length <= 3) setCardData({ ...cardData, cvv: v });
  };
  // Форматування для виведення
  const handleWithdrawCardNumber = (e) => {
    const f = formatCardNumber(e.target.value);
    if (f.replace(/\s/g, '').length <= 16) setWithdrawCardData({ ...withdrawCardData, number: f });
  };
  const handleWithdrawExpiry = (e) => {
    const f = formatExpiry(e.target.value);
    if (f.replace('/', '').length <= 4) setWithdrawCardData({ ...withdrawCardData, expiry: f });
  };

  const handleSignOut = async () => { await signOut(); navigate('/login'); };
  const getCurrencySymbol = (c) => ({ 'USD': '$', 'EUR': '€', 'UAH': '₴', 'GBP': '£', 'JPY': '¥', 'CHF': '₣' }[c] || c);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
  };
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100, damping: 15 } }
  };
  const navbarVariants = {
    hidden: { y: -50, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100, damping: 15, delay: 0.1 } }
  };
  const sidebarVariants = {
    hidden: { x: -50, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 100, damping: 15, delay: 0.3 } }
  };

  if (!user) return null;

  const availableCurrencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' },
    { code: 'CHF', name: 'Swiss franc', symbol: '₣' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  ];
  const openAddWalletModal = () => { setSelectedCurrency(''); setIsAddWalletModalOpen(true); };
  const closeAddWalletModal = () => { setIsAddWalletModalOpen(false); setSelectedCurrency(''); };
  const handleAddWallet = async (e) => {
    e.preventDefault();
    if (!selectedCurrency) { alert('Оберіть валюту'); return; }
    if (wallets.some(w => w.currency === selectedCurrency)) { alert('Ця валюта вже додана'); return; }
    setAddWalletLoading(true);
    try {
      const { data, error } = await supabase.from('wallets').insert([{ user_id: user.id, currency: selectedCurrency, balance: 0 }]).select();
      if (error) throw error;
      setWallets([...wallets, data[0]]);
      closeAddWalletModal();
      alert(`Гаманець ${selectedCurrency} успішно додано`);
    } catch { alert('Помилка при додаванні гаманця'); }
    finally { setAddWalletLoading(false); }
  };

  // ── РЕНДЕР ────────────────────────────────────────────────────────────────
  return (
    <div className="dashboard-page">
      <div className="dashboard-background">
        <Particles quantity={150} staticity={50} color={currentTheme.particles} size={0.6} />
      </div>

      <div className="dashboard-container">
        <motion.nav variants={navbarVariants} initial="hidden" animate="visible" className="navbar">
          <div className="navbar-logo">Currex</div>
          <div className="navbar-avatar" onClick={handleSignOut} title="Вийти">
            {user?.email?.charAt(0).toUpperCase() || 'A'}
          </div>
        </motion.nav>

        <div className="content-wrapper">
          <motion.aside variants={sidebarVariants} initial="hidden" animate="visible" className="sidebar">
            <nav className="sidebar-nav">
              <Link to="/dashboard/overview" className="sidebar-link sidebar-link-active">
                <span className="sidebar-link-icon">📊</span>
                <span className="sidebar-link-text">Огляд</span>
              </Link>
              <Link to="/dashboard/convert" className="sidebar-link">
                <span className="sidebar-link-icon">🔄</span>
                <span className="sidebar-link-text">Конвертація</span>
              </Link>
              <Link to="/dashboard/crypto" className="sidebar-link">
                <span className="sidebar-link-icon">₿</span>
                <span className="sidebar-link-text">Крипто</span>
              </Link>
              <Link to="/dashboard/history" className="sidebar-link">
                <span className="sidebar-link-icon">📜</span>
                <span className="sidebar-link-text">Історія</span>
              </Link>
              <div className="sidebar-divider"></div>
              <Link to="/dashboard/settings" className="sidebar-link">
                <span className="sidebar-link-icon">⚙️</span>
                <span className="sidebar-link-text">Налаштування</span>
              </Link>
            </nav>
          </motion.aside>

          <main className="main-content">
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }} className="page-title">
              Показ портфеля
            </motion.h1>

            {error && <div className="error-box">{error}</div>}

            {loading ? (
              <div className="loading-box">Завантаження...</div>
            ) : (
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="wallets-grid">
                {wallets.map((wallet) => (
                  <motion.div key={wallet.id} variants={itemVariants} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="wallet-card">
                    <div className="wallet-header">
                      <div className="wallet-icon-box">{getCurrencySymbol(wallet.currency)}</div>
                      <div className="wallet-details">
                        <div className="wallet-currency">{wallet.currency}</div>
                        <div className="wallet-label">Баланс</div>
                      </div>
                    </div>
                    <div className="wallet-amount">
                      {parseFloat(wallet.balance).toFixed(2)} {getCurrencySymbol(wallet.currency)}
                    </div>
                    {/* ── Три кнопки ── */}
                    <div className="wallet-buttons">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="wallet-btn wallet-btn-primary" onClick={() => openTopUpModal(wallet)}>
                        Поповнити
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="wallet-btn wallet-btn-secondary" onClick={() => openTransferModal(wallet)}>
                        Відправити
                      </motion.button>
                    </div>
                    <div className="wallet-buttons" style={{ marginTop: '8px' }}>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="wallet-btn wallet-btn-withdraw" onClick={() => openWithdrawModal(wallet)}
                        disabled={parseFloat(wallet.balance) <= 0}>
                        Вивести
                      </motion.button>
                    </div>
                  </motion.div>
                ))}

                <motion.div variants={itemVariants} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="add-wallet" onClick={openAddWalletModal}>
                  <div className="add-wallet-icon">+</div>
                  <div className="add-wallet-text">Додати валюту</div>
                </motion.div>
              </motion.div>
            )}
          </main>
        </div>
      </div>

      {/* ── MODAL — Додати валюту ────────────────────────────────────────────── */}
      {isAddWalletModalOpen && (
        <div className="modal-overlay" onClick={closeAddWalletModal}>
          <motion.div className="modal-box" onClick={e => e.stopPropagation()} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
            <h2 className="modal-heading">Додати валюту</h2>
            <p className="modal-subheading">Оберіть валюту для додавання</p>
            <form onSubmit={handleAddWallet} className="modal-form">
              <div className="currency-list">
                {availableCurrencies.map((currency) => {
                  const alreadyAdded = wallets.some(w => w.currency === currency.code);
                  return (
                    <div key={currency.code} className={`currency-item ${selectedCurrency === currency.code ? 'currency-item-active' : ''} ${alreadyAdded ? 'currency-item-disabled' : ''}`} onClick={() => !alreadyAdded && setSelectedCurrency(currency.code)}>
                      <div className="currency-symbol">{currency.symbol}</div>
                      <div className="currency-info">
                        <div className="currency-code">{currency.code}</div>
                        <div className="currency-name">{currency.name}</div>
                      </div>
                      {alreadyAdded && <div className="currency-badge">Додано</div>}
                    </div>
                  );
                })}
              </div>
              <div className="modal-buttons">
                <button type="button" onClick={closeAddWalletModal} disabled={addWalletLoading} className="modal-btn modal-btn-cancel">Скасувати</button>
                <button type="submit" disabled={addWalletLoading || !selectedCurrency} className="modal-btn modal-btn-submit">
                  {addWalletLoading ? 'Додавання...' : 'Додати'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── MODAL — Переказ ──────────────────────────────────────────────────── */}
      {isTransferModalOpen && (
        <div className="modal-overlay" onClick={closeTransferModal}>
          <motion.div className="modal-box" onClick={e => e.stopPropagation()} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
            <h2 className="modal-heading">Переказ {transferData.fromWallet?.currency}</h2>
            <div className="payment-summary">
              <div className="payment-summary-row">
                <span className="payment-summary-label">Доступно:</span>
                <span className="payment-summary-value">{parseFloat(transferData.fromWallet?.balance || 0).toFixed(2)} {getCurrencySymbol(transferData.fromWallet?.currency)}</span>
              </div>
            </div>
            <form onSubmit={handleTransfer} className="modal-form">
              <div className="form-field">
                <label className="form-label">Email отримувача</label>
                <div className="recipient-search-wrapper">
                  <input type="email" value={transferData.recipientEmail} onChange={handleRecipientEmailChange} placeholder="example@mail.com" className="form-input" disabled={transferLoading} autoFocus />
                  {searchingRecipient && <div className="search-spinner">🔍</div>}
                </div>
                {recipientSearchResults.length > 0 && (
                  <div className="recipient-results">
                    {recipientSearchResults.map(r => (
                      <div key={r.id} className="recipient-item" onClick={() => selectRecipient(r.email)}>
                        <div className="recipient-avatar">{r.email.charAt(0).toUpperCase()}</div>
                        <div className="recipient-info">
                          <div className="recipient-email">{r.email}</div>
                          {r.full_name && <div className="recipient-name">{r.full_name}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-field">
                <label className="form-label">Сума</label>
                <input type="number" value={transferData.amount} onChange={e => setTransferData({ ...transferData, amount: e.target.value })} placeholder="0.00" step="0.01" min="0.01" max={transferData.fromWallet?.balance} className="form-input" disabled={transferLoading} />
              </div>
              <div className="modal-buttons">
                <button type="button" onClick={closeTransferModal} disabled={transferLoading} className="modal-btn modal-btn-cancel">Скасувати</button>
                <button type="submit" disabled={transferLoading} className="modal-btn modal-btn-submit">{transferLoading ? 'Відправка...' : 'Відправити'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── MODAL — Поповнення ───────────────────────────────────────────────── */}
      {isTopUpModalOpen && (
        <div className="modal-overlay" onClick={closeTopUpModal}>
          <motion.div className="modal-box" onClick={e => e.stopPropagation()} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
            {topUpStep === 1 && (
              <>
                <h2 className="modal-heading">Поповнити {selectedWallet?.currency}</h2>
                <p className="modal-subheading">Поточний баланс: {parseFloat(selectedWallet?.balance || 0).toFixed(2)} {getCurrencySymbol(selectedWallet?.currency)}</p>
                <form onSubmit={goToNextStep} className="modal-form">
                  <div className="form-field">
                    <label className="form-label">Сума поповнення</label>
                    <input type="number" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} placeholder="0.00" step="0.01" min="0.01" max="100000" className="form-input" autoFocus />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Спосіб оплати</label>
                    <div className="payment-options">
                      <div className={`payment-card ${paymentMethod === 'visa' ? 'payment-card-active' : ''}`} onClick={() => setPaymentMethod('visa')}>
                        <div className="payment-logo"><img src="https://upload.wikimedia.org/wikipedia/commons/5/5c/Visa_Inc._logo_%282021%E2%80%93present%29.svg" alt="Visa" /></div>
                        <span className="payment-name">Visa</span>
                      </div>
                      <div className={`payment-card ${paymentMethod === 'mastercard' ? 'payment-card-active' : ''}`} onClick={() => setPaymentMethod('mastercard')}>
                        <div className="payment-logo"><img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" /></div>
                        <span className="payment-name">Mastercard</span>
                      </div>
                    </div>
                  </div>
                  <div className="modal-buttons">
                    <button type="button" onClick={closeTopUpModal} className="modal-btn modal-btn-cancel">Скасувати</button>
                    <button type="submit" className="modal-btn modal-btn-submit">Далі</button>
                  </div>
                </form>
              </>
            )}
            {topUpStep === 2 && (
              <>
                <h2 className="modal-heading">Дані карти</h2>
                <div className="payment-summary">
                  <div className="payment-summary-row">
                    <span className="payment-summary-label">Сума:</span>
                    <span className="payment-summary-value">{parseFloat(topUpAmount).toFixed(2)} {getCurrencySymbol(selectedWallet?.currency)}</span>
                  </div>
                  <div className="payment-summary-row">
                    <span className="payment-summary-label">Спосіб:</span>
                    <span className="payment-summary-value">{paymentMethod === 'visa' ? 'Visa' : 'Mastercard'}</span>
                  </div>
                </div>
                <form onSubmit={handleTopUp} className="modal-form">
                  <div className="form-field">
                    <label className="form-label">Номер карти</label>
                    <input type="text" value={cardData.number} onChange={handleCardNumberChange} placeholder="1234 5678 9012 3456" className="form-input form-input-card" disabled={topUpLoading} autoFocus />
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label className="form-label">Термін дії</label>
                      <input type="text" value={cardData.expiry} onChange={handleExpiryChange} placeholder="MM/YY" className="form-input form-input-card" disabled={topUpLoading} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">CVV</label>
                      <input type="text" value={cardData.cvv} onChange={handleCvvChange} placeholder="123" className="form-input form-input-card" disabled={topUpLoading} />
                    </div>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Ім'я власника</label>
                    <input type="text" value={cardData.name} onChange={e => setCardData({ ...cardData, name: e.target.value.toUpperCase() })} placeholder="TARAS SHEVCHENKO" className="form-input form-input-card" disabled={topUpLoading} maxLength={30} />
                  </div>
                  <div className="modal-buttons">
                    <button type="button" onClick={goToPreviousStep} disabled={topUpLoading} className="modal-btn modal-btn-cancel">Назад</button>
                    <button type="submit" disabled={topUpLoading} className="modal-btn modal-btn-submit">{topUpLoading ? 'Оплата...' : 'Оплатити'}</button>
                  </div>
                </form>
                <div className="security-badge">🔒 Ваші дані захищені SSL-шифруванням</div>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* ── MODAL — Виведення коштів ─────────────────────────────────────────── */}
      {isWithdrawModalOpen && withdrawWallet && (
        <div className="modal-overlay" onClick={closeWithdrawModal}>
          <motion.div className="modal-box" onClick={e => e.stopPropagation()} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>

            {withdrawStep === 1 && (
              <>
                <h2 className="modal-heading">Вивести {withdrawWallet.currency}</h2>
                <p className="modal-subheading">
                  Доступно: {parseFloat(withdrawWallet.balance).toFixed(2)} {getCurrencySymbol(withdrawWallet.currency)}
                </p>

                <form onSubmit={goToWithdrawStep2} className="modal-form">
                  <div className="form-field">
                    <label className="form-label">Сума виведення</label>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="1"
                      max={withdrawWallet.balance}
                      className="form-input"
                      autoFocus
                    />
                  </div>

                  {/* Швидкий вибір суми */}
                  <div className="quick-amounts">
                    {[25, 50, 100].map(pct => {
                      const amt = (parseFloat(withdrawWallet.balance) * pct / 100).toFixed(2);
                      return (
                        <button key={pct} type="button" className="quick-amount-btn" onClick={() => setWithdrawAmount(amt)}>
                          {pct}% ({amt})
                        </button>
                      );
                    })}
                    <button type="button" className="quick-amount-btn" onClick={() => setWithdrawAmount(parseFloat(withdrawWallet.balance).toFixed(2))}>
                      Все
                    </button>
                  </div>

                  <div className="modal-buttons">
                    <button type="button" onClick={closeWithdrawModal} className="modal-btn modal-btn-cancel">Скасувати</button>
                    <button type="submit" className="modal-btn modal-btn-withdraw-submit">Далі →</button>
                  </div>
                </form>
              </>
            )}

            {withdrawStep === 2 && (
              <>
                <h2 className="modal-heading">Картка для виведення</h2>

                <div className="payment-summary">
                  <div className="payment-summary-row">
                    <span className="payment-summary-label">Сума виведення:</span>
                    <span className="payment-summary-value withdraw-amount-highlight">
                      {parseFloat(withdrawAmount).toFixed(2)} {getCurrencySymbol(withdrawWallet.currency)}
                    </span>
                  </div>
                  <div className="payment-summary-row">
                    <span className="payment-summary-label">Залишок після:</span>
                    <span className="payment-summary-value">
                      {(parseFloat(withdrawWallet.balance) - parseFloat(withdrawAmount)).toFixed(2)} {getCurrencySymbol(withdrawWallet.currency)}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleWithdraw} className="modal-form">
                  <div className="form-field">
                    <label className="form-label">Номер карти отримувача</label>
                    <input
                      type="text"
                      value={withdrawCardData.number}
                      onChange={handleWithdrawCardNumber}
                      placeholder="1234 5678 9012 3456"
                      className="form-input form-input-card"
                      disabled={withdrawLoading}
                      autoFocus
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Термін дії</label>
                    <input
                      type="text"
                      value={withdrawCardData.expiry}
                      onChange={handleWithdrawExpiry}
                      placeholder="MM/YY"
                      className="form-input form-input-card"
                      disabled={withdrawLoading}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Ім'я власника</label>
                    <input
                      type="text"
                      value={withdrawCardData.name}
                      onChange={e => setWithdrawCardData({ ...withdrawCardData, name: e.target.value.toUpperCase() })}
                      placeholder="TARAS SHEVCHENKO"
                      className="form-input form-input-card"
                      disabled={withdrawLoading}
                      maxLength={30}
                    />
                  </div>

                  <div className="modal-buttons">
                    <button type="button" onClick={() => setWithdrawStep(1)} disabled={withdrawLoading} className="modal-btn modal-btn-cancel">Назад</button>
                    <button type="submit" disabled={withdrawLoading} className="modal-btn modal-btn-withdraw-submit">
                      {withdrawLoading ? 'Обробка...' : 'Вивести кошти'}
                    </button>
                  </div>
                </form>

                <div className="security-badge">🔒 Ваші дані захищені SSL-шифруванням</div>
              </>
            )}
          </motion.div>
        </div>
      )}

      <ThemeToggle />
    </div>
  );
}

export default Dashboard;