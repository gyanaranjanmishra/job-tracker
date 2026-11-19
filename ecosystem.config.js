module.exports = {
  apps: [
    {
      name: 'job-tracker',
      script: 'server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'development',
      },
      restart_delay: 5000,
      max_restarts: 10,
      watch: false,
    },
  ],
}
