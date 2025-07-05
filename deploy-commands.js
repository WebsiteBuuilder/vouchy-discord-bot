const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

console.log('DISCORD_TOKEN loaded:', process.env.DISCORD_TOKEN ? 'YES' : 'NO');
console.log('CLIENT_ID loaded:', (process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID) ? 'YES' : 'NO');
console.log('GUILD_ID loaded:', (process.env.GUILD_ID || process.env.DISCORD_GUILD_ID) ? 'YES' : 'NO');

const clientId = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID || process.env.DISCORD_GUILD_ID;

if (!process.env.DISCORD_TOKEN || !clientId || !guildId) {
  console.error('Missing environment variables!');
  console.log('Make sure your .env file contains:');
  console.log('DISCORD_TOKEN=your_bot_token_here');
  console.log('CLIENT_ID=your_client_id_here (or DISCORD_CLIENT_ID)');
  console.log('GUILD_ID=your_guild_id_here (or DISCORD_GUILD_ID)');
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
    .setDescription('🏆 Show the top 15 users with the most vouch points'),
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
    .setDescription('Opens the store')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('close')
    .setDescription('Closes the store')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('reload-points')
    .setDescription('🔄 Reloads points from the best available backup file (Admin only)')
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

module.exports = { commands }; 