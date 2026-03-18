import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Particles } from '../components/Particles';
import { supabase } from '../services/SupaBaseClient';
import { useNavigate } from 'react-router-dom';
import '../css/History.css';

function History() {
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState({});

  // Фільтри
  const [filterType, setFilterType] = useState('all'); // all, topup, transfer, convert
  const [filterCurrency, setFilterCurrency] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date-desc'); // date-desc, date-asc, amount-desc, amount-asc

  // Перевірка авторизації
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Завантаження транзакцій
  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);

      // Отримуємо всі транзакції, де користувач є відправником або отримувачем
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions(data || []);
      setFilteredTransactions(data || []);

      // Завантажуємо профілі користувачів для відображення email
      if (data && data.length > 0) {
        await fetchProfiles(data);
      }
    } catch (error) {
      console.error('Помилка завантаження транзакцій:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async (transactionsList) => {
    try {
      // Збираємо всі унікальні ID користувачів
      const userIds = new Set();
      transactionsList.forEach(t => {
        userIds.add(t.sender_id);
        userIds.add(t.receiver_id);
      });

      // Завантажуємо профілі
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', Array.from(userIds));

      if (error) throw error;

      // Створюємо об'єкт для швидкого доступу
      const profilesMap = {};
      data.forEach(profile => {
        profilesMap[profile.id] = profile;
      });

      setProfiles(profilesMap);
    } catch (error) {
      console.error('Помилка завантаження профілів:', error);
    }
  };

  // Застосування фільтрів
  useEffect(() => {
    applyFilters();
  }, [filterType, filterCurrency, filterStatus, searchQuery, sortBy, transactions]);

  const applyFilters = () => {
    let filtered = [...transactions];

    // Фільтр по типу
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType);
    }

    // Фільтр по валюті
    if (filterCurrency !== 'all') {
      filtered = filtered.filter(t => t.currency === filterCurrency);
    }

    // Фільтр по статусу
    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    // Пошук
    if (searchQuery) {
      filtered = filtered.filter(t => {
        const senderEmail = profiles[t.sender_id]?.email?.toLowerCase() || '';
        const receiverEmail = profiles[t.receiver_id]?.email?.toLowerCase() || '';
        const amount = t.amount.toString();
        const query = searchQuery.toLowerCase();

        return (
          senderEmail.includes(query) ||
          receiverEmail.includes(query) ||
          amount.includes(query) ||
          t.currency.toLowerCase().includes(query)
        );
      });
    }

    // Сортування
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'date-asc':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'amount-desc':
          return b.amount - a.amount;
        case 'amount-asc':
          return a.amount - b.amount;
        default:
          return 0;
      }
    });

    setFilteredTransactions(filtered);
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

  const getTransactionTypeIcon = (type) => {
    const icons = {
      'topup': '💳',
      'transfer': '💸',
      'convert': '🔄',
      'withdraw': '🏦'
    };
    return icons[type] || '📄';
  };

  const getTransactionTypeLabel = (type) => {
    const labels = {
      'topup': 'Поповнення',
      'transfer': 'Переказ',
      'convert': 'Конвертація',
      'withdraw': 'Виведення'
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status) => {
    const styles = {
      'completed': 'status-completed',
      'pending': 'status-pending',
      'failed': 'status-failed'
    };
    const labels = {
      'completed': 'Виконано',
      'pending': 'В обробці',
      'failed': 'Відхилено'
    };
    return {
      className: styles[status] || 'status-pending',
      label: labels[status] || status
    };
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Щойно';
    if (diffMins < 60) return `${diffMins} хв тому`;
    if (diffHours < 24) return `${diffHours} год тому`;
    if (diffDays < 7) return `${diffDays} дн тому`;

    return date.toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Отримуємо унікальні валюти для фільтра
  const uniqueCurrencies = [...new Set(transactions.map(t => t.currency))];

  // Статистика
  const stats = {
    total: transactions.length,
    completed: transactions.filter(t => t.status === 'completed').length,
    pending: transactions.filter(t => t.status === 'pending').length,
    totalAmount: transactions
      .filter(t => t.status === 'completed' && t.sender_id === user.id)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0)
  };

  if (loading) {
    return (
      <div className="history-page-wrapper">
        <div className="history-background">
          <Particles
            quantity={150}
            staticity={50}
            color={currentTheme.particles}
            size={0.6}
          />
        </div>
        <div className="history-page">
          <div className="history-loading">Завантаження транзакцій...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="history-page-wrapper">
      {/* Фон */}
      <div className="history-background">
        <Particles
          quantity={150}
          staticity={50}
          color={currentTheme.particles}
          size={0.6}
        />
      </div>

      {/* Контент */}
      <div className="history-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="history-container"
        >
          <h1 className="history-title">Історія транзакцій</h1>
          <p className="history-subtitle">
            Всі ваші операції в одному місці
          </p>

          {/* Статистика */}
          <div className="history-stats">
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <div className="stat-label">Всього операцій</div>
                <div className="stat-value">{stats.total}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-info">
                <div className="stat-label">Виконано</div>
                <div className="stat-value">{stats.completed}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">⏳</div>
              <div className="stat-info">
                <div className="stat-label">В обробці</div>
                <div className="stat-value">{stats.pending}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-info">
                <div className="stat-label">Загальна сума витрат</div>
                <div className="stat-value">{stats.totalAmount.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Фільтри */}
          <div className="history-filters">
            <div className="filters-row">
              {/* Пошук */}
              <div className="filter-search">
                <input
                  type="text"
                  placeholder="🔍 Пошук по email, сумі, валюті..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>

              {/* Тип транзакції */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="filter-select"
              >
                <option value="all">Всі типи</option>
                <option value="topup">Поповнення</option>
                <option value="transfer">Перекази</option>
                <option value="convert">Конвертація</option>
                <option value="withdraw">Виведення</option>
              </select>

              {/* Валюта */}
              <select
                value={filterCurrency}
                onChange={(e) => setFilterCurrency(e.target.value)}
                className="filter-select"
              >
                <option value="all">Всі валюти</option>
                {uniqueCurrencies.map(curr => (
                  <option key={curr} value={curr}>{curr}</option>
                ))}
              </select>

              {/* Статус */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="filter-select"
              >
                <option value="all">Всі статуси</option>
                <option value="completed">Виконано</option>
                <option value="pending">В обробці</option>
                <option value="failed">Відхилено</option>
              </select>

              {/* Сортування */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="filter-select"
              >
                <option value="date-desc">Спочатку нові</option>
                <option value="date-asc">Спочатку старі</option>
                <option value="amount-desc">За сумою (більше)</option>
                <option value="amount-asc">За сумою (менше)</option>
              </select>
            </div>
          </div>

          {/* Список транзакцій */}
          <div className="transactions-list">
            {filteredTransactions.length === 0 ? (
              <div className="no-transactions">
                <div className="no-transactions-icon">📭</div>
                <h3>Транзакцій не знайдено</h3>
                <p>Спробуйте змінити фільтри або здійсніть першу операцію</p>
              </div>
            ) : (
              filteredTransactions.map((transaction, index) => {
                const isOutgoing = transaction.sender_id === user.id;
                const statusBadge = getStatusBadge(transaction.status);

                return (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`transaction-card ${isOutgoing ? 'transaction-outgoing' : 'transaction-incoming'}`}
                  >
                    {/* Іконка типу */}
                    <div className="transaction-icon">
                      {getTransactionTypeIcon(transaction.type)}
                    </div>

                    {/* Інфо */}
                    <div className="transaction-info">
                      <div className="transaction-main">
                        <div className="transaction-type">
                          {getTransactionTypeLabel(transaction.type)}
                        </div>
                        <div className="transaction-participants">
                          {transaction.type === 'transfer' && (
                            <>
                              {isOutgoing ? (
                                <>
                                  Відправлено → {profiles[transaction.receiver_id]?.email || 'Невідомий користувач'}
                                </>
                              ) : (
                                <>
                                  Отримано ← {profiles[transaction.sender_id]?.email || 'Невідомий користувач'}
                                </>
                              )}
                            </>
                          )}
                          {transaction.type === 'topup' && 'Поповнення балансу'}
                          {transaction.type === 'convert' && `Конвертація ${transaction.currency}`}
                          {transaction.type === 'withdraw' && 'Виведення коштів'}
                        </div>
                      </div>

                      <div className="transaction-meta">
                        <span className="transaction-date">{formatDate(transaction.created_at)}</span>
                        <span className="transaction-time">{formatTime(transaction.created_at)}</span>
                        <span className={`transaction-status ${statusBadge.className}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                    </div>

                    {/* Сума */}
                    <div className={`transaction-amount ${isOutgoing ? 'amount-negative' : 'amount-positive'}`}>
                      <div className="amount-value">
                        {isOutgoing ? '-' : '+'}{parseFloat(transaction.amount).toFixed(2)}
                      </div>
                      <div className="amount-currency">
                        {getCurrencySymbol(transaction.currency)}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default History;