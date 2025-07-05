const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const storage = require('../../storage.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recount-vouches')
    .setDescription('Recalculates all points by scanning the vouch channel history')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      // Find the vouch channel
      const vouchChannel = interaction.guild.channels.cache.find(
        channel => channel.name.toLowerCase().includes('vouch')
      );

      if (!vouchChannel) {
        return await interaction.editReply('Could not find a channel with "vouch" in its name.');
      }

      await interaction.editReply('Starting vouch recount... This may take a while.');

      // Get the provider role
      const providerRole = interaction.guild.roles.cache.find(
        role => role.name.toLowerCase() === 'provider'
      );

      if (!providerRole) {
        return await interaction.editReply('Could not find the "provider" role.');
      }

      // Reset all points
      const points = {};
      let messageCount = 0;
      let vouchCount = 0;

      try {
        // Fetch all messages
        let lastMessageId;
        while (true) {
          const options = { limit: 100 };
          if (lastMessageId) options.before = lastMessageId;
          
          const messages = await vouchChannel.messages.fetch(options);
          if (messages.size === 0) break;
          
          messageCount += messages.size;
          await interaction.editReply(`Scanning messages... ${messageCount} processed so far.`);
          
          for (const message of messages.values()) {
            // Skip bot messages
            if (message.author.bot) continue;

            // Check for provider mentions
            const mentionedProviders = message.mentions.members?.filter(
              member => member.roles.cache.has(providerRole.id)
            );

            if (mentionedProviders?.size > 0) {
              // For each provider mentioned, give a point to the person who mentioned them
              const userId = message.author.id;
              points[userId] = (points[userId] || 0) + mentionedProviders.size;
              vouchCount += mentionedProviders.size;
            }
          }
          
          lastMessageId = messages.last().id;
        }

        // Update points in storage
        for (const [userId, pointCount] of Object.entries(points)) {
          await storage.setPoints(userId, pointCount);
        }

        await interaction.editReply(
          `Recount complete!\n` +
          `- Processed ${messageCount} messages\n` +
          `- Found ${vouchCount} valid vouches\n` +
          `- Updated points for ${Object.keys(points).length} users`
        );

      } catch (error) {
        console.error('Error during vouch recount:', error);
        await interaction.editReply('An error occurred while scanning messages. Please try again.');
      }

    } catch (error) {
      console.error('Error in recount-vouches command:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'There was an error while recounting vouches. Please try again later.',
          ephemeral: true 
        });
      } else {
        await interaction.editReply('There was an error while recounting vouches. Please try again later.');
      }
    }
  },
}; 