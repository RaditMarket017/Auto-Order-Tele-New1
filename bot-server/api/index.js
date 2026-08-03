const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../../src/config');

const adminApi = require('../src/admin-api');

function setupServer(app) {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS Middleware for Telegram WebApp / Webview cross-origin iframe support
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-telegram-user-id, x-admin-secret, ngrok-skip-browser-warning');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Dynamic Domain Auto-Detection Middleware
  app.use((req, res, next) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      const activeDomain = `${protocol}://${host}`;
      config.WEBHOOK_BASE_URL = activeDomain;
      process.env.WEBHOOK_BASE_URL = activeDomain;
    }
    next();
  });

  // API Routes
  app.use('/api/admin', adminApi);

  // Serve Admin Web App (Svelte dist) with CORS headers
  const adminDist = path.join(__dirname, '..', 'admin-app', 'dist');
  const adminLegacy = path.join(__dirname, '..', 'admin');

  const staticOptions = {
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    }
  };

  if (fs.existsSync(adminDist)) {
    app.use('/admin', express.static(adminDist, staticOptions));
  }
  app.use('/admin', express.static(adminLegacy, staticOptions));

  app.get('/admin*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (fs.existsSync(path.join(adminDist, 'index.html'))) {
      res.sendFile(path.join(adminDist, 'index.html'));
    } else {
      res.sendFile(path.join(adminLegacy, 'index.html'));
    }
  });

  return app;
}

module.exports = { setupServer };
