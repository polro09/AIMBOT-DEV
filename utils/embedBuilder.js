const { EmbedBuilder } = require('discord.js');

// 임베드 색상 정의
const colors = {
    success: 0x00ff00,
    error: 0xff0000,
    warning: 0xffff00,
    info: 0x0099ff,
    default: 0x7289da
};

// 기본 임베드 생성 함수
function createEmbed(options = {}) {
    const {
        title = null,
        description = null,
        color = colors.default,
        fields = [],
        thumbnail = null,
        image = null,
        timestamp = true,
        url = null,
        guild = null
    } = options;
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
            name: process.env.EMBED_AUTHOR_NAME || 'Aimbot.DEV',
            iconURL: process.env.EMBED_AUTHOR_ICON || 'https://imgur.com/Sd8qK9c.gif'
        });
    
    // 제목 설정
    if (title) embed.setTitle(title);
    
    // 설명 설정
    if (description) embed.setDescription(description);
    
    // URL 설정
    if (url) embed.setURL(url);
    
    // 필드 추가
    if (fields.length > 0) {
        fields.forEach(field => {
            embed.addFields({
                name: field.name,
                value: field.value,
                inline: field.inline || false
            });
        });
    }
    
    // 썸네일 설정
    if (thumbnail) embed.setThumbnail(thumbnail);
    
    // 이미지 설정
    if (image) embed.setImage(image);
    
    // 타임스탬프 설정
    if (timestamp) embed.setTimestamp();
    
    // 푸터 설정
    const footerText = process.env.EMBED_FOOTER_TEXT || '🔺DEUS VULT';
    const footerIcon = guild ? guild.iconURL({ dynamic: true }) : null;
    
    embed.setFooter({
        text: footerText,
        iconURL: footerIcon
    });
    
    return embed;
}

// 성공 임베드
function successEmbed(title, description, options = {}) {
    return createEmbed({
        ...options,
        title,
        description,
        color: colors.success
    });
}

// 에러 임베드
function errorEmbed(title, description, options = {}) {
    return createEmbed({
        ...options,
        title,
        description,
        color: colors.error
    });
}

// 경고 임베드
function warningEmbed(title, description, options = {}) {
    return createEmbed({
        ...options,
        title,
        description,
        color: colors.warning
    });
}

// 정보 임베드
function infoEmbed(title, description, options = {}) {
    return createEmbed({
        ...options,
        title,
        description,
        color: colors.info
    });
}

// 페이지네이션 임베드 생성
function paginationEmbed(pages, currentPage = 0) {
    const page = pages[currentPage];
    const embed = createEmbed(page);
    
    // 페이지 정보 추가
    if (pages.length > 1) {
        embed.setFooter({
            text: `${embed.data.footer?.text || ''} • 페이지 ${currentPage + 1}/${pages.length}`,
            iconURL: embed.data.footer?.icon_url
        });
    }
    
    return embed;
}

// 로딩 임베드
function loadingEmbed(title = '처리 중...', description = '잠시만 기다려주세요.') {
    return createEmbed({
        title,
        description,
        color: colors.info,
        thumbnail: 'https://i.imgur.com/llF5iyg.gif' // 로딩 GIF
    });
}

// 프로그레스 바 생성
function createProgressBar(current, max, size = 10) {
    const percentage = current / max;
    const progress = Math.round(size * percentage);
    const emptyProgress = size - progress;
    
    const progressText = '▓'.repeat(progress);
    const emptyProgressText = '░'.repeat(emptyProgress);
    const percentageText = `${Math.round(percentage * 100)}%`;
    
    return `${progressText}${emptyProgressText} ${percentageText}`;
}

module.exports = {
    colors,
    createEmbed,
    successEmbed,
    errorEmbed,
    warningEmbed,
    infoEmbed,
    paginationEmbed,
    loadingEmbed,
    createProgressBar
};