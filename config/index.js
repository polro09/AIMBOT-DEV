require('dotenv').config();

module.exports = {
    discord: {
        token: process.env.DISCORD_TOKEN,
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/auth/discord/callback'
    },
    party: {
        listChannelId: process.env.PARTY_LIST_CHANNEL_ID || '1379249420951879680',
        noticeChannelId: process.env.PARTY_NOTICE_CHANNEL_ID || '1380482194677698570'
    },
    web: {
        port: parseInt(process.env.WEB_PORT) || 3000,
        sessionSecret: process.env.SESSION_SECRET || 'f4ca2b8d9e7c3a1f5b8d2e9a7c4f1b3d8e2a9c5f7b1d3e8a2c5f9b7d1e3a8c4f',
        url: process.env.WEB_URL || 'http://localhost:3000'
    },
    bot: {
        name: process.env.BOT_NAME || 'Aimbot.DEV',
        prefix: process.env.BOT_PREFIX || '!',
        adminIds: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : ['257097077782216704']
    },
    embed: {
        authorName: process.env.EMBED_AUTHOR_NAME || 'Aimbot.DEV',
        authorIcon: process.env.EMBED_AUTHOR_ICON || 'https://imgur.com/Sd8qK9c.gif',
        footerText: process.env.EMBED_FOOTER_TEXT || '🔺DEUS VULT'
    }
};