
// ========================================
// modules/party.js
// ========================================
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { createEmbed, successEmbed, errorEmbed } = require('../utils/embedBuilder');
const logger = require('../utils/logger');
const dataManager = require('../utils/dataManager');
const eventBus = require('../utils/eventBus');
const config = require('../config');

// 모듈 설정
const MODULE_CONFIG = {
    CHANNEL_IDS: {
        partyList: config.party.listChannelId,
        partyNotice: config.party.noticeChannelId
    },
    ROLE_IDS: {
        member: '1357924680',
        noble: '2468013579',
        admin: '9876543210'
    },
    POINTS: {
        win: 100,
        lose: 50,
        killPerPoint: 1
    }
};

module.exports = {
    name: 'party',
    description: '파티 모집 시스템',
    version: '2.1.0',
    author: 'aimdot.dev',
    
    async init(client) {
        logger.module(`${this.name} 모듈이 초기화되었습니다.`);
        
        // 이벤트 리스너 등록
        client.on('messageCreate', (message) => this.handleMessage(message, client));
        client.on('interactionCreate', (interaction) => this.handleInteraction(interaction, client));
        
        // EventBus 이벤트 구독
        eventBus.on('party:created', (party) => this.handlePartyCreated(party, client));
        eventBus.on('party:updated', (party) => this.handlePartyUpdated(party, client));
        eventBus.on('party:cancelled', (party) => this.handlePartyCancelled(party, client));
        
        // 봇 종료 시 정리
        eventBus.on('bot:shutdown', () => {
            logger.info('파티 모듈 정리 중...');
        });
        
        logger.info('파티 모듈 이벤트 리스너가 등록되었습니다.');
    },
    
    // EventBus 이벤트 핸들러
    async handlePartyCreated(party, client) {
        try {
            await this.sendOrUpdatePartyNotice(party, client, false);
        } catch (error) {
            logger.error(`파티 생성 알림 오류: ${error.message}`);
        }
    },
    
    async handlePartyUpdated(party, client) {
        try {
            await this.sendOrUpdatePartyNotice(party, client, true);
        } catch (error) {
            logger.error(`파티 업데이트 알림 오류: ${error.message}`);
        }
    },
    
    async handlePartyCancelled(party, client) {
        try {
            const channel = client.channels.cache.get(MODULE_CONFIG.CHANNEL_IDS.partyNotice);
            if (!channel) {
                logger.error(`파티 알림 채널을 찾을 수 없습니다: ${MODULE_CONFIG.CHANNEL_IDS.partyNotice}`);
                return;
            }
            
            if (party.embedMessageId) {
                await this.safeUpdateMessage(channel, party.embedMessageId, {
                    content: '**[취소됨]** ~~이 파티는 취소되었습니다.~~',
                    components: []
                });
            }
        } catch (error) {
            logger.error(`파티 취소 알림 오류: ${error.message}`);
        }
    },
    
    // 안전한 메시지 업데이트
    async safeUpdateMessage(channel, messageId, updateData) {
        try {
            const message = await channel.messages.fetch(messageId).catch(() => null);
            
            if (message) {
                await message.edit(updateData);
                logger.debug(`메시지 업데이트 성공: ${messageId}`);
                return true;
            } else {
                logger.warn(`메시지를 찾을 수 없습니다: ${messageId}`);
                return false;
            }
        } catch (error) {
            logger.error(`메시지 업데이트 실패: ${error.message}`);
            return false;
        }
    },
    
    // 메시지 처리
    async handleMessage(message, client) {
        if (message.author.bot) return;
        
        if (message.content === '!파티모집') {
            await this.showPartyMenu(message, client);
        }
    },
    
    // 파티 모집 메뉴 표시
    async showPartyMenu(message, client) {
        try {
            const embed = createEmbed({
                title: '⚔️ 클랜 파티 모집 시스템',
                description: '```\n🔥 전투를 준비하라! 🔥\n```\n' +
                           '> 클랜원들과 함께하는 전략적 전투 시스템\n\n',
                color: 0xFF0000,
                guild: message.guild,
                fields: [
                    {
                        name: '📋 파티 타입',
                        value: '```diff\n' +
                               '+ 모의전 - 클랜원들끼리 진행하는 연습 경기\n' +
                               '+ 정규전 - 적대 클랜과의 명예로운 전투\n' +
                               '- 검은발톱 - 위험한 검은 발톱 퀘스트\n' +
                               '- PK - 적대 클랜원 사냥\n' +
                               '! 레이드 - 강력한 보스 토벌\n' +
                               '! 훈련 - 신규 클랜원 훈련\n' +
                               '```',
                        inline: false
                    },
                    {
                        name: '🌐 웹 대시보드',
                        value: `[파티 생성 및 관리하기](${config.web.url}/party)`,
                        inline: true
                    },
                    {
                        name: '📊 내 전적',
                        value: '아래 버튼을 클릭하여 확인',
                        inline: true
                    }
                ]
            });
            
            const button = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('party_web_link')
                        .setLabel('웹에서 파티 생성')
                        .setStyle(ButtonStyle.Link)
                        .setURL(`${config.web.url}/party/create`)
                        .setEmoji('🌐'),
                    new ButtonBuilder()
                        .setCustomId('party_my_stats')
                        .setLabel('내 전적 보기')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📊')
                );
            
            await message.reply({ embeds: [embed], components: [button] });
            logger.success(`파티 모집 메뉴 실행: ${message.author.tag}`);
        } catch (error) {
            logger.error(`파티 메뉴 표시 오류: ${error.message}`);
            await message.reply({
                embeds: [errorEmbed('❌ 오류 발생', '파티 메뉴를 표시할 수 없습니다.')]
            });
        }
    },
    
    // Discord 알림 전송 및 업데이트 (개선된 버전)
    async sendOrUpdatePartyNotice(party, client, isUpdate = false) {
        try {
            const channel = client.channels.cache.get(MODULE_CONFIG.CHANNEL_IDS.partyNotice);
            if (!channel) {
                logger.error(`파티 알림 채널을 찾을 수 없습니다: ${MODULE_CONFIG.CHANNEL_IDS.partyNotice}`);
                return;
            }
            
            const embed = await this.createPartyEmbed(party);
            const button = this.createPartyButton(party);
            
            const content = party.members.length >= party.maxMembers ? '**[마감됨]**' : '';
            
            if (isUpdate && party.embedMessageId) {
                // 기존 메시지 업데이트 시도
                const updated = await this.safeUpdateMessage(channel, party.embedMessageId, {
                    content,
                    embeds: [embed],
                    components: [button]
                });
                
                if (!updated) {
                    // 업데이트 실패 시 새 메시지 생성
                    await this.createNewPartyMessage(channel, party, embed, button);
                }
            } else {
                // 새 메시지 생성
                await this.createNewPartyMessage(channel, party, embed, button);
            }
        } catch (error) {
            logger.error(`Discord 알림 전송 오류: ${error.message}`);
        }
    },
    
    // 새 파티 메시지 생성
    async createNewPartyMessage(channel, party, embed, button) {
        const message = await channel.send({
            embeds: [embed],
            components: [button]
        });
        
        party.embedMessageId = message.id;
        await dataManager.write(`party_${party.id}`, party);
        logger.success(`파티 알림 전송: ${party.title}`);
    },
    
    // 파티 임베드 생성
    async createPartyEmbed(party) {
        const partyConfig = {
            mock_battle: { name: '모의전', icon: '⚔️', color: 0x808080 },
            regular_battle: { name: '정규전', icon: '🔥', color: 0xFF0000 },
            black_claw: { name: '검은발톱', icon: '⚫', color: 0x000000 },
            pk: { name: 'PK', icon: '⚡', color: 0xFFFF00 },
            raid: { name: '레이드', icon: '👑', color: 0xFFD700 },
            training: { name: '훈련', icon: '🎯', color: 0x00FF00 }
        }[party.type];
        
        const startTime = new Date(party.startTime);
        const formattedTime = startTime.toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        const fields = [
            {
                name: '📅 시작 시간',
                value: formattedTime,
                inline: true
            },
            {
                name: '👥 참가 인원',
                value: `${party.members.length}/${party.maxMembers}명`,
                inline: true
            },
            {
                name: '🎯 최소 점수',
                value: `${party.minScore || 0}점`,
                inline: true
            }
        ];
        
        if (party.description) {
            fields.push({
                name: '📝 설명',
                value: party.description,
                inline: false
            });
        }
        
        if (party.requirements && party.requirements.length > 0) {
            fields.push({
                name: '⚠️ 필수 요구사항',
                value: party.requirements,
                inline: false
            });
        }
        
        return createEmbed({
            title: `${partyConfig.icon} ${party.title}`,
            description: `**${partyConfig.name}** 파티가 모집 중입니다!`,
            color: partyConfig.color,
            fields,
            footer: {
                text: `개최자: ${party.createdByName}`
            }
        });
    },
    
    // 파티 버튼 생성
    createPartyButton(party) {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('party_join_web')
                    .setLabel('웹에서 참가하기')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${config.web.url}/party/${party.id}`)
                    .setEmoji('🌐')
                    .setDisabled(party.members.length >= party.maxMembers)
            );
    },
    
    // 인터랙션 처리
    async handleInteraction(interaction, client) {
        if (!interaction.isButton()) return;
        
        if (interaction.customId === 'party_my_stats') {
            await this.showDetailedStats(interaction, client);
        }
    },
    
    // 상세 통계 표시
    async showDetailedStats(interaction, client) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const userId = interaction.user.id;
            const stats = await this.getUserDetailedStats(userId);
            
            const embed = createEmbed({
                title: '📊 상세 전적 정보',
                description: `<@${userId}>님의 전투 기록`,
                color: 0xFF0000,
                guild: interaction.guild,
                fields: [
                    {
                        name: '🏆 총 점수',
                        value: `**${stats.points}**점`,
                        inline: true
                    },
                    {
                        name: '⚔️ 전투 수',
                        value: `**${stats.totalGames}**판`,
                        inline: true
                    },
                    {
                        name: '📈 승률',
                        value: `**${stats.winRate}%**`,
                        inline: true
                    },
                    {
                        name: '✅ 승리',
                        value: `**${stats.wins}**승`,
                        inline: true
                    },
                    {
                        name: '❌ 패배',
                        value: `**${stats.losses}**패`,
                        inline: true
                    },
                    {
                        name: '💀 평균 킬',
                        value: `**${stats.avgKills}**킬`,
                        inline: true
                    }
                ],
                thumbnail: interaction.user.displayAvatarURL({ dynamic: true })
            });
            
            await interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            logger.error(`상세 통계 조회 오류: ${error.message}`);
            await interaction.editReply({ 
                embeds: [errorEmbed('❌ 오류 발생', '통계를 불러올 수 없습니다.')],
                ephemeral: true 
            });
        }
    },
    
    // 사용자 상세 통계 가져오기
    async getUserDetailedStats(userId) {
        const userData = await dataManager.getUserData(`party_user_${userId}`, {
            wins: 0,
            losses: 0,
            totalKills: 0,
            matches: []
        });
        
        const totalGames = userData.wins + userData.losses;
        const winRate = totalGames > 0 ? Math.round((userData.wins / totalGames) * 100) : 0;
        const avgKills = totalGames > 0 ? (userData.totalKills / totalGames).toFixed(1) : 0;
        const points = (userData.wins * 100) + (userData.losses * 50) + userData.totalKills;
        
        return {
            points,
            winRate,
            avgKills,
            totalGames,
            wins: userData.wins,
            losses: userData.losses,
            totalKills: userData.totalKills
        };
    }
};