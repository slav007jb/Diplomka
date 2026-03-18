import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/SupaBaseClient';
import { useNavigate } from 'react-router-dom';
import { Particles } from '../components/Particles';
import '../css/Convert.css';

function Convert() {
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  const navigate = useNavigate();

  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [convertLoading, setConvertLoading] = useState(false);

  const [fromWallet, setFromWallet] = useState(null);
  const [toWallet, setToWallet] = useState(null);
  const [amount, setAmount] = useState('');
  const [convertedAmount, setConvertedAmount] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(0);
  const [commission, setCommission] = useState(0);

  const [liveRates, setLiveRates] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(true);

  // Курси валют (статичні, можна підключити API)
  const exchangeRates = {
    'USD-EUR': 0.92,
    'EUR-USD': 1.09,
    'USD-UAH': 41.50,
    'UAH-USD': 0.024,
    'EUR-UAH': 45.20,
    'UAH-EUR': 0.022,
    'GBP-USD': 1.27,
    'USD-GBP': 0.79,
    'GBP-EUR': 1.17,
    'EUR-GBP': 0.85,
    'USD-USD': 1,
    'EUR-EUR': 1,
    'UAH-UAH': 1,
    'GBP-GBP': 1
  };

  // Перевірка авторизації
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Завантаження кошельків
  useEffect(() => {
    if (user) {
      fetchWallets();
    }
  }, [user]);

  // Завантаження реальних курсів валют
  useEffect(() => {
    fetchExchangeRates();
    // Оновлюємо курси кожні 5 хвилин
    const interval = setInterval(fetchExchangeRates, 300000);
    return () => clearInterval(interval);
  }, []);
  
  const fetchExchangeRates = async () => {
    try {
      setRatesLoading(true);
      
      // Безкоштовний API для курсів валют
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await response.json();
      
      setLiveRates(data.rates);
      console.log('✅ Курси валют оновлено:', data.rates);
    } catch (error) {
      console.error('❌ Помилка завантаження курсів:', error);
      // Якщо API не працює, використовуємо статичні курси
      setLiveRates(null);
    } finally {
      setRatesLoading(false);
    }
  };
  const fetchWallets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setWallets(data || []);
      
      // Автоматично вибираємо перші два кошельки
      if (data && data.length >= 2) {
        setFromWallet(data[0]);
        setToWallet(data[1]);
        updateExchangeRate(data[0].currency, data[1].currency);
      } else if (data && data.length === 1) {
        setFromWallet(data[0]);
      }
    } catch (error) {
      console.error('Помилка завантаження гаманців:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrencySymbol = (currency) => {
    const symbols = {
      'USD': '$',
      'EUR': '€',
      'UAH': '₴',
      'GBP': '£',
      'JPY': '¥'
    };
    return symbols[currency] || currency;
  };

  const getExchangeRate = (fromCurrency, toCurrency) => {
    if (!fromCurrency || !toCurrency) return 0;
    
    // Якщо одна валюта
    if (fromCurrency === toCurrency) return 1;
    
    // Спробуємо використати реальні курси
    if (liveRates && liveRates[fromCurrency] && liveRates[toCurrency]) {
      // Конвертація через USD як базову валюту
      // Наприклад: EUR → UAH = (1 USD в EUR) * (UAH в 1 USD)
      const fromRate = liveRates[fromCurrency];
      const toRate = liveRates[toCurrency];
      return toRate / fromRate;
    }
    
    // Якщо API не працює, використовуємо статичні курси
    const key = `${fromCurrency}-${toCurrency}`;
    return exchangeRates[key] || 0;
  };

  const updateExchangeRate = (fromCurr, toCurr) => {
    const rate = getExchangeRate(fromCurr, toCurr);
    setExchangeRate(rate);
  };

  const handleFromWalletChange = (walletId) => {
    const wallet = wallets.find(w => w.id === walletId);
    setFromWallet(wallet);
    if (toWallet) {
      updateExchangeRate(wallet.currency, toWallet.currency);
    }
    calculateConversion(amount, wallet, toWallet);
  };

  const handleToWalletChange = (walletId) => {
    const wallet = wallets.find(w => w.id === walletId);
    setToWallet(wallet);
    if (fromWallet) {
      updateExchangeRate(fromWallet.currency, wallet.currency);
    }
    calculateConversion(amount, fromWallet, wallet);
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    setAmount(value);
    calculateConversion(value, fromWallet, toWallet);
  };

  const calculateConversion = (amt, from, to) => {
    if (!amt || !from || !to) {
      setConvertedAmount(0);
      setCommission(0);
      return;
    }

    const rate = getExchangeRate(from.currency, to.currency);
    const converted = parseFloat(amt) * rate;
    const comm = converted * 0.01; // 1% комісія
    
    setConvertedAmount((converted - comm).toFixed(2));
    setCommission(comm.toFixed(2));
  };

  const swapWallets = () => {
    if (!fromWallet || !toWallet) return;
    
    const temp = fromWallet;
    setFromWallet(toWallet);
    setToWallet(temp);
    updateExchangeRate(toWallet.currency, temp.currency);
    calculateConversion(amount, toWallet, temp);
  };

  const handleConvert = async (e) => {
    e.preventDefault();

    const amt = parseFloat(amount);

    if (!amt || amt <= 0) {
      alert('Введіть коректну суму');
      return;
    }

    if (!fromWallet || !toWallet) {
      alert('Оберіть валюти для конвертації');
      return;
    }

    if (amt > parseFloat(fromWallet.balance)) {
      alert('Недостатньо коштів на балансі');
      return;
    }

    if (fromWallet.id === toWallet.id) {
      alert('Неможливо конвертувати в ту саму валюту');
      return;
    }

    setConvertLoading(true);

    try {
      // Оновлюємо баланс вихідного гаманця
      const newFromBalance = parseFloat(fromWallet.balance) - amt;
      const { error: fromError } = await supabase
        .from('wallets')
        .update({ balance: newFromBalance })
        .eq('id', fromWallet.id);

      if (fromError) throw fromError;

      // Оновлюємо баланс цільового гаманця
      const finalAmount = parseFloat(convertedAmount);
      const newToBalance = parseFloat(toWallet.balance) + finalAmount;

      const { error: toError } = await supabase
        .from('wallets')
        .update({ balance: newToBalance })
        .eq('id', toWallet.id);

      if (toError) throw toError;

      // Створюємо запис транзакції
      await supabase
        .from('transactions')
        .insert([{
          sender_id: user.id,
          receiver_id: user.id,
          amount: amt,
          currency: fromWallet.currency,
          type: 'convert',
          status: 'completed'
        }]);

      alert(`Конвертація успішна! Ви отримали ${finalAmount} ${getCurrencySymbol(toWallet.currency)}`);
      
      // Очищаємо форму та перезавантажуємо дані
      setAmount('');
      setConvertedAmount(0);
      setCommission(0);
      await fetchWallets();

    } catch (error) {
      console.error('Помилка конвертації:', error);
      alert('Помилка при виконанні конвертації');
    } finally {
      setConvertLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="convert-page">
        <div className="convert-loading">Завантаження...</div>
      </div>
    );
  }

  if (wallets.length < 2) {
    return (
      <div className="convert-page">
        <div className="convert-error">
          <h2>Недостатньо валют для конвертації</h2>
          <p>Додайте мінімум 2 різні валюти для використання конвертації.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="convert-page-wrapper">
        <div className="convert-background">
          <Particles
            quantity={150}
            staticity={50}
            color={currentTheme.particles}
            size={0.6}
          />
        </div>
        <div className="convert-page">
          <div className="convert-loading">Завантаження...</div>
        </div>
      </div>
    );
  }
  
  if (wallets.length < 2) {
    return (
      <div className="convert-page-wrapper">
        <div className="convert-background">
          <Particles
            quantity={150}
            staticity={50}
            color={currentTheme.particles}
            size={0.6}
          />
        </div>
        <div className="convert-page">
          <div className="convert-error">
            <h2>Недостатньо валют для конвертації</h2>
            <p>Додайте мінімум 2 різні валюти для використання конвертації.</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="convert-page-wrapper">
      {/* Фон Particles */}
      <div className="convert-background">
        <Particles
          quantity={150}
          staticity={50}
          color={currentTheme.particles}
          size={0.6}
        />
      </div>
  
      {/* Контент */}
      <div className="convert-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="convert-container"
        >
          <h1 className="convert-title">Конвертація валют</h1>
          <p className="convert-subtitle">
            Обміняйте кошти між вашими гаманцями за актуальним курсом
            {ratesLoading && <span> (оновлення курсів...)</span>}
          </p>
  
          <div className="convert-content">
            {/* Лівий блок - форма */}
            <div className="convert-form-section">
              <form onSubmit={handleConvert} className="convert-form">
                
                {/* Вихідна валюта */}
                <div className="convert-input-group">
                  <label className="convert-label">З гаманця</label>
                  <select
                    value={fromWallet?.id || ''}
                    onChange={(e) => handleFromWalletChange(e.target.value)}
                    className="convert-select"
                    disabled={convertLoading}
                  >
                    {wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.currency} - {parseFloat(wallet.balance).toFixed(2)} {getCurrencySymbol(wallet.currency)}
                      </option>
                    ))}
                  </select>
                </div>
  
                {/* Сума */}
                <div className="convert-input-group">
                  <label className="convert-label">Сума</label>
                  <div className="convert-amount-wrapper">
                    <input
                      type="number"
                      value={amount}
                      onChange={handleAmountChange}
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      max={fromWallet?.balance}
                      className="convert-input"
                      disabled={convertLoading}
                    />
                    <span className="convert-currency-badge">
                      {fromWallet ? getCurrencySymbol(fromWallet.currency) : ''}
                    </span>
                  </div>
                  {fromWallet && (
                    <div className="convert-balance-hint">
                      Доступно: {parseFloat(fromWallet.balance).toFixed(2)} {getCurrencySymbol(fromWallet.currency)}
                    </div>
                  )}
                </div>
  
                {/* Кнопка swap */}
                <div className="convert-swap-container">
                  <button
                    type="button"
                    onClick={swapWallets}
                    className="convert-swap-button"
                    disabled={convertLoading}
                  >
                    ⇅
                  </button>
                </div>
  
                {/* Цільова валюта */}
                <div className="convert-input-group">
                  <label className="convert-label">В гаманець</label>
                  <select
                    value={toWallet?.id || ''}
                    onChange={(e) => handleToWalletChange(e.target.value)}
                    className="convert-select"
                    disabled={convertLoading}
                  >
                    {wallets
                      .filter(w => w.id !== fromWallet?.id)
                      .map((wallet) => (
                        <option key={wallet.id} value={wallet.id}>
                          {wallet.currency} - {parseFloat(wallet.balance).toFixed(2)} {getCurrencySymbol(wallet.currency)}
                        </option>
                      ))}
                  </select>
                </div>
  
                {/* Результат */}
                <div className="convert-input-group">
                  <label className="convert-label">Ви отримаєте</label>
                  <div className="convert-result-display">
                    <span className="convert-result-amount">{convertedAmount || '0.00'}</span>
                    <span className="convert-result-currency">
                      {toWallet ? getCurrencySymbol(toWallet.currency) : ''}
                    </span>
                  </div>
                </div>
  
                {/* Кнопка конвертації */}
                <button
                  type="submit"
                  disabled={convertLoading || !amount || !fromWallet || !toWallet}
                  className="convert-submit-button"
                >
                  {convertLoading ? 'Конвертація...' : 'Конвертувати'}
                </button>
              </form>
            </div>
  
            {/* Правий блок - інфо */}
            <div className="convert-info-section">
              <div className="convert-rate-card">
                <h3 className="convert-rate-title">
                  Курс обміну {liveRates && <span className="live-badge">🔴 LIVE</span>}
                </h3>
                <div className="convert-rate-display">
                  <span className="convert-rate-from">
                    1 {fromWallet?.currency || '---'}
                  </span>
                  <span className="convert-rate-equals">=</span>
                  <span className="convert-rate-to">
                    {exchangeRate ? exchangeRate.toFixed(4) : '0.0000'} {toWallet?.currency || '---'}
                  </span>
                </div>
                <div className="convert-rate-update">
                  {liveRates ? '💱 Курс з міжнародних бірж' : '💱 Статичний курс (API недоступний)'}
                </div>
              </div>
  
              {amount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="convert-details-card"
                >
                  <h3 className="convert-details-title">Деталі операції</h3>
                  <div className="convert-details-list">
                    <div className="convert-details-item">
                      <span className="convert-details-label">Сума конвертації:</span>
                      <span className="convert-details-value">
                        {amount} {getCurrencySymbol(fromWallet?.currency)}
                      </span>
                    </div>
                    <div className="convert-details-item">
                      <span className="convert-details-label">Курс:</span>
                      <span className="convert-details-value">
                        {exchangeRate.toFixed(4)}
                      </span>
                    </div>
                    <div className="convert-details-item">
                      <span className="convert-details-label">Комісія (1%):</span>
                      <span className="convert-details-value convert-details-commission">
                        {commission} {getCurrencySymbol(toWallet?.currency)}
                      </span>
                    </div>
                    <div className="convert-details-divider"></div>
                    <div className="convert-details-item convert-details-total">
                      <span className="convert-details-label">Ви отримаєте:</span>
                      <span className="convert-details-value">
                        {convertedAmount} {getCurrencySymbol(toWallet?.currency)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
  
              <div className="convert-tips-card">
                <h3 className="convert-tips-title">💡 Корисні поради</h3>
                <ul className="convert-tips-list">
                  <li>Конвертація між вашими гаманцями миттєва</li>
                  <li>Комісія складає лише 1% від суми</li>
                  <li>Курси оновлюються кожні 5 хвилин</li>
                  <li>Історія конвертацій зберігається назавжди</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default Convert;