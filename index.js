const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const QRCode = require('qrcode');
const { evaluate } = require('mathjs');
const {
    handleTrivia,
    handleRockPaperScissors,
    handleDiceRoll,
    handleWeather,
    handleCalculator,
    handleQRCode,
    handleMeme,
    handleQuote,
    handlePoll,
    handleReminder,
    handleServerStats,
    handleAI
} = require('./features');
require('dotenv').config();

// Load configuration
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// Bot setup
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Database setup
const db = new sqlite3.Database('./bot_data.db');

function initDB() {
    // Users table for economy and levels
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            guild_id TEXT,
            balance INTEGER DEFAULT 0,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            warnings INTEGER DEFAULT 0,
            last_daily DATETIME,
            last_work DATETIME,
            job TEXT DEFAULT 'unemployed'
        )
    `);

    // Giveaways table
    db.run(`
        CREATE TABLE IF NOT EXISTS giveaways (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT,
            channel_id TEXT,
            message_id TEXT,
            prize TEXT,
            end_time DATETIME,
            winner_count INTEGER,
            host_id TEXT
        )
    `);

    // Auto-replies table
    db.run(`
        CREATE TABLE IF NOT EXISTS autoreplies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT,
            trigger TEXT,
            response TEXT
        )
    `);

    // Shop items table
    db.run(`
        CREATE TABLE IF NOT EXISTS shop_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            description TEXT,
            price INTEGER,
            emoji TEXT,
            role_id TEXT
        )
    `);

    // User inventory table
    db.run(`
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            guild_id TEXT,
            item_name TEXT,
            quantity INTEGER DEFAULT 1
        )
    `);

    // Trivia questions table
    db.run(`
        CREATE TABLE IF NOT EXISTS trivia_scores (
            user_id TEXT,
            guild_id TEXT,
            correct_answers INTEGER DEFAULT 0,
            total_questions INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, guild_id)
        )
    `);

    // Welcome/goodbye settings
    db.run(`
        CREATE TABLE IF NOT EXISTS welcome_settings (
            guild_id TEXT PRIMARY KEY,
            welcome_channel TEXT,
            welcome_message TEXT,
            goodbye_channel TEXT,
            goodbye_message TEXT
        )
    `);
}

// Helper functions
function getUserData(userId, guildId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE user_id = ? AND guild_id = ?', [userId, guildId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (!row) {
                db.run('INSERT INTO users (user_id, guild_id) VALUES (?, ?)', [userId, guildId], function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    db.get('SELECT * FROM users WHERE user_id = ? AND guild_id = ?', [userId, guildId], (err, newRow) => {
                        if (err) reject(err);
                        else resolve(newRow);
                    });
                });
            } else {
                resolve(row);
            }
        });
    });
}

function updateUserData(userId, guildId, updates) {
    return new Promise((resolve, reject) => {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        
        db.run(`UPDATE users SET ${setClause} WHERE user_id = ? AND guild_id = ?`, 
               [...values, userId, guildId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function calculateLevel(xp) {
    return Math.floor(Math.pow(xp, 1/4));
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to create error embeds
function createErrorEmbed(message) {
    return new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Error')
        .setDescription(message)
        .setTimestamp();
}

// Helper function to create success embeds
function createSuccessEmbed(title, message) {
    return new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`✅ ${title}`)
        .setDescription(message)
        .setTimestamp();
}

// Helper function to create info embeds
function createInfoEmbed(title, message, color = '#0099ff') {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(message)
        .setTimestamp();
}

// Events
client.once('ready', () => {
    console.log(`${client.user.tag} has landed! 🚀`);
    initDB();
    
    // Set bot status
    client.user.setActivity('!help | Evict-inspired Bot', { type: 'WATCHING' });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // XP system
    try {
        const userData = await getUserData(message.author.id, message.guild.id);
        const xpGain = getRandomInt(config.levels.xp_per_message_min, config.levels.xp_per_message_max);
        const newXp = userData.xp + xpGain;
        const newLevel = calculateLevel(newXp);
        
        await updateUserData(message.author.id, message.guild.id, { xp: newXp, level: newLevel });
        
        // Level up notification
        if (newLevel > userData.level) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎉 Level Up!')
                .setDescription(`${message.author} reached level **${newLevel}**!`)
                .setTimestamp();
            
            message.channel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error updating XP:', error);
    }
    
    // Auto-replies
    db.all('SELECT * FROM autoreplies WHERE guild_id = ?', [message.guild.id], (err, rows) => {
        if (err) return;
        
        for (const row of rows) {
            if (message.content.toLowerCase().includes(row.trigger.toLowerCase())) {
                message.channel.send(row.response);
                break;
            }
        }
    });
    
    // Command handling
    if (!message.content.startsWith(config.bot.prefix)) return;
    
    const args = message.content.slice(config.bot.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    // Commands
    switch (command) {
        case 'help':
            await handleHelp(message);
            break;
        case 'balance':
        case 'bal':
            await handleBalance(message);
            break;
        case 'daily':
            await handleDaily(message);
            break;
        case 'gamble':
            await handleGamble(message, args);
            break;
        case 'level':
        case 'rank':
            await handleLevel(message, args);
            break;
        case 'kick':
            await handleKick(message, args);
            break;
        case 'ban':
            await handleBan(message, args);
            break;
        case 'mute':
            await handleMute(message, args);
            break;
        case 'purge':
            await handlePurge(message, args);
            break;
        case 'warn':
            await handleWarn(message, args);
            break;
        case 'giveaway':
            await handleGiveaway(message, args);
            break;
        case 'autoreply':
            await handleAutoReply(message, args);
            break;
        case 'ping':
            await handlePing(message);
            break;
        case '8ball':
            await handle8Ball(message, args);
            break;
        case 'coinflip':
            await handleCoinFlip(message);
            break;
        case 'work':
            await handleWork(message);
            break;
        case 'shop':
            await handleShop(message, args);
            break;
        case 'buy':
            await handleBuy(message, args);
            break;
        case 'inventory':
        case 'inv':
            await handleInventory(message);
            break;
        case 'pay':
            await handlePay(message, args);
            break;
        case 'leaderboard':
        case 'lb':
            await handleLeaderboard(message, args);
            break;
        case 'trivia':
            await handleTrivia(message);
            break;
        case 'rps':
            await handleRockPaperScissors(message, args);
            break;
        case 'roll':
            await handleDiceRoll(message, args);
            break;
        case 'weather':
            await handleWeather(message, args);
            break;
        case 'calc':
        case 'calculate':
            await handleCalculator(message, args);
            break;
        case 'qr':
            await handleQRCode(message, args);
            break;
        case 'meme':
            await handleMeme(message);
            break;
        case 'quote':
            await handleQuote(message);
            break;
        case 'poll':
            await handlePoll(message, args);
            break;
        case 'reminder':
            await handleReminder(message, args);
            break;
        case 'serverstats':
            await handleServerStats(message);
            break;
        case 'ai':
        case 'ask':
            await handleAI(message, args);
            break;
    }
});

// Command handlers
async function handleHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🤖 Evict-inspired Bot Commands')
        .setDescription('Here are all available commands:')
        .addFields(
            { 
                name: '💰 Economy', 
                value: '`!balance` - Check your balance\n`!daily` - Claim daily reward\n`!work` - Work to earn coins\n`!gamble <amount>` - Gamble your coins\n`!shop` - View shop items\n`!buy <item>` - Purchase items\n`!inventory` - View your items\n`!pay @user <amount>` - Send coins', 
                inline: true 
            },
            { 
                name: '📊 Levels & Leaderboards', 
                value: '`!level [@user]` - Check level/XP\n`!rank [@user]` - Same as level\n`!leaderboard balance` - Top richest\n`!leaderboard level` - Top levels', 
                inline: true 
            },
            { 
                name: '🛡️ Moderation', 
                value: '`!kick <@user> [reason]` - Kick a user\n`!ban <@user> [reason]` - Ban a user\n`!mute <@user> [minutes]` - Mute a user\n`!purge <amount>` - Delete messages\n`!warn <@user> [reason]` - Warn a user', 
                inline: true 
            },
            { 
                name: '🎮 Fun & Games', 
                value: '`!trivia` - Interactive trivia\n`!rps <rock|paper|scissors>` - Rock Paper Scissors\n`!roll [sides] [count]` - Roll dice\n`!8ball <question>` - Magic 8-ball\n`!coinflip` - Flip a coin\n`!meme` - Random memes\n`!quote` - Random quotes', 
                inline: true 
            },
            { 
                name: '🛠️ Utility', 
                value: '`!weather <city>` - Weather info\n`!calc <expression>` - Calculator\n`!qr <text>` - Generate QR code\n`!reminder <time> <message>` - Set reminder\n`!ping` - Check bot latency', 
                inline: true 
            },
            { 
                name: '🤖 AI & Server', 
                value: '`!ai <question>` - Ask AI anything\n`!ask <question>` - Same as !ai\n`!poll <question> <option1> <option2>` - Create polls\n`!serverstats` - Server statistics\n`!giveaway <time> <prize>` - Start giveaway\n`!autoreply add/list/remove` - Manage auto-replies', 
                inline: true 
            }
        )
        .setFooter({ text: `Prefix: ${config.bot.prefix} | Total Commands: 40+` })
        .setTimestamp();
    
    message.channel.send({ embeds: [embed] });
}

async function handleBalance(message) {
    try {
        const userData = await getUserData(message.author.id, message.guild.id);
        const embed = new EmbedBuilder()
            .setColor('#ffff00')
            .setTitle('💰 Balance')
            .setDescription(`${message.author} has **${userData.balance}** coins!`)
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    } catch (error) {
        const embed = createErrorEmbed('Error fetching balance data.');
        message.channel.send({ embeds: [embed] });
    }
}

async function handleDaily(message) {
    try {
        const userData = await getUserData(message.author.id, message.guild.id);
        const now = new Date();
        const lastDaily = userData.last_daily ? new Date(userData.last_daily) : null;
        
        if (lastDaily && (now - lastDaily) < 24 * 60 * 60 * 1000) {
            const timeLeft = 24 * 60 * 60 * 1000 - (now - lastDaily);
            const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            
            const embed = createInfoEmbed('⏰ Daily Reward', `You already claimed your daily reward! Try again in ${hoursLeft}h ${minutesLeft}m.`);
            message.channel.send({ embeds: [embed] });
            return;
        }
        
        const reward = getRandomInt(config.economy.daily_reward_min, config.economy.daily_reward_max);
        await updateUserData(message.author.id, message.guild.id, {
            balance: userData.balance + reward,
            last_daily: now.toISOString()
        });
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎁 Daily Reward')
            .setDescription(`${message.author} claimed **${reward}** coins!\nNew balance: **${userData.balance + reward}** coins`)
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    } catch (error) {
        const embed = createErrorEmbed('Error processing daily reward.');
        message.channel.send({ embeds: [embed] });
    }
}

async function handleGamble(message, args) {
    if (!args[0]) {
        const embed = createErrorEmbed('Please specify an amount to gamble!');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
        const embed = createErrorEmbed('Please enter a valid positive number!');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    try {
        const userData = await getUserData(message.author.id, message.guild.id);
        
        if (userData.balance < amount) {
            const embed = createErrorEmbed('You don\'t have enough coins!');
            message.channel.send({ embeds: [embed] });
            return;
        }
        
        const won = Math.random() < config.economy.gamble_win_chance;
        const newBalance = won ? userData.balance + amount : userData.balance - amount;
        
        await updateUserData(message.author.id, message.guild.id, { balance: newBalance });
        
        const embed = new EmbedBuilder()
            .setColor(won ? '#00ff00' : '#ff0000')
            .setTitle(won ? '🎉 You Won!' : '💸 You Lost!')
            .setDescription(`${message.author} ${won ? 'won' : 'lost'} **${amount}** coins!\nNew balance: **${newBalance}** coins`)
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    } catch (error) {
        const embed = createErrorEmbed('Error processing gamble.');
        message.channel.send({ embeds: [embed] });
    }
}

async function handleLevel(message, args) {
    const target = message.mentions.users.first() || message.author;
    
    try {
        const userData = await getUserData(target.id, message.guild.id);
        const embed = new EmbedBuilder()
            .setColor('#9932cc')
            .setTitle('📊 Level & XP')
            .setDescription(`${target} is level **${userData.level}** with **${userData.xp}** XP!`)
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    } catch (error) {
        const embed = createErrorEmbed('Error fetching level data.');
        message.channel.send({ embeds: [embed] });
    }
}

async function handlePing(message) {
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🏓 Pong!')
        .setDescription(`Latency: **${client.ws.ping}ms**`)
        .setTimestamp();
    
    message.channel.send({ embeds: [embed] });
}

async function handle8Ball(message, args) {
    if (!args.length) {
        const embed = createErrorEmbed('Please ask a question!');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const responses = [
        'Yes', 'No', 'Maybe', 'Definitely', 'Absolutely not',
        'Ask again later', 'I don\'t think so', 'Probably',
        'Without a doubt', 'Very doubtful', 'Most likely',
        'Cannot predict now', 'Yes definitely', 'Reply hazy, try again'
    ];
    
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    const embed = new EmbedBuilder()
        .setColor('#800080')
        .setTitle('🎱 Magic 8-Ball')
        .setDescription(`**Question:** ${args.join(' ')}\n**Answer:** ${response}`)
        .setTimestamp();
    
    message.channel.send({ embeds: [embed] });
}

async function handleCoinFlip(message) {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    
    const embed = new EmbedBuilder()
        .setColor('#ffd700')
        .setTitle('🪙 Coin Flip')
        .setDescription(`The coin landed on **${result}**!`)
        .setTimestamp();
    
    message.channel.send({ embeds: [embed] });
}

// Moderation commands (basic implementations)
async function handleKick(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        const embed = createErrorEmbed('You don\'t have permission to kick members!');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const target = message.mentions.members.first();
    if (!target) {
        const embed = createErrorEmbed('Please mention a user to kick!');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const reason = args.slice(1).join(' ') || 'No reason provided';
    
    try {
        await target.kick(reason);
        const embed = createSuccessEmbed('Member Kicked', `${target.user.tag} has been kicked.\n**Reason:** ${reason}`);
        message.channel.send({ embeds: [embed] });
    } catch (error) {
        const embed = createErrorEmbed('Failed to kick the user.');
        message.channel.send({ embeds: [embed] });
    }
}

async function handleBan(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        const embed = createErrorEmbed('You don\'t have permission to ban members!');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const target = message.mentions.members.first();
    if (!target) {
        const embed = createErrorEmbed('Please mention a user to ban!');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const reason = args.slice(1).join(' ') || 'No reason provided';
    
    try {
        await target.ban({ reason });
        const embed = createSuccessEmbed('Member Banned', `${target.user.tag} has been banned.\n**Reason:** ${reason}`);
        message.channel.send({ embeds: [embed] });
    } catch (error) {
        const embed = createErrorEmbed('Failed to ban the user.');
        message.channel.send({ embeds: [embed] });
    }
}

async function handlePurge(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        const embed = createErrorEmbed('You don\'t have permission to manage messages!');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0 || amount > config.moderation.max_purge_amount) {
        const embed = createErrorEmbed(`Please enter a valid number between 1 and ${config.moderation.max_purge_amount}!`);
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    try {
        await message.channel.bulkDelete(amount + 1);
        const embed = createSuccessEmbed('Messages Purged', `Deleted ${amount} messages.`);
        const reply = await message.channel.send({ embeds: [embed] });
        setTimeout(() => reply.delete(), 5000);
    } catch (error) {
        const embed = createErrorEmbed('Failed to delete messages.');
        message.channel.send({ embeds: [embed] });
    }
}

async function handleWarn(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        const embed = createErrorEmbed('You don\'t have permission to warn members!');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const target = message.mentions.users.first();
    if (!target) {
        const embed = createErrorEmbed('Please mention a user to warn!');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const reason = args.slice(1).join(' ') || 'No reason provided';
    
    try {
        const userData = await getUserData(target.id, message.guild.id);
        await updateUserData(target.id, message.guild.id, { warnings: userData.warnings + 1 });
        
        const embed = new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('⚠️ Member Warned')
            .setDescription(`${target.tag} has been warned.\n**Reason:** ${reason}\n**Total warnings:** ${userData.warnings + 1}`)
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    } catch (error) {
        const embed = createErrorEmbed('Failed to warn the user.');
        message.channel.send({ embeds: [embed] });
    }
}

// Auto-reply command
async function handleAutoReply(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        const embed = createErrorEmbed('You don\'t have permission to manage auto-replies!');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const subcommand = args[0];
    
    if (subcommand === 'add') {
        if (args.length < 3) {
            const embed = createErrorEmbed('Usage: `!autoreply add <trigger> <response>`');
            message.channel.send({ embeds: [embed] });
            return;
        }
        
        const trigger = args[1];
        const response = args.slice(2).join(' ');
        
        db.run('INSERT INTO autoreplies (guild_id, trigger, response) VALUES (?, ?, ?)', 
               [message.guild.id, trigger, response], function(err) {
            if (err) {
                const embed = createErrorEmbed('Failed to add auto-reply.');
                message.channel.send({ embeds: [embed] });
            } else {
                const embed = createSuccessEmbed('Auto-Reply Added', `Trigger: "${trigger}"`);
                message.channel.send({ embeds: [embed] });
            }
        });
    } else if (subcommand === 'list') {
        db.all('SELECT * FROM autoreplies WHERE guild_id = ?', [message.guild.id], (err, rows) => {
            if (err || !rows.length) {
                const embed = createInfoEmbed('📝 Auto-Replies', 'No auto-replies found.');
                message.channel.send({ embeds: [embed] });
                return;
            }
            
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📝 Auto-Replies')
                .setDescription(rows.map(row => `**ID ${row.id}:** "${row.trigger}" → "${row.response}"`).join('\n'))
                .setTimestamp();
            
            message.channel.send({ embeds: [embed] });
        });
    } else if (subcommand === 'remove') {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
            const embed = createErrorEmbed('Please provide a valid auto-reply ID!');
            message.channel.send({ embeds: [embed] });
            return;
        }
        
        db.run('DELETE FROM autoreplies WHERE id = ? AND guild_id = ?', [id, message.guild.id], function(err) {
            if (err || this.changes === 0) {
                const embed = createErrorEmbed('Auto-reply not found or failed to remove.');
                message.channel.send({ embeds: [embed] });
            } else {
                const embed = createSuccessEmbed('Auto-Reply Removed', 'Auto-reply successfully deleted!');
                message.channel.send({ embeds: [embed] });
            }
        });
    } else {
        const embed = createErrorEmbed('Usage: `!autoreply <add|list|remove>`');
        message.channel.send({ embeds: [embed] });
    }
}

// Giveaway command (basic implementation)
async function handleGiveaway(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        const embed = createErrorEmbed('You don\'t have permission to create giveaways!');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    if (args.length < 2) {
        const embed = createErrorEmbed('Usage: `!giveaway <time> <prize>`');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const time = args[0];
    const prize = args.slice(1).join(' ');
    
    // Simple time parsing (e.g., "1h", "30m", "1d")
    let duration = 0;
    const timeMatch = time.match(/^(\d+)([hmd])$/);
    if (timeMatch) {
        const value = parseInt(timeMatch[1]);
        const unit = timeMatch[2];
        
        switch (unit) {
            case 'm': duration = value * 60 * 1000; break;
            case 'h': duration = value * 60 * 60 * 1000; break;
            case 'd': duration = value * 24 * 60 * 60 * 1000; break;
        }
    }
    
    if (duration === 0) {
        const embed = createErrorEmbed('Invalid time format! Use format like: 1h, 30m, 1d');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const embed = new EmbedBuilder()
        .setColor('#ff69b4')
        .setTitle('🎉 GIVEAWAY!')
        .setDescription(`**Prize:** ${prize}\n**Duration:** ${time}\n**Hosted by:** ${message.author}\n\nReact with 🎉 to enter!`)
        .setTimestamp(new Date(Date.now() + duration));
    
    const giveawayMessage = await message.channel.send({ embeds: [embed] });
    await giveawayMessage.react('🎉');
    
    // Store giveaway in database
    const endTime = new Date(Date.now() + duration);
    db.run('INSERT INTO giveaways (guild_id, channel_id, message_id, prize, end_time, winner_count, host_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
           [message.guild.id, message.channel.id, giveawayMessage.id, prize, endTime.toISOString(), 1, message.author.id]);
    
    // Set timeout for giveaway end
    setTimeout(async () => {
        try {
            const fetchedMessage = await message.channel.messages.fetch(giveawayMessage.id);
            const reaction = fetchedMessage.reactions.cache.get('🎉');
            
            if (!reaction) {
                const embed = createInfoEmbed('🎉 Giveaway Ended', 'No valid entries for the giveaway.', '#ff6600');
                message.channel.send({ embeds: [embed] });
                return;
            }
            
            const users = await reaction.users.fetch();
            const validUsers = users.filter(user => !user.bot);
            
            if (validUsers.size === 0) {
                const embed = createInfoEmbed('🎉 Giveaway Ended', 'No valid entries for the giveaway.', '#ff6600');
                message.channel.send({ embeds: [embed] });
                return;
            }
            
            const winner = validUsers.random();
            const winnerEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎉 Giveaway Winner!')
                .setDescription(`**Prize:** ${prize}\n**Winner:** ${winner}\n\nCongratulations!`)
                .setTimestamp();
            
            message.channel.send({ embeds: [winnerEmbed] });
        } catch (error) {
            console.error('Error ending giveaway:', error);
        }
    }, duration);
}

// Enhanced Economy Commands
async function handleWork(message) {
    try {
        const userData = await getUserData(message.author.id, message.guild.id);
        const now = new Date();
        const lastWork = userData.last_work ? new Date(userData.last_work) : null;
        
        if (lastWork && (now - lastWork) < 60 * 60 * 1000) { // 1 hour cooldown
            const timeLeft = 60 * 60 * 1000 - (now - lastWork);
            const minutesLeft = Math.floor(timeLeft / (60 * 1000));
            
            const embed = createInfoEmbed('⏰ Work Cooldown', `You need to wait ${minutesLeft} minutes before working again!`);
            message.channel.send({ embeds: [embed] });
            return;
        }
        
        const jobs = [
            { name: 'programmer', min: 200, max: 500 },
            { name: 'designer', min: 150, max: 400 },
            { name: 'teacher', min: 100, max: 300 },
            { name: 'chef', min: 120, max: 350 },
            { name: 'driver', min: 80, max: 250 }
        ];
        
        const job = jobs[Math.floor(Math.random() * jobs.length)];
        const earnings = getRandomInt(job.min, job.max);
        
        await updateUserData(message.author.id, message.guild.id, {
            balance: userData.balance + earnings,
            last_work: now.toISOString(),
            job: job.name
        });
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('💼 Work Complete!')
            .setDescription(`${message.author} worked as a **${job.name}** and earned **${earnings}** coins!\nNew balance: **${userData.balance + earnings}** coins`)
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    } catch (error) {
        const embed = createErrorEmbed('Error processing work command.');
        message.channel.send({ embeds: [embed] });
    }
}

async function handleShop(message, args) {
    if (args[0] === 'add' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        if (args.length < 4) {
            const embed = createErrorEmbed('Usage: `!shop add <name> <price> <description>`');
            message.channel.send({ embeds: [embed] });
            return;
        }
        
        const name = args[1];
        const price = parseInt(args[2]);
        const description = args.slice(3).join(' ');
        
        if (isNaN(price) || price <= 0) {
            const embed = createErrorEmbed('Price must be a positive number!');
            message.channel.send({ embeds: [embed] });
            return;
        }
        
        db.run('INSERT INTO shop_items (name, price, description, emoji) VALUES (?, ?, ?, ?)',
               [name, price, description, '🛍️'], function(err) {
            if (err) {
                const embed = createErrorEmbed('Failed to add item to shop.');
                message.channel.send({ embeds: [embed] });
            } else {
                const embed = createSuccessEmbed('Item Added', `${name} has been added to the shop for ${price} coins!`);
                message.channel.send({ embeds: [embed] });
            }
        });
    } else {
        db.all('SELECT * FROM shop_items', (err, rows) => {
            if (err || !rows.length) {
                const embed = createInfoEmbed('🛍️ Shop', 'The shop is currently empty.');
                message.channel.send({ embeds: [embed] });
                return;
            }
            
            const embed = new EmbedBuilder()
                .setColor('#9932cc')
                .setTitle('🛍️ Shop')
                .setDescription('Use `!buy <item_name>` to purchase items!')
                .setTimestamp();
            
            rows.forEach(item => {
                embed.addFields({
                    name: `${item.emoji} ${item.name}`,
                    value: `**Price:** ${item.price} coins\n**Description:** ${item.description}`,
                    inline: true
                });
            });
            
            message.channel.send({ embeds: [embed] });
        });
    }
}

async function handleBuy(message, args) {
    if (!args[0]) {
        const embed = createErrorEmbed('Please specify an item to buy! Use `!shop` to see available items.');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const itemName = args.join(' ').toLowerCase();
    
    db.get('SELECT * FROM shop_items WHERE LOWER(name) = ?', [itemName], async (err, item) => {
        if (err || !item) {
            const embed = createErrorEmbed('Item not found in shop!');
            message.channel.send({ embeds: [embed] });
            return;
        }
        
        try {
            const userData = await getUserData(message.author.id, message.guild.id);
            
            if (userData.balance < item.price) {
                const embed = createErrorEmbed(`You need ${item.price - userData.balance} more coins to buy this item!`);
                message.channel.send({ embeds: [embed] });
                return;
            }
            
            // Update balance
            await updateUserData(message.author.id, message.guild.id, {
                balance: userData.balance - item.price
            });
            
            // Add to inventory
            db.run('INSERT OR REPLACE INTO inventory (user_id, guild_id, item_name, quantity) VALUES (?, ?, ?, COALESCE((SELECT quantity FROM inventory WHERE user_id = ? AND guild_id = ? AND item_name = ?), 0) + 1)',
                   [message.author.id, message.guild.id, item.name, message.author.id, message.guild.id, item.name]);
            
            const embed = createSuccessEmbed('Purchase Complete!', `You bought **${item.name}** for **${item.price}** coins!\nRemaining balance: **${userData.balance - item.price}** coins`);
            message.channel.send({ embeds: [embed] });
        } catch (error) {
            const embed = createErrorEmbed('Error processing purchase.');
            message.channel.send({ embeds: [embed] });
        }
    });
}

async function handleInventory(message) {
    db.all('SELECT * FROM inventory WHERE user_id = ? AND guild_id = ?', [message.author.id, message.guild.id], (err, rows) => {
        if (err || !rows.length) {
            const embed = createInfoEmbed('🎒 Inventory', 'Your inventory is empty.');
            message.channel.send({ embeds: [embed] });
            return;
        }
        
        const embed = new EmbedBuilder()
            .setColor('#9932cc')
            .setTitle('🎒 Your Inventory')
            .setTimestamp();
        
        rows.forEach(item => {
            embed.addFields({
                name: item.item_name,
                value: `Quantity: ${item.quantity}`,
                inline: true
            });
        });
        
        message.channel.send({ embeds: [embed] });
    });
}

async function handlePay(message, args) {
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    
    if (!target || isNaN(amount) || amount <= 0) {
        const embed = createErrorEmbed('Usage: `!pay @user <amount>`');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    if (target.id === message.author.id) {
        const embed = createErrorEmbed('You cannot pay yourself!');
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    try {
        const senderData = await getUserData(message.author.id, message.guild.id);
        const receiverData = await getUserData(target.id, message.guild.id);
        
        if (senderData.balance < amount) {
            const embed = createErrorEmbed('You don\'t have enough coins!');
            message.channel.send({ embeds: [embed] });
            return;
        }
        
        await updateUserData(message.author.id, message.guild.id, {
            balance: senderData.balance - amount
        });
        
        await updateUserData(target.id, message.guild.id, {
            balance: receiverData.balance + amount
        });
        
        const embed = createSuccessEmbed('Payment Sent!', `${message.author} sent **${amount}** coins to ${target}!`);
        message.channel.send({ embeds: [embed] });
    } catch (error) {
        const embed = createErrorEmbed('Error processing payment.');
        message.channel.send({ embeds: [embed] });
    }
}

async function handleLeaderboard(message, args) {
    const type = args[0] || 'balance';
    
    if (type === 'balance' || type === 'coins') {
        db.all('SELECT * FROM users WHERE guild_id = ? ORDER BY balance DESC LIMIT 10', [message.guild.id], (err, rows) => {
            if (err || !rows.length) {
                const embed = createInfoEmbed('📊 Leaderboard', 'No data available.');
                message.channel.send({ embeds: [embed] });
                return;
            }
            
            const embed = new EmbedBuilder()
                .setColor('#ffd700')
                .setTitle('💰 Balance Leaderboard')
                .setTimestamp();
            
            let description = '';
            rows.forEach((user, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                description += `${medal} <@${user.user_id}> - **${user.balance}** coins\n`;
            });
            
            embed.setDescription(description);
            message.channel.send({ embeds: [embed] });
        });
    } else if (type === 'level' || type === 'xp') {
        db.all('SELECT * FROM users WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10', [message.guild.id], (err, rows) => {
            if (err || !rows.length) {
                const embed = createInfoEmbed('📊 Leaderboard', 'No data available.');
                message.channel.send({ embeds: [embed] });
                return;
            }
            
            const embed = new EmbedBuilder()
                .setColor('#9932cc')
                .setTitle('📊 Level Leaderboard')
                .setTimestamp();
            
            let description = '';
            rows.forEach((user, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                description += `${medal} <@${user.user_id}> - Level **${user.level}** (${user.xp} XP)\n`;
            });
            
            embed.setDescription(description);
            message.channel.send({ embeds: [embed] });
        });
    }
}

// Login
client.login(process.env.DISCORD_TOKEN);
