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
    .setName('roulette')
    .setDescription('🎲 Bet your points on roulette - pick red, black, green, or a number!')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('How many points do you want to bet?')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000)
    )
    .addStringOption(option =>
      option
        .setName('bet')
        .setDescription('What do you want to bet on?')
        .setRequired(true)
        .addChoices(
          { name: '🔴 Red (2x payout)', value: 'red' },
          { name: '⚫ Black (2x payout)', value: 'black' },
          { name: '🟢 Green (14x payout)', value: 'green' },
          { name: '🎯 Pick a Number (35x payout)', value: 'number' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('number')
        .setDescription('If you picked "Pick a Number", choose which number (0-36)')
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