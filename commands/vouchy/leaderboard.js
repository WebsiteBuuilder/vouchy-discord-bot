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

      // Fetch all user data first
      const userPromises = leaderboard.map(async entry => {
        try {
          const user = await interaction.client.users.fetch(entry.userId);
          return {
            ...entry,
            username: user.username,
            displayName: user.displayName || user.username,
            avatar: user.displayAvatarURL()
          };
        } catch (error) {
          console.error(`Error fetching user ${entry.userId}:`, error);
          return {
            ...entry,
            username: 'Unknown User',
            displayName: 'Unknown User',
            avatar: null
          };
        }
      });

      // Wait for all user data to be fetched
      const usersData = await Promise.all(userPromises);
      
      let description = '';
      for (let i = 0; i < usersData.length; i++) {
        const user = usersData[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        description += `${medal} **${user.displayName}** - **${user.points}** points\n`;
      }
      
      const embed = new EmbedBuilder()
        .setTitle('🏆 Points Leaderboard')
        .setDescription(description)
        .setColor('#FFD700')
        .setFooter({ text: `Top ${usersData.length} players` })
        .setTimestamp();

      // If we have a top player with an avatar, use it as thumbnail
      if (usersData[0]?.avatar) {
        embed.setThumbnail(usersData[0].avatar);
      }
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in leaderboard command:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'There was an error while fetching the leaderboard. Please try again later.',
          ephemeral: true 
        });
      } else {
        await interaction.editReply({ 
          content: 'There was an error while fetching the leaderboard. Please try again later.',
          ephemeral: true 
        });
      }
    }
  },
}; 