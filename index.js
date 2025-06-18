const { Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const { setTimeout } = require('timers/promises');
const { Storage } = require('./storage.js');
const multiplayerRoulette = require('./multiplayer-roulette.js');
require('dotenv').config();

// NEW BULLETPROOF STORAGE SYSTEM
const storage = require('./storage.js');

// In-memory timer management for roulette - doesn't need to be persisted
const rouletteTimers = new Map();

// NEW STORAGE SYSTEM - All data managed by storage.js
// Legacy variables removed - using storage directly now

// LEGACY FUNCTION - Now handled by storage.js
// Storage is automatically loaded when storage.js is imported

// LEGACY FUNCTIONS - Now handled by storage.js
// All data loading/saving is automatically managed by the storage module

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
    case 'even':
    case 'odd':
    case 'high':
    case 'low':
      return `${betAmount * 2} points (2x)`;
    case 'first-dozen':
    case 'second-dozen':
    case 'third-dozen':
    case 'first-column':
    case 'second-column':
    case 'third-column':
      return `${betAmount * 3} points (3x)`;
    case 'green':
    case 'straight':
      return `${betAmount * 36} points (36x)`;
    default:
      return `${betAmount * 2} points`;
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`🚀 Ready! Logged in as ${readyClient.user.tag}`);
  console.log(`🔧 Using ${storage.getStats().environment} storage system`);
  console.log(`📊 Current data: ${storage.getStats().userCount} users, ${storage.getStats().totalPoints} points`);

    // --- AUTOMATIC TEST USER CLEANUP ---
    const usersToRemove = ['test_user_1', 'test_user_2', 'test_user_3'];
    let usersWereRemoved = false;
    usersToRemove.forEach(userId => {
        if (storage.getPoints(userId) > 0) {
            storage.deleteUser(userId);
            console.log(`🧹 Automatically removed test user: ${userId}`);
            usersWereRemoved = true;
        }
    });

    if (usersWereRemoved) {
        console.log('💾 Test users cleaned up automatically');
    }
  
  console.log(`💾 Storage auto-save is handled by storage.js`);
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

  console.log(`🎯 Awarding point to the voucher: ${message.author.username}...`);

  // Award point to the author of the message for making a valid vouch
  const authorId = message.author.id;
  const currentPoints = storage.getPoints(authorId);
  const newPoints = currentPoints + POINTS_PER_VOUCH;
  storage.setPoints(authorId, newPoints);
  
  // Send confirmation message
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Vouch Successful!')
    .setDescription(`Thank you, <@${authorId}>, for vouching for **${mentionedProviders.map(p => p.username).join(', ')}**!`)
    .addFields(
        { name: 'Points Awarded', value: `+${POINTS_PER_VOUCH}`, inline: true },
        { name: 'Your New Balance', value: `${newPoints} points`, inline: true }
    )
    .setFooter({ text: `Your contribution helps the community!` })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
  console.log(`🎉 Vouch processed successfully! ${message.author.username} received ${POINTS_PER_VOUCH} point.`);
});

// Slash command to check points
client.on(Events.InteractionCreate, async (interaction) => {
  // Handle button interactions for gambling games
  if (interaction.isButton()) {
    await handleButtonInteraction(interaction);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  // --- HOTKEY EXECUTION ---
  if (storage.getHotkey(interaction.commandName)) {
    const message = storage.getHotkey(interaction.commandName);
    const finalMessage = message.replace(/{user}/g, `<@${interaction.user.id}>`);
    return interaction.reply(finalMessage);
  }

  // --- NEW MULTIPLAYER ROULETTE ---
  if (interaction.commandName === 'roulette-start') {
    return handleRouletteStart(interaction);
  }
  if (interaction.commandName === 'bet') {
    return handleBet(interaction);
  }

  if (interaction.commandName === 'vouch') {
    // Find the first channel with 'vouch' in its name to link to it.
    const vouchChannel = interaction.guild.channels.cache.find(c => c.name.toLowerCase().includes('vouch'));
    const vouchChannelMention = vouchChannel ? `<#${vouchChannel.id}>` : '#vouch';

    const replyMessage = `Thanks for ordering with Quikbites! Leave a pic in ${vouchChannelMention} to gain points that you can use to get free food 🥤`;

    return interaction.reply(replyMessage);
  }

  if (interaction.commandName === 'points') {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const points = storage.getPoints(targetUser.id);
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📊 Vouch Points')
      .setDescription(`<@${targetUser.id}> has **${points}** vouch points`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'leaderboard') {
    const allPoints = storage.getAllPoints();
    const sortedPoints = Array.from(allPoints.entries())
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

    const stats = storage.getStats();
    const totalPoints = stats.totalPoints;
    const totalUsers = stats.userCount;

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

    const currentPoints = storage.getPoints(targetUser.id);
    const newPoints = Math.max(0, currentPoints + amount); // Prevent negative points
    
    storage.setPoints(targetUser.id, newPoints);

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
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ You need Administrator permissions to use this command!',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    console.log(`[ADMIN] ${interaction.user.username} initiated a manual backup.`);
    const result = storage.backup();

    if (result.success) {
      await interaction.editReply(
        `✅ **Backup completed successfully!**\n\n` +
        `📊 **Statistics:**\n` +
        `• **${result.userCount}** users backed up\n` +
        `• **${result.totalPoints}** total points\n` +
        `• Files saved to Railway persistent storage\n\n` +
        `💾 **Backup files created:**\n` +
        `• \`points-backup.json\` (main backup)\n` +
        `• \`points-backup-[timestamp].json\` (timestamped backup)\n\n` +
        `🔄 **To restore:** Use \`/restore-backup\` command`
      );
    } else {
      await interaction.editReply(
        `❌ **Backup failed!**\n\n` +
        `**Error:** ${result.error}\n\n` +
        `Please try again or contact an administrator.`
      );
    }
    return;
  }

  if (interaction.commandName === 'reload-points') {
    // Check if user has administrator permissions
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ 
        content: '❌ You need Administrator permissions to use this command!', 
        ephemeral: true 
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const result = storage.forceReloadFromBackup();

    if (result.success) {
      await interaction.editReply(`✅ Points reloaded successfully. Found and loaded backup with ${result.userCount} users.`);
    } else {
      await interaction.editReply(`❌ Failed to reload points. Reason: ${result.error}`);
    }
    return;
  }

  if (interaction.commandName === 'restore-backup') {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ You need Administrator permissions to use this command!',
        ephemeral: true,
      });
    }

    const filename = interaction.options.getString('filename');
    await interaction.deferReply({ ephemeral: true });

    console.log(`[ADMIN] ${interaction.user.username} initiated a manual restore from ${filename}.`);
    const result = storage.restoreFrom(filename);

    if (result.success) {
      await interaction.editReply(
        `✅ **Successfully restored points from \`${filename}\`!**\n\n` +
        `📊 **Restored Data:**\n` +
        `• **${result.userCount}** users loaded\n` +
        `• **${result.totalPoints}** total points\n` +
        `• Main points file updated\n` +
        `• Backup file synchronized\n\n` +
        `🔄 **The bot is now using this data.**`
      );
    } else {
      await interaction.editReply(
        `❌ **Failed to restore points from \`${filename}\`!**\n\n` +
        `**Error:** ${result.error}\n\n` +
        `Please check the filename or try a different backup.`
      );
    }
    return;
  }

  if (interaction.commandName === 'open') {
    return handleStoreOpen(interaction);
  }

  if (interaction.commandName === 'close') {
    return handleStoreClose(interaction);
  }

  if (interaction.commandName === 'reload-points') {
    return handleReloadPoints(interaction);
  }

  if (interaction.commandName === 'remove-user') {
    // This command is no longer needed due to automatic cleanup
    return interaction.reply({ content: 'This command is deprecated.', ephemeral: true });
  }

  if (interaction.commandName === 'restore-backup') {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ You need Administrator permissions to use this command!',
        ephemeral: true,
      });
    }

    const filename = interaction.options.getString('filename');
    await interaction.deferReply({ ephemeral: true });

    console.log(`[ADMIN] ${interaction.user.username} initiated a manual restore from ${filename}.`);
    const result = storage.restoreFrom(filename);

    if (result.success) {
      await interaction.editReply(
        `✅ **Successfully restored points from \`${filename}\`!**\n\n` +
        `📊 **Restored Data:**\n` +
        `• **${result.userCount}** users loaded\n` +
        `• **${result.totalPoints}** total points\n` +
        `• Main points file updated\n` +
        `• Backup file synchronized\n\n` +
        `🔄 **The bot is now using this data.**`
      );
    } else {
      await interaction.editReply(
        `❌ **Failed to restore points from \`${filename}\`!**\n\n` +
        `**Error:** ${result.error}\n\n` +
        `Please check the filename or try a different backup.`
      );
    }
    return;
  }

  // Roulette slash command
  if (interaction.commandName === 'roulette') {
    const betAmount = interaction.options.getInteger('amount');
    const betType = interaction.options.getString('bet');
    const numberBet = interaction.options.getInteger('number');
    
    const userId = interaction.user.id;
    const userPoints = storage.getPoints(userId);
    
    if (userPoints < betAmount) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Insufficient Points')
        .setDescription(`You need **${betAmount}** points to place this bet.\nYou currently have **${userPoints}** points.`)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    let finalBetType = betType;
    if (betType === 'number') {
      if (numberBet === null || numberBet === undefined) {
        return interaction.reply({
          content: '❌ You must specify a number between 0 and 36 when using the "number" bet type.',
          ephemeral: true,
        });
      }
      finalBetType = numberBet.toString();
    }
    
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
    
    const collector = response.createMessageComponentCollector({ time: 45000 });
    
    collector.on('collect', async i => {
      if (i.user.id !== userId) {
        return i.reply({ content: 'This is not your bet!', ephemeral: true });
      }
      
      if (i.customId === 'roulette_confirm') {
        // Double check points before playing
        const currentPoints = storage.getPoints(userId);
        if (currentPoints < betAmount) {
            return i.update({
                embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ Insufficient Points').setDescription(`Your points changed after you placed the bet. You only have ${currentPoints} points.`)],
                components: []
            });
        }
        await playRouletteSlash(i, betAmount, finalBetType);
      } else { // Cancel
        await i.update({
            embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ Bet Cancelled').setDescription('Your roulette bet has been cancelled.')],
            components: []
        });
      }
    });
    
    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('⏰ Bet Expired').setDescription('Your roulette bet has expired.')],
            components: []
        });
      }
    });
    return;
  }

  if (interaction.commandName === 'blackjack') {
    const betAmount = interaction.options.getInteger('amount');
    const userId = interaction.user.id;
    const userPoints = storage.getPoints(userId);

    if (userPoints < betAmount) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ Insufficient Points').setDescription(`You need **${betAmount}** points to play. You have **${userPoints}**.`)],
        ephemeral: true,
      });
    }

    if (storage.getGame(userId)) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ Game in Progress').setDescription('You already have a blackjack game running!')],
        ephemeral: true,
      });
    }

    // Start the game immediately
    await playBlackjackSlash(interaction, betAmount);
    return;
  }

  // Multiplayer Roulette Commands
  if (interaction.commandName === 'roulette-start') {
    await multiplayerRoulette.startRoulette(interaction);
    return;
  }

  if (interaction.commandName === 'roulette-bet') {
    await multiplayerRoulette.placeBet(interaction);
    return;
  }

  // 1v1 Challenge System
  if (interaction.commandName === 'challenge') {
    const opponent = interaction.options.getUser('opponent');
    const gameType = interaction.options.getString('game');
    const betAmount = interaction.options.getInteger('bet');
    const challenger = interaction.user;

    // Can't challenge yourself
    if (opponent.id === challenger.id) {
      return interaction.reply({
        content: '❌ You cannot challenge yourself!',
        ephemeral: true,
      });
    }

    // Check if challenger has enough points
    const challengerPoints = storage.getPoints(challenger.id);
    if (challengerPoints < betAmount) {
      return interaction.reply({
        content: `❌ You don't have enough points! You have ${challengerPoints} points but need ${betAmount}.`,
        ephemeral: true,
      });
    }

    // Check if opponent has enough points
    const opponentPoints = storage.getPoints(opponent.id);
    if (opponentPoints < betAmount) {
      return interaction.reply({
        content: `❌ ${opponent.username} doesn't have enough points! They have ${opponentPoints} points but need ${betAmount}.`,
        ephemeral: true,
      });
    }

    // Create challenge
    const challengeId = generateChallengeId();
    const challenge = {
      id: challengeId,
      challenger: challenger.id,
      opponent: opponent.id,
      gameType: gameType,
      betAmount: betAmount,
      timestamp: Date.now(),
      status: 'pending'
    };

    // Store challenge
    if (!challenges.has(opponent.id)) {
      challenges.set(opponent.id, new Map());
    }
    challenges.get(opponent.id).set(challengeId, challenge);

    // Create challenge embed
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('⚔️ **CHALLENGE ISSUED!** ⚔️')
      .setDescription(`${challenger} has challenged ${opponent} to a duel!`)
      .addFields(
        { name: '🎮 Game', value: getGameDisplayName(gameType), inline: true },
        { name: '💰 Bet Amount', value: `${betAmount} points`, inline: true },
        { name: '🆔 Challenge ID', value: `\`${challengeId}\``, inline: true }
      )
      .setFooter({ text: `Use /accept ${challengeId} to accept or /decline ${challengeId} to decline` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Auto-delete challenge after 5 minutes
    setTimeout(() => {
      const opponentChallenges = challenges.get(opponent.id);
      if (opponentChallenges && opponentChallenges.has(challengeId)) {
        opponentChallenges.delete(challengeId);
        if (opponentChallenges.size === 0) {
          challenges.delete(opponent.id);
        }
      }
    }, 5 * 60 * 1000);

    return;
  }

  if (interaction.commandName === 'accept') {
    const challengeId = interaction.options.getString('challenge_id');
    const accepter = interaction.user;

    // Find the challenge
    const opponentChallenges = challenges.get(accepter.id);
    if (!opponentChallenges || !opponentChallenges.has(challengeId)) {
      return interaction.reply({
        content: '❌ Challenge not found or has expired!',
        ephemeral: true,
      });
    }

    const challenge = opponentChallenges.get(challengeId);
    if (challenge.status !== 'pending') {
      return interaction.reply({
        content: '❌ This challenge has already been processed!',
        ephemeral: true,
      });
    }

    // Remove challenge from pending
    opponentChallenges.delete(challengeId);
    if (opponentChallenges.size === 0) {
      challenges.delete(accepter.id);
    }

    // Start the game
    await start1v1Game(interaction, challenge);
    return;
  }

  if (interaction.commandName === 'decline') {
    const challengeId = interaction.options.getString('challenge_id');
    const decliner = interaction.user;

    // Find the challenge
    const opponentChallenges = challenges.get(decliner.id);
    if (!opponentChallenges || !opponentChallenges.has(challengeId)) {
      return interaction.reply({
        content: '❌ Challenge not found or has expired!',
        ephemeral: true,
      });
    }

    const challenge = opponentChallenges.get(challengeId);
    if (challenge.status !== 'pending') {
      return interaction.reply({
        content: '❌ This challenge has already been processed!',
        ephemeral: true,
      });
    }

    // Remove challenge
    opponentChallenges.delete(challengeId);
    if (opponentChallenges.size === 0) {
      challenges.delete(decliner.id);
    }

    const challenger = await client.users.fetch(challenge.challenger);
    
    await interaction.reply({
      content: `❌ ${decliner} has declined ${challenger}'s challenge!`,
    });
    return;
  }

  if (interaction.commandName === 'clear-points') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ You need Administrator permissions to use this command!',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const result = storage.clearAllPoints();
    
    if (result.success) {
      await interaction.editReply(
        `✅ **All points cleared successfully!**\n\n` +
        `🗑️ **Action:** Cleared all user points\n` +
        `👥 **Users affected:** ${result.clearedUsers}\n` +
        `💰 **Points cleared:** ${result.clearedPoints}\n` +
        `🔄 **Status:** Points system reset to zero\n\n` +
        `⚠️ **Warning:** This action cannot be undone!`
      );
    } else {
      await interaction.editReply(
        `❌ **Failed to clear points!**\n\n` +
        `**Error:** ${result.error}`
      );
    }
    
    console.log(`[ADMIN] ${interaction.user.username} cleared all points.`);
    return;
  }
});

// Gambling functionality
async function handleGamblingCommands(message) {
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  if (!['blackjack', 'balance'].includes(command)) return; // Removed 'roulette'
  
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
  
  if (command === 'blackjack') {
    await playBlackjack(message, betAmount);
  }
}

async function playBlackjack(message, betAmount) {
  const userId = message.author.id;
  
  if (storage.getGame(userId)) {
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
  
  storage.setGame(userId, game);
  
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
    
    const game = storage.getGame(gameOwnerId);
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
  
  const userPoints = storage.getPoints(game.userId);
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
  storage.deleteGame(game.userId);
  
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
  const currentPoints = storage.getPoints(game.userId);
  let newPoints = currentPoints;
  let pointChange = 0;
  
  if (playerWon === true) {
    pointChange = +game.betAmount;
    newPoints = currentPoints + game.betAmount;
  } else if (playerWon === false) {
    pointChange = -game.betAmount;
    newPoints = currentPoints - game.betAmount;
  }
  
  storage.setPoints(game.userId, newPoints);
  storage.deleteGame(game.userId);
  
  // Create result embed
  const color = playerWon === true ? 0x00FF00 : playerWon === false ? 0xFF0000 : 0xFFD700;
  const resultEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🃏 Blackjack - GAME OVER')
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

    const game = storage.createGame(userId, betAmount);
    const playerValue = storage.getHandValue(game.playerHand);

    if (playerValue === 21) {
        // Natural Blackjack
        return handleBlackjackEnd(interaction, game, { playerWon: true, reason: 'Blackjack! 🎉' });
    }

    const embed = storage.createBlackjackEmbed(game, false, "Place your bet!");
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('blackjack_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('blackjack_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary)
    );

    // If it's a new interaction, reply. If it's from a button, update.
    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed], components: [row] });
    } else {
        await interaction.reply({ embeds: [embed], components: [row] });
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

async function handleBlackjackEnd(interaction, game, result) {
    let { playerWon, reason } = result;

    // Play out dealer's hand if not an instant win/loss
    if (playerWon === null) {
        while (storage.getHandValue(game.dealerHand) < 17) {
            game.dealerHand.push(storage.drawCard(game.deck));
        }
        const playerValue = storage.getHandValue(game.playerHand);
        const dealerValue = storage.getHandValue(game.dealerHand);

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
            playerWon = 'push'; // Tie
            reason = 'Push (tie)! Your bet is returned.';
        }
    }

    // Update points
    const finalPoints = storage.endGame(game.userId, playerWon);
    storage.deleteGame(game.userId);

    const embed = storage.createBlackjackEmbed(game, true, reason, playerWon);
    
    // Check if interaction can be updated
    if (interaction.isMessageComponent()) {
        await interaction.update({ embeds: [embed], components: [] });
    } else {
        await interaction.editReply({ embeds: [embed], components: [] });
    }

    // Send a new, public message summarizing the result
    const summaryEmbed = new EmbedBuilder()
        .setColor(won ? 0x00FF00 : 0xFF0000)
        .setDescription(won ? `**${interaction.user.username}** won **${payout - betAmount}** points!` : `**${interaction.user.username}** lost **${betAmount}** points.`)
        .setFooter({ text: `New balance: ${finalPoints} points` });

    await interaction.followUp({ embeds: [summaryEmbed] });
}

// --- VOUCH RECOUNT COMMAND ---
async function handleRecountVouches(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const providerRole = guild.roles.cache.find(role => role.name.toLowerCase() === PROVIDER_ROLE_NAME.toLowerCase());

    if (!providerRole) {
        return safeReply(interaction, { content: `❌ Provider role "${PROVIDER_ROLE_NAME}" not found. Cannot perform recount.` });
    }

    const vouchChannels = guild.channels.cache.filter(c =>
        c.isTextBased() &&
        (c.name.toLowerCase().includes('vouch') || c.name.toLowerCase().includes('review') || c.name.toLowerCase().includes('feedback'))
    );

    if (vouchChannels.size === 0) {
        return safeReply(interaction, { content: '❌ No vouch channels found.' });
    }

    await safeReply(interaction, { content: `**Phase 1/4:** ⌛ Scanning ${vouchChannels.size} channel(s) to find all mentioned users...` });

    // --- PASS 1: Discover all mentioned users ---
    const mentionedUserIds = new Set();
    for (const channel of vouchChannels.values()) {
        let lastId;
        while (true) {
            const messages = await channel.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
            if (!messages || messages.size === 0) break;

            for (const message of messages.values()) {
                if (message.mentions.users.size > 0) {
                    message.mentions.users.forEach(user => mentionedUserIds.add(user.id));
                }
            }
            lastId = messages.last().id;
        }
    }
    
    await interaction.editReply({ content: `**Phase 2/4:**  fetching roles for ${mentionedUserIds.size} users. This is much faster than fetching all server members.` });

    // --- Step 2: Fetch ONLY the mentioned members and identify providers ---
    const providerIds = new Set();
    if (mentionedUserIds.size > 0) {
        try {
            const mentionedMembers = await guild.members.fetch({ user: Array.from(mentionedUserIds) });
            mentionedMembers.forEach(member => {
                if (member.roles.cache.has(providerRole.id)) {
                    providerIds.add(member.id);
                }
            });
        } catch (error) {
            console.error("Error fetching mentioned members:", error);
            return interaction.editReply({ content: "❌ An error occurred while fetching member data. Please try again."});
        }
    }
    
    if (providerIds.size === 0) {
        return interaction.editReply({ content: `✅ Scan complete. No users with the "${PROVIDER_ROLE_NAME}" role were found in any vouches.`});
    }

    await interaction.editReply({ content: `**Phase 3/4:** ✅ Found ${providerIds.size} providers. Resetting points and starting final count...` });
    
    // --- PASS 2: Recalculate points with the known list of providers ---
    // Clear all points in storage
    const allUsers = Array.from(storage.getAllPoints().keys());
    allUsers.forEach(userId => storage.deleteUser(userId));
    
    let processedMessages = 0;
    let foundVouches = 0;
    let totalPointsAwarded = 0;
    
    for (const channel of vouchChannels.values()) {
        let lastId;
        while (true) {
            const messages = await channel.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
            if (!messages || messages.size === 0) break;

            for (const message of messages.values()) {
                processedMessages++;
                const hasImage = message.attachments.some(a => a.contentType?.startsWith('image/'));
                
                // Ensure the message isn't from a bot and has mentions
                if (!message.author.bot && hasImage && message.mentions.users.size > 0) {
                    // Check if any mentioned user is a real provider
                    const hasProviderMention = message.mentions.users.some(user => providerIds.has(user.id));
                    
                    if (hasProviderMention) {
                        const authorId = message.author.id;
                        const currentPoints = storage.getPoints(authorId);
                        storage.setPoints(authorId, currentPoints + POINTS_PER_VOUCH);
                        totalPointsAwarded += POINTS_PER_VOUCH;
                        foundVouches++;
                    }
                }
            }
            lastId = messages.last().id;
        }
    }

    // Points are automatically saved by storage.js
    await interaction.editReply({ content: `**Phase 4/4:** ✅ Recount complete! Finalizing results...` });

    const summaryEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Recount Complete!')
        .setDescription('All points have been recalculated from the vouch channel history.')
        .addFields(
            { name: '📊 Messages Scanned', value: `~${processedMessages.toLocaleString()}`, inline: true },
            { name: '🖼️ Valid Vouches Found', value: `${foundVouches.toLocaleString()}`, inline: true },
            { name: '💰 Total Points Awarded', value: `${totalPointsAwarded.toLocaleString()}`, inline: true }
        )
        .setTimestamp();

    await interaction.followUp({ embeds: [summaryEmbed], ephemeral: true });
}

// --- STORE MANAGEMENT FUNCTIONS ---

async function handleStoreOpen(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You do not have permission for this.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const statusCategory = interaction.guild.channels.cache.find(c => c.name.toLowerCase().includes('status') && c.type === ChannelType.GuildCategory);
        const orderChannel = interaction.guild.channels.cache.find(c => c.name.toLowerCase().includes('order-here'));

        if (!orderChannel) {
            return interaction.editReply({ content: '❌ Could not find a channel with "order-here" in its name.' });
        }

        let statusChannel;
        if (statusCategory) {
            statusChannel = statusCategory.children.cache.find(c => c.isTextBased());
        }

        // Update permissions for #order-here
        const everyoneRole = interaction.guild.roles.everyone;
        await orderChannel.permissionOverwrites.edit(everyoneRole, {
            ViewChannel: true,
            SendMessages: true,
        });

        // Rename status channel
        if (statusChannel) {
            await statusChannel.setName('🟢-status-open');
        }

        await interaction.editReply({ content: '✅ **Store is now OPEN!** The `#order-here` channel is public and the status has been updated.' });

    } catch (error) {
        console.error("Error opening store:", error);
        await interaction.editReply({ content: '❌ An error occurred while trying to open the store. Please check my permissions (I may need "Manage Channels" and "Manage Roles"). The bot will continue to function otherwise.' });
    }
}

async function handleStoreClose(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You do not have permission for this.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const statusCategory = interaction.guild.channels.cache.find(c => c.name.toLowerCase().includes('status') && c.type === ChannelType.GuildCategory);
        const orderChannel = interaction.guild.channels.cache.find(c => c.name.toLowerCase().includes('order-here'));

        if (!orderChannel) {
            return interaction.editReply({ content: '❌ Could not find a channel with "order-here" in its name.' });
        }

        let statusChannel;
        if (statusCategory) {
            statusChannel = statusCategory.children.cache.find(c => c.isTextBased());
        }

        // Update permissions for #order-here
        const everyoneRole = interaction.guild.roles.everyone;
        await orderChannel.permissionOverwrites.edit(everyoneRole, {
            ViewChannel: false,
        });

        // Rename status channel
        if (statusChannel) {
            await statusChannel.setName('🔴-status-closed');
        }

        await interaction.editReply({ content: '✅ **Store is now CLOSED!** The `#order-here` channel is private and the status has been updated.' });

    } catch (error) {
        console.error("Error closing store:", error);
        await interaction.editReply({ content: '❌ An error occurred while trying to close the store. Please check my permissions (I may need "Manage Channels" and "Manage Roles"). The bot will continue to function otherwise.' });
    }
}

// --- HOTKEY HELPER FUNCTIONS ---

// Function to dynamically update slash commands with Discord
async function updateDiscordCommands(guild) {
    const { REST } = require('@discordjs/rest');
    const { Routes } = require('discord-api-types/v9');
    
    // This is a bit of a hack to avoid a circular dependency or rewriting the command list
    // We get the static commands by requiring the deploy script and accessing the exported commands
    delete require.cache[require.resolve('./deploy-commands.js')]; // Clear cache to get fresh data
    const staticCommands = require('./deploy-commands.js').commands;

    const dynamicCommands = Array.from(storage.getAllHotkeys().entries()).map(([name, message]) => {
        return new SlashCommandBuilder()
            .setName(name)
            .setDescription(message.length > 100 ? message.substring(0, 97) + '...' : message)
            .toJSON();
    });

    const allCommands = staticCommands.concat(dynamicCommands);
    const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);
    const clientId = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;

    try {
        console.log('🔄 Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationGuildCommands(clientId, guild.id),
            { body: allCommands },
        );
        console.log('✅ Successfully reloaded application (/) commands.');
        return true;
    } catch (error) {
        console.error('❌ Failed to refresh commands:', error);
        return false;
    }
}

async function handleHotkeyCreate(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You do not have permission for this.', ephemeral: true });
    }

    const name = interaction.options.getString('name').toLowerCase();
    const message = interaction.options.getString('message');

    // Discord command name validation
    if (!/^[a-z0-9_-]{1,32}$/.test(name)) {
        return interaction.reply({
            content: '❌ Invalid command name. It must be 1-32 characters long and contain only lowercase letters, numbers, hyphens, or underscores.',
            ephemeral: true,
        });
    }

    if (storage.getHotkey(name)) {
        return interaction.reply({ content: `❌ A hotkey named \`/${name}\` already exists. Use a different name or delete the existing one first.`, ephemeral: true });
    }

    storage.setHotkey(name, message);
    await interaction.deferReply({ ephemeral: true });

    const success = await updateDiscordCommands(interaction.guild);

    if (success) {
        await interaction.editReply({ content: `✅ Successfully created the \`/${name}\` command!` });
    } else {
        await interaction.editReply({ content: '❌ Created the hotkey, but failed to update Discord. The command may not appear. Try again or check the logs.' });
    }
}

async function handleHotkeyDelete(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You do not have permission for this.', ephemeral: true });
    }

    const name = interaction.options.getString('name').toLowerCase();

    if (!storage.getHotkey(name)) {
        return interaction.reply({ content: `❌ No hotkey named \`/${name}\` found.`, ephemeral: true });
    }

    storage.deleteHotkey(name);
    await interaction.deferReply({ ephemeral: true });

    const success = await updateDiscordCommands(interaction.guild);

    if (success) {
        await interaction.editReply({ content: `✅ Successfully deleted the \`/${name}\` command!` });
    } else {
        await interaction.editReply({ content: '❌ Deleted the hotkey, but failed to update Discord. The command may still appear. Try again or check the logs.' });
    }
}

async function handleHotkeyList(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You do not have permission for this.', ephemeral: true });
    }

    const allHotkeys = storage.getAllHotkeys();
    if (allHotkeys.size === 0) {
        return interaction.reply({ content: 'ℹ️ You have not created any hotkeys yet. Use `/hotkey-create` to start.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Custom Hotkey Commands')
        .setDescription('Here are all the custom commands you have created.');

    let description = '';
    for (const [name, message] of allHotkeys) {
        const shortMessage = message.length > 200 ? message.substring(0, 197) + '...' : message;
        description += `**\`/${name}\`**\n>>> ${shortMessage}\n\n`;
    }
    embed.setDescription(description);

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// =================================================================================
// MULTIPLAYER ROULETTE SYSTEM
// =================================================================================

async function handleRouletteStart(interaction) {
    const channelId = interaction.channelId;

    if (storage.getRouletteTable(channelId)) {
        return interaction.reply({ content: '❌ A roulette game is already in progress in this channel!', ephemeral: true });
    }

    const bettingDuration = 45; // seconds
    const endTime = Date.now() + bettingDuration * 1000;

    const table = {
        channelId: channelId,
        endTime: endTime,
        bets: [],
        messageId: null
    };

    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🎰 New Roulette Table Open!')
        .setDescription(`**Bets are open for ${bettingDuration} seconds!**\n\nUse \`/bet <type> <amount>\` to place your bets.\n\nThe wheel will spin <t:${Math.floor(endTime / 1000)}:R>.`)
        .addFields({ name: 'Current Bets', value: 'No bets placed yet.' })
        .setFooter({ text: 'Good luck to all players!' });

    const response = await interaction.reply({ embeds: [embed], fetchReply: true });
    table.messageId = response.id;

    storage.setRouletteTable(channelId, table);
    console.log(`Roulette table started in channel #${interaction.channel.name}`);

    const timer = setTimeout(bettingDuration * 1000)
        .then(() => spinMultiplayerWheel(interaction.client, channelId))
        .catch(err => console.error("Roulette timer error:", err));
        
    rouletteTimers.set(channelId, timer);
}

async function handleBet(interaction) {
    const channelId = interaction.channelId;
    const table = storage.getRouletteTable(channelId);

    if (!table) {
        return interaction.reply({ content: '❌ There is no active roulette game in this channel. Start one with `/roulette-start`.', ephemeral: true });
    }
    
    if (Date.now() > table.endTime) {
        return interaction.reply({ content: '❌ Betting has already closed for this round!', ephemeral: true });
    }

    const betType = interaction.options.getString('bet-type');
    const amount = interaction.options.getInteger('amount');
    const numberBet = interaction.options.getInteger('number');
    const userId = interaction.user.id;

    const userPoints = storage.getPoints(userId);
    
    if (userPoints < amount) {
        return interaction.reply({ content: `❌ Insufficient points! You have ${userPoints}, but tried to bet ${amount}.`, ephemeral: true });
    }

    if (betType === 'straight' && (numberBet === null || numberBet === undefined)) {
        return interaction.reply({ content: '❌ You must specify a number when placing a "Straight Number" bet.', ephemeral: true });
    }

    const bet = {
        userId,
        username: interaction.user.username,
        betType: betType === 'straight' ? `s${numberBet}` : betType,
        amount,
    };

    table.bets.push(bet);
    storage.removePoints(userId, amount);
    storage.setRouletteTable(channelId, table);

    try {
        const mainMessage = await interaction.channel.messages.fetch(table.messageId);
        if (mainMessage) {
            const currentEmbed = mainMessage.embeds[0];
            const newEmbed = new EmbedBuilder(currentEmbed);
            const betsList = table.bets.map(b => `> **${b.username}** bet **${b.amount}** on **${getBetDescription(b.betType)}**`).join('\n');
            newEmbed.setFields({ name: `Current Bets (${table.bets.length})`, value: betsList.substring(0, 1020) });
            await mainMessage.edit({ embeds: [newEmbed] });
        }
    } catch(e) { console.error("Could not edit roulette message", e)}

    await interaction.reply({ content: `✅ Your bet of **${amount}** points on **${getBetDescription(bet.betType)}** has been placed! Your new balance is ${storage.getPoints(userId)}.`, ephemeral: true });
}

function getBetDescription(betType) {
    if (betType.startsWith('s')) return `🎯 Straight Number ${betType.substring(1)}`;
    const descriptions = {
        'red': '🔴 Red', 'black': '⚫ Black', 'green': '🟢 Green/Zero',
        'even': '🔢 Even', 'odd': '🔢 Odd', 'high': '📈 High (19-36)', 'low': '📉 Low (1-18)',
        'first-dozen': '📊 1st Dozen', 'second-dozen': '📊 2nd Dozen', 'third-dozen': '📊 3rd Dozen',
        'first-column': '📋 1st Column', 'second-column': '📋 2nd Column', 'third-column': '📋 3rd Column'
    };
    return descriptions[betType] || 'Unknown Bet';
}

async function spinMultiplayerWheel(client, channelId) {
    const table = storage.getRouletteTable(channelId);
    if (!table) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;
    
    const message = await channel.messages.fetch(table.messageId).catch(() => null);
    if (!message) {
        storage.deleteRouletteTable(channelId);
        rouletteTimers.delete(channelId);
        return;
    }

    const closingEmbed = new EmbedBuilder(message.embeds[0])
        .setTitle('🎰 Betting Closed!')
        .setDescription('**No more bets!** The wheel is about to spin...');
    await message.edit({ embeds: [closingEmbed] });
    await setTimeout(3000);

    const spin = Math.floor(Math.random() * 37);
    const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const isRed = redNumbers.includes(spin);
    const isBlack = spin !== 0 && !isRed;
    const isGreen = spin === 0;
    const numberColor = isGreen ? '🟢' : isRed ? '🔴' : '⚫';

    const spinResultEmbed = new EmbedBuilder(message.embeds[0])
      .setColor(0xFF4500)
      .setTitle('🌪️ WHEEL IS SPINNING...')
      .setDescription(`The wheel slows... click... click... The ball lands on... **${numberColor} ${spin}**!`);
    await message.edit({ embeds: [spinResultEmbed] });
    await setTimeout(3000);
    
    const results = [];
    let totalWon = 0;
    let totalLost = 0;

    for (const bet of table.bets) {
        const checkWin = (spinResult, type) => {
             if (type.startsWith('s')) {
                return { win: spinResult === parseInt(type.substring(1), 10), payout: 36 };
            }
            switch (type) {
                case 'red': return { win: isRed, payout: 2 };
                case 'black': return { win: isBlack, payout: 2 };
                case 'green': return { win: isGreen, payout: 36 };
                case 'even': return { win: spin !== 0 && spin % 2 === 0, payout: 2 };
                case 'odd': return { win: spin !== 0 && spin % 2 === 1, payout: 2 };
                case 'high': return { win: spin >= 19 && spin <= 36, payout: 2 };
                case 'low': return { win: spin >= 1 && spin <= 18, payout: 2 };
                case 'first-dozen': return { win: spin >= 1 && spin <= 12, payout: 3 };
                case 'second-dozen': return { win: spin >= 13 && spin <= 24, payout: 3 };
                case 'third-dozen': return { win: spin >= 25 && spin <= 36, payout: 3 };
                case 'first-column': return { win: spin !== 0 && (spin - 1) % 3 === 0, payout: 3 };
                case 'second-column': return { win: spin !== 0 && (spin - 2) % 3 === 0, payout: 3 };
                case 'third-column': return { win: spin !== 0 && spin % 3 === 0, payout: 3 };
                default: return { win: false, payout: 0 };
            }
        };

        const result = checkWin(spin, bet.betType);
        if (result.win) {
            const winnings = bet.amount * result.payout;
            storage.addPoints(bet.userId, winnings);
            results.push(`> ✅ **${bet.username}** won **${winnings}** points!`);
            totalWon += winnings;
        } else {
            results.push(`> ❌ **${bet.username}** lost **${bet.amount}** points.`);
            totalLost += bet.amount;
        }
    }

    const finalEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`🎰 Wheel Landed on ${numberColor} ${spin}!`)
        .setDescription(results.length > 0 ? results.join('\n').substring(0, 4000) : 'No bets were placed.')
        .addFields(
            { name: '💰 Total Won', value: totalWon.toString(), inline: true },
            { name: '💔 Total Lost', value: totalLost.toString(), inline: true }
        )
        .setFooter({ text: 'Thanks for playing! A new round can be started with /roulette-start.'});

    await message.edit({ embeds: [finalEmbed] });

    storage.deleteRouletteTable(channelId);
    rouletteTimers.delete(channelId);
    console.log(`Roulette game finished in channel ${channelId}.`);
}

async function handleReloadPoints(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const result = storage.forceReloadFromBackup();

    if (result.success) {
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Points Reloaded Successfully')
            .setDescription(`Successfully loaded **${result.count}** user point entries from the backup file: \`${result.file}\`.`)
            .setFooter({ text: 'The bot is now using the restored data.' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    } else {
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Failed to Reload Points')
            .setDescription(`An error occurred: ${result.error}`)
            .setFooter({ text: 'No changes have been made to the current points data.' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// Multiplayer Roulette System
const activeRouletteGames = new Map();

// Roulette wheel layout (European style)
const ROULETTE_NUMBERS = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK_NUMBERS = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

function getNumberColor(number) {
    if (number === 0) return '🟢';
    if (RED_NUMBERS.has(number)) return '🔴';
    return '⚫';
}

function getBetPayout(betType, betAmount) {
    switch(betType) {
        case 'red':
        case 'black':
        case 'even':
        case 'odd':
        case 'high':
        case 'low':
        case 'first-dozen':
        case 'second-dozen':
        case 'third-dozen':
        case 'first-column':
        case 'second-column':
        case 'third-column':
            return betAmount * 2;
        case 'green':
            return betAmount * 14;
        case 'straight':
            return betAmount * 35;
        default:
            return betAmount * 2;
    }
}

// Roulette wheel constants
const ROULETTE_WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS_OLD = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const numberToColor = (n) => {
    if (n === 0) return '🟢';
    if (RED_NUMBERS_OLD.has(n)) return '🔴';
    return '⚫';
};

/**
 * Creates a visual representation of the roulette wheel spinning.
 * @param {import('discord.js').Interaction} interaction The interaction to edit.
 * @param {number} winningNumber The final number the wheel will land on.
 */
async function animateRoulette(interaction, winningNumber) {
    const getWheelSlice = (centerIndex) => {
        let parts = [];
        for (let i = -3; i <= 3; i++) {
            const wheelIndex = (centerIndex + i + ROULETTE_WHEEL.length) % ROULETTE_WHEEL.length;
            const number = ROULETTE_WHEEL[wheelIndex];
            parts.push(`${numberToColor(number)} ${number}`);
        }
        return `\`${parts.slice(0,3).join(' ')}\` ➡️ **${parts[3]}** ⬅️ \`${parts.slice(4).join(' ')}\``;
    };

    const totalSpins = 30; // Total animation frames
    const winningIndex = ROULETTE_WHEEL.indexOf(winningNumber);
    let currentIndex = 0;

    // Animate the wheel spinning
    for (let i = 0; i < totalSpins; i++) {
        currentIndex = (currentIndex + 1) % ROULETTE_WHEEL.length;
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎰 Roulette')
            .setDescription(`**No more bets!** The wheel is spinning...\n\n${getWheelSlice(currentIndex)}`);
        
        if(i === 0) {
            await interaction.update({ embeds: [embed], components: [] });
        } else {
            await interaction.editReply({ embeds: [embed] });
        }

        // Slow down effect
        const progress = i / totalSpins;
        if (progress < 0.5) await sleep(100);
        else if (progress < 0.8) await sleep(200);
        else await sleep(400);
    }

    // Land on the winning number
    while (currentIndex !== winningIndex) {
        currentIndex = (currentIndex + 1) % ROULETTE_WHEEL.length;
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎰 Roulette')
            .setDescription(`Slowing down...\n\n${getWheelSlice(currentIndex)}`);
        await interaction.editReply({ embeds: [embed] });
        await sleep(600);
    }

    // Show the final landing spot
    const finalEmbed = new EmbedBuilder()
        .setColor(numberToColor(winningNumber) === '🟢' ? 0x00FF00 : numberToColor(winningNumber) === '🔴' ? 0xFF0000 : 0x808080)
        .setTitle('🎰 Roulette')
        .setDescription(`The ball landed on... **${numberToColor(winningNumber)} ${winningNumber}**!`);
    await interaction.editReply({ embeds: [finalEmbed] });
    await sleep(2000);
}

// Slash command version of roulette
async function playRouletteSlash(interaction, betAmount, betType) {
  const userId = interaction.user.id;
  
  // Pre-determine the winning number
  const spin = ROULETTE_WHEEL[Math.floor(Math.random() * ROULETTE_WHEEL.length)];
  
  // Animate the wheel and wait for it to finish
  await animateRoulette(interaction, spin);

  const isRed = RED_NUMBERS.has(spin);
  const isBlack = spin !== 0 && !isRed;
  const isGreen = spin === 0;
  
  let won = false;
  let payout = 0;
  let resultText = '';
  
  betType = betType.toLowerCase();
  
  const numericBetType = parseInt(betType);

  if (betType === 'red' && isRed) {
    won = true;
    payout = betAmount * 2;
    resultText = 'You won on **RED**!';
  } else if (betType === 'black' && isBlack) {
    won = true;
    payout = betAmount * 2;
    resultText = 'You won on **BLACK**!';
  } else if (betType === 'green' && isGreen) {
    won = true;
    payout = betAmount * 14;
    resultText = 'You won on **GREEN**!';
  } else if (!isNaN(numericBetType) && numericBetType === spin) {
    won = true;
    payout = betAmount * 35;
    resultText = `You hit the **NUMBER**!`;
  } else {
    resultText = `You lost. Better luck next time!`;
  }
  
  const currentPoints = storage.getPoints(userId);
  let finalPoints = currentPoints;

  if (won) {
    finalPoints += (payout - betAmount);
  } else {
    finalPoints -= betAmount;
  }
  storage.setPoints(userId, finalPoints);
  
  const resultEmbed = new EmbedBuilder()
    .setColor(won ? 0x00FF00 : 0xFF0000)
    .setTitle('🎰 Roulette Results')
    .setDescription(`The ball landed on **${numberToColor(spin)} ${spin}**.\n\n${resultText}`)
    .addFields(
      { name: 'Bet Amount', value: `${betAmount} points`, inline: true },
      { name: 'Outcome', value: won ? `+${payout - betAmount}` : `-${betAmount}`, inline: true },
      { name: 'New Balance', value: `${finalPoints} points`, inline: true }
    )
    .setFooter({ text: `Player: ${interaction.user.username}` })
    .setTimestamp();
  
  await interaction.editReply({ embeds: [resultEmbed], components: [] });
}

// Multiplayer Roulette Helper Functions
async function updateRouletteMessage(game) {
  if (!game.message) return;

  const timeLeft = Math.max(0, Math.ceil((game.endTime - Date.now()) / 1000));
  
  const embed = new EmbedBuilder()
    .setColor(0x1a1a1a)
    .setTitle('🎰 **IMMERSIVE ROULETTE TABLE** 🎰')
    .setDescription('**🕐 BETTING PHASE OPEN**\n\nPlace your bets! You have **' + timeLeft + ' seconds** to bet.');

  // Add betting information
  if (game.bets.size > 0) {
    const betList = Array.from(game.bets.entries()).map(([userId, bet]) => {
      const user = game.client.users.cache.get(userId);
      const username = user ? user.username : 'Unknown User';
      return `• **${username}**: ${bet.amount} on ${bet.type}${bet.number !== null ? ` (${bet.number})` : ''}`;
    }).join('\n');
    
    embed.addFields({
      name: '💰 Current Bets',
      value: betList,
      inline: false
    });
  } else {
    embed.addFields({
      name: '💰 Current Bets',
      value: 'No bets placed yet',
      inline: false
    });
  }

  embed.addFields(
    { name: '⏰ Time Remaining', value: timeLeft + ' seconds', inline: true },
    { name: '🎯 Available Bets', value: '`red` `black` `green` `even` `odd` `high` `low` `straight [0-36]`', inline: false }
  );

  embed.setFooter({ text: 'Use /roulette-bet <amount> <type> to place your bet!' });
  embed.setTimestamp();

  await game.message.edit({ embeds: [embed] });
}

async function endBettingPhase(channelId) {
  const game = activeRouletteGames.get(channelId);
  if (!game) return;

  // Generate winning number
  game.currentNumber = ROULETTE_NUMBERS[Math.floor(Math.random() * ROULETTE_NUMBERS.length)];

  // Animate the wheel
  await animateRouletteWheel(game);

  // Calculate results
  const results = calculateResults(game);

  // Show final results
  const resultsEmbed = createResultsEmbed(game, results);
  await game.message.edit({ embeds: [resultsEmbed] });

  // Clean up
  activeRouletteGames.delete(channelId);
}

async function animateRouletteWheel(game) {
  const totalSpins = 40;
  const winningIndex = ROULETTE_NUMBERS.indexOf(game.currentNumber);
  let currentIndex = 0;

  // Create spinning embed
  const spinningEmbed = new EmbedBuilder()
    .setColor(0x1a1a1a)
    .setTitle('🎰 **ROULETTE WHEEL SPINNING** 🎰')
    .setDescription('**No more bets!** The wheel is spinning...')
    .setFooter({ text: 'Watching the ball...' })
    .setTimestamp();

  await game.message.edit({ embeds: [spinningEmbed] });

  // Spin animation
  for (let i = 0; i < totalSpins; i++) {
    currentIndex = (currentIndex + 1) % ROULETTE_NUMBERS.length;
    
    const wheelSlice = [];
    for (let j = -4; j <= 4; j++) {
      const wheelIndex = (currentIndex + j + ROULETTE_NUMBERS.length) % ROULETTE_NUMBERS.length;
      const number = ROULETTE_NUMBERS[wheelIndex];
      if (j === 0) {
        wheelSlice.push(`**${getNumberColor(number)}${number}**`);
      } else {
        wheelSlice.push(`${getNumberColor(number)}${number}`);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x1a1a1a)
      .setTitle('🎰 **ROULETTE WHEEL SPINNING** 🎰')
      .setDescription('**No more bets!** The wheel is spinning...\n\n' +
        `\`${wheelSlice.slice(0, 4).join(' ')}\` ➡️ **${wheelSlice[4]}** ⬅️ \`${wheelSlice.slice(5).join(' ')}\``)
      .setFooter({ text: 'Watching the ball...' })
      .setTimestamp();

    await game.message.edit({ embeds: [embed] });
    
    // Dynamic speed
    const progress = i / totalSpins;
    let delay;
    if (progress < 0.3) delay = 80;
    else if (progress < 0.6) delay = 150;
    else if (progress < 0.8) delay = 300;
    else delay = 500;
    
    await sleep(delay);
  }

  // Land on winning number
  while (currentIndex !== winningIndex) {
    currentIndex = (currentIndex + 1) % ROULETTE_NUMBERS.length;
    
    const wheelSlice = [];
    for (let j = -4; j <= 4; j++) {
      const wheelIndex = (currentIndex + j + ROULETTE_NUMBERS.length) % ROULETTE_NUMBERS.length;
      const number = ROULETTE_NUMBERS[wheelIndex];
      if (j === 0) {
        wheelSlice.push(`**${getNumberColor(number)}${number}**`);
      } else {
        wheelSlice.push(`${getNumberColor(number)}${number}`);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x1a1a1a)
      .setTitle('🎰 **ROULETTE WHEEL SPINNING** 🎰')
      .setDescription('**Slowing down...**\n\n' +
        `\`${wheelSlice.slice(0, 4).join(' ')}\` ➡️ **${wheelSlice[4]}** ⬅️ \`${wheelSlice.slice(5).join(' ')}\``)
      .setFooter({ text: 'Almost there...' })
      .setTimestamp();

    await game.message.edit({ embeds: [embed] });
    await sleep(800);
  }

  // Final landing
  const finalEmbed = new EmbedBuilder()
    .setColor(getNumberColor(game.currentNumber) === '🟢' ? 0x00FF00 : 
             getNumberColor(game.currentNumber) === '🔴' ? 0xFF0000 : 0x808080)
    .setTitle('🎰 **BALL HAS LANDED!** 🎰')
    .setDescription(`**The ball landed on:** ${getNumberColor(game.currentNumber)} **${game.currentNumber}**`)
    .setFooter({ text: 'Calculating results...' })
    .setTimestamp();

  await game.message.edit({ embeds: [finalEmbed] });
  await sleep(2000);
}

function calculateResults(game) {
  const results = {
    winners: [],
    losers: [],
    totalWinnings: 0
  };

  for (const [userId, bet] of game.bets) {
    const won = checkBetWin(bet, game.currentNumber);
    
    if (won) {
      const winnings = getBetPayout(bet.type, bet.amount) - bet.amount;
      results.winners.push({
        userId: userId,
        bet: bet,
        winnings: winnings
      });
      results.totalWinnings += winnings;
      
      // Update user points
      const currentPoints = storage.getPoints(userId);
      storage.setPoints(userId, currentPoints + winnings);
    } else {
      results.losers.push({
        userId: userId,
        bet: bet,
        loss: bet.amount
      });
      
      // Deduct points
      const currentPoints = storage.getPoints(userId);
      storage.setPoints(userId, currentPoints - bet.amount);
    }
  }

  return results;
}

function checkBetWin(bet, number) {
  const num = parseInt(number);
  
  switch(bet.type) {
    case 'red':
      return RED_NUMBERS.has(num);
    case 'black':
      return BLACK_NUMBERS.has(num);
    case 'green':
      return num === 0;
    case 'even':
      return num !== 0 && num % 2 === 0;
    case 'odd':
      return num !== 0 && num % 2 === 1;
    case 'high':
      return num >= 19 && num <= 36;
    case 'low':
      return num >= 1 && num <= 18;
    case 'first-dozen':
      return num >= 1 && num <= 12;
    case 'second-dozen':
      return num >= 13 && num <= 24;
    case 'third-dozen':
      return num >= 25 && num <= 36;
    case 'first-column':
      return num % 3 === 1;
    case 'second-column':
      return num % 3 === 2;
    case 'third-column':
      return num % 3 === 0 && num !== 0;
    case 'straight':
      return num === parseInt(bet.number);
    default:
      return false;
  }
}

function createResultsEmbed(game, results) {
  const embed = new EmbedBuilder()
    .setColor(getNumberColor(game.currentNumber) === '🟢' ? 0x00FF00 : 
             getNumberColor(game.currentNumber) === '🔴' ? 0xFF0000 : 0x808080)
    .setTitle('🎰 **ROULETTE RESULTS** 🎰')
    .setDescription(`**The ball landed on:** ${getNumberColor(game.currentNumber)} **${game.currentNumber}**\n\n` +
      `**Total bets:** ${game.bets.size}\n` +
      `**Total winnings:** ${results.totalWinnings} points`);

  // Show individual results
  if (results.winners.length > 0 || results.losers.length > 0) {
    let resultsText = '';
    
    if (results.winners.length > 0) {
      resultsText += '**🎉 WINNERS:**\n';
      results.winners.forEach(winner => {
        const user = game.client.users.cache.get(winner.userId);
        const username = user ? user.username : 'Unknown User';
        resultsText += `• **${username}**: +${winner.winnings} points (${winner.bet.type})\n`;
      });
    }
    
    if (results.losers.length > 0) {
      resultsText += '\n**💸 LOSSES:**\n';
      results.losers.forEach(loser => {
        const user = game.client.users.cache.get(loser.userId);
        const username = user ? user.username : 'Unknown User';
        resultsText += `• **${username}**: -${loser.loss} points (${loser.bet.type})\n`;
      });
    }
    
    embed.addFields({
      name: '📊 Results',
      value: resultsText,
      inline: false
    });
  }

  embed.setFooter({ text: 'Game complete! Use /roulette-start to start a new game.' });
  embed.setTimestamp();

  return embed;
}

// 1v1 Challenge System
const challenges = new Map();

function generateChallengeId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getGameDisplayName(gameType) {
  const gameNames = {
    'rps': '🪨 Rock Paper Scissors',
    'dice': '🎲 Dice Battle',
    'coin': '🎯 Coin Flip'
  };
  return gameNames[gameType] || gameType;
}

async function start1v1Game(interaction, challenge) {
  const challenger = await client.users.fetch(challenge.challenger);
  const opponent = await client.users.fetch(challenge.opponent);
  
  // Deduct points from both players
  storage.addPoints(challenge.challenger, -challenge.betAmount);
  storage.addPoints(challenge.opponent, -challenge.betAmount);
  
  const embed = new EmbedBuilder()
    .setColor(0xff6b35)
    .setTitle(`⚔️ **${getGameDisplayName(challenge.gameType)}** ⚔️`)
    .setDescription(`${challenger} vs ${opponent}\n💰 **Bet:** ${challenge.betAmount} points each`)
    .setFooter({ text: 'Game starting...' })
    .setTimestamp();

  const message = await interaction.reply({ embeds: [embed], fetchReply: true });
  
  // Start the specific game
  switch (challenge.gameType) {
    case 'rps':
      await playRockPaperScissors(message, challenge, challenger, opponent);
      break;
    case 'dice':
      await playDiceBattle(message, challenge, challenger, opponent);
      break;
    case 'coin':
      await playCoinFlip(message, challenge, challenger, opponent);
      break;
  }
}

async function playRockPaperScissors(message, challenge, challenger, opponent) {
  const choices = ['🪨 Rock', '📄 Paper', '✂️ Scissors'];
  const results = new Map();
  
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('🪨 **ROCK PAPER SCISSORS** 🪨')
    .setDescription(`${challenger} vs ${opponent}\n💰 **Bet:** ${challenge.betAmount} points each\n\n**Waiting for both players to choose...**`)
    .setFooter({ text: 'React with 🪨 📄 ✂️ to make your choice' })
    .setTimestamp();

  await message.edit({ embeds: [embed] });
  
  // Add reaction options
  await message.react('🪨');
  await message.react('📄');
  await message.react('✂️');
  
  const filter = (reaction, user) => {
    return ['🪨', '📄', '✂️'].includes(reaction.emoji.name) && 
           [challenger.id, opponent.id].includes(user.id) &&
           !results.has(user.id);
  };
  
  const collector = message.createReactionCollector({ filter, time: 30000, max: 2 });
  
  collector.on('collect', (reaction, user) => {
    const choice = reaction.emoji.name === '🪨' ? 0 : reaction.emoji.name === '📄' ? 1 : 2;
    results.set(user.id, choice);
    
    if (results.size === 2) {
      collector.stop();
    }
  });
  
  collector.on('end', async () => {
    if (results.size < 2) {
      // Timeout or not enough players
      const timeoutEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('⏰ **GAME TIMEOUT** ⏰')
        .setDescription('One or both players failed to make a choice in time.\n💰 **Bet refunded to both players.**')
        .setTimestamp();
      
      // Refund points
      storage.addPoints(challenge.challenger, challenge.betAmount);
      storage.addPoints(challenge.opponent, challenge.betAmount);
      
      await message.edit({ embeds: [timeoutEmbed] });
      return;
    }
    
    const challengerChoice = results.get(challenger.id);
    const opponentChoice = results.get(opponent.id);
    
    // Determine winner
    let winner, loser, reason;
    if (challengerChoice === opponentChoice) {
      // Tie
      winner = null;
      reason = "It's a tie!";
    } else if (
      (challengerChoice === 0 && opponentChoice === 2) || // Rock beats Scissors
      (challengerChoice === 1 && opponentChoice === 0) || // Paper beats Rock
      (challengerChoice === 2 && opponentChoice === 1)    // Scissors beats Paper
    ) {
      winner = challenger;
      loser = opponent;
      reason = `${choices[challengerChoice]} beats ${choices[opponentChoice]}`;
    } else {
      winner = opponent;
      loser = challenger;
      reason = `${choices[opponentChoice]} beats ${choices[challengerChoice]}`;
    }
    
    // Award points
    if (winner) {
      storage.addPoints(winner.id, challenge.betAmount * 2);
    } else {
      // Tie - refund both players
      storage.addPoints(challenge.challenger, challenge.betAmount);
      storage.addPoints(challenge.opponent, challenge.betAmount);
    }
    
    const resultEmbed = new EmbedBuilder()
      .setColor(winner ? 0x00ff00 : 0xffff00)
      .setTitle('🪨 **ROCK PAPER SCISSORS - RESULT** 🪨')
      .setDescription(`${challenger}: ${choices[challengerChoice]}\n${opponent}: ${choices[opponentChoice]}\n\n**${reason}**`)
      .addFields(
        { name: '🏆 Winner', value: winner ? winner.toString() : 'Tie!', inline: true },
        { name: '💰 Prize', value: winner ? `${challenge.betAmount * 2} points` : 'Refunded', inline: true }
      )
      .setTimestamp();
    
    await message.edit({ embeds: [resultEmbed] });
  });
}

async function playDiceBattle(message, challenge, challenger, opponent) {
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('🎲 **DICE BATTLE** 🎲')
    .setDescription(`${challenger} vs ${opponent}\n💰 **Bet:** ${challenge.betAmount} points each\n\n**Rolling dice...**`)
    .setTimestamp();

  await message.edit({ embeds: [embed] });
  
  // Simulate dice rolling animation
  for (let i = 0; i < 3; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const tempRoll1 = Math.floor(Math.random() * 6) + 1;
    const tempRoll2 = Math.floor(Math.random() * 6) + 1;
    
    const tempEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🎲 **DICE BATTLE** 🎲')
      .setDescription(`${challenger} vs ${opponent}\n💰 **Bet:** ${challenge.betAmount} points each\n\n**Rolling dice...**\n${challenger}: **${tempRoll1}**\n${opponent}: **${tempRoll2}**`)
      .setTimestamp();
    
    await message.edit({ embeds: [tempEmbed] });
  }
  
  // Final roll
  const roll1 = Math.floor(Math.random() * 6) + 1;
  const roll2 = Math.floor(Math.random() * 6) + 1;
  
  let winner, loser, reason;
  if (roll1 > roll2) {
    winner = challenger;
    loser = opponent;
    reason = `${roll1} beats ${roll2}`;
  } else if (roll2 > roll1) {
    winner = opponent;
    loser = challenger;
    reason = `${roll2} beats ${roll1}`;
  } else {
    winner = null;
    reason = "It's a tie!";
  }
  
  // Award points
  if (winner) {
    storage.addPoints(winner.id, challenge.betAmount * 2);
  } else {
    // Tie - refund both players
    storage.addPoints(challenge.challenger, challenge.betAmount);
    storage.addPoints(challenge.opponent, challenge.betAmount);
  }
  
  const resultEmbed = new EmbedBuilder()
    .setColor(winner ? 0x00ff00 : 0xffff00)
    .setTitle('🎲 **DICE BATTLE - RESULT** 🎲')
    .setDescription(`${challenger}: **${roll1}**\n${opponent}: **${roll2}**\n\n**${reason}**`)
    .addFields(
      { name: '🏆 Winner', value: winner ? winner.toString() : 'Tie!', inline: true },
      { name: '💰 Prize', value: winner ? `${challenge.betAmount * 2} points` : 'Refunded', inline: true }
    )
    .setTimestamp();
  
  await message.edit({ embeds: [resultEmbed] });
}

async function playCoinFlip(message, challenge, challenger, opponent) {
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('🎯 **COIN FLIP** 🎯')
    .setDescription(`${challenger} vs ${opponent}\n💰 **Bet:** ${challenge.betAmount} points each\n\n**Flipping coin...**`)
    .setTimestamp();

  await message.edit({ embeds: [embed] });
  
  // Simulate coin flip animation
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 800));
    const tempResult = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
    
    const tempEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🎯 **COIN FLIP** 🎯')
      .setDescription(`${challenger} vs ${opponent}\n💰 **Bet:** ${challenge.betAmount} points each\n\n**Flipping coin...**\n🎯 **${tempResult}**`)
      .setTimestamp();
    
    await message.edit({ embeds: [tempEmbed] });
  }
  
  // Final result
  const result = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
  const winner = result === 'HEADS' ? challenger : opponent;
  const loser = result === 'HEADS' ? opponent : challenger;
  
  // Award points
  storage.addPoints(winner.id, challenge.betAmount * 2);
  
  const resultEmbed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('🎯 **COIN FLIP - RESULT** 🎯')
    .setDescription(`🎯 **${result}**\n\n**${winner} wins!**`)
    .addFields(
      { name: '🏆 Winner', value: winner.toString(), inline: true },
      { name: '💰 Prize', value: `${challenge.betAmount * 2} points`, inline: true }
    )
    .setTimestamp();
  
  await message.edit({ embeds: [resultEmbed] });
}

client.login(process.env.DISCORD_TOKEN); 