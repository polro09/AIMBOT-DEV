const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class DataManager {
    constructor() {
        this.dataPath = path.join(process.cwd(), 'data');
        this.cache = new Map();
        this.initializeDataDirectory();
    }
    
    // 데이터 디렉토리 초기화
    async initializeDataDirectory() {
        try {
            await fs.access(this.dataPath);
        } catch {
            await fs.mkdir(this.dataPath, { recursive: true });
            logger.info('📁 데이터 디렉토리가 생성되었습니다.');
        }
    }
    
    // 파일 경로 생성
    getFilePath(filename) {
        if (!filename.endsWith('.json')) {
            filename += '.json';
        }
        return path.join(this.dataPath, filename);
    }
    
    // 데이터 읽기
    async read(filename) {
        try {
            const filePath = this.getFilePath(filename);
            
            // 캐시 확인
            if (this.cache.has(filename)) {
                return this.cache.get(filename);
            }
            
            // 파일 읽기
            const data = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(data);
            
            // 캐시에 저장
            this.cache.set(filename, parsed);
            
            return parsed;
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.debug(`파일이 존재하지 않습니다: ${filename}`);
                return null;
            }
            logger.error(`데이터 읽기 오류: ${filename} - ${error.message}`);
            throw error;
        }
    }
    
    // 데이터 쓰기
    async write(filename, data) {
        try {
            const filePath = this.getFilePath(filename);
            const jsonData = JSON.stringify(data, null, 2);
            
            await fs.writeFile(filePath, jsonData, 'utf8');
            
            // 캐시 업데이트
            this.cache.set(filename, data);
            
            logger.debug(`데이터 저장됨: ${filename}`);
            return true;
        } catch (error) {
            logger.error(`데이터 쓰기 오류: ${filename} - ${error.message}`);
            throw error;
        }
    }
    
    // 데이터 삭제
    async delete(filename) {
        try {
            const filePath = this.getFilePath(filename);
            await fs.unlink(filePath);
            
            // 캐시에서 제거
            this.cache.delete(filename);
            
            logger.debug(`데이터 삭제됨: ${filename}`);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.debug(`삭제할 파일이 없습니다: ${filename}`);
                return false;
            }
            logger.error(`데이터 삭제 오류: ${filename} - ${error.message}`);
            throw error;
        }
    }
    
    // 데이터 존재 확인
    async exists(filename) {
        try {
            const filePath = this.getFilePath(filename);
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    // 서버별 데이터 관리
    async getGuildData(guildId, defaultData = {}) {
        const filename = `guild_${guildId}`;
        let data = await this.read(filename);
        
        if (!data) {
            data = {
                id: guildId,
                createdAt: new Date().toISOString(),
                ...defaultData
            };
            await this.write(filename, data);
        }
        
        return data;
    }
    
    async setGuildData(guildId, data) {
        const filename = `guild_${guildId}`;
        const currentData = await this.getGuildData(guildId);
        const newData = {
            ...currentData,
            ...data,
            updatedAt: new Date().toISOString()
        };
        
        return await this.write(filename, newData);
    }
    
    // 유저별 데이터 관리
    async getUserData(userId, defaultData = {}) {
        const filename = `user_${userId}`;
        let data = await this.read(filename);
        
        if (!data) {
            data = {
                id: userId,
                createdAt: new Date().toISOString(),
                ...defaultData
            };
            await this.write(filename, data);
        }
        
        return data;
    }
    
    async setUserData(userId, data) {
        const filename = `user_${userId}`;
        const currentData = await this.getUserData(userId);
        const newData = {
            ...currentData,
            ...data,
            updatedAt: new Date().toISOString()
        };
        
        return await this.write(filename, newData);
    }
    
    // 캐시 관리
    clearCache() {
        this.cache.clear();
        logger.debug('데이터 캐시가 초기화되었습니다.');
    }
    
    // 백업 생성
    async createBackup() {
        try {
            const backupPath = path.join(process.cwd(), 'backups');
            await fs.mkdir(backupPath, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupDir = path.join(backupPath, `backup_${timestamp}`);
            await fs.mkdir(backupDir);
            
            // 모든 데이터 파일 복사
            const files = await fs.readdir(this.dataPath);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const srcPath = path.join(this.dataPath, file);
                    const destPath = path.join(backupDir, file);
                    await fs.copyFile(srcPath, destPath);
                }
            }
            
            logger.success(`백업 생성 완료: backup_${timestamp}`);
            return `backup_${timestamp}`;
        } catch (error) {
            logger.error(`백업 생성 실패: ${error.message}`);
            throw error;
        }
    }
    
    // 통계 정보
    async getStats() {
        try {
            const files = await fs.readdir(this.dataPath);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            
            let totalSize = 0;
            for (const file of jsonFiles) {
                const filePath = path.join(this.dataPath, file);
                const stats = await fs.stat(filePath);
                totalSize += stats.size;
            }
            
            return {
                fileCount: jsonFiles.length,
                totalSize: totalSize,
                cacheSize: this.cache.size,
                guilds: jsonFiles.filter(f => f.startsWith('guild_')).length,
                users: jsonFiles.filter(f => f.startsWith('user_')).length
            };
        } catch (error) {
            logger.error(`통계 조회 실패: ${error.message}`);
            return null;
        }
    }
}

// 싱글톤 인스턴스 생성 및 내보내기
module.exports = new DataManager();