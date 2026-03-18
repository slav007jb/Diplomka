import { useEffect, useState } from 'react';
import { supabase } from '../services/SupaBaseClient';

function Test() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase.from('wallets').select('*');
      if (error) {
        console.error('Ошибка:', error);
      } else {
        console.log('Подключение успешно!', data);
        setData(data);
      }
    }
    testConnection();
  }, []);

  return (
    <div style={{ padding: '40px', color: 'white' }}>
      <h1>Тест подключения к Supabase</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

export default Test;