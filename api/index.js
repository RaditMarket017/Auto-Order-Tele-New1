const express = require('express');
const { setupServer } = require('../bot-server/api/index');

const app = express();
setupServer(app);

module.exports = app;
