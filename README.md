# Vouchy Discord Bot

A Discord bot that automatically tracks vouch points when users post images and mention providers in vouch channels.

## Features

- 🖼️ Detects when users post images with attachments
- 👤 Identifies mentions of users with "provider" role
- 📊 Tracks points automatically
- 🏆 Leaderboard and points checking commands
- ✅ Confirmation messages with embeds
- 🎰 Gambling system with roulette and blackjack
- 🎯 Interactive blackjack with reaction controls
- 💰 Balance tracking and betting limits

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create a Discord Application:**
   - Go to https://discord.com/developers/applications
   - Create "New Application"
   - Go to "Bot" section and create a bot
   - Copy the bot token

3. **Create .env file:**
   ```
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_bot_client_id_here
   ```

4. **Deploy slash commands:**
   ```bash
   node deploy-commands.js
   ```

5. **Start the bot:**
   ```bash
   npm start
   ```

## Configuration

Edit these constants in `index.js`:
- `VOUCH_CHANNEL_NAME`: Channel name to monitor (default: 'vouch')
- `PROVIDER_ROLE_NAME`: Role name for providers (default: 'provider')  
- `POINTS_PER_VOUCH`: Points awarded per vouch (default: 1)
- `GAMBLING_CHANNEL_NAME`: Channel name for gambling commands (default: 'gambling')
- `MIN_BET`: Minimum bet amount (default: 1)
- `MAX_BET`: Maximum bet amount (default: 100)

## Commands

### Slash Commands
- `/points [user]` - Check vouch points for yourself or another user
- `/leaderboard` - Show top 10 users by vouch points
- `/addpoints <user> <amount> [reason]` - Manually add/remove points (Admin only)
- `/roulette <amount> <bet> [number]` - Play roulette with your points
  - Bet options: Red (2x), Black (2x), Green (14x), Number 0-36 (35x)
  - Use `number` parameter when betting on specific numbers
- `/blackjack <amount>` - Play blackjack with your points
  - React with 🃏 to hit, ✋ to stand, ❌ to quit
- `/send <user> <amount> [message]` - Send points to another user

### Legacy Message Commands (in gambling channel)
- `!balance` - Check your current point balance
- `!roulette <amount> <bet>` - Play roulette
  - Bet options: `red`, `black`, `green`, or specific number (0-36)
  - Payouts: Red/Black (2x), Green (14x), Number (35x)
- `!blackjack <amount>` - Start a blackjack game
  - React with 🃏 to hit, ✋ to stand, ❌ to quit
  - Dealer stands on 17, standard blackjack rules

## How it works

1. Bot monitors channels with "vouch" in the name
2. When someone posts an image AND mentions a user with "provider" role
3. Bot adds points to the mentioned provider(s)
4. Sends confirmation message

## Examples

### Slash Commands
```
/points @user
/leaderboard
/roulette 10 red
/roulette 5 black  
/roulette 2 green
/roulette 1 number 17
/blackjack 15
/send @friend 50 "Thanks for the help!"
```

### Legacy Gambling Commands
```
!balance
!roulette 10 red
!roulette 5 black  
!roulette 2 green
!roulette 1 17
!blackjack 15
```

## Bot Permissions Required

- Read Messages/View Channels
- Send Messages  
- Use Slash Commands
- Embed Links
- Read Message History
- Add Reactions
- Use External Emojis 