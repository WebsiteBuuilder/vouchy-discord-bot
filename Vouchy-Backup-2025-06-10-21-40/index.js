const { Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Persistent storage for points - use Railway volume mount
const VOLUME_PATH = '/app/data';
const POINTS_FILE = path.join(VOLUME_PATH, 'points.json');
const BACKUP_POINTS_FILE = path.join(VOLUME_PATH, 'points-backup.json');
const vouchPoints = new Map();

// Load points from file on startup
function loadPoints() {
  try {
    // Ensure the volume directory exists
    if (!fs.existsSync(VOLUME_PATH)) {
      fs.mkdirSync(VOLUME_PATH, { recursive: true });
      console.log(`📁 Created directory: ${VOLUME_PATH}`);
    }
    
    // Try to load from main points file
    if (fs.existsSync(POINTS_FILE)) {
      try {
        const data = fs.readFileSync(POINTS_FILE, 'utf8');
        const pointsObj = JSON.parse(data);
        Object.entries(pointsObj).forEach(([userId, points]) => {
          vouchPoints.set(userId, points);
        });
        console.log(`✅ Loaded ${vouchPoints.size} user points from ${POINTS_FILE}`);
        
        // Create backup on successful load
        fs.writeFileSync(BACKUP_POINTS_FILE, data);
        console.log(`💾 Created backup at ${BACKUP_POINTS_FILE}`);
        
      } catch (error) {
        console.error(`❌ Error reading main points file: ${error.message}`);
        console.log(`🔄 Attempting to load from backup...`);
        
        // Try backup file
        if (fs.existsSync(BACKUP_POINTS_FILE)) {
          const backupData = fs.readFileSync(BACKUP_POINTS_FILE, 'utf8');
          const pointsObj = JSON.parse(backupData);
          Object.entries(pointsObj).forEach(([userId, points]) => {
            vouchPoints.set(userId, points);
          });
          console.log(`✅ Loaded ${vouchPoints.size} user points from backup`);
          
          // Restore main file from backup
          fs.writeFileSync(POINTS_FILE, backupData);
          console.log(`🔄 Restored main points file from backup`);
        }
      }
    } else {
      console.log(`📋 No points file found at ${POINTS_FILE}, starting fresh`);
      
      // Check if backup exists
      if (fs.existsSync(BACKUP_POINTS_FILE)) {
        console.log(`🔄 Found backup file, restoring...`);
        const backupData = fs.readFileSync(BACKUP_POINTS_FILE, 'utf8');
        const pointsObj = JSON.parse(backupData);
        Object.entries(pointsObj).forEach(([userId, points]) => {
          vouchPoints.set(userId, points);
        });
        console.log(`✅ Loaded ${vouchPoints.size} user points from backup`);
        
        // Restore main file
        fs.writeFileSync(POINTS_FILE, backupData);
        console.log(`🔄 Restored main points file`);
      }
    }
    
    console.log(`🎯 Points tracking system ready with ${vouchPoints.size} users`);
    
  } catch (error) {
    console.error('💥 Critical error loading points:', error);
    console.log('🚀 Starting with empty points database');
  }
}

// Save points to file with backup
function savePoints() {
  try {
    // Ensure the volume directory exists
    if (!fs.existsSync(VOLUME_PATH)) {
      fs.mkdirSync(VOLUME_PATH, { recursive: true });
      console.log(`📁 Created directory: ${VOLUME_PATH}`);
    }
    
    const pointsObj = {};
    vouchPoints.forEach((points, userId) => {
      pointsObj[userId] = points;
    });
    
    const jsonData = JSON.stringify(pointsObj, null, 2);
    
    // Write to main file
    fs.writeFileSync(POINTS_FILE, jsonData);
    
    // Write to backup file
    fs.writeFileSync(BACKUP_POINTS_FILE, jsonData);
    
    console.log(`💾 Points saved successfully to ${POINTS_FILE} (${vouchPoints.size} users)`);
    
  } catch (error) {
    console.error('❌ Error saving points:', error);
    
    // Try alternative method
    try {
      const pointsArray = Array.from(vouchPoints.entries());
      fs.writeFileSync(path.join(VOLUME_PATH, 'points-emergency.json'), JSON.stringify(pointsArray));
      console.log('🚨 Emergency backup created');
    } catch (emergencyError) {
      console.error('💥 Emergency backup also failed:', emergencyError);
    }
  }
}

// Call loadPoints when bot starts
loadPoints();

// Handle button interactions for gambling
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
  
  // Handle blackjack game buttons
  if (interaction.customId.startsWith('blackjack_')) {
    const game = blackjackGames.get(userId);
    if (!game) {
      return interaction.reply({ content: 'Game not found!', ephemeral: true });
    }
    
    if (interaction.customId === 'blackjack_hit') {
      // Hit
      game.playerHand.push(drawCard(game.deck));
      const playerValue = getHandValue(game.playerHand);
      
      if (playerValue > 21) {
        await handleBlackjackEndSlash(interaction, false, 'Bust! You went over 21');
      } else if (playerValue === 21) {
        await handleBlackjackEndSlash(interaction, null, 'You got 21! Dealer\'s turn...');
      } else {
        const embed = createBlackjackEmbed(game, false);
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('blackjack_hit')
              .setLabel('🃏 Hit')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('blackjack_stand')
              .setLabel('✋ Stand')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('blackjack_quit')
              .setLabel('❌ Quit')
              .setStyle(ButtonStyle.Danger)
          );
        await interaction.update({ embeds: [embed], components: [row] });
      }
    } else if (interaction.customId === 'blackjack_stand') {
      // Stand
      await handleBlackjackEndSlash(interaction, null, 'You stand. Dealer\'s turn...');
    } else if (interaction.customId === 'blackjack_quit') {
      // Quit
      blackjackGames.delete(userId);
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🃏 Blackjack - Game Quit')
        .setDescription('Game cancelled. Your bet has been returned.')
        .setTimestamp();
      
      await interaction.update({ embeds: [embed], components: [] });
    }
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
client.on(Events.InteractionCreate, async (interaction) => {
  // Handle button interactions for gambling games
  if (interaction.isButton()) {
    await handleButtonInteraction(interaction);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'points') {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const points = vouchPoints.get(targetUser.id) || 0;
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📊 Vouch Points')
      .setDescription(`<@${targetUser.id}> has **${points}** vouch points`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'leaderboard') {
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

  if (interaction.commandName === 'addpoints') {
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

  if (interaction.commandName === 'backup') {
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
  if (interaction.commandName === 'roulette') {
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
    
    // Store bet info for confirmation
    const collector = response.createMessageComponentCollector({ time: 30000 });
    
    collector.on('collect', async i => {
      if (i.user.id !== userId) {
        return i.reply({ content: 'This is not your bet!', ephemeral: true });
      }
      
      if (i.customId === 'roulette_confirm') {
        await playRouletteSlash(i, betAmount, finalBetType);
      } else {
        const cancelEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Bet Cancelled')
          .setDescription('Your roulette bet has been cancelled.')
          .setTimestamp();
        
        await i.update({ embeds: [cancelEmbed], components: [] });
      }
    });
    
    collector.on('end', collected => {
      if (collected.size === 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('⏰ Bet Expired')
          .setDescription('Your roulette bet has expired.')
          .setTimestamp();
        
        interaction.editReply({ embeds: [timeoutEmbed], components: [] });
      }
    });
  }

  // Blackjack slash command
  if (interaction.commandName === 'blackjack') {
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
    
    const collector = response.createMessageComponentCollector({ time: 30000 });
    
    collector.on('collect', async i => {
      if (i.user.id !== userId) {
        return i.reply({ content: 'This is not your bet!', ephemeral: true });
      }
      
      if (i.customId === 'blackjack_confirm') {
        await playBlackjackSlash(i, betAmount);
      } else {
        const cancelEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Bet Cancelled')
          .setDescription('Your blackjack bet has been cancelled.')
          .setTimestamp();
        
        await i.update({ embeds: [cancelEmbed], components: [] });
      }
    });
    
    collector.on('end', collected => {
      if (collected.size === 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('⏰ Bet Expired')
          .setDescription('Your blackjack bet has expired.')
          .setTimestamp();
        
        interaction.editReply({ embeds: [timeoutEmbed], components: [] });
      }
    });
  }

  // Send points slash command
  if (interaction.commandName === 'send') {
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

// Slash command version of roulette
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
  
  // Update points
  const currentPoints = vouchPoints.get(userId) || 0;
  if (won) {
    vouchPoints.set(userId, currentPoints - betAmount + payout);
  } else {
    vouchPoints.set(userId, currentPoints - betAmount);
  }
  savePoints();
  
  const embed = new EmbedBuilder()
    .setColor(won ? 0x00FF00 : 0xFF0000)
    .setTitle('🎰 Roulette Results')
    .setDescription(`**Ball landed on: ${spin}**\n${resultText}`)
    .addFields(
      { name: 'Bet Amount', value: `${betAmount} points`, inline: true },
      { name: 'Result', value: won ? `+${payout - betAmount} points` : `-${betAmount} points`, inline: true },
      { name: 'New Balance', value: `${vouchPoints.get(userId)} points`, inline: true }
    )
    .setFooter({ text: `${interaction.user.username}` })
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed] });
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

// Slash command version of blackjack
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
  
  const playerValue = getHandValue(playerHand);
  
  if (playerValue === 21) {
    // Blackjack!
    return handleBlackjackEndSlash(interaction, true, 'Blackjack! 🎉');
  }
  
  const embed = createBlackjackEmbed(game, false);
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('blackjack_hit')
        .setLabel('🃏 Hit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('blackjack_stand')
        .setLabel('✋ Stand')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('blackjack_quit')
        .setLabel('❌ Quit')
        .setStyle(ButtonStyle.Danger)
    );
  
  const reply = await interaction.update({ embeds: [embed], components: [row] });
  
  // Set up button collector
  const collector = reply.createMessageComponentCollector({ time: 300000 }); // 5 minutes
  
  collector.on('collect', async i => {
    if (i.user.id !== userId) {
      return i.reply({ content: 'This is not your game!', ephemeral: true });
    }
    
    const currentGame = blackjackGames.get(userId);
    if (!currentGame) {
      return i.reply({ content: 'Game not found!', ephemeral: true });
    }
    
    if (i.customId === 'blackjack_hit') {
      // Hit
      currentGame.playerHand.push(drawCard(currentGame.deck));
      const playerValue = getHandValue(currentGame.playerHand);
      
      if (playerValue > 21) {
        await handleBlackjackEndSlash(i, false, 'Bust! You went over 21');
      } else if (playerValue === 21) {
        await handleBlackjackEndSlash(i, null, 'You got 21! Dealer\'s turn...');
      } else {
        const embed = createBlackjackEmbed(currentGame, false);
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('blackjack_hit')
              .setLabel('🃏 Hit')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('blackjack_stand')
              .setLabel('✋ Stand')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('blackjack_quit')
              .setLabel('❌ Quit')
              .setStyle(ButtonStyle.Danger)
          );
        await i.update({ embeds: [embed], components: [row] });
      }
    } else if (i.customId === 'blackjack_stand') {
      // Stand
      await handleBlackjackEndSlash(i, null, 'You stand. Dealer\'s turn...');
    } else if (i.customId === 'blackjack_quit') {
      // Quit
      blackjackGames.delete(userId);
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🃏 Blackjack - Game Quit')
        .setDescription('Game cancelled. Your bet has been returned.')
        .setTimestamp();
      
      await i.update({ embeds: [embed], components: [] });
    }
  });
  
  collector.on('end', () => {
    if (blackjackGames.has(userId)) {
      blackjackGames.delete(userId);
    }
  });
}

// Handle blackjack reactions
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  
  const game = blackjackGames.get(user.id);
  if (!game) return;
  
  if (reaction.message.author.id !== client.user.id) return;
  
  const emoji = reaction.emoji.name;
  
  if (emoji === '🃏') {
    // Hit
    game.playerHand.push(drawCard(game.deck));
    const playerValue = getHandValue(game.playerHand);
    
    if (playerValue > 21) {
      if (game.isSlashCommand) {
        handleBlackjackEndSlash(reaction.message, false, 'Bust! You went over 21');
      } else {
        handleBlackjackEnd(reaction.message, false, 'Bust! You went over 21');
      }
    } else if (playerValue === 21) {
      if (game.isSlashCommand) {
        handleBlackjackEndSlash(reaction.message, null, 'You got 21! Dealer\'s turn...');
      } else {
        handleBlackjackEnd(reaction.message, null, 'You got 21! Dealer\'s turn...');
      }
    } else {
      const embed = createBlackjackEmbed(game, false);
      reaction.message.edit({ embeds: [embed] });
    }
  } else if (emoji === '✋') {
    // Stand
    if (game.isSlashCommand) {
      handleBlackjackEndSlash(reaction.message, null, 'You stand. Dealer\'s turn...');
    } else {
      handleBlackjackEnd(reaction.message, null, 'You stand. Dealer\'s turn...');
    }
  } else if (emoji === '❌') {
    // Quit
    blackjackGames.delete(user.id);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🃏 Blackjack - Game Quit')
      .setDescription('Game cancelled. Your bet has been returned.')
      .setTimestamp();
    
    reaction.message.edit({ embeds: [embed] });
    reaction.message.reactions.removeAll();
  }
  
  // Remove user's reaction
  await reaction.users.remove(user.id);
});

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

// Slash command version of handleBlackjackEnd
async function handleBlackjackEndSlash(messageOrInteraction, playerWon, reason) {
  // Find the game based on the user who reacted
  let userId;
  if (messageOrInteraction.author) {
    // This is a message from reaction
    const games = Array.from(blackjackGames.entries());
    const gameEntry = games.find(([, game]) => game.isSlashCommand);
    if (!gameEntry) return;
    userId = gameEntry[0];
  } else {
    // This is an interaction
    userId = messageOrInteraction.user.id;
  }
  
  const game = blackjackGames.get(userId);
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
  
  await messageOrInteraction.update({ embeds: [embed], components: [] });
}

client.login(process.env.DISCORD_TOKEN); 