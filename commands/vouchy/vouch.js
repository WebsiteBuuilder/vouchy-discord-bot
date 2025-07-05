const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vouch')
    .setDescription('Shows information about how to vouch and earn points'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🌟 Thank You for Choosing QuikEats!')
      .setDescription(
        'We appreciate your business! Don\'t forget to leave a vouch to earn points.'
      )
      .addFields(
        {
          name: '📝 How to Vouch',
          value: 'Head over to <#vouch> and:\n' +
                 '1. Post a screenshot of your order\n' +
                 '2. Tag the provider who helped you\n' +
                 '3. Share your experience!'
        },
        {
          name: '💰 Earn Points',
          value: 'Every time you vouch with a screenshot and tag a provider, you\'ll earn 1 point!'
        },
        {
          name: '🎁 Use Your Points',
          value: 'Points can be used for:\n' +
                 '• Free Orders\n' +
                 '• Special Discounts\n' +
                 '• Priority Service\n' +
                 '• And more!'
        },
        {
          name: '💡 Quick Tip',
          value: 'Use `/points` to check your balance\n' +
                 'Use `/leaderboard` to see top vouchers'
        }
      )
      .setColor('#4CAF50')
      .setTimestamp()
      .setFooter({ text: 'QuikEats - Fast, Fresh, and Reliable!' });

    await interaction.reply({ embeds: [embed] });
  },
}; 