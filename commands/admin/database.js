const { SlashCommandBuilder } = require('discord.js');
const { saveAllPoints, clearAllPoints } = require('../../database-points');

module.exports = {
  data: new SlashCommandBuilder(),
  async execute(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.reply({ content: '❌ You need administrator permissions to use this command.', ephemeral: true });
    }

    if (interaction.commandName === 'save-points') {
      await interaction.deferReply({ ephemeral: true });
      try {
        await saveAllPoints();
        await interaction.editReply('✅ Successfully saved all points to the Railway PostgreSQL database!');
      } catch (error) {
        console.error('Error saving points:', error);
        await interaction.editReply('❌ Failed to save points to database. Check console for details.');
      }
    }

    if (interaction.commandName === 'clear-points') {
      const confirm = interaction.options.getString('confirm');
      if (confirm !== 'CONFIRM') {
        return interaction.reply({ 
          content: '❌ Operation cancelled. You must type CONFIRM exactly to proceed.',
          ephemeral: true 
        });
      }

      await interaction.deferReply({ ephemeral: true });
      try {
        await clearAllPoints();
        await interaction.editReply('✅ Successfully cleared all points from the system!');
      } catch (error) {
        console.error('Error clearing points:', error);
        await interaction.editReply('❌ Failed to clear points. Check console for details.');
      }
    }
  },
}; 