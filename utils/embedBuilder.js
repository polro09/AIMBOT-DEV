// ========================================
// utils/embedBuilder.js
// ========================================
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

const colors = {
    success: 0x00ff00,
    error: 0xff0000,
    warning: 0xffff00,
    info: 0x0099ff,
    default: 0x7289da
};

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
        guild = null,
        footer = null
    } = options;
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
            name: config.embed.authorName,
            iconURL: config.embed.authorIcon
        });
    
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (url) embed.setURL(url);
    
    if (fields.length > 0) {
        fields.forEach(field => {
            embed.addFields({
                name: field.name,
                value: field.value,
                inline: field.inline || false
            });
        });
    }
    
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (image) embed.setImage(image);
    if (timestamp) embed.setTimestamp();
    
    if (footer && typeof footer === 'object') {
        embed.setFooter(footer);
    } else {
        const footerText = footer || config.embed.footerText;
        const footerIcon = guild ? guild.iconURL({ dynamic: true }) : null;
        
        embed.setFooter({
            text: footerText,
            iconURL: footerIcon
        });
    }
    
    return embed;
}

function successEmbed(title, description, options = {}) {
    return createEmbed({
        ...options,
        title,
        description,
        color: colors.success
    });
}

function errorEmbed(title, description, options = {}) {
    return createEmbed({
        ...options,
        title,
        description,
        color: colors.error
    });
}

function warningEmbed(title, description, options = {}) {
    return createEmbed({
        ...options,
        title,
        description,
        color: colors.warning
    });
}

function infoEmbed(title, description, options = {}) {
    return createEmbed({
        ...options,
        title,
        description,
        color: colors.info
    });
}

module.exports = {
    colors,
    createEmbed,
    successEmbed,
    errorEmbed,
    warningEmbed,
    infoEmbed
};