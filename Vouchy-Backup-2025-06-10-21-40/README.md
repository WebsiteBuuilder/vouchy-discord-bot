# 🎯 Vouchy Discord Bot

A comprehensive Discord bot that automatically tracks vouch points when users post images and mention providers, with a full gambling casino system.

## ✨ Features

### 📊 **Points Tracking System**
- 🖼️ **Automatic Detection**: Detects when users post images with attachments
- 👤 **Provider Recognition**: Identifies mentions of users with "provider" role
- 💾 **Persistent Storage**: Points are saved to Railway's persistent volume (survives restarts & redeploys)
- 📈 **Real-time Updates**: Points are saved immediately after each vouch
- 🏆 **Leaderboard System**: Track top performers

### 🎰 **Casino & Gambling System**
- 🎲 **Roulette**: Bet on red/black/green or specific numbers (35x payout for numbers!)
- 🃏 **Blackjack**: Interactive card game with hit/stand/quit buttons
- 💰 **Balance Tracking**: Check your points anytime
- 🎯 **Interactive UI**: Beautiful confirmation dialogs and button controls
- 📊 **Bet Validation**: Prevents overbetting and shows potential payouts

### 🔧 **Admin Features**
- ➕ **Manual Points**: Add/remove points with reasons (Admin only)
- 💸 **Point Transfers**: Send points between users
- 📋 **Comprehensive Logging**: All actions are logged for transparency

## 🚀 **Quick Start**

### **For Users:**
1. **Earn Points**: Post images and tag providers in vouch channels
2. **Check Points**: Use `/points` to see your balance
3. **Gamble**: Use `/roulette` or `/blackjack` in casino channels
4. **Send Points**: Use `/send` to transfer points to friends

### **For Admins:**
1. **Manage Points**: Use `/addpoints` to manually adjust balances
2. **Monitor Activity**: Check `/leaderboard` for top users
3. **Configure**: Edit constants in `index.js` for your server setup

## 📱 **Commands**

### **💰 Points Commands**
```
/points [user]                    - Check vouch points for yourself or another user
/leaderboard                      - Show top 10 users by vouch points  
/addpoints <user> <amount> [reason] - Manually add/remove points (Admin only)
/send <user> <amount> [message]   - Send points to another user
```

### **🎰 Gambling Commands**
```
/roulette <amount> <bet> [number] - Play roulette with confirmation dialog
  • Red/Black: 2x payout
  • Green (0): 14x payout  
  • Specific Number: 35x payout
  
/blackjack <amount>               - Play blackjack with interactive buttons
  • Hit 🃏 / Stand ✋ / Quit ❌
  • Dealer stands on 17
  • Standard blackjack rules
```

### **🎮 Legacy Gambling (in casino channels)**
```
!balance                          - Check your current point balance
!roulette <amount> <bet>          - Quick roulette (red/black/green/number)
!blackjack <amount>               - Quick blackjack game
```

## ⚙️ **Configuration**

Edit these constants in `index.js`:

```javascript
const VOUCH_CHANNEL_NAME = 'vouch';      // Channel name to monitor
const PROVIDER_ROLE_NAME = 'provider';   // Role name for providers  
const POINTS_PER_VOUCH = 1;              // Points awarded per vouch
const MIN_BET = 1;                       // Minimum gambling bet
const MAX_BET = 100;                     // Maximum gambling bet
```

## 🛠️ **Setup & Deployment**

### **1. Environment Variables** 
Create `.env` file:
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
```

### **2. Install Dependencies**
```bash
npm install
```

### **3. Deploy Commands**
```bash
npm run deploy-commands
# or use Railway: railway run node deploy-commands.js
```

### **4. Start Bot**
```bash
npm start
# or deploy to Railway: railway up --detach
```

### **5. Clear Points (Start Fresh)**
```bash
npm run clear-points
```

## 🏗️ **Railway Deployment**

This bot is configured for Railway with:
- ✅ **Persistent Volume**: Points stored in `/app/data/points.json`
- ✅ **Auto-restart**: Restarts on failure with retry policy
- ✅ **Environment Variables**: All credentials managed securely
- ✅ **Zero-downtime Deployments**: Updates without losing data

### **Railway Commands:**
```bash
railway login                     # Login to Railway
railway link                      # Link project
railway up --detach              # Deploy changes
railway logs                     # View logs
railway variables                # Check environment variables
railway run node deploy-commands.js  # Deploy Discord commands
```

## 📊 **How Points Work**

### **Earning Points:**
1. Post an image in a channel with "vouch" in the name
2. Mention a user with the "provider" role in your message
3. Bot automatically adds 1 point to each mentioned provider
4. Get confirmation with a green embed

### **Spending Points:**
1. Gambling: Risk points for bigger rewards
2. Transfers: Send points to other users
3. Points persist forever (stored on Railway's persistent disk)

### **Point Storage:**
- **Location**: `/app/data/points.json` (Railway persistent volume)
- **Backup**: Automatically saved after every transaction
- **Recovery**: Survives bot restarts, redeploys, and server crashes

## 🎯 **Game Rules**

### **🎲 Roulette Payouts:**
- **Red/Black**: 2x your bet
- **Green (0)**: 14x your bet  
- **Specific Number**: 35x your bet

### **🃏 Blackjack Rules:**
- Standard blackjack rules
- Dealer stands on 17
- Blackjack pays 2:1
- Interactive buttons for all actions

## 🔒 **Permissions Required**

Bot needs these Discord permissions:
- Read Messages/View Channels
- Send Messages  
- Use Slash Commands
- Embed Links
- Read Message History
- Add Reactions (for legacy features)

## 🆘 **Troubleshooting**

### **Points Not Saving?**
```bash
railway logs  # Check for storage errors
```

### **Commands Not Working?**
```bash
railway run node deploy-commands.js  # Redeploy commands
```

### **Bot Offline?**
```bash
railway up --detach  # Redeploy bot
```

### **Start Fresh?**
```bash
npm run clear-points  # Clear all points locally
railway up --detach   # Deploy fresh to Railway
```

## 📈 **System Statistics**

- 💾 **Persistent Storage**: ✅ Railway Volume Mount
- 🔄 **Auto-Save**: ✅ After Every Transaction  
- 📊 **Real-time Tracking**: ✅ Instant Point Updates
- 🎮 **Interactive Gaming**: ✅ Button-based Controls
- 🛡️ **Error Handling**: ✅ Comprehensive Validation
- 📱 **Cross-Platform**: ✅ Works on All Discord Clients

---

**🎉 Your points tracking system is now complete and production-ready!**

The bot will automatically track all vouches and save points permanently to Railway's persistent storage. Enjoy your casino! 🎰 