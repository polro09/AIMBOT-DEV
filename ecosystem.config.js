module.exports = {
  apps: [{
    name: 'aimdot-bot',
    script: './index.js',
    watch: false, // --watch 옵션 대신 여기서 설정
    ignore_watch: ['node_modules', 'logs', 'data', '.git'],
    max_restarts: 10,
    min_uptime: '10s',
    env: {
      NODE_ENV: 'development'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    time: true,
    // PM2가 graceful shutdown을 대기하는 시간
    kill_timeout: 3000,
    // 재시작 지연
    restart_delay: 4000,
    autorestart: true
  }]
}