const path = require('path');
process.env.PORT = process.env.PORT || '3001';
process.env.DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'server', 'data');
process.env.NODE_ENV = 'production';
require(path.join(__dirname, '..', 'server', 'server.js'));
