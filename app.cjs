'use strict';

const fs = require('node:fs');
const path = require('node:path');

const builtServer = path.join(__dirname, 'dist-server', 'server.mjs');
const entry = fs.existsSync(builtServer)
  ? './dist-server/server.mjs'
  : './server.ts';

import(entry).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
