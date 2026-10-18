require('dotenv').config();
const app = require('./src/index');

if (require.main === module) {
  // Intentionally left blank because src/index.js starts the server itself.
}

module.exports = app;
