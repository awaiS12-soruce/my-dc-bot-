# 🤖 Evict-Inspired Discord Bot

A comprehensive Discord bot inspired by Evict bot, featuring moderation, economy, levels, giveaways, and utility commands.

## ✨ Features

### 🛡️ Moderation
- **Kick/Ban** members with reasons
- **Warn** system with tracking
- **Mute** with automatic unmute
- **Purge** messages (up to 100)

### 💰 Economy System
- **Daily rewards** (100-500 coins)
- **Balance** checking
- **Gambling** system (45% win chance)
- Persistent user data storage

### 📈 Leveling System
- **XP gain** from messages (15-25 XP per message)
- **Level up** notifications
- Level calculation: `xp^(1/4)`

### 🎉 Giveaways
- **Timed giveaways** with automatic winner selection
- Support for multiple winners
- Reaction-based entry system

### 🤖 Auto-Replies
- **Custom triggers** and responses
- Server-specific auto-replies
- Easy management commands

### 🎮 Fun Commands
- **8-ball** predictions
- **Coin flip** game
- More fun features coming soon!

### ℹ️ Utility
- **User info** with stats
- **Server info** overview
- Beautiful embed responses

## 🚀 Quick Setup

1. **Run the setup script:**
   ```bash
   python setup.py
   ```

2. **Or manual setup:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Get your Discord bot token:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to "Bot" section
   - Copy the token
   - Enable "Message Content Intent"

4. **Set your token:**
   Create a `.env` file:
   ```
   DISCORD_TOKEN=your_bot_token_here
   ```

5. **Run the bot:**
   ```bash
   python main.py
   ```

## 🔗 Bot Permissions

When inviting your bot, make sure to grant these permissions:
- Send Messages
- Manage Messages
- Embed Links
- Read Message History
- Add Reactions
- Kick Members
- Ban Members
- Manage Roles
- Manage Channels

## 📋 Commands

### Moderation Commands
- `!kick <member> [reason]` - Kick a member
- `!ban <member> [reason]` - Ban a member
- `!warn <member> [reason]` - Warn a member
- `!mute <member> [duration] [reason]` - Mute a member (default: 10 minutes)
- `!purge <amount>` - Delete messages (max 100)

### Economy Commands
- `!balance [member]` - Check balance
- `!daily` - Claim daily reward (24h cooldown)
- `!gamble <amount>` - Gamble coins (45% win chance)

### Utility Commands
- `!userinfo [member]` - Show user information
- `!serverinfo` - Show server information
- `!help` - Show all commands

### Giveaway Commands
- `!gstart <duration> <winners> <prize>` - Start a giveaway
  - Duration examples: `1h`, `30m`, `2d`
  - Example: `!gstart 1h 2 Discord Nitro`

### Auto-Reply Commands
- `!addreply <trigger> <response>` - Add auto-reply
- `!removereply <trigger>` - Remove auto-reply

### Fun Commands
- `!8ball <question>` - Ask the magic 8-ball
- `!coinflip` - Flip a coin

## 🗄️ Database

The bot uses SQLite to store:
- User data (XP, levels, balance, warnings)
- Giveaway information
- Auto-reply triggers

Database file: `bot_data.db` (created automatically)

## ⚙️ Configuration

Edit `config.json` to customize:
- Bot prefix and description
- Feature toggles
- Economy settings
- Level system parameters
- Moderation defaults

## 🔧 Troubleshooting

**Bot not responding:**
- Check if the token is correct
- Ensure "Message Content Intent" is enabled
- Verify bot has necessary permissions

**Database errors:**
- Delete `bot_data.db` to reset (will lose all data)
- Check file permissions

**Permission errors:**
- Ensure bot role is above roles it needs to manage
- Check channel-specific permissions

## 📝 Notes

- Default prefix: `!`
- XP is gained from non-command messages
- Giveaways are checked every minute
- Mute role is created automatically if it doesn't exist
- All embeds use color coding for different message types

## 🎯 Inspired by Evict Bot

This bot is inspired by the popular Evict Discord bot, implementing similar features with a focus on:
- Clean, modern embed design
- Comprehensive moderation tools
- Engaging economy system
- User-friendly commands
- Reliable performance

## 🤝 Contributing

Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

---

**Enjoy your new Discord bot!** 🚀

For support or questions, check the bot's help command or refer to the Discord.py documentation.
