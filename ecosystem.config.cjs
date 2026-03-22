module.exports = {
  apps: [
    {
      name: 'stock-server',
      script: './server/index.js',
      env: {
        PORT: 31000,
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'stock-crawler',
      script: './server/realtime_crawler.js',
      env: {
        ENABLE_CRAWLER: 'true',
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    }
  ]
};
