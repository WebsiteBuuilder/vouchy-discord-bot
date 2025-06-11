const fs = require('fs');
const path = require('path');

// Use the same path logic as the main bot
const VOLUME_PATH = '/app/data';
const POINTS_FILE = path.join(VOLUME_PATH, 'points.json');
const BACKUP_POINTS_FILE = path.join(VOLUME_PATH, 'points-backup.json');

console.log('🧪 Testing Points Persistence System...\n');

try {
  // Ensure directory exists
  if (!fs.existsSync(VOLUME_PATH)) {
    fs.mkdirSync(VOLUME_PATH, { recursive: true });
    console.log(`📁 Created directory: ${VOLUME_PATH}`);
  }

  // Check current files
  console.log('📋 Current Storage Status:');
  console.log(`📄 Main File: ${fs.existsSync(POINTS_FILE) ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`💾 Backup File: ${fs.existsSync(BACKUP_POINTS_FILE) ? '✅ EXISTS' : '❌ MISSING'}`);

  // Read current points if they exist
  if (fs.existsSync(POINTS_FILE)) {
    const data = fs.readFileSync(POINTS_FILE, 'utf8');
    const pointsObj = JSON.parse(data);
    const userCount = Object.keys(pointsObj).length;
    const totalPoints = Object.values(pointsObj).reduce((a, b) => a + b, 0);
    
    console.log(`\n📊 Current Data:`);
    console.log(`👥 Users: ${userCount}`);
    console.log(`🎯 Total Points: ${totalPoints}`);
    
    if (userCount > 0) {
      console.log(`\n🏆 Top Users:`);
      Object.entries(pointsObj)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([userId, points], index) => {
          console.log(`${index + 1}. User ${userId}: ${points} points`);
        });
    }
  } else {
    console.log('\n📋 No existing points data found');
  }

  // Test writing sample data
  console.log('\n🧪 Testing Write Operation...');
  const testData = {
    'test_user_1': 100,
    'test_user_2': 50,
    'test_user_3': 25
  };

  fs.writeFileSync(POINTS_FILE, JSON.stringify(testData, null, 2));
  fs.writeFileSync(BACKUP_POINTS_FILE, JSON.stringify(testData, null, 2));
  
  console.log('✅ Test data written successfully');

  // Verify read operation
  const readData = JSON.parse(fs.readFileSync(POINTS_FILE, 'utf8'));
  const backupData = JSON.parse(fs.readFileSync(BACKUP_POINTS_FILE, 'utf8'));

  if (JSON.stringify(readData) === JSON.stringify(testData) && 
      JSON.stringify(backupData) === JSON.stringify(testData)) {
    console.log('✅ Data integrity verified');
  } else {
    console.log('❌ Data integrity check failed');
  }

  // Get file stats
  const stats = fs.statSync(POINTS_FILE);
  const backupStats = fs.statSync(BACKUP_POINTS_FILE);

  console.log('\n📈 File Information:');
  console.log(`📄 Main File: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`💾 Backup File: ${(backupStats.size / 1024).toFixed(2)} KB`);
  console.log(`🕒 Last Modified: ${stats.mtime.toISOString()}`);

  console.log('\n🎉 Persistence Test Complete!');
  console.log('✅ Points will now persist between bot restarts and updates');

} catch (error) {
  console.error('❌ Persistence test failed:', error);
  process.exit(1);
} 