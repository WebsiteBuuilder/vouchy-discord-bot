const { EmbedBuilder } = require('discord.js');

// Multiplayer Roulette System
const activeRouletteGames = new Map();

// Roulette wheel layout (European style)
const ROULETTE_NUMBERS = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK_NUMBERS = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

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

async function updateRouletteMessage(game) {
    if (!game.message) return;

    const timeLeft = Math.max(0, Math.ceil((game.endTime - Date.now()) / 1000));
    
    const embed = new EmbedBuilder()
        .setColor(0x1a1a1a)
        .setTitle('🎰 **IMMERSIVE ROULETTE TABLE** 🎰')
        .setDescription('**🕐 BETTING PHASE OPEN**\n\nPlace your bets! You have **' + timeLeft + ' seconds** to bet.');

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

    try {
        await game.message.edit({ embeds: [embed] });
        
        // Pin the message to keep it visible
        if (!game.message.pinned) {
            await game.message.pin().catch(() => {}); // Ignore pin errors
        }
    } catch (error) {
        console.error('Error updating roulette message:', error);
    }
}

async function animateRouletteWheel(game) {
    const totalSpins = 40;
    const winningIndex = ROULETTE_NUMBERS.indexOf(game.currentNumber);
    let currentIndex = 0;

    const spinningEmbed = new EmbedBuilder()
        .setColor(0x1a1a1a)
        .setTitle('🎰 **ROULETTE WHEEL SPINNING** 🎰')
        .setDescription('**No more bets!** The wheel is spinning...')
        .setFooter({ text: 'Watching the ball...' })
        .setTimestamp();

    await game.message.edit({ embeds: [spinningEmbed] });

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
        
        const progress = i / totalSpins;
        let delay;
        if (progress < 0.3) delay = 80;
        else if (progress < 0.6) delay = 150;
        else if (progress < 0.8) delay = 300;
        else delay = 500;
        
        await sleep(delay);
    }

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

function calculateResults(game, storage) {
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
            
            const currentPoints = storage.getPoints(userId);
            storage.setPoints(userId, currentPoints + winnings);
        } else {
            results.losers.push({
                userId: userId,
                bet: bet,
                loss: bet.amount
            });
            
            const currentPoints = storage.getPoints(userId);
            storage.setPoints(userId, currentPoints - bet.amount);
        }
    }

    return results;
}

function createResultsEmbed(game, results) {
    const embed = new EmbedBuilder()
        .setColor(getNumberColor(game.currentNumber) === '🟢' ? 0x00FF00 : 
                 getNumberColor(game.currentNumber) === '🔴' ? 0xFF0000 : 0x808080)
        .setTitle('🎰 **ROULETTE RESULTS** 🎰')
        .setDescription(`**The ball landed on:** ${getNumberColor(game.currentNumber)} **${game.currentNumber}**\n\n` +
            `**Total bets:** ${game.bets.size}\n` +
            `**Total winnings:** ${results.totalWinnings} points`);

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

async function endBettingPhase(channelId, storage) {
    const game = activeRouletteGames.get(channelId);
    if (!game) return;

    game.currentNumber = ROULETTE_NUMBERS[Math.floor(Math.random() * ROULETTE_NUMBERS.length)];

    await animateRouletteWheel(game);

    const results = calculateResults(game, storage);

    const resultsEmbed = createResultsEmbed(game, results);
    await game.message.edit({ embeds: [resultsEmbed] });

    activeRouletteGames.delete(channelId);
}

// Add a function to start continuous updates
function startRouletteUpdates(game) {
    const updateInterval = setInterval(async () => {
        if (!activeRouletteGames.has(game.channelId)) {
            clearInterval(updateInterval);
            return;
        }
        
        await updateRouletteMessage(game);
        
        // Stop updates when betting phase ends
        if (Date.now() > game.endTime) {
            clearInterval(updateInterval);
        }
    }, 2000); // Update every 2 seconds
    
    game.updateInterval = updateInterval;
}

async function startRoulette(interaction) {
  const channelId = interaction.channelId;
  
  if (activeRouletteGames.has(channelId)) {
    return interaction.reply({
      content: '❌ There\'s already a roulette game running in this channel!',
      ephemeral: true,
    });
  }

  const game = {
    channelId: channelId,
    bets: new Map(),
    startTime: Date.now(),
    endTime: Date.now() + (30 * 1000), // 30 seconds
    client: interaction.client,
    message: null
  };

  activeRouletteGames.set(channelId, game);

  const embed = new EmbedBuilder()
    .setColor(0x1a1a1a)
    .setTitle('🎰 **IMMERSIVE ROULETTE TABLE** 🎰')
    .setDescription('**🕐 BETTING PHASE OPEN**\n\nPlace your bets! You have **30 seconds** to bet.')
    .addFields(
      { name: '💰 Current Bets', value: 'No bets placed yet', inline: false },
      { name: '⏰ Time Remaining', value: '30 seconds', inline: true },
      { name: '🎯 Available Bets', value: '`red` `black` `green` `even` `odd` `high` `low` `straight [0-36]`', inline: false }
    )
    .setFooter({ text: 'Use /roulette-bet <amount> <type> to place your bet!' })
    .setTimestamp();

  const message = await interaction.reply({ embeds: [embed], fetchReply: true });
  game.message = message;

  // Start continuous updates
  startRouletteUpdates(game);

  // End betting phase after 30 seconds
  setTimeout(() => {
    const storage = require('./storage.js');
    endBettingPhase(channelId, storage);
  }, 30 * 1000);

  console.log(`🎰 Roulette game started in channel ${channelId}`);
}

async function placeBet(interaction) {
  const channelId = interaction.channelId;
  const game = activeRouletteGames.get(channelId);
  
  if (!game) {
    return interaction.reply({
      content: '❌ No active roulette game in this channel! Use `/roulette-start` to begin.',
      ephemeral: true,
    });
  }
  
  if (Date.now() > game.endTime) {
    return interaction.reply({
      content: '❌ Betting time has ended! The wheel is spinning.',
      ephemeral: true,
    });
  }
  
  const userId = interaction.user.id;
  const amount = interaction.options.getInteger('amount');
  const type = interaction.options.getString('type');
  const number = interaction.options.getInteger('number');
  
  // Import storage to check points
  const { Storage } = require('./storage.js');
  const storage = require('./storage.js');
  
  if (storage.getPoints(userId) < amount) {
    return interaction.reply({
      content: `❌ You don't have enough points! You have ${storage.getPoints(userId)} points.`,
      ephemeral: true,
    });
  }
  
  if (game.bets.has(userId)) {
    return interaction.reply({
      content: '❌ You already have a bet placed for this round!',
      ephemeral: true,
    });
  }
  
  // Validate straight number bet
  if (type === 'straight' && (number === null || number < 0 || number > 36)) {
    return interaction.reply({
      content: '❌ For straight bets, you must specify a number between 0-36!',
      ephemeral: true,
    });
  }
  
  // Store the bet
  game.bets.set(userId, {
    amount: amount,
    type: type,
    number: number
  });
  
  const payout = getBetPayout(type, amount);
  
  await interaction.reply({
    content: `✅ **Bet placed!** ${amount} points on **${type}**${number !== null ? ` (${number})` : ''}\n💰 **Potential payout:** ${payout} points`,
    ephemeral: true,
  });
  
  // Update the main message
  await updateRouletteMessage(game);
}

module.exports = {
    activeRouletteGames,
    startRoulette,
    placeBet,
    updateRouletteMessage,
    endBettingPhase,
    checkBetWin,
    getBetPayout,
    getNumberColor
}; 