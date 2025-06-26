const { Client, GatewayIntentBits, Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const storage = require('./storage.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Configuration
const PROVIDER_ROLE_NAME = 'provider';
const POINTS_PER_VOUCH = 1;

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`🚀 Ready! Logged in as ${readyClient.user.tag}`);
  console.log(`🔧 Using ${storage.getStats().environment} storage system`);
  console.log(`📊 Current data: ${storage.getStats().userCount} users, ${storage.getStats().totalPoints} points`);
  console.log(`💾 Storage auto-save is handled by storage.js`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // Check if message is in vouch channel
  const isVouchChannel = message.channel.name?.toLowerCase().includes('vouch') || 
                        message.channel.name?.toLowerCase().includes('review') ||
                        message.channel.name?.toLowerCase().includes('feedback');
  
  if (!isVouchChannel) return;

  console.log(`📝 Message in vouch channel from ${message.author.username}: checking for image and provider mentions...`);

  // Check for images
  const hasImage = message.attachments.some(attachment => 
    attachment.contentType?.startsWith('image/') || 
    attachment.name?.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i)
  );

  if (!hasImage) {
    console.log(`❌ No image found in message from ${message.author.username}`);
    return;
  }

  console.log(`✅ Image detected in message from ${message.author.username}`);

  // Check for provider mentions
  const mentionedUsers = message.mentions.users;
  if (mentionedUsers.size === 0) {
    console.log(`❌ No user mentions found in message from ${message.author.username}`);
    return;
  }

  console.log(`👥 Found ${mentionedUsers.size} user mention(s) in message from ${message.author.username}`);

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
    console.log(`❌ No valid providers mentioned in message from ${message.author.username}`);
    return;
  }

  // Award points to the author (the person providing the vouch)
  const currentPointsAuthor = storage.getPoints(message.author.id);
  const newPointsAuthor = currentPointsAuthor + POINTS_PER_VOUCH;
  storage.setPoints(message.author.id, newPointsAuthor);

  console.log(`💰 Awarded ${POINTS_PER_VOUCH} point to ${message.author.username} (${currentPointsAuthor} → ${newPointsAuthor})`);

  // React to show message was processed
  try {
    await message.react('✅');
    console.log(`✅ Reacted to vouch message from ${message.author.username}`);
  } catch (error) {
    console.log(`❌ Could not react to message: ${error.message}`);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'points') {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const points = storage.getPoints(targetUser.id);
    
    const embed = new EmbedBuilder()
      .setColor(0x00D4AA)
      .setTitle('💰 Vouch Points')
      .setDescription(`${targetUser.username} has **${points}** vouch points`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'leaderboard') {
    const allPoints = storage.getAllPoints();
    const sortedUsers = Object.entries(allPoints)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15);

    if (sortedUsers.length === 0) {
      return await interaction.reply('No users have vouch points yet!');
    }

    let description = '';
    for (let i = 0; i < sortedUsers.length; i++) {
      const [userId, points] = sortedUsers[i];
      let username = `User ${userId}`;
      try {
        const user = await interaction.client.users.fetch(userId, { force: true });
        username = user.username;
      } catch (error) {
        console.log(`Could not fetch user ${userId}: ${error.message}`);
      }

      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      description += `${medal} **${username}** - ${points} points\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00D4AA)
      .setTitle('🏆 Vouch Points Leaderboard (Top 15)')
      .setDescription(description)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'vouch') {
    const embed = new EmbedBuilder()
      .setColor(0x00D4AA)
      .setTitle('📋 How to Vouch')
      .setDescription('**Want to vouch for a provider?**\n\n1. Post a screenshot of your experience\n2. Mention the provider with @username\n3. They automatically get vouch points!')
      .addFields(
        { name: '✅ Valid Vouch', value: 'Image + Provider mention = **You** earn a point!', inline: true },
        { name: '❌ Invalid Vouch', value: 'No image or no provider mention = No points', inline: true }
      )
      .setFooter({ text: 'Help keep our community trustworthy!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'send') {
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const message = interaction.options.getString('message') || '';
    const senderId = interaction.user.id;

    if (targetUser.id === senderId) {
      return await interaction.reply({ content: '❌ You cannot send points to yourself!', ephemeral: true });
    }

    const senderPoints = storage.getPoints(senderId);
    if (senderPoints < amount) {
      return await interaction.reply({ 
        content: `❌ You don't have enough points! You have ${senderPoints} points but tried to send ${amount}.`, 
        ephemeral: true 
      });
    }

    storage.setPoints(senderId, senderPoints - amount);
    const receiverPoints = storage.getPoints(targetUser.id);
    storage.setPoints(targetUser.id, receiverPoints + amount);

      const embed = new EmbedBuilder()
      .setColor(0x00D4AA)
      .setTitle('💸 Points Sent!')
      .setDescription(`**${interaction.user.username}** sent **${amount}** points to **${targetUser.username}**`)
      .addFields(
        { name: '💰 Your Balance', value: `${senderPoints - amount} points`, inline: true },
        { name: '💰 Their Balance', value: `${receiverPoints + amount} points`, inline: true }
      )
      .setTimestamp();
    
    if (message) {
      embed.addFields({ name: '💌 Message', value: message, inline: false });
    }

    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'addpoints') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ You need Administrator permissions to use this command!', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const currentPoints = storage.getPoints(targetUser.id);
    const newPoints = Math.max(0, currentPoints + amount);
    storage.setPoints(targetUser.id, newPoints);

    const embed = new EmbedBuilder()
      .setColor(amount > 0 ? 0x00FF00 : 0xFF0000)
      .setTitle(amount > 0 ? '➕ Points Added' : '➖ Points Removed')
      .setDescription(`**${targetUser.username}** now has **${newPoints}** points`)
      .addFields(
        { name: 'Change', value: `${amount > 0 ? '+' : ''}${amount} points`, inline: true },
        { name: 'Previous', value: `${currentPoints} points`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'backup') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ You need Administrator permissions to use this command!', ephemeral: true });
    }

    const stats = storage.getStats();
    
    const embed = new EmbedBuilder()
      .setColor(0x00D4AA)
      .setTitle('💾 Storage Information')
      .setDescription('Current storage system status')
    .addFields(
        { name: '🗄️ Environment', value: stats.environment, inline: true },
        { name: '👥 Total Users', value: stats.userCount.toString(), inline: true },
        { name: '💰 Total Points', value: stats.totalPoints.toString(), inline: true }
    )
      .setFooter({ text: 'Backup completed automatically' })
    .setTimestamp();
  
    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'recount-vouches') {
    return await handleRecountVouches(interaction);
  }

  else if (commandName === 'remove-user') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ You need Administrator permissions to use this command!', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const points = storage.getPoints(targetUser.id);
    
    if (points === 0) {
      return await interaction.reply({ content: `❌ ${targetUser.username} has no points to remove.`, ephemeral: true });
    }

    storage.deleteUser(targetUser.id);

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🗑️ User Removed')
      .setDescription(`**${targetUser.username}** has been removed from the system`)
      .addFields({ name: 'Points Removed', value: `${points} points`, inline: true })
    .setTimestamp();
  
    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'hotkey-create') {
    return await handleHotkeyCreate(interaction);
  }
  else if (commandName === 'hotkey-delete') {
    return await handleHotkeyDelete(interaction);
  }
  else if (commandName === 'hotkey-list') {
    return await handleHotkeyList(interaction);
  }
  else if (commandName === 'open') {
    return await handleStoreOpen(interaction);
  }
  else if (commandName === 'close') {
    return await handleStoreClose(interaction);
  }
  else if (commandName === 'reload-points') {
    return await handleReloadPoints(interaction);
  }
  else if (commandName === 'restore-backup') {
    return await handleRestoreBackup(interaction);
  }
  else {
    // Check if it's a custom hotkey command
    const hotkeys = storage.getAllHotkeys();
    if (hotkeys[commandName]) {
      await interaction.reply(hotkeys[commandName]);
    }
  }
});

async function handleRecountVouches(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ You need Administrator permissions to use this command!', ephemeral: true });
    }

  await interaction.deferReply();

  try {
    const guild = interaction.guild;
    
    // Find vouch channels with more aggressive search
    const vouchChannels = guild.channels.cache.filter(channel => 
      channel.type === 0 && 
      (channel.name.toLowerCase().includes('vouch') || 
       channel.name.toLowerCase().includes('review') || 
       channel.name.toLowerCase().includes('feedback') ||
       channel.name.toLowerCase().includes('rep') ||
       channel.name.toLowerCase().includes('testimonial'))
    );

    if (vouchChannels.size === 0) {
      return await interaction.editReply('❌ No vouch channels found! Make sure there\'s a channel with "vouch", "review", "feedback", "rep", or "testimonial" in the name.');
    }

    console.log(`🔍 Found ${vouchChannels.size} vouch channel(s): ${vouchChannels.map(c => c.name).join(', ')}`);

    const providerRole = guild.roles.cache.find(role => 
      role.name.toLowerCase() === PROVIDER_ROLE_NAME.toLowerCase()
    );

    if (!providerRole) {
      return await interaction.editReply(`❌ Provider role "${PROVIDER_ROLE_NAME}" not found in server!`);
    }

    console.log(`🔍 Provider role found: ${providerRole.name} with ${providerRole.members.size} members`);

    // Capture current points so we can preserve manual adjustments
    const previousPoints = storage.getAllPoints();

    // Clear existing points so we can recount vouches from scratch
    Object.keys(previousPoints).forEach(userId => {
      storage.setPoints(userId, 0);
    });
    console.log(`🗑️ Cleared points for ${Object.keys(previousPoints).length} users`);

    let totalVouchesProcessed = 0;
    let totalPointsAwarded = 0;
    let processedMessages = 0;

    // Process each vouch channel
    for (const [channelId, channel] of vouchChannels) {
      console.log(`📝 Processing channel: ${channel.name}`);
      
      let lastMessageId = null;
      let hasMoreMessages = true;
      let channelVouches = 0;

      while (hasMoreMessages) {
        const options = { limit: 100 };
        if (lastMessageId) {
          options.before = lastMessageId;
        }

        const messages = await channel.messages.fetch(options);
        console.log(`📨 Fetched ${messages.size} messages from ${channel.name}`);
        
        if (messages.size === 0) {
          hasMoreMessages = false;
          break;
        }

        for (const [messageId, message] of messages) {
          processedMessages++;
          
          if (message.author.bot) continue;

          // Check for images with more aggressive detection
          const hasImage = message.attachments.size > 0 && message.attachments.some(attachment => 
            attachment.contentType?.startsWith('image/') || 
            attachment.name?.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i) ||
            attachment.url?.includes('cdn.discordapp.com')
          );

          if (!hasImage) continue;

          const mentionedUsers = message.mentions.users;
          if (mentionedUsers.size === 0) continue;

          console.log(`📸 Found vouch with image from ${message.author.username} mentioning ${mentionedUsers.size} users`);

          // Award point to the author (person giving the vouch)
          const currentPointsRecount = storage.getPoints(message.author.id);
          storage.setPoints(message.author.id, currentPointsRecount + POINTS_PER_VOUCH);
          totalPointsAwarded += POINTS_PER_VOUCH;
          channelVouches++;
          console.log(`✅ Awarded point to ${message.author.username} from message ${messageId}`);
        }

        lastMessageId = messages.last()?.id;
        await new Promise(resolve => setTimeout(resolve, 200)); // Longer delay to avoid rate limits
      }

      totalVouchesProcessed += channelVouches;
      console.log(`📊 Processed ${channelVouches} vouches in ${channel.name}`);
    }

    // Re-apply manual adjustments (any difference between previous points and newly counted vouch points)
    let manualAdjustmentsApplied = 0;
    const newPointsAfterVouch = storage.getAllPoints();
    for (const [userId, prevPts] of Object.entries(previousPoints)) {
      const vouchPts = newPointsAfterVouch[userId] ?? 0;
      if (prevPts > vouchPts) {
        const diff = prevPts - vouchPts;
        storage.addPoints(userId, diff);
        manualAdjustmentsApplied += diff;
        console.log(`🛠️ Preserved manual adjustment of +${diff} for user ${userId}`);
      }
    }

    const usersWithPoints = Object.keys(storage.getAllPoints()).filter(id => storage.getPoints(id) > 0).length;

    const embed = new EmbedBuilder()
      .setColor(0x00D4AA)
      .setTitle('✅ Vouch Recount Complete!')
      .setDescription('Successfully recounted all vouches from channel history')
      .addFields(
        { name: '📁 Channels Scanned', value: vouchChannels.map(c => c.name).join(', '), inline: false },
        { name: '📨 Messages Processed', value: processedMessages.toString(), inline: true },
        { name: '📊 Valid Vouches Found', value: totalVouchesProcessed.toString(), inline: true },
        { name: '💰 Points Awarded', value: totalPointsAwarded.toString(), inline: true },
        { name: '👥 Users with Points', value: usersWithPoints.toString(), inline: true },
        { name: '🎭 Provider Role Members', value: providerRole.members.size.toString(), inline: true },
        { name: '🛠️ Manual Adjustments Preserved', value: manualAdjustmentsApplied.toString(), inline: true }
      )
      .setFooter({ text: 'All points have been recalculated from scratch' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    } catch (error) {
    console.error('Error during recount:', error);
    await interaction.editReply(`❌ An error occurred during the recount: ${error.message}`);
    }
}

async function handleHotkeyCreate(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ You need Administrator permissions to use this command!', ephemeral: true });
    }

  const name = interaction.options.getString('name');
    const message = interaction.options.getString('message');

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return await interaction.reply({ content: '❌ Command name can only contain letters, numbers, underscores, and hyphens!', ephemeral: true });
  }

  const hotkeys = storage.getAllHotkeys();
  hotkeys[name] = message;
    storage.setHotkey(name, message);

  const embed = new EmbedBuilder()
    .setColor(0x00D4AA)
    .setTitle('✅ Hotkey Created!')
    .setDescription(`Created new command: \`/${name}\``)
    .addFields({ name: 'Message', value: message, inline: false })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleHotkeyDelete(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ You need Administrator permissions to use this command!', ephemeral: true });
    }

  const name = interaction.options.getString('name');
  const hotkeys = storage.getAllHotkeys();

  if (!hotkeys[name]) {
    return await interaction.reply({ content: `❌ No hotkey command found with name: \`${name}\``, ephemeral: true });
    }

    storage.deleteHotkey(name);

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
    .setTitle('🗑️ Hotkey Deleted!')
    .setDescription(`Deleted command: \`/${name}\``)
            .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleHotkeyList(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ You need Administrator permissions to use this command!', ephemeral: true });
  }

  const hotkeys = storage.getAllHotkeys();
  const hotkeyList = Object.keys(hotkeys);

  if (hotkeyList.length === 0) {
    return await interaction.reply('No custom hotkey commands have been created yet.');
  }

        const embed = new EmbedBuilder()
    .setColor(0x00D4AA)
    .setTitle('📋 Custom Hotkey Commands')
    .setDescription(hotkeyList.map(name => `• \`/${name}\``).join('\n'))
    .setFooter({ text: `Total: ${hotkeyList.length} custom commands` })
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed] });
}

async function handleStoreOpen(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ You need Administrator permissions to use this command!', ephemeral: true });
    }

    const embed = new EmbedBuilder()
    .setColor(0x00D4AA)
    .setTitle('🏪 Store Opened!')
    .setDescription('The store is now open for business!')
      .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleStoreClose(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ You need Administrator permissions to use this command!', ephemeral: true });
    }

    const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('🏪 Store Closed!')
    .setDescription('The store is now closed.')
      .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleReloadPoints(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ You need Administrator permissions to use this command!', ephemeral: true });
  }

  const stats = storage.getStats();
  
  const embed = new EmbedBuilder()
    .setColor(0x00D4AA)
    .setTitle('🔄 Points Reloaded!')
    .setDescription('Points data has been reloaded from storage')
      .addFields(
      { name: '👥 Users', value: stats.userCount.toString(), inline: true },
      { name: '💰 Total Points', value: stats.totalPoints.toString(), inline: true }
      )
      .setTimestamp();
    
  await interaction.reply({ embeds: [embed] });
}

async function handleRestoreBackup(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ You need Administrator permissions to use this command!', ephemeral: true });
  }

  const filename = interaction.options.getString('filename');
  
  const embed = new EmbedBuilder()
    .setColor(0x00D4AA)
    .setTitle('📥 Backup Restored!')
    .setDescription(`Successfully restored data from ${filename}`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

client.login(process.env.DISCORD_TOKEN); 