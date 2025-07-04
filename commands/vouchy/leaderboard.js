const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const storage = require('../../storage.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the top players by points')
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of players to show (default: 10)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)),
  
  async execute(interaction) {
    try {
      await interaction.deferReply(); // Defer the reply immediately
      
      const limit = interaction.options.getInteger('limit') || 10;
      const leaderboard = await storage.getLeaderboard(limit);
      
      if (!leaderboard || leaderboard.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('🏆 Points Leaderboard')
          .setDescription('No players found with points yet!')
          .setColor('#FFD700')
          .setTimestamp();
        
        return await interaction.editReply({ embeds: [embed] });
      }
      
      let description = '';
      for (let i = 0; i < leaderboard.length; i++) {
        const user = leaderboard[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        description += `${medal} <@${user.userId}> - **${user.points}** points\n`;
      }
      
      const embed = new EmbedBuilder()
        .setTitle('🏆 Points Leaderboard')
        .setDescription(description)
        .setColor('#FFD700')
        .setFooter({ text: `Top ${leaderboard.length} players` })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in leaderboard command:', error);
      
      // If we haven't replied yet, send an error message
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'There was an error while fetching the leaderboard. Please try again later.',
          ephemeral: true 
        });
      } else {
        // If we already deferred, edit the reply
        await interaction.editReply({ 
          content: 'There was an error while fetching the leaderboard. Please try again later.',
          ephemeral: true 
        });
      }
    }
  },
}; 