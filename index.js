const { Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// UNBREAKABLE PERSISTENCE SYSTEM - Multiple redundant storage locations
const STORAGE_STRATEGY = {
  // Railway volume mount (if available)
  railway: '/app/data',
  // Local project directory (always works)
  local: './data',
  // Root project directory (fallback)
  root: './',
  // System temp (emergency)
  temp: '/tmp',
  // Railway's persistent storage environment variable path
  railwayPersistent: process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data'
};

const BACKUP_FILES = ['points.json', 'points-backup.json', 'points-emergency.json', 'points-recovery.json'];
let ACTIVE_STORAGE_PATHS = [];
let SUCCESSFUL_SAVE_LOCATIONS = [];

// Initialize unbreakable storage system
function initializeUnbreakableStorage() {
  console.log('🛡️ Initializing UNBREAKABLE storage system...');
  
  ACTIVE_STORAGE_PATHS = [];
  
  // Test all storage locations
  Object.entries(STORAGE_STRATEGY).forEach(([name, location]) => {
    try {
      // Ensure directory exists
      if (!fs.existsSync(location)) {
        fs.mkdirSync(location, { recursive: true });
      }
      
      // Test write permissions with unique test file
      const testFile = path.join(location, `test-${Date.now()}.json`);
      const testData = { test: true, timestamp: Date.now(), location: name };
      fs.writeFileSync(testFile, JSON.stringify(testData));
      
      // Test read permissions
      const readData = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      
      // Clean up test file
      fs.unlinkSync(testFile);
      
      // This location is working
      ACTIVE_STORAGE_PATHS.push({ name, path: location });
      console.log(`✅ Storage location "${name}" active: ${location}`);
      
    } catch (error) {
      console.log(`❌ Storage location "${name}" failed: ${location} - ${error.message}`);
    }
  });
  
  if (ACTIVE_STORAGE_PATHS.length === 0) {
    console.error('💥 CRITICAL: NO STORAGE LOCATIONS AVAILABLE!');
    throw new Error('Cannot initialize storage - no writable locations found');
  }
  
  console.log(`🔒 ${ACTIVE_STORAGE_PATHS.length} storage locations active and ready`);
  return true;
}

const vouchPoints = new Map();

// UNBREAKABLE POINTS LOADING - scans ALL locations for data
function loadPointsUnbreakable() {
  console.log('📥 Loading points with UNBREAKABLE system...');
  
  if (ACTIVE_STORAGE_PATHS.length === 0) {
    initializeUnbreakableStorage();
  }
  
  let pointsLoaded = false;
  let bestDataSource = null;
  let maxPointsFound = 0;
  
  // Scan ALL storage locations for point files
  for (const storage of ACTIVE_STORAGE_PATHS) {
    for (const filename of BACKUP_FILES) {
      const filePath = path.join(storage.path, filename);
      
      try {
        if (fs.existsSync(filePath)) {
          console.log(`🔍 Scanning: ${storage.name}/${filename}`);
          
          const data = fs.readFileSync(filePath, 'utf8');
          if (!data.trim()) {
            console.log(`⚠️ Empty file: ${filePath}`);
            continue;
          }
          
          const pointsData = JSON.parse(data);
          let userCount = 0;
          let totalPoints = 0;
          
          // Count users and points to find the best data source
          if (Array.isArray(pointsData)) {
            userCount = pointsData.length;
            totalPoints = pointsData.reduce((sum, [, points]) => sum + (points || 0), 0);
          } else if (typeof pointsData === 'object') {
            userCount = Object.keys(pointsData).length;
            totalPoints = Object.values(pointsData).reduce((sum, points) => sum + (points || 0), 0);
          }
          
          console.log(`📊 Found ${userCount} users with ${totalPoints} total points in ${storage.name}/${filename}`);
          
          // Use the data source with the most users/points (most recent/complete)
          if (userCount > maxPointsFound) {
            maxPointsFound = userCount;
            bestDataSource = { storage, filename, data: pointsData, userCount, totalPoints };
          }
        }
      } catch (error) {
        console.error(`❌ Error reading ${filePath}: ${error.message}`);
      }
    }
  }
  
  if (bestDataSource) {
    console.log(`🏆 Best data source: ${bestDataSource.storage.name}/${bestDataSource.filename}`);
    console.log(`📈 Loading ${bestDataSource.userCount} users with ${bestDataSource.totalPoints} total points`);
    
    // Clear existing data
    vouchPoints.clear();
    
    // Load the best data
    if (Array.isArray(bestDataSource.data)) {
      bestDataSource.data.forEach(([userId, points]) => {
        if (userId && typeof points === 'number') {
          vouchPoints.set(userId, points);
        }
      });
    } else if (typeof bestDataSource.data === 'object') {
      Object.entries(bestDataSource.data).forEach(([userId, points]) => {
        if (userId && typeof points === 'number') {
          vouchPoints.set(userId, points);
        }
      });
    }
    
    pointsLoaded = true;
    console.log(`✅ Successfully loaded ${vouchPoints.size} users from best source`);
    
    // Immediately create backups in all locations
    savePointsUnbreakable();
    
  } else {
    console.log('📋 No existing points found - starting fresh');
  }
  
  console.log(`🎯 Points system ready with ${vouchPoints.size} users`);
  console.log(`💾 Data will be saved to ${ACTIVE_STORAGE_PATHS.length} locations for maximum safety`);
}

// UNBREAKABLE POINTS SAVING - saves to ALL available locations
function savePointsUnbreakable() {
  const startTime = Date.now();
  console.log(`💾 UNBREAKABLE SAVE: Saving ${vouchPoints.size} users to ALL locations...`);
  
  const pointsObj = {};
  vouchPoints.forEach((points, userId) => {
    pointsObj[userId] = points;
  });
  
  const jsonData = JSON.stringify(pointsObj, null, 2);
  const metadata = {
    timestamp: Date.now(),
    userCount: vouchPoints.size,
    totalPoints: Array.from(vouchPoints.values()).reduce((sum, points) => sum + points, 0),
    version: "unbreakable-v1"
  };
  
  SUCCESSFUL_SAVE_LOCATIONS = [];
  let saveErrors = [];
  
  // Save to ALL active storage locations
  for (const storage of ACTIVE_STORAGE_PATHS) {
    try {
      const locationSuccess = saveToLocation(storage, jsonData, metadata);
      if (locationSuccess) {
        SUCCESSFUL_SAVE_LOCATIONS.push(storage.name);
        console.log(`✅ Saved to ${storage.name}: ${storage.path}`);
      }
    } catch (error) {
      const errorMsg = `Failed to save to ${storage.name}: ${error.message}`;
      saveErrors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }
  }
  
  const saveTime = Date.now() - startTime;
  
  if (SUCCESSFUL_SAVE_LOCATIONS.length > 0) {
    console.log(`🎉 SAVE SUCCESS: Data saved to ${SUCCESSFUL_SAVE_LOCATIONS.length}/${ACTIVE_STORAGE_PATHS.length} locations in ${saveTime}ms`);
    console.log(`📍 Successful locations: ${SUCCESSFUL_SAVE_LOCATIONS.join(', ')}`);
    return true;
  } else {
    console.error('💥 CRITICAL: ALL SAVE LOCATIONS FAILED!');
    console.error('❌ Errors:', saveErrors);
    
    // Emergency console dump for manual recovery
    console.log('🚨 EMERGENCY BACKUP - COPY THIS DATA:');
    console.log('='.repeat(50));
    console.log(JSON.stringify(pointsObj, null, 2));
    console.log('='.repeat(50));
    
    return false;
  }
}

// Helper function to save to a specific location
function saveToLocation(storage, jsonData, metadata) {
  const location = storage.path;
  
  // Ensure directory exists
  if (!fs.existsSync(location)) {
    fs.mkdirSync(location, { recursive: true });
  }
  
  let filesWritten = 0;
  
  // Write to all backup files
  for (const filename of BACKUP_FILES) {
    try {
      const filePath = path.join(location, filename);
      fs.writeFileSync(filePath, jsonData);
      filesWritten++;
    } catch (error) {
      console.error(`⚠️ Failed to write ${filename} in ${storage.name}: ${error.message}`);
    }
  }
  
  // Write metadata file
  try {
    const metadataPath = path.join(location, 'points-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error(`⚠️ Failed to write metadata in ${storage.name}: ${error.message}`);
  }
  
  // Verify at least one file was written successfully
  if (filesWritten > 0) {
    // Verify data integrity
    try {
      const verifyPath = path.join(location, BACKUP_FILES[0]);
      const verifyData = JSON.parse(fs.readFileSync(verifyPath, 'utf8'));
      const verifyCount = Object.keys(verifyData).length;
      
      if (verifyCount === vouchPoints.size) {
        return true;
      } else {
        throw new Error(`Verification failed: expected ${vouchPoints.size} users, got ${verifyCount}`);
      }
    } catch (error) {
      throw new Error(`Verification failed: ${error.message}`);
    }
  }
  
  return false;
}

// Auto-save every 15 seconds for maximum safety
setInterval(() => {
  if (vouchPoints.size > 0) {
    savePointsUnbreakable();
  }
}, 15000);

// Initialize the unbreakable system immediately
try {
  initializeUnbreakableStorage();
  loadPointsUnbreakable();
} catch (error) {
  console.error('💥 CRITICAL STORAGE ERROR:', error);
  console.log('🚨 Starting with empty points - storage will be retried');
}

// Replace old functions with unbreakable versions
function loadPoints() {
  loadPointsUnbreakable();
}

function savePoints() {
  return savePointsUnbreakable();
}

// Initialize storage and load points when the module loads
// This will happen automatically at startup

// Simple handler for legacy confirmation buttons
async function handleButtonInteraction(interaction) {
  const userId = interaction.user.id;
  
  // Handle roulette confirmation buttons
  if (interaction.customId === 'roulette_confirm' || interaction.customId === 'roulette_cancel') {
    if (interaction.customId === 'roulette_cancel') {
      const cancelEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Bet Cancelled')
        .setDescription('Your roulette bet has been cancelled.')
        .setTimestamp();
      
      return await interaction.update({ embeds: [cancelEmbed], components: [] });
    }
    // For roulette_confirm, the collector in the slash command will handle it
    return;
  }
  
  // Handle blackjack confirmation buttons
  if (interaction.customId === 'blackjack_confirm' || interaction.customId === 'blackjack_cancel') {
    if (interaction.customId === 'blackjack_cancel') {
      const cancelEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Bet Cancelled')
        .setDescription('Your blackjack bet has been cancelled.')
        .setTimestamp();
      
      return await interaction.update({ embeds: [cancelEmbed], components: [] });
    }
    // For blackjack_confirm, the collector in the slash command will handle it
    return;
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Configuration - adjust these to your needs
const VOUCH_CHANNEL_NAME = 'vouch'; // Channel name to monitor
const PROVIDER_ROLE_NAME = 'provider'; // Role name for providers
const POINTS_PER_VOUCH = 1;
const GAMBLING_CHANNEL_NAME = 'gambling'; // Channel name for gambling commands
const MIN_BET = 1;
const MAX_BET = 100;

// Helper function to calculate potential payout
function getPotentialPayout(betType, betAmount) {
  switch(betType.toLowerCase()) {
    case 'red':
    case 'black':
      return `${betAmount * 2} points (2x)`;
    case 'green':
      return `${betAmount * 14} points (14x)`;
    case 'number':
      return `${betAmount * 35} points (35x)`;
    default:
      return `${betAmount * 2} points`;
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`🚀 Ready! Logged in as ${readyClient.user.tag}`);
  
  // Set up periodic auto-save every 5 minutes
  setInterval(() => {
    if (vouchPoints.size > 0) {
      savePoints();
      console.log(`🔄 Auto-saved ${vouchPoints.size} user points`);
    }
  }, 5 * 60 * 1000); // 5 minutes
  
  console.log(`💾 Auto-save enabled (every 5 minutes)`);
});

client.on(Events.MessageCreate, async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Handle gambling commands - more lenient channel check
  if (message.channel.name?.toLowerCase().includes('casino') || 
      message.channel.name?.toLowerCase().includes('gambling')) {
    await handleGamblingCommands(message);
    return;
  }

  // Check if message is in vouch channel (more flexible detection)
  const isVouchChannel = message.channel.name?.toLowerCase().includes('vouch') || 
                        message.channel.name?.toLowerCase().includes('review') ||
                        message.channel.name?.toLowerCase().includes('feedback');
  
  if (!isVouchChannel) return;

  console.log(`📝 Message in vouch channel from ${message.author.username}: checking for image and provider mentions...`);

  // Check if message has attachments (images)
  const hasImage = message.attachments.some(attachment => 
    attachment.contentType?.startsWith('image/') || 
    attachment.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
  );

  if (!hasImage) {
    console.log(`❌ No image found in message from ${message.author.username}`);
    return;
  }

  console.log(`✅ Image detected in message from ${message.author.username}`);

  // Check if message mentions a provider
  const mentionedUsers = message.mentions.users;
  if (mentionedUsers.size === 0) {
    console.log(`❌ No user mentions found in message from ${message.author.username}`);
    return;
  }

  console.log(`👥 Found ${mentionedUsers.size} user mention(s) in message from ${message.author.username}`);

  // Check if any mentioned user has provider role
  const guild = message.guild;
  const providerRole = guild.roles.cache.find(role => 
    role.name.toLowerCase() === PROVIDER_ROLE_NAME.toLowerCase()
  );

  if (!providerRole) {
    console.log(`❌ Provider role "${PROVIDER_ROLE_NAME}" not found in server`);
    return;
  }

  console.log(`🔍 Provider role found: ${providerRole.name}`);

  let mentionedProviders = [];
  for (const [userId, user] of mentionedUsers) {
    try {
      const member = await guild.members.fetch(userId);
      if (member && member.roles.cache.has(providerRole.id)) {
        mentionedProviders.push(user);
        console.log(`✅ ${user.username} is a provider - will receive points`);
      } else {
        console.log(`❌ ${user.username} is not a provider - no points awarded`);
      }
    } catch (error) {
      console.log(`❌ Could not fetch member ${user.username}: ${error.message}`);
    }
  }

  if (mentionedProviders.length === 0) {
    console.log(`❌ No providers mentioned in vouch from ${message.author.username}`);
    return;
  }

  console.log(`🎯 Awarding points to ${mentionedProviders.length} provider(s)...`);

  // Add points for each mentioned provider
  mentionedProviders.forEach(provider => {
    const currentPoints = vouchPoints.get(provider.id) || 0;
    const newPoints = currentPoints + POINTS_PER_VOUCH;
    vouchPoints.set(provider.id, newPoints);
    
    console.log(`💰 Added ${POINTS_PER_VOUCH} point(s) to ${provider.username} (${provider.id}) - New total: ${newPoints}`);
  });
  
  // Save points after adding
  savePoints();
  
  // Send confirmation message
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Vouch Points Added!')
    .setDescription(`**${message.author.username}** vouched for:\n${mentionedProviders.map(p => `• <@${p.id}> (+${POINTS_PER_VOUCH} point${POINTS_PER_VOUCH !== 1 ? 's' : ''})`).join('\n')}`)
    .addFields({
      name: 'Total Points Awarded',
      value: `${mentionedProviders.length * POINTS_PER_VOUCH} point${mentionedProviders.length * POINTS_PER_VOUCH !== 1 ? 's' : ''}`,
      inline: true
    })
    .setFooter({ text: `Vouched by ${message.author.username}` })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
  console.log(`🎉 Vouch processed successfully! ${mentionedProviders.length} provider(s) received points.`);
});

// Slash command to check points
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  // Handle button interactions
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('bj_')) {
      // Handle blackjack buttons
      return handleBlackjackButtons(interaction);
    }
    return handleButtonInteraction(interaction);
  }

  const { commandName } = interaction;

  if (commandName === 'points') {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const points = vouchPoints.get(targetUser.id) || 0;
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📊 Vouch Points')
      .setDescription(`<@${targetUser.id}> has **${points}** vouch points`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'leaderboard') {
    const sortedPoints = Array.from(vouchPoints.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    if (sortedPoints.length === 0) {
      return interaction.reply('No vouch points recorded yet!');
    }

    const leaderboardText = sortedPoints
      .map(([userId, points], index) => `${index + 1}. <@${userId}>: **${points}** points`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 Vouch Leaderboard')
      .setDescription(leaderboardText)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'addpoints') {
    // Check if user has administrator permissions
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ 
        content: '❌ You need Administrator permissions to use this command!', 
        ephemeral: true 
      });
    }

    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'Manual adjustment';

    const currentPoints = vouchPoints.get(targetUser.id) || 0;
    const newPoints = Math.max(0, currentPoints + amount); // Prevent negative points
    
    vouchPoints.set(targetUser.id, newPoints);
    savePoints(); // Save after manual changes

    const embed = new EmbedBuilder()
      .setColor(amount > 0 ? 0x00FF00 : 0xFF0000)
      .setTitle('⚖️ Points Modified')
      .setDescription(`${amount > 0 ? 'Added' : 'Removed'} **${Math.abs(amount)}** points ${amount > 0 ? 'to' : 'from'} <@${targetUser.id}>`)
      .addFields(
        { name: 'Previous Balance', value: `${currentPoints} points`, inline: true },
        { name: 'New Balance', value: `${newPoints} points`, inline: true },
        { name: 'Change', value: `${amount > 0 ? '+' : ''}${amount} points`, inline: true },
        { name: 'Reason', value: reason, inline: false },
        { name: 'Modified by', value: `<@${interaction.user.id}>`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    console.log(`${interaction.user.username} modified ${targetUser.username}'s points: ${currentPoints} -> ${newPoints} (${amount > 0 ? '+' : ''}${amount}) - ${reason}`);
  }

  if (commandName === 'backup') {
    // Check if user has administrator permissions
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ 
        content: '❌ You need Administrator permissions to use this command!', 
        ephemeral: true 
      });
    }

    try {
      // Force save points
      savePoints();

      // Get file stats
      const stats = fs.existsSync(POINTS_FILE) ? fs.statSync(POINTS_FILE) : null;
      const backupStats = fs.existsSync(BACKUP_POINTS_FILE) ? fs.statSync(BACKUP_POINTS_FILE) : null;

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('💾 Backup & Storage Info')
        .setDescription('Manual backup completed successfully!')
        .addFields(
          { name: '👥 Total Users', value: `${vouchPoints.size}`, inline: true },
          { name: '📊 Total Points', value: `${Array.from(vouchPoints.values()).reduce((a, b) => a + b, 0)}`, inline: true },
          { name: '📁 Storage Path', value: `${VOLUME_PATH}`, inline: false },
          { name: '📄 Main File', value: stats ? `✅ ${(stats.size / 1024).toFixed(2)} KB` : '❌ Not found', inline: true },
          { name: '💾 Backup File', value: backupStats ? `✅ ${(backupStats.size / 1024).toFixed(2)} KB` : '❌ Not found', inline: true },
          { name: '🕒 Last Modified', value: stats ? `<t:${Math.floor(stats.mtime.getTime() / 1000)}:R>` : 'N/A', inline: true }
        )
        .setFooter({ text: `Backup requested by ${interaction.user.username}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      console.log(`💾 Manual backup completed by ${interaction.user.username}`);

    } catch (error) {
      console.error('❌ Backup command error:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Backup Failed')
        .setDescription(`Error during backup: ${error.message}`)
        .setTimestamp();

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }

  // Roulette slash command
  if (commandName === 'roulette') {
    const betAmount = interaction.options.getInteger('amount');
    const betType = interaction.options.getString('bet');
    const numberBet = interaction.options.getInteger('number');
    
    const userId = interaction.user.id;
    const userPoints = vouchPoints.get(userId) || 0;
    
    if (userPoints < betAmount) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Insufficient Points')
        .setDescription(`You need **${betAmount}** points to place this bet.\nYou currently have **${userPoints}** points.`)
        .addFields({ name: 'How to get points?', value: 'Post images and tag providers in vouch channels!' })
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    // Handle number bet
    let finalBetType = betType;
    if (betType === 'number') {
      if (numberBet === null || numberBet === undefined) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Missing Number')
          .setDescription('When betting on a specific number, you must specify which number (0-36)!')
          .addFields({ name: 'Example', value: '/roulette 10 number 17' })
          .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      finalBetType = numberBet.toString();
    }
    
    // Show bet confirmation
    const confirmEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🎰 Roulette - Confirm Your Bet')
      .setDescription(`You're about to bet **${betAmount}** points on **${betType === 'number' ? `Number ${numberBet}` : betType.toUpperCase()}**`)
      .addFields(
        { name: 'Your Balance', value: `${userPoints} points`, inline: true },
        { name: 'Bet Amount', value: `${betAmount} points`, inline: true },
        { name: 'Potential Payout', value: getPotentialPayout(betType, betAmount), inline: true }
      )
      .setFooter({ text: 'Good luck! 🍀' })
      .setTimestamp();
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('roulette_confirm')
          .setLabel('🎲 Spin the Wheel!')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('roulette_cancel')
          .setLabel('❌ Cancel')
          .setStyle(ButtonStyle.Secondary)
      );
    
    const response = await interaction.reply({ embeds: [confirmEmbed], components: [row] });
    
    const collector = response.createMessageComponentCollector({ time: 300000 }); // 5 minutes instead of 30 seconds
    
    collector.on('collect', async i => {
      if (i.user.id !== userId) {
        return i.reply({ content: 'This is not your bet!', ephemeral: true });
      }
      
      if (i.customId === 'roulette_confirm') {
        collector.stop('game_started'); // Stop the confirmation collector
        await playRouletteSlash(i, betAmount, finalBetType);
      } else {
        collector.stop('cancelled');
        const cancelEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Bet Cancelled')
          .setDescription('Your roulette bet has been cancelled.')
          .setTimestamp();
        
        await i.update({ embeds: [cancelEmbed], components: [] });
      }
    });
    
    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        // Only show timeout if the user didn't start a game or cancel
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('⏰ Bet Timeout')
          .setDescription('Your roulette bet confirmation timed out.')
          .setTimestamp();
        
        interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
      }
    });
  }

  // Blackjack slash command
  if (commandName === 'blackjack') {
    const betAmount = interaction.options.getInteger('amount');
    const userId = interaction.user.id;
    const userPoints = vouchPoints.get(userId) || 0;
    
    if (userPoints < betAmount) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Insufficient Points')
        .setDescription(`You need **${betAmount}** points to place this bet.\nYou currently have **${userPoints}** points.`)
        .addFields({ name: 'How to get points?', value: 'Post images and tag providers in vouch channels!' })
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    if (blackjackGames.has(userId)) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Game in Progress')
        .setDescription('You already have a blackjack game in progress!\nFinish your current game first.')
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    // Show bet confirmation
    const confirmEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🃏 Blackjack - Confirm Your Bet')
      .setDescription(`You're about to bet **${betAmount}** points on a blackjack game`)
      .addFields(
        { name: 'Your Balance', value: `${userPoints} points`, inline: true },
        { name: 'Bet Amount', value: `${betAmount} points`, inline: true },
        { name: 'Max Payout', value: `${betAmount * 2} points`, inline: true }
      )
      .setFooter({ text: 'Blackjack pays 2:1 • Dealer stands on 17' })
      .setTimestamp();
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('blackjack_confirm')
          .setLabel('🃏 Deal the Cards!')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('blackjack_cancel')
          .setLabel('❌ Cancel')
          .setStyle(ButtonStyle.Secondary)
      );
    
    const response = await interaction.reply({ embeds: [confirmEmbed], components: [row] });
    
    const collector = response.createMessageComponentCollector({ time: 300000 }); // 5 minutes instead of 30 seconds
    
    collector.on('collect', async i => {
      if (i.user.id !== userId) {
        return i.reply({ content: 'This is not your bet!', ephemeral: true });
      }
      
      if (i.customId === 'blackjack_confirm') {
        collector.stop('game_started'); // Stop the confirmation collector
        await playBlackjackSlash(i, betAmount);
      } else {
        collector.stop('cancelled');
        const cancelEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Bet Cancelled')
          .setDescription('Your blackjack bet has been cancelled.')
          .setTimestamp();
        
        await i.update({ embeds: [cancelEmbed], components: [] });
      }
    });
    
    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        // Only show timeout if the user didn't start a game or cancel
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('⏰ Bet Timeout')
          .setDescription('Your blackjack bet confirmation timed out.')
          .setTimestamp();
        
        interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
      }
    });
  }

  // Send points slash command
  if (commandName === 'send') {
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const message = interaction.options.getString('message') || '';
    
    const senderId = interaction.user.id;
    const senderPoints = vouchPoints.get(senderId) || 0;
    
    // Check if trying to send to themselves
    if (targetUser.id === senderId) {
      return interaction.reply({ 
        content: '❌ You cannot send points to yourself!', 
        ephemeral: true 
      });
    }
    
    // Check if target is a bot
    if (targetUser.bot) {
      return interaction.reply({ 
        content: '❌ You cannot send points to bots!', 
        ephemeral: true 
      });
    }
    
    // Check if sender has enough points
    if (senderPoints < amount) {
      return interaction.reply({ 
        content: `❌ You don't have enough points! You have ${senderPoints} points but tried to send ${amount}.`, 
        ephemeral: true 
      });
    }
    
    // Transfer points
    const receiverPoints = vouchPoints.get(targetUser.id) || 0;
    vouchPoints.set(senderId, senderPoints - amount);
    vouchPoints.set(targetUser.id, receiverPoints + amount);
    savePoints();
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('💸 Points Transferred!')
      .setDescription(`<@${senderId}> sent **${amount}** points to <@${targetUser.id}>`)
      .addFields(
        { name: 'Sender Balance', value: `${senderPoints - amount} points`, inline: true },
        { name: 'Receiver Balance', value: `${receiverPoints + amount} points`, inline: true },
        { name: 'Amount Sent', value: `${amount} points`, inline: true }
      )
      .setTimestamp();
    
    if (message) {
      embed.addFields({ name: 'Message', value: message, inline: false });
    }
    
    await interaction.reply({ embeds: [embed] });
    
    console.log(`${interaction.user.username} sent ${amount} points to ${targetUser.username}`);
  }
});

// Gambling functionality
async function handleGamblingCommands(message) {
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  if (!['roulette', 'blackjack', 'balance'].includes(command)) return;
  
  const userId = message.author.id;
  const userPoints = vouchPoints.get(userId) || 0;
  
  if (command === 'balance') {
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('💰 Your Balance')
      .setDescription(`You have **${userPoints}** vouch points`)
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
  }
  
  const betAmount = parseInt(args[0]);
  
  if (!betAmount || betAmount < MIN_BET || betAmount > MAX_BET) {
    return message.reply(`❌ Please enter a valid bet amount between ${MIN_BET} and ${MAX_BET} points!`);
  }
  
  if (userPoints < betAmount) {
    return message.reply(`❌ You don't have enough points! You have ${userPoints} points.`);
  }
  
  if (command === 'roulette') {
    await playRoulette(message, betAmount, args[1]);
  } else if (command === 'blackjack') {
    await playBlackjack(message, betAmount);
  }
}

async function playRoulette(message, betAmount, betType) {
  const userId = message.author.id;
  
  if (!betType) {
    return message.reply('❌ Please specify your bet! Usage: `!roulette <amount> <red/black/green/number>`');
  }
  
  const spin = Math.floor(Math.random() * 37); // 0-36
  const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(spin);
  const isBlack = spin !== 0 && !isRed;
  const isGreen = spin === 0;
  
  let won = false;
  let payout = 0;
  let resultText = '';
  
  betType = betType.toLowerCase();
  
  if (betType === 'red' && isRed) {
    won = true;
    payout = betAmount * 2;
    resultText = '🔴 RED wins!';
  } else if (betType === 'black' && isBlack) {
    won = true;
    payout = betAmount * 2;
    resultText = '⚫ BLACK wins!';
  } else if (betType === 'green' && isGreen) {
    won = true;
    payout = betAmount * 14;
    resultText = '🟢 GREEN wins!';
  } else if (!isNaN(betType) && parseInt(betType) === spin) {
    won = true;
    payout = betAmount * 35;
    resultText = `🎯 Number ${spin} wins!`;
  } else {
    resultText = `You lost! The ball landed on ${spin} (${isGreen ? 'Green' : isRed ? 'Red' : 'Black'})`;
  }
  
  // Update points
  const currentPoints = vouchPoints.get(userId) || 0;
  if (won) {
    vouchPoints.set(userId, currentPoints - betAmount + payout);
  } else {
    vouchPoints.set(userId, currentPoints - betAmount);
  }
  savePoints(); // Save after gambling
  
  const embed = new EmbedBuilder()
    .setColor(won ? 0x00FF00 : 0xFF0000)
    .setTitle('🎰 Roulette Results')
    .setDescription(`**Ball landed on: ${spin}**\n${resultText}`)
    .addFields(
      { name: 'Bet Amount', value: `${betAmount} points`, inline: true },
      { name: 'Result', value: won ? `+${payout - betAmount} points` : `-${betAmount} points`, inline: true },
      { name: 'New Balance', value: `${vouchPoints.get(userId)} points`, inline: true }
    )
    .setFooter({ text: `${message.author.username}` })
    .setTimestamp();
  
  message.reply({ embeds: [embed] });
}

// ENHANCED CINEMATIC ROULETTE with immersive casino experience
async function playRouletteSlash(interaction, betAmount, betType) {
  const userId = interaction.user.id;
  
  const spin = Math.floor(Math.random() * 37); // 0-36
  const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(spin);
  const isBlack = spin !== 0 && !isRed;
  const isGreen = spin === 0;
  
  let won = false;
  let payout = 0;
  let resultText = '';
  
  betType = betType.toLowerCase();
  
  if (betType === 'red' && isRed) {
    won = true;
    payout = betAmount * 2;
    resultText = '🔴 RED wins!';
  } else if (betType === 'black' && isBlack) {
    won = true;
    payout = betAmount * 2;
    resultText = '⚫ BLACK wins!';
  } else if (betType === 'green' && isGreen) {
    won = true;
    payout = betAmount * 14;
    resultText = '🟢 GREEN wins!';
  } else if (!isNaN(betType) && parseInt(betType) === spin) {
    won = true;
    payout = betAmount * 35;
    resultText = `🎯 Number ${spin} wins!`;
  } else {
    resultText = `You lost! The ball landed on ${spin} (${isGreen ? '🟢 Green' : isRed ? '🔴 Red' : '⚫ Black'})`;
  }

  // STAGE 1: Welcome to Monte Carlo Casino
  const welcomeEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🏛️ WELCOME TO MONTE CARLO CASINO 🏛️')
    .setDescription('```\n' +
      '╔═══════════════════════════════════════════════════════╗\n' +
      '║        🎩 EUROPÉAN ROULETTE TABLE 🎩                 ║\n' +
      '║                                                       ║\n' +
      '║     🍾 Premium Gaming Experience 🍾                   ║\n' +
      '║                                                       ║\n' +
      '║   ✨ Your bet has been placed at our finest table ✨  ║\n' +
      '║                                                       ║\n' +
      '║           🎲 Preparing the wheel... 🎲                ║\n' +
      '╚═══════════════════════════════════════════════════════╝\n' +
      '```\n' +
      '🥂 **The croupier approaches your table with elegance**')
    .addFields(
      { name: '💰 Your Wager', value: `${betAmount} points on **${betType === 'number' ? `Number ${parseInt(betType)}` : betType.toUpperCase()}**`, inline: true },
      { name: '🎯 Table Minimum', value: '1 point', inline: true },
      { name: '💎 VIP Status', value: 'High Roller', inline: true }
    )
    .setFooter({ text: '🎰 Monte Carlo Casino • Where legends are born' })
    .setTimestamp();

  await interaction.update({ embeds: [welcomeEmbed], components: [] });
  await new Promise(resolve => setTimeout(resolve, 2500));

  // STAGE 2: Croupier announces the game
  const announcementEmbed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('🎭 CROUPIER ANNOUNCEMENT 🎭')
    .setDescription('```\n' +
      '╔══════════════════════════════════════════════════════╗\n' +
      '║                                                      ║\n' +
      '║  🎩 "Ladies and gentlemen, place your bets!"        ║\n' +
      '║                                                      ║\n' +
      '║     🎯 All bets are now locked in                    ║\n' +
      '║                                                      ║\n' +
      '║     🌟 The wheel will now begin spinning...          ║\n' +
      '║                                                      ║\n' +
      '║  🍀 "Rien ne va plus!" - No more bets! 🍀          ║\n' +
      '╚══════════════════════════════════════════════════════╝\n' +
      '```\n' +
      '🎪 **The atmosphere becomes electric as anticipation builds**')
    .addFields(
      { name: '🎲 Your Bet', value: `${betAmount} points on **${betType === 'number' ? `Number ${parseInt(betType)}` : betType.toUpperCase()}**`, inline: false },
      { name: '⚡ Tension Level', value: '████████████ MAX', inline: true },
      { name: '🎯 Lucky Number?', value: 'About to find out...', inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [announcementEmbed] });
  await new Promise(resolve => setTimeout(resolve, 2000));

  // STAGE 3: Enhanced spinning sequence with 6 frames
  const spinningSequence = [
    {
      title: '🌪️ WHEEL SPINNING - STAGE 1 🌪️',
      description: '```\n' +
        '╔══════════════ ROULETTE WHEEL ══════════════╗\n' +
        '║                                            ║\n' +
        '║    🔴 ⚫ 🔴 ⚫ 🟢 ⚫ 🔴 ⚫ 🔴 ⚫           ║\n' +
        '║  ⚫ 🔴 ⚫ 🔴 ⚫ 🎱 ⚫ 🔴 ⚫ 🔴 ⚫         ║\n' +
        '║    🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫           ║\n' +
        '║                                            ║\n' +
        '║         💨 WHEEL GAINING SPEED 💨           ║\n' +
        '╚════════════════════════════════════════════╝\n' +
        '```\n🎰 *The wheel starts to turn with mechanical precision*',
      status: 'Starting rotation...'
    },
    {
      title: '⚡ WHEEL SPINNING - STAGE 2 ⚡',
      description: '```\n' +
        '╔══════════════ ROULETTE WHEEL ══════════════╗\n' +
        '║                                            ║\n' +
        '║    ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🟢 ⚫ 🔴           ║\n' +
        '║  🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🎱 ⚫ 🔴 ⚫ 🔴         ║\n' +
        '║    ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴           ║\n' +
        '║                                            ║\n' +
        '║        🌪️ SPINNING FASTER 🌪️               ║\n' +
        '╚════════════════════════════════════════════╝\n' +
        '```\n🎪 *The ball dances along the edge of the wheel*',
      status: 'Accelerating...'
    },
    {
      title: '🔥 WHEEL SPINNING - STAGE 3 🔥',
      description: '```\n' +
        '╔══════════════ ROULETTE WHEEL ══════════════╗\n' +
        '║                                            ║\n' +
        '║    🔴 ⚫ 🟢 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫           ║\n' +
        '║  ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🎱 ⚫ 🔴 ⚫         ║\n' +
        '║    🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫           ║\n' +
        '║                                            ║\n' +
        '║         🚀 MAXIMUM VELOCITY 🚀              ║\n' +
        '╚════════════════════════════════════════════╝\n' +
        '```\n💫 *The wheel becomes a blur of colors and numbers*',
      status: 'Peak speed reached!'
    },
    {
      title: '⏳ WHEEL SPINNING - STAGE 4 ⏳',
      description: '```\n' +
        '╔══════════════ ROULETTE WHEEL ══════════════╗\n' +
        '║                                            ║\n' +
        '║    ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🟢           ║\n' +
        '║  🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🎱 ⚫ 🔴         ║\n' +
        '║    ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴           ║\n' +
        '║                                            ║\n' +
        '║          🕰️ SLOWING DOWN 🕰️                ║\n' +
        '╚════════════════════════════════════════════╝\n' +
        '```\n⚰️ *The ball begins to lose momentum and bounce*',
      status: 'Deceleration phase...'
    },
    {
      title: '🎯 WHEEL SPINNING - FINAL MOMENTS 🎯',
      description: '```\n' +
        '╔══════════════ ROULETTE WHEEL ══════════════╗\n' +
        '║                                            ║\n' +
        '║    🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫           ║\n' +
        '║  ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🎱 ⚫         ║\n' +
        '║    🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫           ║\n' +
        '║                                            ║\n' +
        '║        🎪 SETTLING DOWN 🎪                  ║\n' +
        '╚════════════════════════════════════════════╝\n' +
        '```\n💥 *The final clicks echo through the casino*',
      status: 'Almost stopped...'
    }
  ];

  // Animate the spinning sequence
  for (let i = 0; i < spinningSequence.length; i++) {
    const frame = spinningSequence[i];
    const spinEmbed = new EmbedBuilder()
      .setColor(0xFF6B35)
      .setTitle(frame.title)
      .setDescription(frame.description)
      .addFields(
        { name: '🎲 Your Bet', value: `${betAmount} points on **${betType === 'number' ? `Number ${parseInt(betType)}` : betType.toUpperCase()}**`, inline: true },
        { name: '🌟 Status', value: frame.status, inline: true },
        { name: '⚡ Excitement', value: '████████████ MAXIMUM', inline: true }
      )
      .setFooter({ text: `🎰 Spin Progress: ${i + 1}/${spinningSequence.length} • The tension is unbearable!` })
      .setTimestamp();

    await interaction.editReply({ embeds: [spinEmbed] });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // STAGE 4: Dramatic pause and anticipation
  const suspenseEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('⚡ MOMENT OF TRUTH ⚡')
    .setDescription('```\n' +
      '╔═══════════════════════════════════════════════════╗\n' +
      '║                                                   ║\n' +
      '║           🤫 Complete Silence Falls...            ║\n' +
      '║                                                   ║\n' +
      '║               ⏰ The wheel stops ⏰                ║\n' +
      '║                                                   ║\n' +
      '║             🎭 The croupier leans in...           ║\n' +
      '║                                                   ║\n' +
      '║         💥 THE RESULT WILL BE REVEALED 💥         ║\n' +
      '╚═══════════════════════════════════════════════════╝\n' +
      '```\n' +
      '🔥 **Every eye in the casino is watching your table...**')
    .addFields(
      { name: '🎯 Winning Number', value: '🤐 **CLASSIFIED**', inline: true },
      { name: '💰 Your Fate', value: '⏳ **PENDING**', inline: true },
      { name: '🍀 Luck Factor', value: '🌟 **LEGENDARY**', inline: true }
    )
    .setFooter({ text: '🎪 The most dramatic moment in casino history...' })
    .setTimestamp();

  await interaction.editReply({ embeds: [suspenseEmbed] });
  await new Promise(resolve => setTimeout(resolve, 3000));

  // STAGE 5: Spectacular result reveal
  const numberColor = isGreen ? '🟢' : isRed ? '🔴' : '⚫';
  const winStatus = won ? '🎊 WINNER! 🎊' : '💔 SO CLOSE! 💔';
  const resultDescription = won 
    ? `🎆 **INCREDIBLE! YOU'VE WON!** 🎆\n\n🏆 The ball has landed in your favor! 🏆\n\n${resultText}`
    : `😤 **UNLUCKY THIS TIME!** 😤\n\n💪 You played with courage and style! 💪\n\n${resultText}`;

  const rouletteBoard = 
    '```\n' +
    '╔══════════════ FINAL ROULETTE BOARD ═══════════════╗\n' +
    '║                                                   ║\n' +
    `║           🎯 WINNING NUMBER: ${spin.toString().padStart(2, ' ')} 🎯            ║\n` +
    `║                  ${numberColor} ${numberColor} ${numberColor}                   ║\n` +
    '║                                                   ║\n' +
    '║  🔴 RED NUMBERS (2:1 payout):                     ║\n' +
    '║  1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36 ║\n' +
    '║                                                   ║\n' +
    '║  ⚫ BLACK NUMBERS (2:1 payout):                   ║\n' +
    '║  2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35║\n' +
    '║                                                   ║\n' +
    '║  🟢 GREEN NUMBER (14:1 payout): 0                 ║\n' +
    '║                                                   ║\n' +
    '║  🎯 SINGLE NUMBER BET (35:1 payout): Any 0-36     ║\n' +
    '╚═══════════════════════════════════════════════════╝\n' +
    '```';

  // Update points
  const currentPoints = vouchPoints.get(userId) || 0;
  if (won) {
    vouchPoints.set(userId, currentPoints - betAmount + payout);
  } else {
    vouchPoints.set(userId, currentPoints - betAmount);
  }
  savePoints();

  const finalEmbed = new EmbedBuilder()
    .setColor(won ? 0x00FF00 : 0xFF4500)
    .setTitle(`🎰 ${winStatus} 🎰`)
    .setDescription(resultDescription + '\n\n' + rouletteBoard)
    .addFields(
      { name: '🎲 Your Bet', value: `${betAmount} points on **${betType === 'number' ? `Number ${parseInt(betType)}` : betType.toUpperCase()}**`, inline: false },
      { name: '🎯 Winning Number', value: `${numberColor} **${spin}** ${numberColor}`, inline: true },
      { name: '💰 Payout', value: won ? `**+${payout - betAmount}** points` : `**-${betAmount}** points`, inline: true },
      { name: '🏦 New Balance', value: `**${vouchPoints.get(userId)}** points`, inline: true }
    )
    .setFooter({ 
      text: won 
        ? `🎊 ${interaction.user.username} • Congratulations, high roller! The casino salutes you! 🎊`
        : `🎲 ${interaction.user.username} • Thank you for playing at Monte Carlo Casino! 🎲` 
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [finalEmbed] });

  // STAGE 6: Celebration or consolation message
  if (won) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const celebrationEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🎊 CASINO CELEBRATION 🎊')
      .setDescription('```\n' +
        '╔═══════════════════════════════════════════════════╗\n' +
        '║                                                   ║\n' +
        '║    🍾 The house sends complimentary champagne! 🍾  ║\n' +
        '║                                                   ║\n' +
        '║        🎺 The casino band plays in your honor!     ║\n' +
        '║                                                   ║\n' +
        '║      🏆 You are now a VIP member of our club! 🏆   ║\n' +
        '║                                                   ║\n' +
        '║        💎 Your legend will be remembered! 💎       ║\n' +
        '╚═══════════════════════════════════════════════════╝\n' +
        '```\n' +
        `🥂 **Congratulations! Your ${payout - betAmount} point win is absolutely spectacular!**`)
      .setFooter({ text: '🎰 Monte Carlo Casino • Where dreams come true' })
      .setTimestamp();

    await interaction.followUp({ embeds: [celebrationEmbed], ephemeral: false });
  }
}

// Blackjack game storage
const blackjackGames = new Map();

async function playBlackjack(message, betAmount) {
  const userId = message.author.id;
  
  if (blackjackGames.has(userId)) {
    return message.reply('❌ You already have a blackjack game in progress! Use `!hit`, `!stand`, or `!quit`');
  }
  
  // Create deck and deal cards
  const deck = createDeck();
  const playerHand = [drawCard(deck), drawCard(deck)];
  const dealerHand = [drawCard(deck), drawCard(deck)];
  
  const game = {
    deck,
    playerHand,
    dealerHand,
    betAmount,
    userId
  };
  
  blackjackGames.set(userId, game);
  
  const playerValue = getHandValue(playerHand);
  
  if (playerValue === 21) {
    // Blackjack!
    return handleBlackjackEnd(message, true, 'Blackjack! 🎉');
  }
  
  const embed = createBlackjackEmbed(game, false);
  const reply = await message.reply({ embeds: [embed] });
  
  // Add reactions for game controls
  await reply.react('🃏'); // hit
  await reply.react('✋'); // stand
  await reply.react('❌'); // quit
}

// Completely rebuilt blackjack system - 100% bulletproof
async function playBlackjackSlash(interaction, betAmount) {
  const userId = interaction.user.id;
  
  // Create deck and deal cards
  const deck = createDeck();
  const playerHand = [drawCard(deck), drawCard(deck)];
  const dealerHand = [drawCard(deck), drawCard(deck)];
  
  const game = {
    deck,
    playerHand,
    dealerHand,
    betAmount,
    userId,
    isSlashCommand: true
  };
  
  blackjackGames.set(userId, game);

  // Start with dealing animation
  const dealEmbed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('🃏 Blackjack - Dealing Cards')
    .setDescription('🎴 **SHUFFLING AND DEALING** 🎴\n\n```\n🃁🃑 Your cards incoming...\n🃆❓ Dealer gets 2 cards\n```')
    .addFields({ name: 'Bet Amount', value: `${betAmount} points` })
    .setTimestamp();

  await interaction.update({ embeds: [dealEmbed], components: [] });
  await new Promise(resolve => setTimeout(resolve, 2000));

  const playerValue = getHandValue(playerHand);
  
  // Check for natural blackjack
  if (playerValue === 21) {
    const blackjackEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🎉 BLACKJACK! 🎉')
      .setDescription('🃏 **NATURAL 21 - INSTANT WIN!** 🃏')
      .addFields(
        { name: 'Your Hand', value: createAnimatedHand(playerHand, true), inline: false },
        { name: 'Result', value: `+${betAmount} points`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [blackjackEmbed], components: [] });
    return handleBlackjackEndSlash(interaction, true, 'Natural Blackjack!');
  }
  
  // Show initial game state and set up buttons
  await showBlackjackGame(interaction, game);
}

// Show the current game state with buttons
async function showBlackjackGame(interaction, game) {
  const embed = createAnimatedBlackjackEmbed(game, false);
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder().setCustomId(`bj_hit_${game.userId}`).setLabel('🃏 Hit').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`bj_stand_${game.userId}`).setLabel('✋ Stand').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`bj_double_${game.userId}`).setLabel('⬆️ Double').setStyle(ButtonStyle.Success).setDisabled(game.playerHand.length > 2),
      new ButtonBuilder().setCustomId(`bj_quit_${game.userId}`).setLabel('❌ Quit').setStyle(ButtonStyle.Danger)
    );
  
  await interaction.editReply({ embeds: [embed], components: [row] });
}

// Handle all blackjack button interactions
async function handleBlackjackButtons(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;
  
  // Extract action and check if it's for this user
  if (!customId.startsWith('bj_') || !customId.endsWith(`_${userId}`)) {
    return interaction.reply({ content: 'This is not your game!', ephemeral: true });
  }
  
  const action = customId.split('_')[1]; // hit, stand, double, quit
  const game = blackjackGames.get(userId);
  
  if (!game) {
    return interaction.reply({ content: '❌ Game expired! Start a new one with /blackjack', ephemeral: true });
  }
  
  // Defer the interaction immediately
  await interaction.deferUpdate();
  
  try {
    if (action === 'hit') {
      await handleHit(interaction, game);
    } else if (action === 'stand') {
      await handleStand(interaction, game);
    } else if (action === 'double') {
      await handleDouble(interaction, game);
    } else if (action === 'quit') {
      await handleQuit(interaction, game);
    }
  } catch (error) {
    console.error('Blackjack button error:', error);
    try {
      await interaction.followUp({ content: '❌ Something went wrong! Game reset.', ephemeral: true });
      blackjackGames.delete(userId);
    } catch (e) {
      console.error('Error handling error:', e);
    }
  }
}

// Handle hit action
async function handleHit(interaction, game) {
  // Draw card animation
  const drawEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🃏 Drawing Card...')
    .setDescription('🎴 **DEALING YOU A CARD** 🎴\n\n🎯 *Here it comes...*')
    .setTimestamp();
  
  await interaction.editReply({ embeds: [drawEmbed], components: [] });
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  // Add card to hand
  game.playerHand.push(drawCard(game.deck));
  const playerValue = getHandValue(game.playerHand);
  
  if (playerValue > 21) {
    // Bust!
    const bustEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('💥 BUST! 💥')
      .setDescription('🃏 **YOU WENT OVER 21!** 🃏\n\n💔 You lose!')
      .addFields(
        { name: 'Your Hand', value: createAnimatedHand(game.playerHand, true), inline: false },
        { name: 'Total', value: `${playerValue} (BUST)`, inline: true },
        { name: 'Lost', value: `-${game.betAmount} points`, inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [bustEmbed], components: [] });
    blackjackGames.delete(game.userId);
    
    // Update points
    const currentPoints = vouchPoints.get(game.userId) || 0;
    vouchPoints.set(game.userId, currentPoints - game.betAmount);
    savePoints();
    
  } else if (playerValue === 21) {
    // Perfect 21!
    const perfectEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🎯 PERFECT 21! 🎯')
      .setDescription('🃏 **YOU HIT 21!** 🃏\n\n✨ Dealer\'s turn...')
      .addFields(
        { name: 'Your Hand', value: createAnimatedHand(game.playerHand, true), inline: false },
        { name: 'Total', value: '21 (Perfect!)', inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [perfectEmbed], components: [] });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await handleBlackjackEndSlash(interaction, null, 'You got 21!');
    
  } else {
    // Continue game
    await showBlackjackGame(interaction, game);
  }
}

// Handle stand action
async function handleStand(interaction, game) {
  const standEmbed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('✋ You Stand!')
    .setDescription('🃏 **STAYING WITH YOUR HAND** 🃏\n\n🎭 Dealer\'s turn...')
    .addFields(
      { name: 'Your Hand', value: createAnimatedHand(game.playerHand, true), inline: false },
      { name: 'Your Total', value: `${getHandValue(game.playerHand)}`, inline: true }
    )
    .setTimestamp();
  
  await interaction.editReply({ embeds: [standEmbed], components: [] });
  await new Promise(resolve => setTimeout(resolve, 2000));
  await handleBlackjackEndSlash(interaction, null, 'You stand');
}

// Handle double down action
async function handleDouble(interaction, game) {
  const currentPoints = vouchPoints.get(game.userId) || 0;
  if (currentPoints < game.betAmount) {
    await interaction.followUp({ content: '❌ Not enough points to double down!', ephemeral: true });
    return;
  }
  
  game.betAmount *= 2;
  
  const doubleEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('⬆️ DOUBLE DOWN!')
    .setDescription('🎴 **BET DOUBLED!** 🎴\n\n💰 Drawing one final card...')
    .addFields(
      { name: 'New Bet', value: `${game.betAmount} points`, inline: true },
      { name: 'Risk', value: 'HIGH STAKES! 🔥', inline: true }
    )
    .setTimestamp();
  
  await interaction.editReply({ embeds: [doubleEmbed], components: [] });
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Draw exactly one card
  game.playerHand.push(drawCard(game.deck));
  const playerValue = getHandValue(game.playerHand);
  
  if (playerValue > 21) {
    // Double down bust
    const bustEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('💥 DOUBLE DOWN BUST! 💥')
      .setDescription('🃏 **DOUBLE BET LOST!** 🃏\n\n😱 Expensive mistake!')
      .addFields(
        { name: 'Your Hand', value: createAnimatedHand(game.playerHand, true), inline: false },
        { name: 'Total', value: `${playerValue} (BUST)`, inline: true },
        { name: 'Lost', value: `-${game.betAmount} points`, inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [bustEmbed], components: [] });
    blackjackGames.delete(game.userId);
    
    // Update points
    const currentPoints = vouchPoints.get(game.userId) || 0;
    vouchPoints.set(game.userId, currentPoints - game.betAmount);
    savePoints();
    
  } else {
    // Auto-stand after double down
    const doubleStandEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('⬆️ Double Down Complete!')
      .setDescription('🃏 **ONE CARD DRAWN - AUTO STAND** 🃏\n\n🎭 Dealer\'s turn...')
      .addFields(
        { name: 'Your Hand', value: createAnimatedHand(game.playerHand, true), inline: false },
        { name: 'Total', value: `${playerValue}`, inline: true },
        { name: 'Doubled Bet', value: `${game.betAmount} points`, inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [doubleStandEmbed], components: [] });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await handleBlackjackEndSlash(interaction, null, 'Double down complete');
  }
}

// Handle quit action
async function handleQuit(interaction, game) {
  const quitEmbed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('❌ Game Quit')
    .setDescription('🃏 **GAME CANCELLED** 🃏\n\n💸 Bet returned')
    .addFields(
      { name: 'Result', value: 'Game cancelled', inline: true },
      { name: 'Bet Status', value: 'Returned to you', inline: true }
    )
    .setTimestamp();
  
  await interaction.editReply({ embeds: [quitEmbed], components: [] });
  blackjackGames.delete(game.userId);
}

// Create animated hand display
function createAnimatedHand(hand, showAll = false) {
  return hand.map((card, index) => {
    if (!showAll && index === 1) return '🎴'; // Hidden card
    const suitEmojis = { '♠️': '♠️', '♥️': '♥️', '♦️': '♦️', '♣️': '♣️' };
    return `${card.rank}${suitEmojis[card.suit] || card.suit}`;
  }).join(' ');
}

// Enhanced blackjack embed with animations
function createAnimatedBlackjackEmbed(game, showDealerCards) {
  const playerValue = getHandValue(game.playerHand);
  const dealerValue = getHandValue(game.dealerHand);
  
  const playerCards = createAnimatedHand(game.playerHand, true);
  const dealerCards = createAnimatedHand(game.dealerHand, showDealerCards);
  
  const statusText = showDealerCards ? 
    '🎭 **SHOWDOWN TIME!** 🎭' : 
    '🎯 **YOUR TURN TO PLAY** 🎯';
  
  return new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('🃏 Blackjack Table')
    .setDescription(`${statusText}\n\n🎲 *What will you do?*`)
    .addFields(
      { name: `🙋 Your Hand (${playerValue})`, value: `${playerCards}\n**Total: ${playerValue}**`, inline: false },
      { name: `🎭 Dealer Hand ${showDealerCards ? `(${dealerValue})` : ''}`, value: `${dealerCards}${showDealerCards ? `\n**Total: ${dealerValue}**` : '\n*One card hidden*'}`, inline: false },
      { name: '💰 Bet Amount', value: `${game.betAmount} points`, inline: true },
      { name: '🎯 Goal', value: 'Get as close to 21 as possible!', inline: true }
    )
    .setFooter({ text: showDealerCards ? 'Good luck!' : '🃏 Hit | ✋ Stand | ❌ Fold' })
    .setTimestamp();
}

function createDeck() {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  
  // Shuffle deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
}

function drawCard(deck) {
  return deck.pop();
}

function getHandValue(hand) {
  let value = 0;
  let aces = 0;
  
  for (const card of hand) {
    if (card.rank === 'A') {
      aces++;
      value += 11;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank);
    }
  }
  
  // Handle aces
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  
  return value;
}

function createBlackjackEmbed(game, showDealerCards) {
  const playerValue = getHandValue(game.playerHand);
  const dealerValue = getHandValue(game.dealerHand);
  
  const playerCards = game.playerHand.map(card => `${card.rank}${card.suit}`).join(' ');
  const dealerCards = showDealerCards 
    ? game.dealerHand.map(card => `${card.rank}${card.suit}`).join(' ')
    : `${game.dealerHand[0].rank}${game.dealerHand[0].suit} 🎴`;
  
  return new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('🃏 Blackjack')
    .addFields(
      { name: `Your Hand (${playerValue})`, value: playerCards, inline: false },
      { name: `Dealer Hand ${showDealerCards ? `(${dealerValue})` : ''}`, value: dealerCards, inline: false },
      { name: 'Bet Amount', value: `${game.betAmount} points`, inline: true }
    )
    .setFooter({ text: showDealerCards ? '' : '🃏 Hit | ✋ Stand | ❌ Quit' })
    .setTimestamp();
}

async function handleBlackjackEnd(message, playerWon, reason) {
  const game = blackjackGames.get(message.mentions?.users?.first()?.id || message.author.id);
  if (!game) return;
  
  // Play out dealer's hand if needed
  if (playerWon === null) {
    while (getHandValue(game.dealerHand) < 17) {
      game.dealerHand.push(drawCard(game.deck));
    }
    
    const playerValue = getHandValue(game.playerHand);
    const dealerValue = getHandValue(game.dealerHand);
    
    if (dealerValue > 21) {
      playerWon = true;
      reason = 'Dealer busted!';
    } else if (dealerValue > playerValue) {
      playerWon = false;
      reason = 'Dealer wins!';
    } else if (playerValue > dealerValue) {
      playerWon = true;
      reason = 'You win!';
    } else {
      playerWon = null;
      reason = 'Push (tie)!';
    }
  }
  
  // Update points
  const currentPoints = vouchPoints.get(game.userId) || 0;
  let newPoints = currentPoints;
  
  if (playerWon === true) {
    newPoints = currentPoints + game.betAmount;
  } else if (playerWon === false) {
    newPoints = currentPoints - game.betAmount;
  }
  // If tie (playerWon === null), points stay the same
  
  vouchPoints.set(game.userId, newPoints);
  savePoints(); // Save after blackjack
  blackjackGames.delete(game.userId);
  
  const embed = new EmbedBuilder()
    .setColor(playerWon === true ? 0x00FF00 : playerWon === false ? 0xFF0000 : 0xFFFF00)
    .setTitle('🃏 Blackjack - Game Over')
    .setDescription(reason)
    .addFields(
      { name: `Your Hand (${getHandValue(game.playerHand)})`, value: game.playerHand.map(card => `${card.rank}${card.suit}`).join(' '), inline: false },
      { name: `Dealer Hand (${getHandValue(game.dealerHand)})`, value: game.dealerHand.map(card => `${card.rank}${card.suit}`).join(' '), inline: false },
      { name: 'Result', value: playerWon === true ? `+${game.betAmount} points` : playerWon === false ? `-${game.betAmount} points` : 'No change', inline: true },
      { name: 'New Balance', value: `${newPoints} points`, inline: true }
    )
    .setTimestamp();
  
  await message.edit({ embeds: [embed] });
  message.reactions.removeAll();
}

// Handle blackjack end with dealer animations
async function handleBlackjackEndSlash(interaction, playerWon, reason) {
  const userId = interaction.user.id;
  const game = blackjackGames.get(userId);
  
  if (!game) return;
  
  if (playerWon === true) {
    // Player already won (blackjack or 21)
    const currentPoints = vouchPoints.get(userId) || 0;
    vouchPoints.set(userId, currentPoints + game.betAmount);
    savePoints();
    
    const winEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎉 VICTORY! 🎉')
      .setDescription(`🃏 **${reason}** 🃏\n\n🏆 **CONGRATULATIONS!** 🏆`)
      .addFields(
        { name: 'Your Hand', value: createAnimatedHand(game.playerHand, true), inline: false },
        { name: 'Payout', value: `+${game.betAmount} points`, inline: true },
        { name: 'New Balance', value: `${vouchPoints.get(userId)} points`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [winEmbed], components: [] });
    blackjackGames.delete(userId);
    return;
  }
  
  if (playerWon === false) {
    // Player busted
    const currentPoints = vouchPoints.get(userId) || 0;
    vouchPoints.set(userId, currentPoints - game.betAmount);
    savePoints();
    blackjackGames.delete(userId);
    return;
  }
  
  // Dealer's turn with animations
  const dealerRevealEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🎭 Dealer\'s Turn!')
    .setDescription('🃏 **REVEALING DEALER CARDS** 🃏\n\n🎴 *Flipping the hidden card...*')
    .addFields(
      { name: 'Your Hand', value: createAnimatedHand(game.playerHand, true), inline: false },
      { name: 'Your Total', value: `${getHandValue(game.playerHand)}`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [dealerRevealEmbed], components: [] });
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Show dealer's full hand
  const dealerFullEmbed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('🎭 Dealer\'s Cards Revealed!')
    .setDescription('🃏 **DEALER\'S HAND REVEALED** 🃏\n\n🎯 *Dealer must hit on 16 and below...*')
    .addFields(
      { name: 'Your Hand', value: createAnimatedHand(game.playerHand, true), inline: false },
      { name: 'Your Total', value: `${getHandValue(game.playerHand)}`, inline: true },
      { name: 'Dealer Hand', value: createAnimatedHand(game.dealerHand, true), inline: false },
      { name: 'Dealer Total', value: `${getHandValue(game.dealerHand)}`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [dealerFullEmbed] });
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Dealer hits until 17 or higher with animations
  while (getHandValue(game.dealerHand) < 17) {
    const hitEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🃏 Dealer Draws Card...')
      .setDescription('🎴 **DEALER MUST HIT** 🎴\n\n```\n   🃁 ➡️ ❓\n```\n🎭 *Dealer draws another card...*')
      .setTimestamp();

    await interaction.editReply({ embeds: [hitEmbed] });
    await new Promise(resolve => setTimeout(resolve, 1500));

    game.dealerHand.push(drawCard(game.deck));
    
    const newCardEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🎭 Dealer\'s New Card!')
      .setDescription('🃏 **DEALER DREW A CARD** 🃏\n\n🎯 *Checking total...*')
      .addFields(
        { name: 'Your Hand', value: createAnimatedHand(game.playerHand, true), inline: false },
        { name: 'Your Total', value: `${getHandValue(game.playerHand)}`, inline: true },
        { name: 'Dealer Hand', value: createAnimatedHand(game.dealerHand, true), inline: false },
        { name: 'Dealer Total', value: `${getHandValue(game.dealerHand)}`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [newCardEmbed] });
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Determine winner with dramatic reveal
  const playerValue = getHandValue(game.playerHand);
  const dealerValue = getHandValue(game.dealerHand);
  
  let won = false;
  let resultText = '';
  let resultTitle = '';
  let resultColor = 0xFF0000;
  
  if (dealerValue > 21) {
    won = true;
    resultText = '💥 **DEALER BUSTED!** 💥\n\n🎉 You win because the dealer went over 21!';
    resultTitle = '🎉 DEALER BUST - YOU WIN! 🎉';
    resultColor = 0x00FF00;
  } else if (playerValue > dealerValue) {
    won = true;
    resultText = '🏆 **YOUR HAND IS HIGHER!** 🏆\n\n🎉 Congratulations on the victory!';
    resultTitle = '🎉 YOU WIN! 🎉';
    resultColor = 0x00FF00;
  } else if (playerValue === dealerValue) {
    resultText = '🤝 **PUSH - IT\'S A TIE!** 🤝\n\n💰 Your bet is returned to you.';
    resultTitle = '🤝 PUSH - TIE GAME!';
    resultColor = 0xFFD700;
  } else {
    resultText = '😞 **DEALER WINS** 😞\n\n💔 Better luck next time!';
    resultTitle = '💔 DEALER WINS';
    resultColor = 0xFF0000;
  }

  // Final dramatic result
  const finalEmbed = new EmbedBuilder()
    .setColor(resultColor)
    .setTitle(resultTitle)
    .setDescription(`🃏 **FINAL SHOWDOWN** 🃏\n\n${resultText}`)
    .addFields(
      { name: '🙋 Your Final Hand', value: `${createAnimatedHand(game.playerHand, true)}\n**Total: ${playerValue}**`, inline: false },
      { name: '🎭 Dealer Final Hand', value: `${createAnimatedHand(game.dealerHand, true)}\n**Total: ${dealerValue}**`, inline: false },
      { name: '💰 Bet Amount', value: `${game.betAmount} points`, inline: true },
      { name: '📊 Result', value: won ? `+${game.betAmount} points` : playerValue === dealerValue ? 'Bet returned' : `-${game.betAmount} points`, inline: true },
      { name: '🎯 New Balance', value: `${vouchPoints.get(userId) + (won ? game.betAmount : playerValue === dealerValue ? 0 : -game.betAmount)} points`, inline: true }
    )
    .setFooter({ text: won ? 'Congratulations! 🎉' : playerValue === dealerValue ? 'Close game! 🤝' : 'Try again! 🎲' })
    .setTimestamp();

  await interaction.editReply({ embeds: [finalEmbed], components: [] });

  // Update points
  const currentPoints = vouchPoints.get(userId) || 0;
  if (won) {
    vouchPoints.set(userId, currentPoints + game.betAmount);
  } else if (playerValue !== dealerValue) {
    vouchPoints.set(userId, currentPoints - game.betAmount);
  }
  // If tie, points stay the same (bet returned)
  
  savePoints();
  blackjackGames.delete(userId);
}

// Load points when the bot starts
loadPoints();

client.login(process.env.DISCORD_TOKEN); 