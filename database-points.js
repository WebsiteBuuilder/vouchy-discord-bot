const { Pool } = require('pg');

// Database connection
let pool;

// Initialize database connection
function initDatabase() {
  if (process.env.DATABASE_URL) {
    // Use PostgreSQL database (Railway)
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Create points table if it doesn't exist
    initTable();
    console.log('Connected to PostgreSQL database');
  } else {
    console.log('No DATABASE_URL found, using file storage fallback');
  }
}

// Create the points table
async function initTable() {
  if (!pool) return;
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_points (
        user_id VARCHAR(20) PRIMARY KEY,
        points INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Points table initialized');
  } catch (error) {
    console.error('Error creating points table:', error);
  }
}

/**
 * Get points for a user
 * @param {string} userId - Discord user ID
 * @returns {Promise<number>} User's point balance
 */
async function getUserPoints(userId) {
  if (!pool) return 0;
  
  try {
    const result = await pool.query('SELECT points FROM user_points WHERE user_id = $1', [userId]);
    return result.rows.length > 0 ? result.rows[0].points : 0;
  } catch (error) {
    console.error('Database error in getUserPoints:', error);
    return 0;
  }
}

/**
 * Set points for a user
 * @param {string} userId - Discord user ID
 * @param {number} amount - Points amount to set
 */
async function setUserPoints(userId, amount) {
  if (!pool) return;
  
  const safeAmount = Math.max(0, amount);
  try {
    await pool.query(`
      INSERT INTO user_points (user_id, points, updated_at) 
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) 
      DO UPDATE SET points = $2, updated_at = CURRENT_TIMESTAMP
    `, [userId, safeAmount]);
  } catch (error) {
    console.error('Database error in setUserPoints:', error);
  }
}

/**
 * Add points to a user
 * @param {string} userId - Discord user ID
 * @param {number} amount - Points to add
 * @returns {Promise<number>} New point balance
 */
async function addUserPoints(userId, amount) {
  if (!pool) return 0;
  
  try {
    const result = await pool.query(`
      INSERT INTO user_points (user_id, points) 
      VALUES ($1, $2)
      ON CONFLICT (user_id) 
      DO UPDATE SET points = user_points.points + $2
      RETURNING points
    `, [userId, amount]);
    
    return result.rows[0].points;
  } catch (error) {
    console.error('Database error in addUserPoints:', error);
    return 0;
  }
}

/**
 * Remove points from a user
 * @param {string} userId - Discord user ID
 * @param {number} amount - Points to remove
 * @returns {Promise<number>} New point balance
 */
async function removeUserPoints(userId, amount) {
  if (!pool) return 0;
  
  try {
    const result = await pool.query(`
      UPDATE user_points 
      SET points = GREATEST(0, points - $2)
      WHERE user_id = $1
      RETURNING points
    `, [userId, amount]);
    
    if (result.rows.length === 0) {
      return 0;
    }
    
    return result.rows[0].points;
  } catch (error) {
    console.error('Database error in removeUserPoints:', error);
    return 0;
  }
}

/**
 * Check if user has enough points
 * @param {string} userId - Discord user ID
 * @param {number} amount - Amount to check
 * @returns {Promise<boolean>} True if user has enough points
 */
async function hasEnoughPoints(userId, amount) {
  const points = await getUserPoints(userId);
  return points >= amount;
}

/**
 * Get leaderboard
 * @param {number} limit - Number of users to return
 * @returns {Promise<Array>} Array of {userId, points} objects
 */
async function getLeaderboard(limit = 10) {
  if (!pool) return [];
  
  try {
    const result = await pool.query(`
      SELECT user_id as "userId", points 
      FROM user_points 
      ORDER BY points DESC 
      LIMIT $1
    `, [limit]);
    
    return result.rows;
  } catch (error) {
    console.error('Database error in getLeaderboard:', error);
    return [];
  }
}

/**
 * Delete a user's points
 * @param {string} userId - Discord user ID
 */
async function deleteUser(userId) {
  if (!pool) return;
  
  try {
    await pool.query('DELETE FROM user_points WHERE user_id = $1', [userId]);
  } catch (error) {
    console.error('Database error in deleteUser:', error);
  }
}

// Initialize database on module load
initDatabase();

module.exports = {
  getUserPoints,
  setUserPoints,
  addUserPoints,
  removeUserPoints,
  hasEnoughPoints,
  getLeaderboard,
  deleteUser,
  initDatabase
}; 