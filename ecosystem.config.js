// ecosystem.config.js
// PM2 Process Manager Configuration
// https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [
    {
      // Application name (shows in pm2 status)
      name: 'app-server',

      // Working directory
      cwd: './server',

      // Entry point
      script: 'dist/server.js',

      // Cluster mode - use all available CPUs
      instances: 'max',
      exec_mode: 'cluster',

      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },

      // Logging configuration
      log_file: './logs/combined.log',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Restart configuration
      max_restarts: 10,
      restart_delay: 1000,
      exp_backoff_restart_delay: 100,

      // Auto-restart on memory limit
      max_memory_restart: '500M',

      // Watch mode (development only)
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.log'],

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // Source maps for error tracking
      source_map_support: true,
    },
  ],

  // Deployment configuration (optional - for pm2 deploy)
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:username/repo.git',
      path: '/var/www/app',
      'pre-deploy-local': '',
      'post-deploy':
        'npm ci --production && cd server && npx prisma migrate deploy && cd .. && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      env: {
        NODE_ENV: 'production',
      },
    },
  },
};
