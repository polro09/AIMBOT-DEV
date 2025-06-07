module.exports = {
  apps: [{
    name: 'aimdot-bot',
    script: './index.js',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'data', '.git', 'data/sessions'],
    max_restarts: 10,
    min_uptime: '10s',
    env: {
      NODE_ENV: 'development',
      SESSION_SECRET: process.env.SESSION_SECRET
    },
    env_production: {
      NODE_ENV: 'production',
      SESSION_SECRET: process.env.SESSION_SECRET,
      COOKIE_SECURE: 'true'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    time: true,
    // PM2가 graceful shutdown을 대기하는 시간
    kill_timeout: 3000,
    // 재시작 지연
    restart_delay: 4000,
    autorestart: true,
    // 메모리 제한 (선택사항)
    max_memory_restart: '1G'
  }]
}