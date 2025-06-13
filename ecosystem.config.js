// ========================================
// ecosystem.config.js
// ========================================
module.exports = {
    apps: [{
        name: 'aimdot-bot',
        script: './index.js',
        watch: false,
        ignore_watch: [
            'node_modules', 
            'logs', 
            'data', 
            '.git', 
            'data/sessions',
            'sessions',
            '*.log',
            '.env'
        ],
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
        kill_timeout: 3000,
        restart_delay: 4000,
        autorestart: true,
        max_memory_restart: '1G'
    }]
}