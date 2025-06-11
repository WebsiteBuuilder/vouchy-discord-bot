const { REST, Routes, SlashCommandBuilder } = require('discord.js');
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
    .setDescription('Check vouch points for a user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to check points for')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the vouch points leaderboard'),
  new SlashCommandBuilder()
    .setName('addpoints')
    .setDescription('Manually add or remove points from a user (Admin only)')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to modify points for')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Amount of points to add (use negative numbers to remove)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for adding/removing points')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Play roulette with your points')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Amount of points to bet')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option
        .setName('bet')
        .setDescription('What to bet on')
        .setRequired(true)
        .addChoices(
          { name: 'Red', value: 'red' },
          { name: 'Black', value: 'black' },
          { name: 'Green (0)', value: 'green' },
          { name: 'Number 0-36', value: 'number' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('number')
        .setDescription('Specific number to bet on (0-36)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(36)
    ),
  new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play blackjack with your points')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Amount of points to bet')
        .setRequired(true)
        .setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName('send')
    .setDescription('Send points to another user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to send points to')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Amount of points to send')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Optional message with the transfer')
        .setRequired(false)
    ),
].map(command => command.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

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