const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { createEmbed, successEmbed, errorEmbed } = require('../utils/embedBuilder');
const logger = require('../utils/logger');
const dataManager = require('../utils/dataManager');

// 설정 (상단에서 쉽게 수정 가능)
const CONFIG = {
    // 채널 ID
    CHANNEL_IDS: {
        partyList: process.env.PARTY_LIST_CHANNEL_ID || '1234567890', // 파티 목록이 표시될 채널
        partyNotice: process.env.PARTY_NOTICE_CHANNEL_ID || '1376106637177126922' // 파티 알림 채널
    },
    
    // 역할 ID
    ROLE_IDS: {
        member: '1357924680',
        noble: '2468013579', // 귀족 역할
        admin: '9876543210'
    },
    
    // 점수 설정
    POINTS: {
        win: 100,
        lose: 50,
        killPerPoint: 1
    },
    
    // 기타 설정
    PREFIX: '!',
    WEB_URL: process.env.WEB_URL || 'http://localhost:3000',
    
    // 임베드 메시지 ID 저장 (업데이트용)
    embedMessages: new Map()
};

// 모듈 정보
module.exports = {
    name: 'party',
    description: '파티 모집 시스템',
    version: '2.0.0',
    author: 'aimdot.dev',
    
    // 모듈 초기화
    async init(client) {
        logger.module(`${this.name} 모듈이 초기화되었습니다.`);
        
        // 메시지 이벤트 리스너 등록
        client.on('messageCreate', (message) => this.handleMessage(message, client));
        
        // 인터랙션 이벤트 리스너 등록
        client.on('interactionCreate', (interaction) => this.handleInteraction(interaction, client));
        
        // 웹 API 이벤트 처리 (웹서버와 연동)
        this.initWebAPI(client);
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
                               '! 훈련 - 병과별 전문 훈련\n' +
                               '```',
                        inline: false
                    },
                    {
                        name: '🛡️ 병과 시스템',
                        value: '**일반 병과**\n' +
                               '> 방패보병, 폴암보병, 궁수, 석궁병, 창기병, 궁기병\n\n' +
                               '**귀족 병과** *(특별 권한 필요)*\n' +
                               '> 귀족 궁수, 귀족 창기병, 귀족 궁기병',
                        inline: true
                    },
                    {
                        name: '🏰 국가 선택',
                        value: '> 제국\n> 블란디아\n> 아세라이\n> 바타니아\n> 스터지아',
                        inline: true
                    },
                    {
                        name: '💡 대기실 시스템',
                        value: '```yaml\n' +
                               '1. 파티 참여 시 대기실로 입장\n' +
                               '2. 병과와 국가 선택\n' +
                               '3. 개최자가 팀 배정\n' +
                               '4. 전투 준비 완료!\n' +
                               '```',
                        inline: false
                    }
                ],
                thumbnail: 'https://i.imgur.com/6G5xYJJ.png',
                image: 'https://i.imgur.com/AxeBESV.png'
            });
            
            // 버튼 액션
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('파티 생성하기')
                        .setStyle(ButtonStyle.Link)
                        .setURL(`${CONFIG.WEB_URL}/party/create`)
                        .setEmoji('➕'),
                    new ButtonBuilder()
                        .setLabel('모집 중인 파티')
                        .setStyle(ButtonStyle.Link)
                        .setURL(`${CONFIG.WEB_URL}/party`)
                        .setEmoji('📋'),
                    new ButtonBuilder()
                        .setCustomId('party_my_stats')
                        .setLabel('내 전적 확인')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📊')
                );
            
            await message.reply({
                embeds: [embed],
                components: [buttons]
            });
            
            logger.success(`파티 모집 메뉴 실행: ${message.author.tag}`);
        } catch (error) {
            logger.error(`파티 모집 메뉴 오류: ${error.message}`);
            await message.reply({ embeds: [errorEmbed('❌ 오류 발생', '파티 모집 메뉴를 표시할 수 없습니다.', { guild: message.guild })] });
        }
    },
    
    // 인터랙션 처리
    async handleInteraction(interaction, client) {
        if (interaction.isButton()) {
            if (interaction.customId === 'party_my_stats') {
                await this.showDetailedStats(interaction, client);
            }
        }
    },
    
    // 상세 통계 표시 (ephemeral)
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
                    },
                    {
                        name: '🎯 총 킬수',
                        value: `**${stats.totalKills}**킬`,
                        inline: true
                    },
                    {
                        name: '🏅 랭킹',
                        value: `**${stats.ranking}**위`,
                        inline: true
                    },
                    {
                        name: '📅 최근 전투',
                        value: stats.recentMatches || '기록 없음',
                        inline: false
                    }
                ],
                thumbnail: interaction.user.displayAvatarURL({ dynamic: true })
            });
            
            await interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            logger.error(`상세 통계 조회 오류: ${error.message}`);
            await interaction.editReply({ 
                embeds: [errorEmbed('❌ 오류 발생', '통계를 불러올 수 없습니다.', { guild: interaction.guild })],
                ephemeral: true 
            });
        }
    },
    
    // Discord 알림 전송 및 업데이트
    async sendOrUpdatePartyNotice(party, client, isUpdate = false) {
        try {
            const channel = client.channels.cache.get(CONFIG.CHANNEL_IDS.partyNotice);
            if (!channel) return;
            
            const partyConfig = {
                mock_battle: { name: '모의전', icon: '⚔️', color: 0x808080 },
                regular_battle: { name: '정규전', icon: '🔥', color: 0xFF0000 },
                black_claw: { name: '검은발톱', icon: '⚫', color: 0x000000 },
                pk: { name: 'PK', icon: '⚡', color: 0xFFFF00 },
                raid: { name: '레이드', icon: '👑', color: 0xFFD700 },
                training: { name: '훈련', icon: '🎯', color: 0x00FF00 }
            }[party.type];
            
            // 시간 포맷팅
            const startTime = new Date(party.startTime);
            const formattedTime = startTime.toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            // 시간 남은 계산
            const now = new Date();
            const timeDiff = startTime - now;
            const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60));
            const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            let timeLeftText = '';
            if (timeDiff > 0) {
                if (hoursLeft > 0) {
                    timeLeftText = `⏰ **${hoursLeft}시간 ${minutesLeft}분 후 시작**`;
                } else {
                    timeLeftText = `⏰ **${minutesLeft}분 후 시작**`;
                }
            } else {
                timeLeftText = '🚨 **진행 중**';
            }
            
            // 개최자 전적 가져오기
            const creatorStats = await this.getUserDetailedStats(party.createdBy);
            
            // 참가자 목록 생성
            const waitingRoom = party.members.filter(m => !m.team || m.team === 0);
            const team1 = party.members.filter(m => m.team === 1);
            const team2 = party.members.filter(m => m.team === 2);
            
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: process.env.EMBED_AUTHOR_NAME || 'Aimbot.DEV',
                    iconURL: process.env.EMBED_AUTHOR_ICON || 'https://imgur.com/Sd8qK9c.gif'
                })
                .setTitle(`${partyConfig.icon} **${partyConfig.name}** 파티 모집!`)
                .setDescription(`## ${party.title}\n${timeLeftText}\n\n> ${party.description}`)
                .setColor(partyConfig.color)
                .addFields([
                    {
                        name: '👤 개최자',
                        value: `**${party.createdByName}**\n` +
                               `└ 점수: ${creatorStats.points}점\n` +
                               `└ 승률: ${creatorStats.winRate}%\n` +
                               `└ 평균킬: ${creatorStats.avgKills}`,
                        inline: true
                    },
                    {
                        name: '📅 시작 시간',
                        value: `**${formattedTime}**\n` +
                               `└ 모집 인원: ${party.members.length}/${party.maxMembers}명\n` +
                               `└ 상태: ${party.members.length >= party.maxMembers ? '❌ 마감' : '✅ 모집중'}`,
                        inline: true
                    },
                    {
                        name: '🎮 파티 정보',
                        value: `└ 타입: **${partyConfig.name}**\n` +
                               `└ 최소점수: ${party.minScore > 0 ? party.minScore + '점' : '제한없음'}\n` +
                               `└ 생성시간: <t:${Math.floor(new Date(party.createdAt).getTime() / 1000)}:R>`,
                        inline: true
                    }
                ])
                .setThumbnail('https://i.imgur.com/6G5xYJJ.png')
                .setFooter({
                    text: process.env.EMBED_FOOTER_TEXT || '🔺DEUS VULT',
                    iconURL: channel.guild.iconURL({ dynamic: true })
                })
                .setTimestamp();
            
            // 참가 조건
            if (party.requirements) {
                embed.addFields({ 
                    name: '📋 참가 조건', 
                    value: `\`\`\`${party.requirements}\`\`\``, 
                    inline: false 
                });
            }
            
            // 대기실 표시
            if (waitingRoom.length > 0) {
                const waitingList = waitingRoom.map(m => {
                    const classIcon = m.selectedClassInfo?.icon || '❓';
                    const className = m.selectedClassInfo?.name || '미선택';
                    const nationName = m.selectedNationInfo?.name || '미선택';
                    const stats = m.stats || { points: 0, winRate: 0 };
                    return `${classIcon} **${m.username}** - ${className} (${nationName})\n└ ${stats.points}점 | 승률: ${stats.winRate}%`;
                }).join('\n\n');
                embed.addFields({ 
                    name: `🏠 대기실 (${waitingRoom.length}명)`, 
                    value: waitingList.substring(0, 1024) || '없음', 
                    inline: false 
                });
            }
            
            // 팀별 멤버 표시
            if (party.type === 'mock_battle' || party.type === 'regular_battle' || party.type === 'training') {
                const team1Text = team1.length > 0 ? team1.map(m => {
                    const classIcon = m.selectedClassInfo?.icon || '❓';
                    const className = m.selectedClassInfo?.name || '미선택';
                    const stats = m.stats || { points: 0, winRate: 0 };
                    return `${classIcon} **${m.username}**\n└ ${className} (${stats.points}점)`;
                }).join('\n\n') : '대기 중...';
                
                const team2Text = team2.length > 0 ? team2.map(m => {
                    const classIcon = m.selectedClassInfo?.icon || '❓';
                    const className = m.selectedClassInfo?.name || '미선택';
                    const stats = m.stats || { points: 0, winRate: 0 };
                    return `${classIcon} **${m.username}**\n└ ${className} (${stats.points}점)`;
                }).join('\n\n') : '대기 중...';
                
                embed.addFields(
                    { 
                        name: `🔴 1팀 (${team1.length}/5)`, 
                        value: team1Text.substring(0, 1024), 
                        inline: true 
                    },
                    { 
                        name: `🔵 2팀 (${team2.length}/5)`, 
                        value: team2Text.substring(0, 1024), 
                        inline: true 
                    }
                );
            } else {
                // 단일 팀인 경우
                const teamMembers = party.members.filter(m => m.team === 1);
                if (teamMembers.length > 0 || party.members.length > 0) {
                    const teamList = (teamMembers.length > 0 ? teamMembers : party.members).map(m => {
                        const classIcon = m.selectedClassInfo?.icon || '❓';
                        const className = m.selectedClassInfo?.name || '미선택';
                        const nationName = m.selectedNationInfo?.name || '미선택';
                        const stats = m.stats || { points: 0, winRate: 0 };
                        return `${classIcon} **${m.username}** - ${className} (${nationName})\n└ ${stats.points}점 | 승률: ${stats.winRate}% | 평균킬: ${stats.avgKills || 0}`;
                    }).join('\n\n');
                    embed.addFields({ 
                        name: `⚔️ 참가자 (${teamMembers.length || party.members.length}/${party.maxMembers})`, 
                        value: teamList.substring(0, 1024) || '없음', 
                        inline: false 
                    });
                }
            }
            
            // 현재 파티 통계
            if (party.members.length > 0) {
                const avgPoints = Math.round(party.members.reduce((sum, m) => sum + (m.stats?.points || 0), 0) / party.members.length);
                const avgWinRate = Math.round(party.members.reduce((sum, m) => sum + (m.stats?.winRate || 0), 0) / party.members.length);
                
                embed.addFields({
                    name: '📊 파티 평균 스탯',
                    value: `평균 점수: **${avgPoints}점** | 평균 승률: **${avgWinRate}%**`,
                    inline: false
                });
            }
            
            // 이미지 설정
            if (party.members.length >= party.maxMembers) {
                embed.setImage('https://i.imgur.com/YourFullImage.png'); // 마감 이미지
            } else {
                embed.setImage('https://i.imgur.com/AxeBESV.png'); // 모집 중 이미지
            }
            
            const button = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('파티 참여하기')
                        .setStyle(ButtonStyle.Link)
                        .setURL(`${CONFIG.WEB_URL}/party/${party.id}`)
                        .setEmoji('🔗')
                        .setDisabled(party.members.length >= party.maxMembers)
                );
            
            // 히얼 역할 찾기
            const hereRole = channel.guild.roles.cache.find(role => role.name === '히얼' || role.name === '@here');
            const mentionContent = hereRole ? `<@&${hereRole.id}>` : '@here';
            
            if (isUpdate && CONFIG.embedMessages.has(party.id)) {
                // 기존 메시지 업데이트
                const messageId = CONFIG.embedMessages.get(party.id);
                try {
                    const message = await channel.messages.fetch(messageId);
                    await message.edit({
                        content: party.members.length >= party.maxMembers ? '**[마감됨]**' : mentionContent,
                        embeds: [embed],
                        components: [button]
                    });
                } catch (error) {
                    logger.error(`메시지 업데이트 실패: ${error.message}`);
                    // 실패 시 새 메시지 전송
                    const message = await channel.send({
                        content: mentionContent,
                        embeds: [embed],
                        components: [button]
                    });
                    CONFIG.embedMessages.set(party.id, message.id);
                }
            } else {
                // 새 메시지 전송
                const message = await channel.send({
                    content: mentionContent,
                    embeds: [embed],
                    components: [button]
                });
                CONFIG.embedMessages.set(party.id, message.id);
            }
        } catch (error) {
            logger.error(`Discord 알림 전송 오류: ${error.message}`);
        }
    },
    
    // 웹 API 초기화
    initWebAPI(client) {
        // 웹 서버의 API 엔드포인트 추가
        try {
            const { app } = require('../web/server');
            
            if (!app) {
                logger.warn('웹 서버가 초기화되지 않았습니다.');
                return;
            }
            
            // 파티 생성 웹훅
            app.post('/api/party/create', async (req, res, next) => {
                // 인증 체크는 웹서버에서 처리
                if (!req.user) return next();
                
                try {
                    const partyData = req.body;
                    const party = await this.createParty(partyData, req.user, client);
                    
                    res.json({ success: true, partyId: party.id });
                } catch (error) {
                    logger.error(`파티 생성 API 오류: ${error.message}`);
                    res.status(500).json({ success: false, error: error.message });
                }
            });
            
            // 파티 업데이트 웹훅
            app.post('/api/party/update/:partyId', async (req, res, next) => {
                if (!req.user) return next();
                
                try {
                    const party = await dataManager.read(`party_${req.params.partyId}`);
                    if (party) {
                        await this.sendOrUpdatePartyNotice(party, client, true);
                    }
                    res.json({ success: true });
                } catch (error) {
                    logger.error(`파티 업데이트 API 오류: ${error.message}`);
                    res.status(500).json({ success: false, error: error.message });
                }
            });
        } catch (error) {
            logger.warn(`웹 API 초기화 건너뜀: ${error.message}`);
        }
    },
    
    // 파티 생성
    async createParty(partyData, user, client) {
        const partyId = Date.now().toString();
        const party = {
            id: partyId,
            ...partyData,
            createdBy: user.id,
            createdByName: user.username,
            createdAt: new Date().toISOString(),
            members: [],
            status: 'recruiting'
        };
        
        // 파티 데이터 저장
        await dataManager.write(`party_${partyId}`, party);
        
        // Discord 채널에 알림
        await this.sendOrUpdatePartyNotice(party, client, false);
        
        logger.success(`새 파티 생성: ${party.title} (${partyId})`);
        return party;
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
        const points = (userData.wins * CONFIG.POINTS.win) + (userData.losses * CONFIG.POINTS.lose) + (userData.totalKills * CONFIG.POINTS.killPerPoint);
        
        // 최근 5경기
        const recentMatches = userData.matches.slice(-5).reverse().map(match => 
            `${match.date} - ${match.result} (${match.kills}킬)`
        ).join('\n');
        
        // 랭킹 계산
        const ranking = await this.calculateRanking(userId, points);
        
        return {
            points,
            totalGames,
            winRate,
            wins: userData.wins,
            losses: userData.losses,
            avgKills,
            totalKills: userData.totalKills,
            ranking,
            recentMatches: recentMatches || '기록 없음'
        };
    },
    
    // 랭킹 계산
    async calculateRanking(userId, userPoints) {
        const files = await require('fs').promises.readdir(require('path').join(process.cwd(), 'data'));
        const allUsers = [];
        
        for (const file of files) {
            if (file.startsWith('user_party_user_') && file.endsWith('.json')) {
                const userData = await dataManager.read(file.replace('.json', ''));
                if (userData) {
                    const totalGames = userData.wins + userData.losses;
                    const points = (userData.wins * CONFIG.POINTS.win) + (userData.losses * CONFIG.POINTS.lose) + (userData.totalKills * CONFIG.POINTS.killPerPoint);
                    allUsers.push({ userId: userData.id, points });
                }
            }
        }
        
        allUsers.sort((a, b) => b.points - a.points);
        const ranking = allUsers.findIndex(u => u.userId === `party_user_${userId}`) + 1;
        
        return ranking || allUsers.length + 1;
    },
    
    // 모듈 실행
    async execute(client) {
        // 이벤트 기반이므로 비워둠
    }
};