const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Persistent storage for points
const POINTS_FILE = path.join(__dirname, 'points.json');
const vouchPoints = new Map();

// Load points from file on startup
function loadPoints() {
  try {
    if (fs.existsSync(POINTS_FILE)) {
      const data = fs.readFileSync(POINTS_FILE, 'utf8');
      const pointsObj = JSON.parse(data);
      Object.entries(pointsObj).forEach(([userId, points]) => {
        vouchPoints.set(userId, points);
      });
      console.log(`Loaded ${vouchPoints.size} user points from storage`);
    }
  } catch (error) {
    console.error('Error loading points:', error);
  }
}

// Save points to file
function savePoints() {
  try {
    const pointsObj = Object.fromEntries(vouchPoints);
    fs.writeFileSync(POINTS_FILE, JSON.stringify(pointsObj, null, 2));
  } catch (error) {
    console.error('Error saving points:', error);
  }
}

// Load points on startup
loadPoints();

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

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Handle gambling commands
  if (message.channel.name?.toLowerCase().includes(GAMBLING_CHANNEL_NAME.toLowerCase())) {
    await handleGamblingCommands(message);
    return;
  }

  // Check if message is in vouch channel
  if (!message.channel.name?.toLowerCase().includes('vouch')) return;

  // Check if message has attachments (images)
  const hasImage = message.attachments.some(attachment => 
    attachment.contentType?.startsWith('image/')
  );

  if (!hasImage) return;

  // Check if message mentions a provider
  const mentionedUsers = message.mentions.users;
  if (mentionedUsers.size === 0) return;

  // Check if any mentioned user has provider role
  const guild = message.guild;
  const providerRole = guild.roles.cache.find(role => 
    role.name.toLowerCase() === PROVIDER_ROLE_NAME.toLowerCase()
  );

  if (!providerRole) {
    console.log('Provider role not found');
    return;
  }

  let mentionedProviders = [];
  for (const [userId, user] of mentionedUsers) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member && member.roles.cache.has(providerRole.id)) {
      mentionedProviders.push(user);
    }
  }

  if (mentionedProviders.length === 0) return;

  // Add points for each mentioned provider
  mentionedProviders.forEach(provider => {
    const currentPoints = vouchPoints.get(provider.id) || 0;
    vouchPoints.set(provider.id, currentPoints + POINTS_PER_VOUCH);
    
    console.log(`Added ${POINTS_PER_VOUCH} point(s) to ${provider.username} (${provider.id})`);
  });
  
  // Save points after adding
  savePoints();

  // Send confirmation embed
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Vouch Point(s) Added!')
    .setDescription(`${mentionedProviders.map(p => `<@${p.id}>`).join(', ')} received ${POINTS_PER_VOUCH} point(s)!`)
    .setFooter({ text: `From: ${message.author.username}` })
    .setTimestamp();

  message.reply({ embeds: [embed] });
});

// Slash command to check points
client.on(Events.InteractionCreate, async (interaction) => {
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

  // Roulette slash command
  if (interaction.commandName === 'roulette') {
    const betAmount = interaction.options.getInteger('amount');
    const betType = interaction.options.getString('bet');
    const numberBet = interaction.options.getInteger('number');
    
    const userId = interaction.user.id;
    const userPoints = vouchPoints.get(userId) || 0;
    
    if (userPoints < betAmount) {
      return interaction.reply({ 
        content: `❌ You don't have enough points! You have ${userPoints} points but tried to bet ${betAmount}.`, 
        ephemeral: true 
      });
    }
    
    // Handle number bet
    let finalBetType = betType;
    if (betType === 'number') {
      if (numberBet === null || numberBet === undefined) {
        return interaction.reply({ 
          content: '❌ Please specify a number (0-36) when betting on numbers!', 
          ephemeral: true 
        });
      }
      finalBetType = numberBet.toString();
    }
    
    await playRouletteSlash(interaction, betAmount, finalBetType);
  }

  // Blackjack slash command
  if (interaction.commandName === 'blackjack') {
    const betAmount = interaction.options.getInteger('amount');
    const userId = interaction.user.id;
    const userPoints = vouchPoints.get(userId) || 0;
    
    if (userPoints < betAmount) {
      return interaction.reply({ 
        content: `❌ You don't have enough points! You have ${userPoints} points but tried to bet ${betAmount}.`, 
        ephemeral: true 
      });
    }
    
    if (blackjackGames.has(userId)) {
      return interaction.reply({ 
        content: '❌ You already have a blackjack game in progress!', 
        ephemeral: true 
      });
    }
    
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
  const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
  
  // Add reactions for game controls
  await reply.react('🃏'); // hit
  await reply.react('✋'); // stand
  await reply.react('❌'); // quit
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
  
  if (messageOrInteraction.edit) {
    await messageOrInteraction.edit({ embeds: [embed] });
    messageOrInteraction.reactions.removeAll();
  } else {
    await messageOrInteraction.editReply({ embeds: [embed] });
  }
}

client.login(process.env.DISCORD_TOKEN); 