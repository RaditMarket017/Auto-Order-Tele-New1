const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../../src/config');

const shopApi = require('../src/shop-api');
const adminApi = require('../src/admin-api');

function setupServer(app) {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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
  app.use('/api/shop', shopApi);
  app.use('/api/admin', adminApi);

  // Serve Admin Web App (Svelte dist)
  const adminDist = path.join(__dirname, '..', 'admin-app', 'dist');
  const adminLegacy = path.join(__dirname, '..', 'admin');

  if (fs.existsSync(adminDist)) {
    app.use('/admin', express.static(adminDist));
  }
  app.use('/admin', express.static(adminLegacy));

  app.get('/admin*', (req, res) => {
    if (fs.existsSync(path.join(adminDist, 'index.html'))) {
      res.sendFile(path.join(adminDist, 'index.html'));
    } else {
      res.sendFile(path.join(adminLegacy, 'index.html'));
    }
  });

  // Serve Shop Mini App (Svelte dist)
  const shopDist = path.join(__dirname, '..', 'shop-app', 'dist');
  const shopSource = path.join(__dirname, '..', 'shop-app');

  if (fs.existsSync(shopDist)) {
    app.use('/app', express.static(shopDist));
  }
  app.use('/app', express.static(shopSource));

  app.get('/app*', (req, res) => {
    if (fs.existsSync(path.join(shopDist, 'index.html'))) {
      res.sendFile(path.join(shopDist, 'index.html'));
    } else {
      res.sendFile(path.join(shopSource, 'index.html'));
    }
  });

  return app;
}

module.exports = { setupServer };
