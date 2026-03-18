import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Particles } from '../components/Particles';
import { supabase } from '../services/SupaBaseClient';
import { useNavigate } from 'react-router-dom';
import * as bip39 from 'bip39';
import { Buffer } from 'buffer';
import '../css/Crypto.css';

window.Buffer = Buffer;

const SUPPORTED_COINS = [
  { id: 'bitcoin',  symbol: 'BTC',  name: 'Bitcoin',  icon: '₿', color: '#f7931a' },
  { id: 'ethereum', symbol: 'ETH',  name: 'Ethereum', icon: 'Ξ', color: '#627eea' },
  { id: 'solana',   symbol: 'SOL',  name: 'Solana',   icon: '◎', color: '#9945ff' },
  { id: 'ripple',   symbol: 'XRP',  name: 'XRP',      icon: '✕', color: '#00aae4' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', icon: 'Ð', color: '#c2a633' },
];

const deriveAddress = (type, mnemonic) => {
  const seed    = bip39.mnemonicToSeedSync(mnemonic);
  const hexSeed = seed.toString('hex').substring(0, 40);
  return type === 'bitcoin' ? '1' + hexSeed.substring(0, 33) : '0x' + hexSeed;
};

// ══════════════════════════════════════════════════════════════════════════════
// WalletLoginModal — вхід до кошелька по seed-фразі (повне переключення)
// ══════════════════════════════════════════════════════════════════════════════
function WalletLoginModal({ isOpen, onClose, onLogin }) {
  const [seedInput, setSeedInput] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const handleClose = () => { setSeedInput(''); setError(''); onClose(); };

  const handleLogin = async () => {
    setError('');
    const trimmed = seedInput.trim();
    if (!bip39.validateMnemonic(trimmed)) {
      setError('Невалідна seed-фраза. Перевірте правильність 12 слів.');
      return;
    }
    setLoading(true);
    try {
      const btcAddr = deriveAddress('bitcoin',  trimmed);
      const ethAddr = deriveAddress('ethereum', trimmed);

      const { data: wallets, error: wErr } = await supabase
        .from('crypto_wallets')
        .select('*')
        .in('address', [btcAddr, ethAddr]);
      if (wErr) throw new Error(wErr.message);
      if (!wallets || wallets.length === 0)
        throw new Error('Кошелёк с такой seed-фразой не найден в системе.');

      const impersonatedUserId = wallets[0].user_id;

      // Завантажуємо всі дані від імені власника
      const [{ data: portfolio }, { data: fiatWallets }, { data: cryptoWallets }] = await Promise.all([
        supabase.from('crypto_portfolio').select('*').eq('user_id', impersonatedUserId),
        supabase.from('wallets').select('*').eq('user_id', impersonatedUserId),
        supabase.from('crypto_wallets').select('*').eq('user_id', impersonatedUserId).order('created_at', { ascending: false }),
      ]);

      // Отримуємо профіль, щоб показати ім'я в банері
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', impersonatedUserId)
        .single();

      onLogin({
        userId:       impersonatedUserId,
        wallets:      cryptoWallets  ?? [],
        portfolio:    portfolio      ?? [],
        fiatWallets:  fiatWallets    ?? [],
        profileName:  profile?.full_name || profile?.email || impersonatedUserId.slice(0, 8) + '...',
      });
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="wam-overlay" onClick={handleClose}>
      <motion.div
        className="wam-modal"
        onClick={e => e.stopPropagation()}
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      >
        <div className="wam-header">
          <span className="wam-header-icon">🔑</span>
          <div>
            <h2 className="wam-title">Вхід до кошелька</h2>
            <p className="wam-subtitle">Введіть seed-фразу щоб отримати повний доступ</p>
          </div>
          <button className="wam-close" onClick={handleClose}>✕</button>
        </div>

        <div className="wam-body">
          <div className="wam-field">
            <label className="wam-label">Seed-фраза (12 слів)</label>
            <textarea
              className="wam-textarea"
              rows={3}
              placeholder="word1 word2 word3 ... word12"
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
            <p className="wam-hint">⚠️ Seed-фраза обробляється локально і не передається на сервер</p>
          </div>

          {error && (
            <motion.div className="wam-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
              ❌ {error}
            </motion.div>
          )}

          <div className="wam-actions">
            <button className="wam-btn-cancel" onClick={handleClose}>Скасувати</button>
            <motion.button
              className="wam-btn-submit"
              whileTap={{ scale: 0.96 }}
              onClick={handleLogin}
              disabled={loading || !seedInput.trim()}
            >
              {loading ? '⏳ Вхід...' : '🔓 Увійти до кошелька'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Основний компонент Crypto
// ══════════════════════════════════════════════════════════════════════════════
function Crypto() {
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  const navigate = useNavigate();

  // ─── Режим імперсонації (вхід по seed-фразі) ────────────────────────────────
  // null = свій акаунт; object = { userId, wallets, portfolio, fiatWallets, profileName }
  const [impersonated, setImpersonated] = useState(null);

  // ─── Власні дані ────────────────────────────────────────────────────────────
  const [loading, setLoading]               = useState(true);
  const [ownCryptoWallets, setOwnCryptoWallets] = useState([]);
  const [ownPortfolio, setOwnPortfolio]     = useState([]);
  const [ownFiatWallets, setOwnFiatWallets] = useState([]);

  // ─── Активні дані (своє або чуже) ───────────────────────────────────────────
  const activeUserId    = impersonated ? impersonated.userId    : user?.id;
  const cryptoWallets   = impersonated ? impersonated.wallets   : ownCryptoWallets;
  const portfolio       = impersonated ? impersonated.portfolio : ownPortfolio;
  const fiatWallets     = impersonated ? impersonated.fiatWallets : ownFiatWallets;

  // ─── Генерація ──────────────────────────────────────────────────────────────
  const [isGenerating, setIsGenerating]     = useState(false);
  const [newWallet, setNewWallet]           = useState(null);
  const [showSeedWarning, setShowSeedWarning] = useState(false);
  const [seedConfirmed, setSeedConfirmed]   = useState(false);

  // ─── Ціни ───────────────────────────────────────────────────────────────────
  const [prices, setPrices]               = useState({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError]     = useState('');
  const [lastUpdated, setLastUpdated]     = useState(null);

  // ─── Модал купівлі ──────────────────────────────────────────────────────────
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [selectedCoin, setSelectedCoin]     = useState(null);
  const [buyAmountUsd, setBuyAmountUsd]     = useState('');
  const [buyLoading, setBuyLoading]         = useState(false);

  // ─── Модал продажу ──────────────────────────────────────────────────────────
  const [isSellModalOpen, setIsSellModalOpen]   = useState(false);
  const [sellItem, setSellItem]                 = useState(null);
  const [sellMode, setSellMode]                 = useState('usd');
  const [sellAmountUsd, setSellAmountUsd]       = useState('');
  const [sellAmountCrypto, setSellAmountCrypto] = useState('');
  const [sellLoading, setSellLoading]           = useState(false);

  // ─── Модал входу ────────────────────────────────────────────────────────────
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // ══════════════════════════════════════════════════════════════════════════════
  // ІНІЦІАЛІЗАЦІЯ
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => { if (!user) navigate('/login'); }, [user, navigate]);

  useEffect(() => {
    if (user) {
      fetchOwnData();
      fetchPrices();
    }
  }, [user]);

  const fetchOwnData = async () => {
    setLoading(true);
    try {
      const [{ data: wallets }, { data: port }, { data: fiat }] = await Promise.all([
        supabase.from('crypto_wallets').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('crypto_portfolio').select('*').eq('user_id', user.id),
        supabase.from('wallets').select('*').eq('user_id', user.id),
      ]);
      setOwnCryptoWallets(wallets ?? []);
      setOwnPortfolio(port ?? []);
      setOwnFiatWallets(fiat ?? []);
    } catch (err) {
      console.error('Помилка завантаження:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Оновлення даних імперсонованого акаунту ─────────────────────────────────
  const refreshImpersonated = async () => {
    if (!impersonated) return;
    const [{ data: portfolio }, { data: fiatWallets }, { data: wallets }] = await Promise.all([
      supabase.from('crypto_portfolio').select('*').eq('user_id', impersonated.userId),
      supabase.from('wallets').select('*').eq('user_id', impersonated.userId),
      supabase.from('crypto_wallets').select('*').eq('user_id', impersonated.userId).order('created_at', { ascending: false }),
    ]);
    setImpersonated(prev => ({
      ...prev,
      portfolio:   portfolio   ?? [],
      fiatWallets: fiatWallets ?? [],
      wallets:     wallets     ?? [],
    }));
  };

  const refreshPortfolio = async () => {
    if (impersonated) { await refreshImpersonated(); }
    else {
      const { data } = await supabase.from('crypto_portfolio').select('*').eq('user_id', user.id);
      setOwnPortfolio(data ?? []);
    }
  };

  const refreshFiatWallets = async () => {
    if (impersonated) { await refreshImpersonated(); }
    else {
      const { data } = await supabase.from('wallets').select('*').eq('user_id', user.id);
      setOwnFiatWallets(data ?? []);
    }
  };

  // ─── Вихід з режиму імперсонації ─────────────────────────────────────────────
  const handleLogoutImpersonation = () => {
    setImpersonated(null);
    // Скидаємо відкриті модали
    setIsBuyModalOpen(false);
    setIsSellModalOpen(false);
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // CoinGecko API
  // ══════════════════════════════════════════════════════════════════════════════
  const fetchPrices = async () => {
    setPricesLoading(true);
    setPricesError('');
    try {
      const ids = SUPPORTED_COINS.map(c => c.id).join(',');
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
      );
      if (!res.ok) throw new Error('Помилка отримання цін');
      const data = await res.json();
      const normalized = {};
      for (const coin of SUPPORTED_COINS) {
        if (data[coin.id]) {
          normalized[coin.id] = { usd: data[coin.id].usd, change: data[coin.id].usd_24h_change ?? 0 };
        }
      }
      setPrices(normalized);
      setLastUpdated(new Date());
    } catch (err) {
      setPricesError('Не вдалося отримати ціни.');
      console.error(err);
    } finally {
      setPricesLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // КУПІВЛЯ
  // ══════════════════════════════════════════════════════════════════════════════
  const openBuyModal  = (coin) => { setSelectedCoin(coin); setBuyAmountUsd(''); setIsBuyModalOpen(true); };
  const closeBuyModal = () => { setIsBuyModalOpen(false); setSelectedCoin(null); setBuyAmountUsd(''); };
  const calcCryptoAmount = () => {
    if (!selectedCoin || !buyAmountUsd || !prices[selectedCoin.id]) return 0;
    return parseFloat(buyAmountUsd) / prices[selectedCoin.id].usd;
  };

  const handleBuy = async (e) => {
    e.preventDefault();
    const usdAmount = parseFloat(buyAmountUsd);
    if (!usdAmount || usdAmount <= 0) { alert('Введіть коректну суму'); return; }

    const usdWallet = fiatWallets.find(w => w.currency === 'USD');
    if (!usdWallet) { alert('Немає USD гаманця.'); return; }
    if (parseFloat(usdWallet.balance) < usdAmount) {
      alert(`Недостатньо коштів. Доступно: $${parseFloat(usdWallet.balance).toFixed(2)}`);
      return;
    }

    const coinPrice = prices[selectedCoin.id].usd;
    const cryptoAmt = usdAmount / coinPrice;
    setBuyLoading(true);
    try {
      const newBalance = parseFloat(usdWallet.balance) - usdAmount;
      const { error: wErr } = await supabase.from('wallets').update({ balance: newBalance }).eq('id', usdWallet.id);
      if (wErr) throw wErr;

      await supabase.from('transactions').insert([{
        sender_id: activeUserId, receiver_id: activeUserId,
        amount: usdAmount, currency: 'USD', type: 'crypto_buy', status: 'completed',
      }]);

      const existing = portfolio.find(p => p.coin_id === selectedCoin.id);
      if (existing) {
        const totalAmt    = parseFloat(existing.amount) + cryptoAmt;
        const newAvgPrice = (parseFloat(existing.amount) * parseFloat(existing.avg_price) + cryptoAmt * coinPrice) / totalAmt;
        const { error: pErr } = await supabase.from('crypto_portfolio')
          .update({ amount: totalAmt, avg_price: newAvgPrice, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (pErr) throw pErr;
      } else {
        const { error: pErr } = await supabase.from('crypto_portfolio').insert([{
          user_id: activeUserId, coin_id: selectedCoin.id,
          symbol: selectedCoin.symbol, name: selectedCoin.name,
          amount: cryptoAmt, avg_price: coinPrice,
        }]);
        if (pErr) throw pErr;
      }

      await refreshPortfolio();
      await refreshFiatWallets();
      closeBuyModal();
      alert(`✅ Успішно куплено!\n${cryptoAmt.toFixed(8)} ${selectedCoin.symbol}\nза $${usdAmount.toFixed(2)} USD`);
    } catch (err) {
      alert('Помилка: ' + (err.message || 'Невідома'));
    } finally {
      setBuyLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // ПРОДАЖ
  // ══════════════════════════════════════════════════════════════════════════════
  const openSellModal  = (item) => { setSellItem(item); setSellMode('usd'); setSellAmountUsd(''); setSellAmountCrypto(''); setIsSellModalOpen(true); };
  const closeSellModal = () => { setIsSellModalOpen(false); setSellItem(null); setSellAmountUsd(''); setSellAmountCrypto(''); };

  const handleSellUsdChange = (val) => {
    setSellAmountUsd(val);
    if (val && sellItem && prices[sellItem.coin_id])
      setSellAmountCrypto((parseFloat(val) / prices[sellItem.coin_id].usd).toFixed(8));
    else setSellAmountCrypto('');
  };

  const handleSellCryptoChange = (val) => {
    setSellAmountCrypto(val);
    if (val && sellItem && prices[sellItem.coin_id])
      setSellAmountUsd((parseFloat(val) * prices[sellItem.coin_id].usd).toFixed(2));
    else setSellAmountUsd('');
  };

  const handleSellMax = () => {
    if (!sellItem || !prices[sellItem.coin_id]) return;
    const maxCrypto = parseFloat(sellItem.amount);
    setSellAmountCrypto(maxCrypto.toFixed(8));
    setSellAmountUsd((maxCrypto * prices[sellItem.coin_id].usd).toFixed(2));
  };

  const handleSell = async (e) => {
    e.preventDefault();
    const cryptoAmt = parseFloat(sellAmountCrypto);
    if (!cryptoAmt || cryptoAmt <= 0) { alert('Введіть суму'); return; }
    if (cryptoAmt > parseFloat(sellItem.amount)) {
      alert(`Недостатньо ${sellItem.symbol}. Доступно: ${parseFloat(sellItem.amount).toFixed(8)}`);
      return;
    }

    const usdWallet = fiatWallets.find(w => w.currency === 'USD');
    if (!usdWallet) { alert('Немає USD гаманця для зарахування.'); return; }

    setSellLoading(true);
    try {
      const coinPrice  = prices[sellItem.coin_id].usd;
      const usdReceive = cryptoAmt * coinPrice;
      const newBalance = parseFloat(usdWallet.balance) + usdReceive;
      const remaining  = parseFloat(sellItem.amount) - cryptoAmt;

      const { error: wErr } = await supabase.from('wallets').update({ balance: newBalance }).eq('id', usdWallet.id);
      if (wErr) throw wErr;

      await supabase.from('transactions').insert([{
        sender_id: activeUserId, receiver_id: activeUserId,
        amount: usdReceive, currency: 'USD', type: 'crypto_sell', status: 'completed',
      }]);

      if (remaining < 0.000000001) {
        const { error: dErr } = await supabase.from('crypto_portfolio').delete().eq('id', sellItem.id);
        if (dErr) throw dErr;
      } else {
        const { error: pErr } = await supabase.from('crypto_portfolio')
          .update({ amount: remaining, updated_at: new Date().toISOString() })
          .eq('id', sellItem.id);
        if (pErr) throw pErr;
      }

      await refreshPortfolio();
      await refreshFiatWallets();
      closeSellModal();

      const pnlOnSale = (coinPrice - parseFloat(sellItem.avg_price)) * cryptoAmt;
      alert(
        `✅ Успішно продано!\n${cryptoAmt.toFixed(8)} ${sellItem.symbol}\n` +
        `Отримано: $${usdReceive.toFixed(2)} USD\n` +
        `P&L: ${pnlOnSale >= 0 ? '+' : ''}$${pnlOnSale.toFixed(2)}`
      );
    } catch (err) {
      alert('Помилка: ' + (err.message || 'Невідома'));
    } finally {
      setSellLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // ГЕНЕРАЦІЯ ГАМАНЦЯ (тільки для власного акаунта)
  // ══════════════════════════════════════════════════════════════════════════════
  const generateCryptoWallet = async (type = 'bitcoin') => {
    setIsGenerating(true);
    try {
      const mnemonic = bip39.generateMnemonic(128);
      const address  = deriveAddress(type, mnemonic);
      setNewWallet({ type, address, mnemonic, createdAt: new Date().toISOString() });
      setShowSeedWarning(true);
      setSeedConfirmed(false);
    } catch (err) {
      alert('Помилка генерації: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveWalletToDatabase = async () => {
    if (!newWallet || !seedConfirmed) { alert('Підтвердіть збереження seed-фрази!'); return; }
    try {
      const { error } = await supabase.from('crypto_wallets').insert([{
        user_id: user.id, address: newWallet.address, type: newWallet.type,
      }]);
      if (error) throw error;
      alert('Криптогаманець успішно збережено!');
      setNewWallet(null); setShowSeedWarning(false); setSeedConfirmed(false);
      await fetchOwnData();
    } catch (err) {
      alert('Помилка збереження: ' + err.message);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text)
      .then(() => alert(`${label} скопійовано!`))
      .catch(() => alert('Не вдалося скопіювати'));
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // ДОПОМІЖНІ
  // ══════════════════════════════════════════════════════════════════════════════
  const usdBalance = parseFloat(fiatWallets.find(w => w.currency === 'USD')?.balance ?? 0).toFixed(2);

  const getPortfolioValue = (item) =>
    (parseFloat(item.amount) * (prices[item.coin_id]?.usd ?? 0)).toFixed(2);

  const getPnL = (item) => {
    const cur = prices[item.coin_id]?.usd ?? 0;
    return ((cur - parseFloat(item.avg_price)) * parseFloat(item.amount)).toFixed(2);
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // РЕНДЕР
  // ══════════════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="crypto-page-wrapper">
        <div className="crypto-background">
          <Particles quantity={150} staticity={50} color={currentTheme.particles} size={0.6} />
        </div>
        <div className="crypto-page">
          <div className="crypto-loading">Завантаження...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="crypto-page-wrapper">
      <div className="crypto-background">
        <Particles quantity={150} staticity={50} color={currentTheme.particles} size={0.6} />
      </div>

      {/* ── БАНЕР ІМПЕРСОНАЦІЇ ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {impersonated && (
          <motion.div
            className="impersonation-banner"
            initial={{ y: -56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -56, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <span className="impersonation-icon">🔓</span>
            <span className="impersonation-text">
              Ви увійшли до кошелька: <strong>{impersonated.profileName}</strong>
            </span>
            <button className="impersonation-exit-btn" onClick={handleLogoutImpersonation}>
              ✕ Вийти
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="crypto-page" style={{ paddingTop: impersonated ? '80px' : undefined }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="crypto-container"
        >
          {/* ── ЗАГОЛОВОК ── */}
          <div className="crypto-title-row">
            <div>
              <h1 className="crypto-title">Криптовалютні операції</h1>
              <p className="crypto-subtitle">
                {impersonated
                  ? `Режим кошелька: ${impersonated.profileName}`
                  : 'Генеруйте гаманці та купуйте криптовалюту за актуальними курсами'}
              </p>
            </div>
            {!impersonated && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="wallet-access-btn"
                onClick={() => setIsLoginModalOpen(true)}
              >
                🔑 Увійти до гаманця
              </motion.button>
            )}
          </div>

          {/* ── РИНОК ── */}
          <section className="crypto-market-section">
            <div className="market-header">
              <h2 className="section-title">📈 Ринок</h2>
              <div className="market-meta">
                {lastUpdated && (
                  <span className="last-updated">Оновлено: {lastUpdated.toLocaleTimeString('uk-UA')}</span>
                )}
                <button onClick={fetchPrices} disabled={pricesLoading} className="refresh-btn">
                  {pricesLoading ? '⏳' : '🔄'}
                </button>
              </div>
            </div>
            {pricesError && <div className="prices-error">{pricesError}</div>}
            <div className="coins-grid">
              {SUPPORTED_COINS.map(coin => {
                const priceData = prices[coin.id];
                const change    = priceData?.change ?? 0;
                const isPos     = change >= 0;
                return (
                  <motion.div key={coin.id} whileHover={{ scale: 1.03 }} className="coin-card">
                    <div className="coin-icon">{coin.icon}</div>
                    <div className="coin-info">
                      <div className="coin-name">{coin.name}</div>
                      <div className="coin-symbol">{coin.symbol}</div>
                    </div>
                    <div className="coin-price-block">
                      <div className="coin-price">
                        {priceData ? `$${priceData.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : pricesLoading ? '...' : '—'}
                      </div>
                      {priceData && (
                        <div className={`coin-change ${isPos ? 'positive' : 'negative'}`}>
                          {isPos ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                        </div>
                      )}
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => openBuyModal(coin)}
                      disabled={!priceData}
                      className="buy-btn"
                    >
                      Купити
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* ── USD БАЛАНС ── */}
          <div className="usd-balance-bar">
            <span className="usd-balance-label">💵 Доступно USD:</span>
            <span className="usd-balance-value">${usdBalance}</span>
          </div>

          {/* ── ПОРТФЕЛЬ ── */}
          {portfolio.length > 0 && (
            <section className="portfolio-section">
              <h2 className="section-title">💼 Портфель {impersonated ? `(${impersonated.profileName})` : ''}</h2>
              <div className="portfolio-grid">
                {portfolio.map(item => {
                  const coin     = SUPPORTED_COINS.find(c => c.id === item.coin_id);
                  const pnl      = parseFloat(getPnL(item));
                  const isPnlPos = pnl >= 0;
                  return (
                    <div key={item.id} className="portfolio-card">
                      <div className="portfolio-coin-header">
                        <span className="portfolio-icon">{coin?.icon ?? '?'}</span>
                        <span className="portfolio-name">{item.name}</span>
                        <span className="portfolio-symbol">{item.symbol}</span>
                      </div>
                      <div className="portfolio-row">
                        <span className="portfolio-label">Кількість:</span>
                        <span className="portfolio-value">{parseFloat(item.amount).toFixed(8)} {item.symbol}</span>
                      </div>
                      <div className="portfolio-row">
                        <span className="portfolio-label">Ср. ціна купівлі:</span>
                        <span className="portfolio-value">${parseFloat(item.avg_price).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="portfolio-row">
                        <span className="portfolio-label">Поточна вартість:</span>
                        <span className="portfolio-value">${getPortfolioValue(item)}</span>
                      </div>
                      <div className="portfolio-row">
                        <span className="portfolio-label">P&L:</span>
                        <span className={`portfolio-pnl ${isPnlPos ? 'positive' : 'negative'}`}>
                          {isPnlPos ? '+' : ''}${pnl.toFixed(2)}
                        </span>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        className="sell-btn"
                        onClick={() => openSellModal(item)}
                        disabled={!prices[item.coin_id]}
                      >
                        💸 Продати {item.symbol}
                      </motion.button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── ГЕНЕРАЦІЯ ГАМАНЦІВ (тільки свій акаунт) ── */}
          {!impersonated && (
            <section className="generate-section">
              <h2 className="section-title">🔑 Генерація гаманців</h2>
              {!newWallet && (
                <div className="crypto-generate-section">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => generateCryptoWallet('bitcoin')} disabled={isGenerating}
                    className="crypto-generate-btn bitcoin-btn">
                    {isGenerating ? 'Генерація...' : '₿ Створити Bitcoin гаманець'}
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => generateCryptoWallet('ethereum')} disabled={isGenerating}
                    className="crypto-generate-btn ethereum-btn">
                    {isGenerating ? 'Генерація...' : 'Ξ Створити Ethereum гаманець'}
                  </motion.button>
                </div>
              )}
            </section>
          )}

          {/* ── SEED WARNING MODAL ── */}
          <AnimatePresence>
            {showSeedWarning && newWallet && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="seed-warning-modal"
              >
                <div className="seed-warning-box">
                  <h2 className="seed-warning-title">⚠️ ВАЖЛИВО!</h2>
                  <p className="seed-warning-text">
                    Ваша seed-фраза — це єдиний спосіб відновити доступ до гаманця.<br /><br />
                    <strong>Збережіть її в безпечному місці!</strong><br /><br />
                    Ніколи не діліться нею з третіми особами.
                  </p>
                  <div className="seed-phrase-box">
                    <div className="seed-phrase-label">Ваша seed-фраза (12 слів):</div>
                    <div className="seed-phrase-words">
                      {newWallet.mnemonic.split(' ').map((word, i) => (
                        <span key={i} className="seed-word">
                          <span className="seed-word-number">{i + 1}.</span> {word}
                        </span>
                      ))}
                    </div>
                    <button onClick={() => copyToClipboard(newWallet.mnemonic, 'Seed-фраза')} className="copy-seed-btn">
                      📋 Копіювати seed-фразу
                    </button>
                  </div>
                  <div className="address-box">
                    <div className="address-label">
                      {newWallet.type === 'bitcoin' ? '₿ Bitcoin' : 'Ξ Ethereum'} адреса:
                    </div>
                    <div className="address-value">{newWallet.address}</div>
                    <button onClick={() => copyToClipboard(newWallet.address, 'Адреса')} className="copy-address-btn">
                      📋 Копіювати адресу
                    </button>
                  </div>
                  <div className="seed-confirmation">
                    <label className="confirmation-checkbox">
                      <input type="checkbox" checked={seedConfirmed} onChange={e => setSeedConfirmed(e.target.checked)} />
                      <span>Я зберіг seed-фразу в безпечному місці</span>
                    </label>
                  </div>
                  <div className="seed-warning-buttons">
                    <button onClick={() => { setNewWallet(null); setShowSeedWarning(false); setSeedConfirmed(false); }} className="seed-cancel-btn">
                      Скасувати
                    </button>
                    <button onClick={saveWalletToDatabase} disabled={!seedConfirmed} className="seed-save-btn">
                      Зберегти гаманець
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── СПИСОК ГАМАНЦІВ ── */}
          <div className="crypto-wallets-list">
            <h2 className="wallets-list-title">
              {impersonated ? `Гаманці: ${impersonated.profileName}` : 'Ваші криптогаманці'}
            </h2>
            {cryptoWallets.length === 0 ? (
              <div className="no-wallets">
                <div className="no-wallets-icon">🔐</div>
                <h3>Немає криптогаманців</h3>
                <p>{impersonated ? 'У цього користувача немає гаманців' : 'Створіть свій перший Bitcoin або Ethereum гаманець'}</p>
              </div>
            ) : (
              <div className="wallets-grid">
                {cryptoWallets.map((wallet, idx) => (
                  <motion.div
                    key={wallet.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`wallet-item ${wallet.type}-wallet`}
                  >
                    <div className="wallet-type-badge">
                      {wallet.type === 'bitcoin' ? '₿ Bitcoin' : 'Ξ Ethereum'}
                    </div>
                    <div className="wallet-address-label">Адреса:</div>
                    <div className="wallet-address-display">{wallet.address}</div>
                    <button onClick={() => copyToClipboard(wallet.address, 'Адреса')} className="wallet-copy-btn">
                      📋 Копіювати
                    </button>
                    <div className="wallet-created">
                      Створено: {new Date(wallet.created_at).toLocaleDateString('uk-UA')}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* ── ІНФО-СЕКЦІЯ ── */}
          {!impersonated && (
            <div className="crypto-info-section">
              <h3 className="info-title">💡 Корисна інформація</h3>
              <ul className="info-list">
                <li>Ціни оновлюються в реальному часі через CoinGecko API</li>
                <li>Купівля криптовалюти списує кошти з вашого USD гаманця</li>
                <li>Seed-фраза генерується локально на вашому пристрої</li>
                <li>Приватні ключі НЕ зберігаються на сервері</li>
                <li>Використовується стандарт BIP-39</li>
              </ul>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── МОДАЛ КУПІВЛІ ── */}
      <AnimatePresence>
        {isBuyModalOpen && selectedCoin && (
          <div className="modal-overlay" onClick={closeBuyModal}>
            <motion.div className="modal-box" onClick={e => e.stopPropagation()}
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
              <h2 className="modal-heading">{selectedCoin.icon} Купити {selectedCoin.name}</h2>
              <div className="payment-summary">
                <div className="payment-summary-row">
                  <span className="payment-summary-label">Поточна ціна:</span>
                  <span className="payment-summary-value">${prices[selectedCoin.id]?.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="payment-summary-row">
                  <span className="payment-summary-label">Зміна за 24г:</span>
                  <span className={`payment-summary-value ${prices[selectedCoin.id]?.change >= 0 ? 'positive' : 'negative'}`}>
                    {prices[selectedCoin.id]?.change >= 0 ? '+' : ''}{prices[selectedCoin.id]?.change.toFixed(2)}%
                  </span>
                </div>
                <div className="payment-summary-row">
                  <span className="payment-summary-label">Доступно USD:</span>
                  <span className="payment-summary-value">${usdBalance}</span>
                </div>
              </div>
              <form onSubmit={handleBuy} className="modal-form">
                <div className="form-field">
                  <label className="form-label">Сума в USD</label>
                  <input type="number" value={buyAmountUsd} onChange={e => setBuyAmountUsd(e.target.value)}
                    placeholder="0.00" step="0.01" min="1" className="form-input" autoFocus disabled={buyLoading} />
                </div>
                {buyAmountUsd > 0 && prices[selectedCoin.id] && (
                  <div className="conversion-preview">
                    <span>Ви отримаєте: </span>
                    <strong>{calcCryptoAmount().toFixed(8)} {selectedCoin.symbol}</strong>
                  </div>
                )}
                <div className="modal-buttons">
                  <button type="button" onClick={closeBuyModal} disabled={buyLoading} className="modal-btn modal-btn-cancel">Скасувати</button>
                  <button type="submit" disabled={buyLoading} className="modal-btn modal-btn-submit">
                    {buyLoading ? 'Обробка...' : `Купити ${selectedCoin.symbol}`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── МОДАЛ ПРОДАЖУ ── */}
      <AnimatePresence>
        {isSellModalOpen && sellItem && (
          <div className="modal-overlay" onClick={closeSellModal}>
            <motion.div className="modal-box" onClick={e => e.stopPropagation()}
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
              <h2 className="modal-heading sell-heading">
                {SUPPORTED_COINS.find(c => c.id === sellItem.coin_id)?.icon} Продати {sellItem.name}
              </h2>
              <div className="payment-summary">
                <div className="payment-summary-row">
                  <span className="payment-summary-label">Поточна ціна:</span>
                  <span className="payment-summary-value">${prices[sellItem.coin_id]?.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="payment-summary-row">
                  <span className="payment-summary-label">Доступно {sellItem.symbol}:</span>
                  <span className="payment-summary-value">{parseFloat(sellItem.amount).toFixed(8)}</span>
                </div>
                <div className="payment-summary-row">
                  <span className="payment-summary-label">Макс. сума:</span>
                  <span className="payment-summary-value">${(parseFloat(sellItem.amount) * (prices[sellItem.coin_id]?.usd ?? 0)).toFixed(2)}</span>
                </div>
                {(() => {
                  const pnlPer = (prices[sellItem.coin_id]?.usd ?? 0) - parseFloat(sellItem.avg_price);
                  return (
                    <div className="payment-summary-row">
                      <span className="payment-summary-label">P&L за монету:</span>
                      <span className={`payment-summary-value ${pnlPer >= 0 ? 'positive' : 'negative'}`}>
                        {pnlPer >= 0 ? '+' : ''}${pnlPer.toFixed(2)}
                      </span>
                    </div>
                  );
                })()}
              </div>
              <form onSubmit={handleSell} className="modal-form">
                <div className="sell-mode-tabs">
                  <button type="button" className={`sell-mode-tab ${sellMode === 'usd' ? 'active' : ''}`}
                    onClick={() => { setSellMode('usd'); setSellAmountUsd(''); setSellAmountCrypto(''); }}>$ USD</button>
                  <button type="button" className={`sell-mode-tab ${sellMode === 'crypto' ? 'active' : ''}`}
                    onClick={() => { setSellMode('crypto'); setSellAmountUsd(''); setSellAmountCrypto(''); }}>{sellItem.symbol}</button>
                </div>
                {sellMode === 'usd' ? (
                  <div className="form-field">
                    <label className="form-label">Сума продажу в USD</label>
                    <input type="number" value={sellAmountUsd} onChange={e => handleSellUsdChange(e.target.value)}
                      placeholder="0.00" step="0.01" min="0.01" className="form-input sell-input" autoFocus disabled={sellLoading} />
                  </div>
                ) : (
                  <div className="form-field">
                    <label className="form-label">Кількість {sellItem.symbol}</label>
                    <input type="number" value={sellAmountCrypto} onChange={e => handleSellCryptoChange(e.target.value)}
                      placeholder="0.00000000" step="0.00000001" min="0.00000001" className="form-input sell-input" autoFocus disabled={sellLoading} />
                  </div>
                )}
                <button type="button" className="sell-max-btn" onClick={handleSellMax} disabled={sellLoading}>
                  Продати все (MAX)
                </button>
                {sellAmountCrypto > 0 && sellAmountUsd > 0 && (
                  <div className="conversion-preview sell-preview">
                    <div>Продаєте: <strong>{parseFloat(sellAmountCrypto).toFixed(8)} {sellItem.symbol}</strong></div>
                    <div>Отримаєте: <strong>${parseFloat(sellAmountUsd).toFixed(2)} USD</strong></div>
                    {(() => {
                      const pnl = (prices[sellItem.coin_id]?.usd - parseFloat(sellItem.avg_price)) * parseFloat(sellAmountCrypto);
                      return <div className={pnl >= 0 ? 'positive' : 'negative'}>P&L: <strong>{pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</strong></div>;
                    })()}
                  </div>
                )}
                <div className="modal-buttons">
                  <button type="button" onClick={closeSellModal} disabled={sellLoading} className="modal-btn modal-btn-cancel">Скасувати</button>
                  <button type="submit" disabled={sellLoading || !sellAmountCrypto} className="modal-btn modal-btn-sell">
                    {sellLoading ? 'Обробка...' : `Продати ${sellItem.symbol}`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── МОДАЛ ВХОДУ ПО SEED-ФРАЗІ ── */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <WalletLoginModal
            isOpen={isLoginModalOpen}
            onClose={() => setIsLoginModalOpen(false)}
            onLogin={(data) => {
              setImpersonated(data);
              setIsLoginModalOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default Crypto;