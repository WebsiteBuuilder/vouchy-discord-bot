const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// Channel IDs
const STATUS_CHANNEL_ID = '1379853441819480194';
const ORDER_CHANNEL_ID = '1379887115143479466';

module.exports = {
    data: new SlashCommandBuilder(),
    async execute(interaction) {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply({ content: '❌ You need administrator permissions to use this command.', ephemeral: true });
        }

        const command = interaction.commandName;

        try {
            // Get the channels
            const statusChannel = await interaction.guild.channels.fetch(STATUS_CHANNEL_ID);
            const orderChannel = await interaction.guild.channels.fetch(ORDER_CHANNEL_ID);

            if (!statusChannel || !orderChannel) {
                return interaction.reply({
                    content: '❌ Could not find the status or order channels. Please check the channel IDs.',
                    ephemeral: true
                });
            }

            if (command === 'open') {
                // Update status channel name with green emojis
                await statusChannel.setName('🟢-OPEN-🟢');

                // Make order channel visible to everyone
                await orderChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                    ViewChannel: true
                });

                await interaction.reply({
                    content: '✅ Store opened successfully!\n• Status channel updated: 🟢-OPEN-🟢\n• #orderhere is now visible to everyone',
                    ephemeral: true
                });

            } else if (command === 'close') {
                // Update status channel name
                await statusChannel.setName('🔴-CLOSED-🔴');

                // Hide order channel from everyone
                await orderChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                    ViewChannel: false
                });

                await interaction.reply({
                    content: '✅ Store closed successfully!\n• Status channel updated: 🔴-CLOSED-🔴\n• #orderhere is now hidden from everyone',
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('Error in store command:', error);
            await interaction.reply({
                content: `❌ An error occurred: ${error.message}`,
                ephemeral: true
            });
        }
    },
}; 