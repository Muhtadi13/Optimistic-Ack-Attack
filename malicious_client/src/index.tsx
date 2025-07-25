import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AttackDashboard from './components/AttackDashboard';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AttackDashboard />
  </StrictMode>,
);