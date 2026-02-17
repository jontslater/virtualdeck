import React from 'react';
import { createRoot } from 'react-dom/client';
import BattleOverlay from './components/BattleOverlay';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<BattleOverlay />);
}

