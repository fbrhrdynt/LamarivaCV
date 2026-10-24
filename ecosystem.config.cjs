const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
module.exports = { apps: [
  { name: 'lamariva', cwd: __dirname, script: 'node_modules/next/dist/bin/next',
    args: ['start', '-H', '127.0.0.1', '-p', process.env.PORT || '3035'],
    instances: 1, exec_mode: 'fork', autorestart: true,
    max_memory_restart: '750M', restart_delay: 3000, kill_timeout: 15000,
    time: true, merge_logs: true, env: { NODE_ENV: 'production' } },
  { name: 'lamariva-job-sync', cwd: __dirname, script: 'scripts/sync.ts',
    interpreter: 'node', node_args: '--import tsx',
    cron_restart: '17 * * * *', autorestart: false, time: true,
    env: { NODE_ENV: 'production' } }
] };
