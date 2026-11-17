import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const builtServer = path.join(__dirname, 'dist-server', 'server.mjs');
const entry = fs.existsSync(builtServer)
  ? './dist-server/server.mjs'
  : './server.ts';

import(entry).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
