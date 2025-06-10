const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

console.log('DISCORD_TOKEN loaded:', process.env.DISCORD_TOKEN ? 'YES' : 'NO');
console.log('CLIENT_ID loaded:', process.env.CLIENT_ID ? 'YES' : 'NO');

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('Missing environment variables!');
  console.log('Make sure your .env file contains:');
  console.log('DISCORD_TOKEN=your_bot_token_here');
  console.log('CLIENT_ID=your_client_id_here');
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
].map(command => command.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})(); 