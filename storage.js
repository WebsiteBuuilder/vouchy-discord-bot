const fs = require('fs');
const path = require('path');

class VouchyStorage {
    constructor() {
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
        
        // In-memory data
        this.points = new Map();
        this.games = new Map();
        this.hotkeys = new Map();
        
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
    }
    
    loadPoints() {
        try {
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
    
    saveAllData() {
        this.savePoints();
        this.saveGames();
        this.saveHotkeys();
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
        return new Map(this.points);
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
        return new Map(this.hotkeys);
    }
    
    // Utility methods
    getStats() {
        return {
            userCount: this.points.size,
            totalPoints: Array.from(this.points.values()).reduce((sum, points) => sum + points, 0),
            activeGames: this.games.size,
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
}

// Export singleton instance
module.exports = new VouchyStorage(); 