import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import ChatSignalsFeedScreen from './screens/chat-signals-feed';

createRoot(document.getElementById('root')!).render(<ChatSignalsFeedScreen />);
