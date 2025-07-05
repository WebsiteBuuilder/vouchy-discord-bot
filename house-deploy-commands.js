const { REST, Routes } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!process.env.DISCORD_TOKEN || !clientId || !guildId) {
  console.error('Missing environment variables!');
  console.log('Make sure your .env file contains:');
  console.log('DISCORD_TOKEN=your_bot_token_here');
  console.log('DISCORD_CLIENT_ID=your_client_id_here');
  console.log('DISCORD_GUILD_ID=your_guild_id_here');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('💰 Check your current point balance'),
  
  new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('🃏 Play blackjack! Try to get 21 without going over')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('How many points do you want to bet?')
        .setRequired(true)
        .setMinValue(1)
    ),
  
  new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('🎲 Spin the roulette wheel! Bet on red, black, green, or a specific number')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('How many points do you want to bet?')
        .setRequired(true)
        .setMinValue(1)
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
          { name: '🎯 Specific Number (35x payout)', value: 'number' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('number')
        .setDescription('If betting on a specific number, choose 0-36')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(36)
    ),
  
  new SlashCommandBuilder()
    .setName('slots')
    .setDescription('🎰 Pull the slot machine lever! Match symbols to win big')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('How many points do you want to bet?')
        .setRequired(true)
        .setMinValue(1)
    ),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🎰 Started refreshing House bot commands...');

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );

    console.log('✅ Successfully deployed House bot commands!');
    console.log('🎲 Casino commands ready:');
    console.log('  - /balance - Check your points');
    console.log('  - /blackjack - Play blackjack');
    console.log('  - /roulette - Spin the wheel');
    console.log('  - /slots - Pull the slot machine');
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})(); 