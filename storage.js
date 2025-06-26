const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class VouchyStorage extends EventEmitter {
    constructor() {
        super();
        // Detect if running on Railway vs local
        this.isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
        
        // Set storage paths based on environment
        if (this.isRailway) {
            // Railway environment - use mounted volume
            this.baseDir = '/app/data';
        } else {
            // Local development - use local data directory
            this.baseDir = path.join(process.cwd(), 'data');
        }
        
        // File paths
        this.pointsFile = path.join(this.baseDir, 'points.json');
        this.backupFile = path.join(this.baseDir, 'points-backup.json');
        this.metadataFile = path.join(this.baseDir, 'points-metadata.json');
        this.gamesFile = path.join(this.baseDir, 'active-games.json');
        this.hotkeysFile = path.join(this.baseDir, 'hotkeys.json');
        this.rouletteFile = path.join(this.baseDir, 'roulette-tables.json');
        
        // In-memory data
        this.points = new Map();
        this.games = new Map();
        this.hotkeys = new Map();
        this.rouletteTables = new Map();
        
        console.log(`🔧 VouchyStorage initialized for ${this.isRailway ? 'RAILWAY' : 'LOCAL'} environment`);
        console.log(`📁 Storage directory: ${this.baseDir}`);
        
        this.ensureDirectoryExists();
        this.loadAllData();
        
        // Auto-save every 30 seconds
        setInterval(() => this.saveAllData(), 30000);
        console.log('💾 Auto-save enabled (every 30 seconds)');
        
        // Save on process exit
        process.on('SIGINT', () => this.gracefulShutdown());
        process.on('SIGTERM', () => this.gracefulShutdown());
    }
    
    ensureDirectoryExists() {
        try {
            if (!fs.existsSync(this.baseDir)) {
                fs.mkdirSync(this.baseDir, { recursive: true });
                console.log(`📁 Created storage directory: ${this.baseDir}`);
            }
        } catch (error) {
            console.error('❌ Failed to create storage directory:', error);
            throw error;
        }
    }
    
    loadAllData() {
        this.loadPoints();
        this.loadGames();
        this.loadHotkeys();
        this.loadRouletteTables();
    }
    
    loadPoints() {
        try {
            // On Railway, prioritize loading from latest backup if available
            if (this.isRailway) {
                const latestBackup = this.findLatestBackup();
                if (latestBackup) {
                    const data = fs.readFileSync(latestBackup, 'utf8');
                    const parsed = JSON.parse(data);
                    this.points = new Map(Object.entries(parsed));
                    console.log(`🎯 RAILWAY: Loaded ${this.points.size} users from latest backup: ${path.basename(latestBackup)}`);
                    this.savePoints(); // Ensure main file is up to date
                    return;
                }
            }
            
            // Try to load from main file first
            if (fs.existsSync(this.pointsFile)) {
                const data = fs.readFileSync(this.pointsFile, 'utf8');
                const parsed = JSON.parse(data);
                this.points = new Map(Object.entries(parsed));
                console.log(`✅ Loaded ${this.points.size} users from ${this.pointsFile}`);
                return;
            }
            
            // Try backup file
            if (fs.existsSync(this.backupFile)) {
                const data = fs.readFileSync(this.backupFile, 'utf8');
                const parsed = JSON.parse(data);
                this.points = new Map(Object.entries(parsed));
                console.log(`🔄 Restored ${this.points.size} users from backup`);
                this.savePoints(); // Restore main file
                return;
            }
            
            // No files exist, start fresh
            console.log('📝 No points file found, starting fresh');
            this.points = new Map();
            this.savePoints();
            
        } catch (error) {
            console.error('❌ Error loading points:', error);
            this.points = new Map();
        }
    }
    
    loadGames() {
        try {
            if (fs.existsSync(this.gamesFile)) {
                const data = fs.readFileSync(this.gamesFile, 'utf8');
                const gamesArray = JSON.parse(data);
                this.games = new Map(gamesArray);
                console.log(`✅ Loaded ${this.games.size} active games`);
            } else {
                this.games = new Map();
            }
        } catch (error) {
            console.error('❌ Error loading games:', error);
            this.games = new Map();
        }
    }
    
    loadHotkeys() {
        try {
            if (fs.existsSync(this.hotkeysFile)) {
                const data = fs.readFileSync(this.hotkeysFile, 'utf8');
                const parsed = JSON.parse(data);
                this.hotkeys = new Map(Object.entries(parsed));
                console.log(`✅ Loaded ${this.hotkeys.size} hotkeys`);
            } else {
                this.hotkeys = new Map();
            }
        } catch (error) {
            console.error('❌ Error loading hotkeys:', error);
            this.hotkeys = new Map();
        }
    }
    
    loadRouletteTables() {
        try {
            if (fs.existsSync(this.rouletteFile)) {
                const data = fs.readFileSync(this.rouletteFile, 'utf8');
                const parsed = JSON.parse(data);
                this.rouletteTables = new Map(Object.entries(parsed));
                console.log(`✅ Loaded ${this.rouletteTables.size} active roulette tables`);
            } else {
                this.rouletteTables = new Map();
            }
        } catch (error) {
            console.error('❌ Error loading roulette tables:', error);
            this.rouletteTables = new Map();
        }
    }
    
    saveAllData() {
        this.savePoints();
        this.saveGames();
        this.saveHotkeys();
        this.saveRouletteTables();
        this.saveMetadata();
    }
    
    savePoints() {
        try {
            const data = JSON.stringify(Object.fromEntries(this.points), null, 2);
            
            // Write to main file
            fs.writeFileSync(this.pointsFile, data);
            
            // Write to backup file
            fs.writeFileSync(this.backupFile, data);
            
            console.log(`💾 Points saved (${this.points.size} users) to ${this.isRailway ? 'RAILWAY' : 'LOCAL'}`);
        } catch (error) {
            console.error('❌ Error saving points:', error);
        }
    }
    
    saveGames() {
        try {
            const gamesArray = Array.from(this.games.entries());
            fs.writeFileSync(this.gamesFile, JSON.stringify(gamesArray, null, 2));
        } catch (error) {
            console.error('❌ Error saving games:', error);
        }
    }
    
    saveHotkeys() {
        try {
            const data = JSON.stringify(Object.fromEntries(this.hotkeys), null, 2);
            fs.writeFileSync(this.hotkeysFile, data);
        } catch (error) {
            console.error('❌ Error saving hotkeys:', error);
        }
    }
    
    saveRouletteTables() {
        try {
            const data = JSON.stringify(Object.fromEntries(this.rouletteTables), null, 2);
            fs.writeFileSync(this.rouletteFile, data);
        } catch (error) {
            console.error('❌ Error saving roulette tables:', error);
        }
    }
    
    saveMetadata() {
        try {
            const metadata = {
                timestamp: Date.now(),
                userCount: this.points.size,
                totalPoints: Array.from(this.points.values()).reduce((sum, points) => sum + points, 0),
                environment: this.isRailway ? 'railway' : 'local',
                version: 'bulletproof-v2',
                storageDir: this.baseDir
            };
            fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
        } catch (error) {
            console.error('❌ Error saving metadata:', error);
        }
    }
    
    // Points management methods
    getPoints(userId) {
        return this.points.get(userId) || 0;
    }
    
    setPoints(userId, amount) {
        this.points.set(userId, Math.max(0, amount));
        this.savePoints();
    }
    
    addPoints(userId, amount) {
        const current = this.getPoints(userId);
        this.setPoints(userId, current + amount);
    }
    
    removePoints(userId, amount) {
        const current = this.getPoints(userId);
        this.setPoints(userId, Math.max(0, current - amount));
    }
    
    hasPoints(userId, amount) {
        return this.getPoints(userId) >= amount;
    }
    
    getAllPoints() {
        // Return a plain object so callers can use Object.keys/entries directly.
        return Object.fromEntries(this.points);
    }
    
    deleteUser(userId) {
        this.points.delete(userId);
        this.savePoints();
    }
    
    // Games management
    getGame(userId) {
        return this.games.get(userId);
    }
    
    setGame(userId, gameData) {
        this.games.set(userId, gameData);
        this.saveGames();
    }
    
    deleteGame(userId) {
        this.games.delete(userId);
        this.saveGames();
    }
    
    // Hotkeys management
    getHotkey(name) {
        return this.hotkeys.get(name);
    }
    
    setHotkey(name, message) {
        this.hotkeys.set(name, message);
        this.saveHotkeys();
    }
    
    deleteHotkey(name) {
        this.hotkeys.delete(name);
        this.saveHotkeys();
    }
    
    getAllHotkeys() {
        // Return plain object for easier usage in command handlers
        return Object.fromEntries(this.hotkeys);
    }
    
    // Roulette Table management
    getRouletteTable(channelId) {
        return this.rouletteTables.get(channelId);
    }
    
    setRouletteTable(channelId, tableData) {
        this.rouletteTables.set(channelId, tableData);
        this.saveRouletteTables();
    }
    
    deleteRouletteTable(channelId) {
        this.rouletteTables.delete(channelId);
        this.saveRouletteTables();
    }
    
    // Utility methods
    getStats() {
        return {
            userCount: this.points.size,
            totalPoints: Array.from(this.points.values()).reduce((sum, points) => sum + points, 0),
            activeGames: this.games.size,
            activeRouletteTables: this.rouletteTables.size,
            hotkeys: this.hotkeys.size,
            environment: this.isRailway ? 'Railway' : 'Local',
            storageDir: this.baseDir
        };
    }
    
    gracefulShutdown() {
        console.log('🔄 Graceful shutdown - saving all data...');
        this.saveAllData();
        console.log('💾 All data saved successfully');
        process.exit(0);
    }
    
    // Force backup creation
    createBackup() {
        this.saveAllData();
        const stats = this.getStats();
        console.log('📊 Backup created:', stats);
        return stats;
    }

    // Find the most recent backup file based on modification time
    findLatestBackup() {
        try {
            const backupFiles = [
                this.backupFile,
                path.join(this.baseDir, 'points-emergency.json'),
                path.join(this.baseDir, 'points-recovery.json')
            ].filter(file => fs.existsSync(file));

            if (backupFiles.length === 0) return null;

            // Read all backups and get their stats
            const sortedBackups = backupFiles
                .map(file => {
                    try {
                        const content = fs.readFileSync(file, 'utf8');
                        // Handle case where file might be empty string
                        if (!content.trim()) {
                           return { path: file, mtime: new Date(0), userCount: 0 };
                        }
                        const data = JSON.parse(content);
                        const userCount = Object.keys(data).length;
                        return {
                            path: file,
                            mtime: fs.statSync(file).mtime,
                            userCount: userCount
                        };
                    } catch (e) {
                        // File might be corrupted or not valid JSON, ignore it
                        console.error(`Could not parse backup file ${file}, skipping.`, e);
                        return { path: file, mtime: new Date(0), userCount: 0 };
                    }
                })
                // Prioritize backups with more users, then by most recent date
                .sort((a, b) => {
                    if (a.userCount !== b.userCount) {
                        return b.userCount - a.userCount; // More users first
                    }
                    return b.mtime - a.mtime; // Then newest first
                });
            
            const bestBackup = sortedBackups[0];
            if (bestBackup.userCount === 0) {
                 console.log(`⚠️ All available backups appear to be empty. Choosing latest modified anyway.`);
            }

            console.log(`📊 Found ${sortedBackups.length} backup files. Best choice: ${path.basename(bestBackup.path)} with ${bestBackup.userCount} users.`);
            return bestBackup.path;

        } catch (error) {
            console.error('❌ Error finding latest backup:', error);
            return null;
        }
    }

    forceReloadFromBackup() {
        console.log('🔄 Admin triggered force reload from backup...');
        const latestBackup = this.findLatestBackup();
        if (latestBackup) {
            try {
                const data = fs.readFileSync(latestBackup, 'utf8');
                const parsed = JSON.parse(data);
                this.points = new Map(Object.entries(parsed));
                console.log(`✅ Force reloaded ${this.points.size} users from ${path.basename(latestBackup)}`);
                // Immediately save the reloaded data to the primary file to ensure consistency
                this.savePoints();
                return { success: true, count: this.points.size, file: path.basename(latestBackup) };
            } catch (error) {
                console.error('❌ Failed to parse or load backup file during force reload:', error);
                return { success: false, error: 'Failed to read or parse backup file.' };
            }
        } else {
            console.log('❌ No backup files found during force reload attempt.');
            return { success: false, error: 'No backup files were found.' };
        }
    }

    findAvailableBackups() {
        try {
            const files = fs.readdirSync(this.baseDir);
            const backupFiles = files.filter(file => 
                file.startsWith('points-backup') && file.endsWith('.json')
            );
            
            const backupInfo = [];
            for (const file of backupFiles) {
                try {
                    const filePath = path.join(this.baseDir, file);
                    const stats = fs.statSync(filePath);
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    if (content.trim()) {
                        const data = JSON.parse(content);
                        const userCount = Object.keys(data).length;
                        const totalPoints = Object.values(data).reduce((a, b) => a + b, 0);
                        
                        backupInfo.push({
                            filename: file,
                            userCount: userCount,
                            totalPoints: totalPoints,
                            size: stats.size,
                            modified: stats.mtime
                        });
                    }
                } catch (e) {
                    console.log(`Skipping corrupted backup file: ${file}`);
                }
            }
            
            // Sort by most recent first
            backupInfo.sort((a, b) => b.modified - a.modified);
            
            return backupInfo;
        } catch (error) {
            console.error('Error finding backups:', error);
            return [];
        }
    }

    restoreFrom(filename) {
        const sourcePath = path.join(this.baseDir, filename);

        if (!fs.existsSync(sourcePath)) {
            const error = `Backup file not found: ${filename}`;
            console.error(`❌ ${error}`);
            return { success: false, error: error, userCount: 0 };
        }

        try {
            console.log(`[RESTORE] Attempting to restore from ${filename}...`);
            const data = fs.readFileSync(sourcePath, 'utf8');
            if (!data.trim()) {
                const error = `Backup file is empty: ${filename}`;
                console.warn(`⚠️ ${error}`);
                return { success: false, error: error, userCount: 0 };
            }

            const pointsObj = JSON.parse(data);
            const userIds = Object.keys(pointsObj);
            const userCount = userIds.length;
            const totalPoints = Object.values(pointsObj).reduce((a, b) => a + b, 0);
            console.log(`[RESTORE] Parsed ${filename}, found ${userCount} users with ${totalPoints} total points.`);

            // Clear current points and games before loading new data
            this.points.clear();
            this.games.clear();
            console.log(`[RESTORE] Cleared existing points and games.`);

            // Load new points from the restored object
            let restoredCount = 0;
            for (const userId of userIds) {
                const points = parseInt(pointsObj[userId], 10);
                if (!isNaN(points)) {
                    this.points.set(userId, points);
                    restoredCount++;
                }
            }
            console.log(`[RESTORE] Successfully loaded points for ${restoredCount}/${userCount} users.`);

            // Overwrite main points file and backup with this known-good data
            const restoredData = JSON.stringify(Object.fromEntries(this.points), null, 2);
            fs.writeFileSync(this.pointsFile, restoredData);
            fs.writeFileSync(this.backupFile, restoredData);
            console.log(`[RESTORE] Synced main points file and backup with restored data.`);

            this.emit('reload', this.points);
            return { success: true, userCount: this.points.size, totalPoints: totalPoints };
        } catch (error) {
            console.error(`❌ Critical error restoring from ${filename}:`, error);
            return { success: false, error: error.message, userCount: 0 };
        }
    }

    backup() {
        try {
            const pointsObj = Object.fromEntries(this.points);
            const backupData = JSON.stringify(pointsObj, null, 2);
            
            // Save to main backup file
            fs.writeFileSync(this.backupFile, backupData);
            
            // Create a timestamped backup for extra safety
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const timestampedBackup = path.join(this.baseDir, `points-backup-${timestamp}.json`);
            fs.writeFileSync(timestampedBackup, backupData);
            
            // Update metadata
            const metadata = {
                timestamp: Date.now(),
                userCount: this.points.size,
                totalPoints: Array.from(this.points.values()).reduce((a, b) => a + b, 0),
                version: "bulletproof-v3",
                backupFiles: [path.basename(this.backupFile), path.basename(timestampedBackup)]
            };
            fs.writeFileSync(path.join(this.baseDir, 'points-metadata.json'), JSON.stringify(metadata, null, 2));
            
            console.log(`💾 Backup created: ${this.points.size} users, ${metadata.totalPoints} total points`);
            console.log(`📁 Backup files: ${path.basename(this.backupFile)}, ${path.basename(timestampedBackup)}`);
            
            return { success: true, userCount: this.points.size, totalPoints: metadata.totalPoints };
        } catch (error) {
            console.error('❌ Backup failed:', error);
            return { success: false, error: error.message };
        }
    }

    clearAllPoints() {
        try {
            const userCount = this.points.size;
            const totalPoints = Array.from(this.points.values()).reduce((a, b) => a + b, 0);
            
            // Clear all points
            this.points.clear();
            this.games.clear();
            
            // Save empty points to files
            const emptyData = JSON.stringify({}, null, 2);
            fs.writeFileSync(this.pointsFile, emptyData);
            fs.writeFileSync(this.backupFile, emptyData);
            
            // Update metadata
            const metadata = {
                timestamp: Date.now(),
                userCount: 0,
                totalPoints: 0,
                version: "bulletproof-v3",
                action: "cleared_all_points"
            };
            fs.writeFileSync(path.join(this.baseDir, 'points-metadata.json'), JSON.stringify(metadata, null, 2));
            
            console.log(`🗑️ Cleared all points: ${userCount} users, ${totalPoints} total points`);
            this.emit('reload', this.points);
            
            return { success: true, clearedUsers: userCount, clearedPoints: totalPoints };
        } catch (error) {
            console.error('❌ Clear points failed:', error);
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance
module.exports = new VouchyStorage(); 