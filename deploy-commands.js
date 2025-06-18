const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

console.log('DISCORD_TOKEN loaded:', process.env.DISCORD_TOKEN ? 'YES' : 'NO');
console.log('CLIENT_ID loaded:', (process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID) ? 'YES' : 'NO');

const clientId = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;

if (!process.env.DISCORD_TOKEN || !clientId) {
  console.error('Missing environment variables!');
  console.log('Make sure your .env file contains:');
  console.log('DISCORD_TOKEN=your_bot_token_here');
  console.log('CLIENT_ID=your_client_id_here (or DISCORD_CLIENT_ID)');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('vouch')
    .setDescription('Posts a pre-written message to encourage users to vouch.'),
  new SlashCommandBuilder()
    .setName('points')
    .setDescription('💰 Check how many vouch points you or someone else has')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to check points for (leave empty to check yourself)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('🏆 Show the top 10 users with the most vouch points'),
  new SlashCommandBuilder()
    .setName('addpoints')
    .setDescription('⚖️ Add or remove points from a user (Admin only)')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Which user to give/take points from')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('How many points to add (use negative numbers like -5 to remove)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Why are you adding/removing these points?')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('backup')
    .setDescription('💾 Manually backup points data and show storage info (Admin only)'),
  new SlashCommandBuilder()
    .setName('roulette-start')
    .setDescription('🎰 Start a new multiplayer roulette game (30 second betting phase)'),
  new SlashCommandBuilder()
    .setName('bet')
    .setDescription('🎯 Place a bet on the active roulette table!')
    .addStringOption(option =>
      option
        .setName('bet-type')
        .setDescription('Choose your bet type')
        .setRequired(true)
        .addChoices(
          { name: '🔴 Red (2x payout)', value: 'red' },
          { name: '⚫ Black (2x payout)', value: 'black' },
          { name: '🟢 Green/Zero (36x payout)', value: 'green' },
          { name: '🎯 Straight Number (36x payout)', value: 'straight' },
          { name: '🔢 Even Numbers (2x payout)', value: 'even' },
          { name: '🔢 Odd Numbers (2x payout)', value: 'odd' },
          { name: '📈 High (19-36) (2x payout)', value: 'high' },
          { name: '📉 Low (1-18) (2x payout)', value: 'low' },
          { name: '📊 First Dozen (1-12) (3x payout)', value: 'first-dozen' },
          { name: '📊 Second Dozen (13-24) (3x payout)', value: 'second-dozen' },
          { name: '📊 Third Dozen (25-36) (3x payout)', value: 'third-dozen' },
          { name: '📋 First Column (3x payout)', value: 'first-column' },
          { name: '📋 Second Column (3x payout)', value: 'second-column' },
          { name: '📋 Third Column (3x payout)', value: 'third-column' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('How many points do you want to bet?')
        .setRequired(true)
        .setMinValue(1)
    )
    .addIntegerOption(option =>
      option
        .setName('number')
        .setDescription('If betting on a straight number, choose which number (0-36)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(36)
    ),
  new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('🃏 Play blackjack and try to get 21! Beat the dealer for 2x payout')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('How many points do you want to bet?')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000)
    ),
  new SlashCommandBuilder()
    .setName('send')
    .setDescription('💸 Send some of your points to another user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Who do you want to send points to?')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('How many points do you want to send?')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Optional message to include with the transfer')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('remove-user')
    .setDescription('ADMIN: Removes a user and their points from the system.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to remove')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('recount-vouches')
    .setDescription('ADMIN: Recalculates all points by scanning the vouch channel history.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // Hotkey Commands
  new SlashCommandBuilder()
    .setName('hotkey-create')
    .setDescription('ADMIN: Create a new custom command (hotkey).')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('The name of the new command (e.g., "promo"). No spaces or special characters.')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('The message the bot will post when this command is used.')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('hotkey-delete')
    .setDescription('ADMIN: Delete a custom command.')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('The name of the command to delete.')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('hotkey-list')
    .setDescription('ADMIN: List all available custom commands.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('open')
    .setDescription('ADMIN: Opens the store, making the order channel public.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('close')
    .setDescription('ADMIN: Closes the store, making the order channel private.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('reload-points')
    .setDescription('🔄 Reloads points from the best available backup file (Admin only)'),
  new SlashCommandBuilder()
    .setName('restore-backup')
    .setDescription('🗄️ Force restore points from a specific backup file (Admin only)')
    .addStringOption(option =>
      option
        .setName('filename')
        .setDescription('The backup file to restore from')
        .setRequired(true)
        .addChoices(
          { name: 'Latest Backup (points-backup.json)', value: 'points-backup.json' },
          { name: 'Recovery (points-recovery.json)', value: 'points-recovery.json' },
          { name: 'Emergency (points-emergency.json)', value: 'points-emergency.json' }
        )
    ),
  new SlashCommandBuilder()
    .setName('clear-points')
    .setDescription('🗑️ Clear all user points and start fresh (Admin only)'),
  new SlashCommandBuilder()
    .setName('roulette-bet')
    .setDescription('💰 Place a bet in the current roulette game')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('How many points to bet')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('What to bet on')
        .setRequired(true)
        .addChoices(
          { name: '🔴 Red (2x)', value: 'red' },
          { name: '⚫ Black (2x)', value: 'black' },
          { name: '🟢 Green (14x)', value: 'green' },
          { name: 'Even Numbers (2x)', value: 'even' },
          { name: 'Odd Numbers (2x)', value: 'odd' },
          { name: 'High (19-36) (2x)', value: 'high' },
          { name: 'Low (1-18) (2x)', value: 'low' },
          { name: 'First Dozen (1-12) (2x)', value: 'first-dozen' },
          { name: 'Second Dozen (13-24) (2x)', value: 'second-dozen' },
          { name: 'Third Dozen (25-36) (2x)', value: 'third-dozen' },
          { name: 'First Column (2x)', value: 'first-column' },
          { name: 'Second Column (2x)', value: 'second-column' },
          { name: 'Third Column (2x)', value: 'third-column' },
          { name: 'Straight Number (35x)', value: 'straight' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('number')
        .setDescription('Number for straight bet (0-36)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(36)
    ),
  new SlashCommandBuilder()
    .setName('challenge')
    .setDescription('⚔️ Challenge another user to a 1v1 game for vouch points')
    .addUserOption(option =>
      option
        .setName('opponent')
        .setDescription('The user you want to challenge')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('game')
        .setDescription('The game to play')
        .setRequired(true)
        .addChoices(
          { name: '🪨 Rock Paper Scissors', value: 'rps' },
          { name: '🎲 Dice Battle', value: 'dice' },
          { name: '🎯 Coin Flip', value: 'coin' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('bet')
        .setDescription('Amount of points to bet')
        .setRequired(true)
        .setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName('accept')
    .setDescription('✅ Accept a challenge from another user')
    .addStringOption(option =>
      option
        .setName('challenge_id')
        .setDescription('The challenge ID to accept')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('decline')
    .setDescription('❌ Decline a challenge from another user')
    .addStringOption(option =>
      option
        .setName('challenge_id')
        .setDescription('The challenge ID to decline')
        .setRequired(true)
    ),
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

module.exports = { commands }; 