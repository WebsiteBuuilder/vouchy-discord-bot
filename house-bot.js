const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const storage = require('./storage.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// House bot configuration
const HOUSE_NAME = 'House';
const HOUSE_EDGE = 0.95; // 5% house edge for slots

// Game storage
const blackjackGames = new Map();
const slotSymbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`🎰 ${HOUSE_NAME} Bot Ready! Logged in as ${readyClient.user.tag}`);
  console.log(`💾 Using ${storage.getStats().environment} storage system`);
  console.log(`🎲 Casino is open for business!`);
});

// Handle slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // Balance command
  if (commandName === 'balance') {
    const userId = interaction.user.id;
    const points = storage.getPoints(userId);
    
    // Store username when we see it
    storage.setPoints(userId, points, interaction.user.username);
    
    const embed = new EmbedBuilder()
      .setColor(0x00D4AA)
      .setTitle('💰 Your Balance')
      .setDescription(`You have **${points}** points`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // Blackjack command
  else if (commandName === 'blackjack') {
    const betAmount = interaction.options.getInteger('amount');
    const userId = interaction.user.id;
    const currentPoints = storage.getPoints(userId);

    if (currentPoints < betAmount) {
      return interaction.reply({
        content: `❌ You don't have enough points! You have ${currentPoints} points but tried to bet ${betAmount}.`,
        ephemeral: true
      });
    }

    if (blackjackGames.has(userId)) {
      return interaction.reply({
        content: '❌ You already have a blackjack game in progress!',
        ephemeral: true
      });
    }

    await playBlackjack(interaction, betAmount);
  }

  // Roulette command
  else if (commandName === 'roulette') {
    const betAmount = interaction.options.getInteger('amount');
    const betType = interaction.options.getString('bet');
    const betNumber = interaction.options.getInteger('number');
    const userId = interaction.user.id;
    const currentPoints = storage.getPoints(userId);

    if (currentPoints < betAmount) {
      return interaction.reply({
        content: `❌ You don't have enough points! You have ${currentPoints} points but tried to bet ${betAmount}.`,
        ephemeral: true
      });
    }

    await playRoulette(interaction, betAmount, betType, betNumber);
  }

  // Slots command
  else if (commandName === 'slots') {
    const betAmount = interaction.options.getInteger('amount');
    const userId = interaction.user.id;
    const currentPoints = storage.getPoints(userId);

    if (currentPoints < betAmount) {
      return interaction.reply({
        content: `❌ You don't have enough points! You have ${currentPoints} points but tried to bet ${betAmount}.`,
        ephemeral: true
      });
    }

    await playSlots(interaction, betAmount);
  }
});

// Handle button interactions for blackjack
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const userId = interaction.user.id;
  const game = blackjackGames.get(userId);

  if (!game) {
    return interaction.reply({ content: 'No active game found!', ephemeral: true });
  }

  if (interaction.customId === 'blackjack_hit') {
    game.playerHand.push(drawCard(game.deck));
    const playerValue = getHandValue(game.playerHand);

    if (playerValue > 21) {
      await endBlackjackGame(interaction, game, false, 'Bust! You went over 21');
    } else if (playerValue === 21) {
      await endBlackjackGame(interaction, game, null, 'You got 21! Dealer\'s turn...');
    } else {
      const embed = createBlackjackEmbed(game, false);
      const row = createBlackjackButtons();
      await interaction.update({ embeds: [embed], components: [row] });
    }
  }

  else if (interaction.customId === 'blackjack_stand') {
    await endBlackjackGame(interaction, game, null, 'You stand. Dealer\'s turn...');
  }

  else if (interaction.customId === 'blackjack_quit') {
    blackjackGames.delete(userId);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🃏 Blackjack - Game Cancelled')
      .setDescription('Game cancelled. Your bet has been returned.')
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
  }
});

// Blackjack functions
async function playBlackjack(interaction, betAmount) {
  const userId = interaction.user.id;
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
    return await endBlackjackGame(interaction, game, true, 'Blackjack! 🎉');
  }

  const embed = createBlackjackEmbed(game, false);
  const row = createBlackjackButtons();

  await interaction.reply({ embeds: [embed], components: [row] });
}

function createBlackjackEmbed(game, showDealerCards) {
  const playerValue = getHandValue(game.playerHand);
  const dealerValue = getHandValue(game.dealerHand);

  const playerCards = game.playerHand.map(card => `${card.rank}${card.suit}`).join(' ');
  const dealerCards = showDealerCards 
    ? game.dealerHand.map(card => `${card.rank}${card.suit}`).join(' ')
    : `${game.dealerHand[0].rank}${game.dealerHand[0].suit} 🎴`;

  return new EmbedBuilder()
    .setColor(0x00D4AA)
    .setTitle('🃏 Blackjack')
    .addFields(
      { name: `Your Hand (${playerValue})`, value: playerCards, inline: false },
      { name: `Dealer Hand ${showDealerCards ? `(${dealerValue})` : ''}`, value: dealerCards, inline: false },
      { name: 'Bet Amount', value: `${game.betAmount} points`, inline: true }
    )
    .setFooter({ text: showDealerCards ? '' : 'Hit, Stand, or Quit' })
    .setTimestamp();
}

function createBlackjackButtons() {
  return new ActionRowBuilder()
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
}

async function endBlackjackGame(interaction, game, playerWon, reason) {
  if (playerWon === null) {
    // Play dealer's hand
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

  const currentPoints = storage.getPoints(game.userId);
  let newPoints = currentPoints;

  if (playerWon === true) {
    newPoints = currentPoints + game.betAmount;
  } else if (playerWon === false) {
    newPoints = currentPoints - game.betAmount;
  }

  storage.setPoints(game.userId, newPoints, interaction.user.username);
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

  await interaction.update({ embeds: [embed], components: [] });
}

// Roulette functions
async function playRoulette(interaction, betAmount, betType, betNumber) {
  const userId = interaction.user.id;
  const winningNumber = Math.floor(Math.random() * 37); // 0-36
  const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(winningNumber);
  const isBlack = winningNumber !== 0 && !isRed;
  const isGreen = winningNumber === 0;

  let won = false;
  let payout = 0;

  if (betType === 'red' && isRed) {
    won = true;
    payout = betAmount * 2;
  } else if (betType === 'black' && isBlack) {
    won = true;
    payout = betAmount * 2;
  } else if (betType === 'green' && isGreen) {
    won = true;
    payout = betAmount * 14;
  } else if (betType === 'number' && betNumber === winningNumber) {
    won = true;
    payout = betAmount * 35;
  }

  const currentPoints = storage.getPoints(userId);
  const newPoints = won ? currentPoints + payout - betAmount : currentPoints - betAmount;
  storage.setPoints(userId, newPoints, interaction.user.username);

  const color = isRed ? '🔴' : isBlack ? '⚫' : '🟢';
  const embed = new EmbedBuilder()
    .setColor(won ? 0x00FF00 : 0xFF0000)
    .setTitle('🎲 Roulette')
    .setDescription(`The ball landed on ${color} **${winningNumber}**`)
    .addFields(
      { name: 'Your Bet', value: `${betAmount} points on ${betType}${betType === 'number' ? ` (${betNumber})` : ''}`, inline: true },
      { name: 'Result', value: won ? `You won ${payout} points!` : `You lost ${betAmount} points`, inline: true },
      { name: 'New Balance', value: `${newPoints} points`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Slots functions
async function playSlots(interaction, betAmount) {
  const userId = interaction.user.id;
  const reels = [
    slotSymbols[Math.floor(Math.random() * slotSymbols.length)],
    slotSymbols[Math.floor(Math.random() * slotSymbols.length)],
    slotSymbols[Math.floor(Math.random() * slotSymbols.length)]
  ];

  let payout = 0;
  let result = 'No match';

  // Check for wins
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    if (reels[0] === '7️⃣') {
      payout = betAmount * 10; // Jackpot
      result = 'JACKPOT! 🎉';
    } else if (reels[0] === '💎') {
      payout = betAmount * 5;
      result = 'Diamond match! 💎';
    } else {
      payout = betAmount * 3;
      result = 'Three of a kind!';
    }
  } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    payout = betAmount * 2;
    result = 'Pair match!';
  }

  const currentPoints = storage.getPoints(userId);
  const newPoints = payout > 0 ? currentPoints + payout - betAmount : currentPoints - betAmount;
  storage.setPoints(userId, newPoints, interaction.user.username);

  const embed = new EmbedBuilder()
    .setColor(payout > 0 ? 0x00FF00 : 0xFF0000)
    .setTitle('🎰 Slots')
    .setDescription(`${reels[0]} ${reels[1]} ${reels[2]}`)
    .addFields(
      { name: 'Result', value: result, inline: true },
      { name: 'Bet', value: `${betAmount} points`, inline: true },
      { name: 'Payout', value: payout > 0 ? `${payout} points` : '0 points', inline: true },
      { name: 'New Balance', value: `${newPoints} points`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Card deck functions
function createDeck() {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit });
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

  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
}

client.login(process.env.DISCORD_TOKEN); 