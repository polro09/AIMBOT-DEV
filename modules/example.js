// ========================================
// modules/example.js
// ========================================
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { createEmbed, successEmbed, errorEmbed } = require('../utils/embedBuilder');
const logger = require('../utils/logger');

const CONFIG = {
    CHANNEL_IDS: {
        welcome: '1234567890',
        logs: '0987654321',
        announcements: '1122334455'
    },
    CATEGORY_IDS: {
        general: '5544332211',
        admin: '6677889900'
    },
    ROLE_IDS: {
        member: '1357924680',
        moderator: '2468013579',
        admin: '9876543210'
    },
    PREFIX: '!',
    COOLDOWN: 5000,
    MAX_WARNINGS: 3
};

module.exports = {
    name: 'example',
    description: '예제 모듈입니다.',
    version: '1.0.0',
    author: 'aimdot.dev',
    
    async init(client) {
        logger.module(`${this.name} 모듈이 초기화되었습니다.`);
        
        client.on('messageCreate', (message) => this.handleMessage(message, client));
        client.on('interactionCreate', (interaction) => this.handleInteraction(interaction, client));
    },
    
    async handleMessage(message, client) {
        if (message.author.bot) return;
        
        if (message.content.startsWith(CONFIG.PREFIX)) {
            const args = message.content.slice(CONFIG.PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            
            if (command === 'test') {
                await this.testCommand(message, args, client);
            }
        }
    },
    
    async handleInteraction(interaction, client) {
        if (interaction.isButton()) {
            await this.handleButtonInteraction(interaction, client);
        }
        
        if (interaction.isStringSelectMenu()) {
            await this.handleSelectMenuInteraction(interaction, client);
        }
    },
    
    async testCommand(message, args, client) {
        try {
            const embed = createEmbed({
                title: '🧪 테스트 메뉴',
                description: '아래 버튼이나 드롭다운을 선택해주세요.',
                color: 0x0099ff,
                guild: message.guild,
                fields: [
                    {
                        name: '정보',
                        value: '이것은 예제 모듈입니다.',
                        inline: true
                    },
                    {
                        name: '작성자',
                        value: 'aimdot.dev',
                        inline: true
                    }
                ]
            });
            
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('example_button_success')
                        .setLabel('성공')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId('example_button_danger')
                        .setLabel('위험')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('⚠️'),
                    new ButtonBuilder()
                        .setCustomId('example_button_info')
                        .setLabel('정보')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('ℹ️')
                );
            
            const row2 = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('example_select')
                        .setPlaceholder('옵션을 선택해주세요')
                        .addOptions([
                            {
                                label: '옵션 1',
                                description: '첫 번째 옵션입니다',
                                value: 'option_1',
                                emoji: '1️⃣'
                            },
                            {
                                label: '옵션 2',
                                description: '두 번째 옵션입니다',
                                value: 'option_2',
                                emoji: '2️⃣'
                            },
                            {
                                label: '옵션 3',
                                description: '세 번째 옵션입니다',
                                value: 'option_3',
                                emoji: '3️⃣'
                            }
                        ])
                );
            
            await message.reply({
                embeds: [embed],
                components: [row1, row2]
            });
            
            logger.success(`테스트 명령어 실행: ${message.author.tag}`);
        } catch (error) {
            logger.error(`테스트 명령어 오류: ${error.message}`);
            
            const errorEmb = errorEmbed(
                '❌ 오류 발생',
                '명령어 실행 중 오류가 발생했습니다.',
                { guild: message.guild }
            );
            
            await message.reply({ embeds: [errorEmb] });
        }
    },
    
    async handleButtonInteraction(interaction, client) {
        if (!interaction.customId.startsWith('example_button_')) return;
        
        await interaction.deferUpdate();
        
        let embed;
        
        switch (interaction.customId) {
            case 'example_button_success':
                embed = successEmbed(
                    '✅ 성공!',
                    '성공 버튼을 클릭했습니다.',
                    { guild: interaction.guild }
                );
                break;
                
            case 'example_button_danger':
                embed = errorEmbed(
                    '⚠️ 위험!',
                    '위험 버튼을 클릭했습니다.',
                    { guild: interaction.guild }
                );
                break;
                
            case 'example_button_info':
                embed = createEmbed({
                    title: 'ℹ️ 정보',
                    description: '정보 버튼을 클릭했습니다.',
                    color: 0x0099ff,
                    guild: interaction.guild,
                    fields: [
                        {
                            name: '사용자',
                            value: interaction.user.tag,
                            inline: true
                        },
                        {
                            name: '시간',
                            value: new Date().toLocaleString('ko-KR'),
                            inline: true
                        }
                    ]
                });
                break;
        }
        
        await interaction.editReply({ embeds: [embed] });
        logger.info(`버튼 클릭: ${interaction.customId} by ${interaction.user.tag}`);
    },
    
    async handleSelectMenuInteraction(interaction, client) {
        if (interaction.customId !== 'example_select') return;
        
        await interaction.deferUpdate();
        
        const selected = interaction.values[0];
        const optionInfo = {
            'option_1': { title: '첫 번째 옵션', desc: '첫 번째 옵션을 선택하셨습니다!' },
            'option_2': { title: '두 번째 옵션', desc: '두 번째 옵션을 선택하셨습니다!' },
            'option_3': { title: '세 번째 옵션', desc: '세 번째 옵션을 선택하셨습니다!' }
        };
        
        const info = optionInfo[selected];
        const embed = createEmbed({
            title: `📋 ${info.title}`,
            description: info.desc,
            color: 0x0099ff,
            guild: interaction.guild,
            fields: [
                {
                    name: '선택한 값',
                    value: selected,
                    inline: true
                },
                {
                    name: '선택한 사용자',
                    value: interaction.user.tag,
                    inline: true
                }
            ]
        });
        
        await interaction.editReply({ embeds: [embed] });
        logger.info(`셀렉트 메뉴 선택: ${selected} by ${interaction.user.tag}`);
    },
    
    async execute(client) {
        // 이 메서드는 필수이지만, init에서 이벤트를 등록했으므로 비워둡니다.
    }
};