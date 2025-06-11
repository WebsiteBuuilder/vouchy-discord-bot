const { Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Persistent storage paths
const dataDir = process.env.DATA_DIR || '/app/data';
const pointsPath = path.join(dataDir, 'points.json');
const backupPath = path.join(dataDir, 'points-backup.json');
const activeGamesPath = path.join(dataDir, 'active-games.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

let vouchPoints = new Map();
let blackjackGames = new Map();

// Function to load vouch points
function loadPoints() {
    try {
        if (fs.existsSync(pointsPath)) {
            const data = fs.readFileSync(pointsPath, 'utf8');
            const parsedData = JSON.parse(data);
            vouchPoints = new Map(Object.entries(parsedData));
            console.log(`✅ Loaded ${vouchPoints.size} user points from ${pointsPath}`);
        } else {
            console.log(`📝 No points file found. Starting fresh.`);
            fs.writeFileSync(pointsPath, JSON.stringify({}));
        }
    } catch (error) {
        console.error('❌ Error loading points:', error);
        if (fs.existsSync(backupPath)) {
            console.log('↩️ Attempting to restore from backup...');
            const backupData = fs.readFileSync(backupPath, 'utf8');
            const parsedBackup = JSON.parse(backupData);
            vouchPoints = new Map(Object.entries(parsedBackup));
            fs.writeFileSync(pointsPath, backupData);
            console.log(`✅ Successfully restored ${vouchPoints.size} points from backup.`);
        }
    }
}

// Function to load active blackjack games
function loadBlackjackGames() {
    try {
        if (fs.existsSync(activeGamesPath) && fs.readFileSync(activeGamesPath, 'utf8').length > 0) {
            const data = fs.readFileSync(activeGamesPath, 'utf8');
            const gamesArray = JSON.parse(data);
            blackjackGames = new Map(gamesArray);
            console.log(`✅ Loaded ${blackjackGames.size} active blackjack games.`);
        } else {
            console.log('🤔 No active blackjack games file found, starting fresh.');
        }
    } catch (error) {
        console.error('❌ Error loading active blackjack games:', error);
    }
}


// Function to save vouch points (with backup)
async function savePoints() {
    try {
        const data = JSON.stringify(Object.fromEntries(vouchPoints), null, 2);
        fs.writeFileSync(pointsPath, data);
        fs.writeFileSync(backupPath, data);
    } catch (error) {
        console.error('❌ Error saving points:', error);
    }
}

// Function to save active blackjack games
async function saveBlackjackGames() {
    try {
        const gamesArray = Array.from(blackjackGames.entries());
        fs.writeFileSync(activeGamesPath, JSON.stringify(gamesArray, null, 2));
    } catch (error) {
        console.error('❌ Error saving active blackjack games:', error);
    }
}

// Load all data on startup
loadPoints();
loadBlackjackGames();

// Handle button interactions for gambling
// This function is now mostly legacy or for non-blackjack buttons
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
  
  // BULLETPROOF BLACKJACK BUTTON HANDLER - Never fails!
  if (interaction.customId.startsWith('bj_')) {
    return await handleBlackjackButton(interaction, userId);
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

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`🚀 Ready! Logged in as ${readyClient.user.tag}`);

    // --- AUTOMATIC TEST USER CLEANUP ---
    const usersToRemove = ['test_user_1', 'test_user_2', 'test_user_3'];
    let usersWereRemoved = false;
    usersToRemove.forEach(userId => {
        if (vouchPoints.has(userId)) {
            vouchPoints.delete(userId);
            console.log(`🧹 Automatically removed test user: ${userId}`);
            usersWereRemoved = true;
        }
    });

    if (usersWereRemoved) {
        console.log('💾 Saving point changes after cleanup...');
        await savePoints();
    }
  
  // Set up periodic auto-save every 15 seconds
  setInterval(savePoints, 15000); 
  console.log(`💾 Auto-save enabled (every 15 seconds)`);
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
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🏆 Vouch Leaderboard')
        .setDescription('📋 **No vouch points recorded yet!**\n\n🎯 **How to get points:**\n• Post images with provider tags in vouch channels\n• Win points through gambling games\n\n🎮 **Try the games:**\n• `/roulette` - European roulette with physics!\n• `/blackjack` - Full blackjack with Double Down!')
        .setFooter({ text: 'Be the first to appear on the leaderboard!' })
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed] });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const leaderboardText = sortedPoints
      .map(([userId, points], index) => {
        const medal = index < 3 ? medals[index] : `${index + 1}.`;
        return `${medal} <@${userId}>: **${points}** points`;
      })
      .join('\n');

    const totalPoints = Array.from(vouchPoints.values()).reduce((sum, points) => sum + points, 0);
    const totalUsers = vouchPoints.size;

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 Vouch Leaderboard - Top Performers')
      .setDescription(leaderboardText)
      .addFields(
        { name: '📊 Stats', value: `👥 **${totalUsers}** users\n💰 **${totalPoints}** total points`, inline: true },
        { name: '🎮 Games', value: '🎰 `/roulette`\n🃏 `/blackjack`', inline: true },
        { name: '📈 Earn Points', value: '🖼️ Post vouches\n🎯 Win at games', inline: true }
      )
      .setFooter({ text: `Showing top ${Math.min(10, sortedPoints.length)} players` })
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
      const stats = fs.existsSync(pointsPath) ? fs.statSync(pointsPath) : null;
      const backupStats = fs.existsSync(backupPath) ? fs.statSync(backupPath) : null;

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('💾 Backup & Storage Info')
        .setDescription('Manual backup completed successfully!')
        .addFields(
          { name: '👥 Total Users', value: `${vouchPoints.size}`, inline: true },
          { name: '📊 Total Points', value: `${Array.from(vouchPoints.values()).reduce((a, b) => a + b, 0)}`, inline: true },
          { name: '📁 Storage Path', value: `${dataDir}`, inline: false },
          { name: '👥 Main File', value: stats ? `✅ ${(stats.size / 1024).toFixed(2)} KB` : '❌ Not found', inline: true },
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
    
    // --- REMOVED CONFIRMATION STEP ---
    // The game now starts immediately for reliability.
    await playBlackjackSlash(interaction, betAmount);
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

  if (interaction.commandName === 'remove-user') {
    // This command is no longer needed due to automatic cleanup
    return interaction.reply({ content: 'This command is deprecated.', ephemeral: true });
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
// IMMERSIVE REALISTIC ROULETTE - Authentic casino experience with physics
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

  // STAGE 1: Authentic Casino Setup
  const setupEmbed = new EmbedBuilder()
    .setColor(0x8B0000)
    .setTitle('🎰 AUTHENTIC EUROPEAN ROULETTE 🎰')
    .setDescription('```\n' +
      '╔════════════════════════════════════════════════╗\n' +
      '║  🎩 CROUPIER: "Place your bets, ladies and     ║\n' +
      '║               gentlemen!"                      ║\n' +
      '║                                                ║\n' +
      '║     🎯 Professional Casino Grade Wheel         ║\n' +
      '║     ⚡ Precision Swiss Bearings                ║\n' +
      '║     🏆 Authentic European Layout               ║\n' +
      '╚════════════════════════════════════════════════╝\n' +
      '```\n' +
      '🥂 *The croupier spins the wheel counter-clockwise...*')
    .addFields(
      { name: '🎲 Your Bet', value: `**${betAmount}** points on **${betType === 'number' ? `Number ${parseInt(betType)}` : betType.toUpperCase()}**`, inline: true },
      { name: '🎯 Odds', value: betType === 'number' ? '35:1' : betType === 'green' ? '14:1' : '2:1', inline: true },
      { name: '🍀 Status', value: 'Bet Locked In', inline: true }
    )
    .setTimestamp();

  await interaction.update({ embeds: [setupEmbed], components: [] });
  await new Promise(resolve => setTimeout(resolve, 1500));

  // STAGE 2: Realistic Wheel Physics Simulation
  const wheelPhases = [
    {
      title: '🌪️ WHEEL ACCELERATION',
      wheel: '```\n' +
        '    ╭─────────────────────────────────────╮\n' +
        '  ╱ 26 🟢 0 🔴 32 ⚫ 15 🔴 19 ⚫ 4 🔴 21 ╲\n' +
        ' │ ⚫ 2 🔴 25 ⚫ 17 🔴 34 ⚫ 6 🔴 27     │\n' +
        ' │   ⚫ 13 🔴 36 ⚫ 11 🔴 30 ⚫ 8       │\n' +
        ' │     🔴 23 ⚫ 10 🔴 5 ⚫ 24 🔴 16     │\n' +
        ' │       ⚫ 33 🔴 1 ⚫ 20 🔴 14 ⚫     │\n' +
        ' │         🔴 31 ⚫ 9 🔴 22 ⚫ 18       │\n' +
        '  ╲ 🔴 29 ⚫ 7 🔴 28 ⚫ 12 🔴 35 ⚫ 3  ╱\n' +
        '    ╰─────────────────────────────────────╯\n' +
        '           🎱 Ball starting to move...\n' +
        '```',
      speed: '⚡ Accelerating... (15 RPM)',
      sound: '*whirr... click click click...*'
    },
    {
      title: '🚀 PEAK VELOCITY',
      wheel: '```\n' +
        '    ╭─────────────────────────────────────╮\n' +
        '  ╱ 🔴 ⚫ 🟢 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ╲\n' +
        ' │ [SPINNING TOO FAST TO READ NUMBERS] │\n' +
        ' │ ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴   │\n' +
        ' │   🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴     │\n' +
        ' │     ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴     │\n' +
        ' │       🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴       │\n' +
        '  ╲ ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴 ⚫ 🔴  ╱\n' +
        '    ╰─────────────────────────────────────╯\n' +
        '              🎱 Ball flying fast!\n' +
        '```',
      speed: '🚀 Maximum Speed (45 RPM)',
      sound: '*WHIRRRRRRR... rapid clicking...*'
    },
    {
      title: '⏳ DECELERATION PHASE',
      wheel: '```\n' +
        '    ╭─────────────────────────────────────╮\n' +
        '  ╱ 26 🟢 0 🔴 32 ⚫ 15 🔴 19 ⚫ 4 🔴 21 ╲\n' +
        ' │ ⚫ 2 🔴 25 ⚫ 17 🔴 34 ⚫ 6 🔴 27     │\n' +
        ' │   ⚫ 13 🔴 36 ⚫ 11 🔴 30 ⚫ 8       │\n' +
        ' │     🔴 23 ⚫ 10 🔴 5 ⚫ 24 🔴 16     │\n' +
        ' │       ⚫ 33 🔴 1 ⚫ 20 🔴 14 ⚫     │\n' +
        ' │         🔴 31 ⚫ 9 🔴 22 ⚫ 18       │\n' +
        '  ╲ 🔴 29 ⚫ 7 🔴 28 ⚫ 12 🔴 35 ⚫ 3  ╱\n' +
        '    ╰─────────────────────────────────────╯\n' +
        '        🎱 Ball losing momentum...\n' +
        '```',
      speed: '⏳ Slowing Down... (8 RPM)',
      sound: '*click... click... click...*'
    }
  ];

  // Animate realistic wheel physics
  for (let i = 0; i < wheelPhases.length; i++) {
    const phase = wheelPhases[i];
    const physicsEmbed = new EmbedBuilder()
      .setColor(0xFF4500)
      .setTitle(phase.title)
      .setDescription(phase.wheel)
      .addFields(
        { name: '🎲 Your Bet', value: `${betAmount} points on **${betType === 'number' ? `Number ${parseInt(betType)}` : betType.toUpperCase()}**`, inline: true },
        { name: '⚡ Wheel Speed', value: phase.speed, inline: true },
        { name: '🔊 Casino Sounds', value: phase.sound, inline: true }
      )
      .setFooter({ text: `🎰 Physics Simulation • Ball trajectory calculated in real-time` })
      .setTimestamp();

    await interaction.editReply({ embeds: [physicsEmbed] });
    await new Promise(resolve => setTimeout(resolve, 900));
  }

  // STAGE 3: Final Moments - Ball Settling
  const numberColor = isGreen ? '🟢' : isRed ? '🔴' : '⚫';
  const finalMomentsEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🎯 FINAL MOMENTS')
    .setDescription('```\n' +
      '    ╭─────────────────────────────────────╮\n' +
      '  ╱ 26 🟢 0 🔴 32 ⚫ 15 🔴 19 ⚫ 4 🔴 21 ╲\n' +
      ' │ ⚫ 2 🔴 25 ⚫ 17 🔴 34 ⚫ 6 🔴 27     │\n' +
      ' │   ⚫ 13 🔴 36 ⚫ 11 🔴 30 ⚫ 8       │\n' +
      ' │     🔴 23 ⚫ 10 🔴 5 ⚫ 24 🔴 16     │\n' +
      ' │       ⚫ 33 🔴 1 ⚫ 20 🔴 14 ⚫     │\n' +
      ' │         🔴 31 ⚫ 9 🔴 22 ⚫ 18       │\n' +
      '  ╲ 🔴 29 ⚫ 7 🔴 28 ⚫ 12 🔴 35 ⚫ 3  ╱\n' +
      '    ╰─────────────────────────────────────╯\n' +
      '           🎱 Ball bouncing... settling...\n' +
      '```\n' +
      '🔥 **The wheel is almost stopped... ball bouncing between pockets...**')
    .addFields(
      { name: '⚡ Wheel Speed', value: '⏳ Nearly stopped (1 RPM)', inline: true },
      { name: '🎱 Ball Status', value: 'Bouncing between pockets', inline: true },
      { name: '💭 Tension', value: '████████████ MAXIMUM', inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [finalMomentsEmbed] });
  await new Promise(resolve => setTimeout(resolve, 1300));

  // STAGE 4: Dramatic Result with Authentic Layout
  const realRouletteWheel = `
    ╭─────────────────────────────────────╮
  ╱ 26 🟢 0 🔴 32 ⚫ 15 🔴 19 ⚫ 4 🔴 21 ╲
 │ ⚫ 2 🔴 25 ⚫ 17 🔴 34 ⚫ 6 🔴 27     │
 │   ⚫ 13 🔴 36 ⚫ 11 🔴 30 ⚫ 8       │
 │     🔴 23 ⚫ 10 🔴 5 ⚫ 24 🔴 16     │
 │       ⚫ 33 🔴 1 ⚫ 20 🔴 14 ⚫     │
 │         🔴 31 ⚫ 9 🔴 22 ⚫ 18       │
  ╲ 🔴 29 ⚫ 7 🔴 28 ⚫ 12 🔴 35 ⚫ 3  ╱
    ╰─────────────────────────────────────╯
            🎱 LANDED ON: ${numberColor} ${spin}`;

  const winnerAnnouncement = won 
    ? `🎊 **"${spin} ${numberColor} WINS!"** 🎊\n\n🏆 **CONGRATULATIONS!** 🏆\n${resultText}`
    : `💔 **"${spin} ${numberColor}"** 💔\n\n😤 **HOUSE WINS THIS TIME** \n${resultText}`;

  // Update points
  const currentPoints = vouchPoints.get(userId) || 0;
  if (won) {
    vouchPoints.set(userId, currentPoints - betAmount + payout);
  } else {
    vouchPoints.set(userId, currentPoints - betAmount);
  }
  savePoints();

  const resultEmbed = new EmbedBuilder()
    .setColor(won ? 0x00FF00 : 0xFF0000)
    .setTitle('🎰 RESULT ANNOUNCEMENT 🎰')
    .setDescription('```' + realRouletteWheel + '```\n\n' + winnerAnnouncement)
    .addFields(
      { name: '🎲 Your Bet', value: `${betAmount} points on **${betType === 'number' ? `Number ${parseInt(betType)}` : betType.toUpperCase()}**`, inline: false },
      { name: '🎯 Winning Number', value: `**${numberColor} ${spin}**`, inline: true },
      { name: '💰 Result', value: won ? `**+${payout - betAmount}** points` : `**-${betAmount}** points`, inline: true },
      { name: '💳 Balance', value: `**${vouchPoints.get(userId)}** points`, inline: true }
    )
    .setFooter({ 
      text: won 
        ? `🎊 ${interaction.user.username} • The house congratulates you!`
        : `🎰 ${interaction.user.username} • Thank you for playing authentic roulette!` 
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [resultEmbed] });

  // BONUS: Winner celebration (only for big wins)
  if (won && (payout - betAmount) >= 50) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const bigWinEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🎊 BIG WINNER! 🎊')
      .setDescription('```\n' +
        '╔════════════════════════════════════════════════╗\n' +
        '║                                                ║\n' +
        '║      🍾 CHAMPAGNE SERVICE! 🍾                  ║\n' +
        '║                                                ║\n' +
        '║    🎺 The house band plays a victory march!    ║\n' +
        '║                                                ║\n' +
        '║      🏆 You are a true high roller! 🏆        ║\n' +
        '╚════════════════════════════════════════════════╝\n' +
        '```\n' +
        `🥂 **Your ${payout - betAmount} point win is spectacular!**`)
      .setTimestamp();

    await interaction.followUp({ embeds: [bigWinEmbed] });
  }
}

// Blackjack game storage
// This is now loaded from a file at the top level
// const blackjackGames = new Map();

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

// BULLETPROOF BLACKJACK BUTTON HANDLER
async function handleBlackjackButton(interaction, clickerId) {
  try {
    // ALWAYS defer first - this prevents ANY timeout issues
    await interaction.deferUpdate().catch(() => {}); // Ignore if already deferred

    const gameOwnerId = interaction.customId.split('_')[2];

    // Check if the person who clicked is the person who started the game
    if (clickerId !== gameOwnerId) {
      return interaction.followUp({ content: 'This is not your game! Start your own with `/bj`.', ephemeral: true });
    }
    
    const game = blackjackGames.get(gameOwnerId);
    if (!game) {
      return await safeReply(interaction, {
        embeds: [createErrorEmbed('🃏 Game not found!', 'Your blackjack game has expired or was not found. This can happen after 10 minutes of inactivity.')],
        components: []
      });
    }
    
    const action = interaction.customId.split('_')[1]; // Extract action from bj_ACTION_userId
    
    switch (action) {
      case 'hit':
        return await handleHit(interaction, game);
      case 'stand':
        return await handleStand(interaction, game);
      case 'double':
        return await handleDoubleDown(interaction, game);
      case 'quit':
        return await handleQuit(interaction, game);
      default:
        return await safeReply(interaction, {
          embeds: [createErrorEmbed('❌ Unknown Action', 'Invalid button action detected.')],
          components: []
        });
    }
  } catch (error) {
    console.error('Blackjack button error:', error);
    return await safeReply(interaction, {
      embeds: [createErrorEmbed('🔧 System Error', 'A technical error occurred. Please try starting a new game.')],
      components: []
    });
  }
}

// A truly safe reply/edit/followUp function that never fails.
async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(options);
    } else {
      await interaction.reply(options);
    }
  } catch (error) {
    console.error(`Primary interaction failed: ${error.message}. Attempting fallback...`);
    try {
      await interaction.followUp({ ...options, ephemeral: true });
    } catch (fallbackError) {
      console.error(`All interaction methods failed: ${fallbackError.message}`);
    }
  }
}

// Create error embed
function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

// BULLETPROOF BLACKJACK ACTIONS
async function handleHit(interaction, game) {
  game.playerHand.push(drawCard(game.deck));
  const playerValue = getHandValue(game.playerHand);
  
  if (playerValue > 21) {
    return await endGame(interaction, game, false, '💥 BUST! You went over 21!');
  } else if (playerValue === 21) {
    return await endGame(interaction, game, null, '🎯 Perfect 21! Dealer\'s turn...');
  } else {
    const embed = createBlackjackEmbed(game, false);
    const buttons = createBlackjackButtons(game.userId, false); // No more double down after hit
    return await safeReply(interaction, { embeds: [embed], components: [buttons] });
  }
}

async function handleStand(interaction, game) {
  return await endGame(interaction, game, null, '✋ You stand. Dealer\'s turn...');
}

async function handleDoubleDown(interaction, game) {
  if (game.playerHand.length !== 2) {
    return await safeReply(interaction, {
      embeds: [createErrorEmbed('❌ Cannot Double Down', 'Double down is only allowed on your first two cards!')],
      components: [createBlackjackButtons(game.userId, false)]
    });
  }
  
  const userPoints = vouchPoints.get(game.userId) || 0;
  if (userPoints < game.betAmount) {
    return await safeReply(interaction, {
      embeds: [createErrorEmbed('💰 Insufficient Points', `You need ${game.betAmount} more points to double down!`)],
      components: [createBlackjackButtons(game.userId, true)]
    });
  }
  
  // Double the bet and mark as double down
  game.betAmount *= 2;
  game.isDoubleDown = true;
  
  // Draw exactly one card
  game.playerHand.push(drawCard(game.deck));
  const playerValue = getHandValue(game.playerHand);
  
  if (playerValue > 21) {
    return await endGame(interaction, game, false, '💥 DOUBLE DOWN BUST! You went over 21!');
  } else {
    return await endGame(interaction, game, null, '💰 DOUBLE DOWN! Dealer\'s turn...');
  }
}

async function handleQuit(interaction, game) {
  blackjackGames.delete(game.userId);
  await saveBlackjackGames();
  
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🃏 Blackjack - Game Quit')
    .setDescription('Game cancelled. Your bet has been returned.')
    .addFields(
      { name: '💰 Bet Returned', value: `${game.betAmount} points`, inline: true },
      { name: '👋 Status', value: 'No points lost', inline: true }
    )
    .setTimestamp();
  
  return await safeReply(interaction, { embeds: [embed], components: [] });
}

// Enhanced game ending logic
async function endGame(interaction, game, playerWon, reason) {
  // Play dealer's hand if needed
  if (playerWon === null) {
    while (getHandValue(game.dealerHand) < 17) {
      game.dealerHand.push(drawCard(game.deck));
    }
    
    const playerValue = getHandValue(game.playerHand);
    const dealerValue = getHandValue(game.dealerHand);
    
    if (dealerValue > 21) {
      playerWon = true;
      reason = game.isDoubleDown ? '🎉 DEALER BUST! Double Down WIN!' : '🎉 DEALER BUST! You win!';
    } else if (dealerValue > playerValue) {
      playerWon = false;
      reason = game.isDoubleDown ? '😞 Dealer wins (Double Down loss)' : '😞 Dealer wins!';
    } else if (playerValue > dealerValue) {
      playerWon = true;
      reason = game.isDoubleDown ? '🎉 YOU WIN! Double Down success!' : '🎉 YOU WIN!';
    } else {
      playerWon = null;
      reason = game.isDoubleDown ? '🤝 PUSH! Double Down returned' : '🤝 PUSH! It\'s a tie!';
    }
  }
  
  // Update points
  const currentPoints = vouchPoints.get(game.userId) || 0;
  let newPoints = currentPoints;
  let pointChange = 0;
  
  if (playerWon === true) {
    pointChange = +game.betAmount;
    newPoints = currentPoints + game.betAmount;
  } else if (playerWon === false) {
    pointChange = -game.betAmount;
    newPoints = currentPoints - game.betAmount;
  }
  
  vouchPoints.set(game.userId, newPoints);
  savePoints();
  blackjackGames.delete(game.userId);
  await saveBlackjackGames();
  
  // Create result embed
  const color = playerWon === true ? 0x00FF00 : playerWon === false ? 0xFF0000 : 0xFFD700;
  const resultEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🃏 BLACKJACK - GAME OVER')
    .setDescription(reason)
    .addFields(
      { name: '🎴 Your Hand', value: `${game.playerHand.map(card => `${card.rank}${card.suit}`).join(' ')}\n**Total: ${getHandValue(game.playerHand)}**`, inline: true },
      { name: '🎩 Dealer Hand', value: `${game.dealerHand.map(card => `${card.rank}${card.suit}`).join(' ')}\n**Total: ${getHandValue(game.dealerHand)}**`, inline: true },
      { name: '💰 Bet', value: `${game.betAmount} points${game.isDoubleDown ? '\n💎 (DOUBLED!)' : ''}`, inline: true },
      { name: '📊 Result', value: pointChange > 0 ? `+${pointChange} points` : pointChange < 0 ? `${pointChange} points` : 'No change', inline: true },
      { name: '🏦 Balance', value: `${newPoints} points`, inline: true },
      { name: '🎯 Status', value: playerWon === true ? '🏆 WINNER!' : playerWon === false ? '💔 LOSS' : '🤝 TIE', inline: true }
    )
    .setFooter({ text: game.isDoubleDown ? '💰 Double Down game completed!' : '🃏 Standard blackjack completed' })
    .setTimestamp();
  
  return await safeReply(interaction, { embeds: [resultEmbed], components: [] });
}

// Create blackjack buttons
function createBlackjackButtons(userId, canDoubleDown = true) {
  const buttons = [
    new ButtonBuilder()
      .setCustomId(`bj_hit_${userId}`)
      .setLabel('🃏 Hit Me!')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`bj_stand_${userId}`)
      .setLabel('✋ I Stand')
      .setStyle(ButtonStyle.Secondary)
  ];
  
  if (canDoubleDown) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`bj_double_${userId}`)
        .setLabel('💰 Double Down!')
        .setStyle(ButtonStyle.Success)
    );
  }
  
  buttons.push(
    new ButtonBuilder()
      .setCustomId(`bj_quit_${userId}`)
      .setLabel('❌ Quit')
      .setStyle(ButtonStyle.Danger)
  );
  
  return new ActionRowBuilder().addComponents(buttons);
}

// BULLETPROOF blackjack slash command
async function playBlackjackSlash(interaction, betAmount) {
  const userId = interaction.user.id;
  
  try {
    // Clean up any existing game
    if (blackjackGames.has(userId)) {
      blackjackGames.delete(userId);
    }
    
    // Create fresh deck and deal cards
    const deck = createDeck();
    const playerHand = [drawCard(deck), drawCard(deck)];
    const dealerHand = [drawCard(deck), drawCard(deck)];
    
    const game = {
      deck,
      playerHand,
      dealerHand,
      betAmount,
      userId,
      isDoubleDown: false,
      timestamp: Date.now()
    };
    
    blackjackGames.set(userId, game);
    await saveBlackjackGames();
    
    const playerValue = getHandValue(playerHand);
    
    // Check for blackjack (21 with first two cards)
    if (playerValue === 21) {
      return await endGame(interaction, game, true, '🎉 BLACKJACK! Perfect 21 with your first two cards!');
    }
    
    const embed = createBlackjackEmbed(game, false);
    const buttons = createBlackjackButtons(userId, true);
    
    // Use the new safeReply function for the initial game message.
    await safeReply(interaction, { embeds: [embed], components: [buttons] });
    
    // Auto-cleanup after 10 minutes
    setTimeout(async () => {
      const currentGame = blackjackGames.get(userId);
      // Only delete if the game is still the same one, preventing race conditions
      if (currentGame && currentGame.timestamp === game.timestamp) {
        blackjackGames.delete(userId);
        await saveBlackjackGames();
        console.log(`⏰ Timed out and removed blackjack game for user ${userId}`);
      }
    }, 600000);
    
  } catch (error) {
    console.error('Blackjack start error:', error);
    const errorEmbed = createErrorEmbed('🔧 Game Start Error', 'Failed to start blackjack. Please try again.');
    await safeReply(interaction, { embeds: [errorEmbed], components: [] });
  }
}

// Legacy reaction handler removed - now using modern button system

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
  await saveBlackjackGames();
  
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

client.login(process.env.DISCORD_TOKEN); 