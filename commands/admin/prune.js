const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../../storage.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prune')
    .setDescription('Clean leaderboard: remove users who left and 0-point users.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: ' Admins only.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const allPoints = storage.getAllPoints();
    let removedMissing = 0;
    let removedZero = 0;

    for (const [userId, points] of Object.entries(allPoints)) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        storage.deleteUser(userId);
        removedMissing++;
      } else if (points === 0) {
        storage.deleteUser(userId);
        removedZero++;
      }
    }

    const remaining = Object.keys(storage.getAllPoints()).length;

    const embed = new EmbedBuilder()
      .setTitle(' Leaderboard Pruned')
      .setColor(0x00D4AA)
      .addFields(
        { name: 'Left/Deleted Users Removed', value: removedMissing.toString(), inline: true },
        { name: '0-Point Users Removed', value: removedZero.toString(), inline: true },
        { name: 'Remaining Users', value: remaining.toString(), inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
