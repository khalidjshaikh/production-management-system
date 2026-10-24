import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles.css';
import App from './App';
import { MetaProvider } from './context/MetaContext';
import { ToastProvider } from './context/ToastContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <MetaProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </MetaProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
