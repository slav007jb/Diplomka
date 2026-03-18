import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Convert from './pages/Convert'
import History from './pages/History'
import Crypto from './pages/Crypto';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/register" replace />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/convert" element={<Convert />} />
        <Route path="/dashboard/history" element={<History />} />
        <Route path="/dashboard/crypto" element={<Crypto />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;