// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'api-server',
      cwd: './server',
      script: 'python3',
      args: '-m uvicorn app.main:app --host 0.0.0.0 --port 3001',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
    {
      name: 'client-app',
      cwd: './client',
      script: 'npx',
      args: 'serve -s dist/browser -l 3000',
      env: {
        NODE_ENV: 'production',
      }
    }
  ],
};
