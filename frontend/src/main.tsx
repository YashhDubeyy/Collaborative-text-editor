import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import 'highlight.js/styles/github-dark.css';

// Apply saved theme immediately to avoid flash
const savedTheme = localStorage.getItem('collabedit-theme') ?? 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
