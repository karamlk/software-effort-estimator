import React from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import EstimationPage from './pages/EstimationPage';
import { Toaster } from '@/components/ui/sonner';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/estimation" replace />} />
        <Route path="/estimation" element={<EstimationPage />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
