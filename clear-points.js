const fs = require('fs');
const path = require('path');

// Use the same path logic as the main bot
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/app/data';
const POINTS_FILE = path.join(VOLUME_PATH, 'points.json');

console.log('🗑️ Clearing points data to start fresh...');

try {
  // Ensure the directory exists
  if (!fs.existsSync(VOLUME_PATH)) {
    fs.mkdirSync(VOLUME_PATH, { recursive: true });
    console.log(`✅ Created directory: ${VOLUME_PATH}`);
  }

  // Create empty points file
  const emptyPoints = {};
  fs.writeFileSync(POINTS_FILE, JSON.stringify(emptyPoints, null, 2));
  
  console.log(`✅ Points data cleared successfully!`);
  console.log(`📍 File location: ${POINTS_FILE}`);
  console.log('🚀 Ready to start tracking points from scratch!');
  
} catch (error) {
  console.error('❌ Error clearing points:', error);
} 