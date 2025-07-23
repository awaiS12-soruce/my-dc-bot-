const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const QRCode = require('qrcode');
const { evaluate } = require('mathjs');

// Fun Games and Entertainment Features

async function handleTrivia(message) {
    try {
        const response = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple');
        const question = response.data.results[0];
        
        const answers = [...question.incorrect_answers, question.correct_answer].sort(() => Math.random() - 0.5);
        const correctIndex = answers.indexOf(question.correct_answer);
        
        const embed = new EmbedBuilder()
            .setColor('#ff6600')
            .setTitle('🧠 Trivia Question')
            .setDescription(`**Category:** ${question.category}\n**Difficulty:** ${question.difficulty}\n\n**Question:** ${question.question}`)
            .addFields(
                { name: 'A', value: answers[0], inline: true },
                { name: 'B', value: answers[1], inline: true },
                { name: 'C', value: answers[2], inline: true },
                { name: 'D', value: answers[3], inline: true }
            )
            .setFooter({ text: 'React with 🇦 🇧 🇨 🇩 to answer!' })
            .setTimestamp();
        
        const triviaMessage = await message.channel.send({ embeds: [embed] });
        await triviaMessage.react('🇦');
        await triviaMessage.react('🇧');
        await triviaMessage.react('🇨');
        await triviaMessage.react('🇩');
        
        const filter = (reaction, user) => {
            return ['🇦', '🇧', '🇨', '🇩'].includes(reaction.emoji.name) && user.id === message.author.id;
        };
        
        triviaMessage.awaitReactions({ filter, max: 1, time: 30000, errors: ['time'] })
            .then(collected => {
                const reaction = collected.first();
                const answerIndex = ['🇦', '🇧', '🇨', '🇩'].indexOf(reaction.emoji.name);
                
                const resultEmbed = new EmbedBuilder()
                    .setTimestamp();
                
                if (answerIndex === correctIndex) {
                    resultEmbed
                        .setColor('#00ff00')
                        .setTitle('✅ Correct!')
                        .setDescription(`Great job ${message.author}! The answer was **${question.correct_answer}**`);
                } else {
                    resultEmbed
                        .setColor('#ff0000')
                        .setTitle('❌ Wrong!')
                        .setDescription(`Sorry ${message.author}, the correct answer was **${question.correct_answer}**`);
                }
                
                message.channel.send({ embeds: [resultEmbed] });
            })
            .catch(() => {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('⏰ Time\'s Up!')
                    .setDescription(`The correct answer was **${question.correct_answer}**`)
                    .setTimestamp();
                
                message.channel.send({ embeds: [timeoutEmbed] });
            });
            
    } catch (error) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Error')
            .setDescription('Failed to fetch trivia question. Please try again later.')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    }
}

async function handleRockPaperScissors(message, args) {
    const choices = ['rock', 'paper', 'scissors'];
    const userChoice = args[0]?.toLowerCase();
    
    if (!userChoice || !choices.includes(userChoice)) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Invalid Choice')
            .setDescription('Usage: `!rps <rock|paper|scissors>`')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const botChoice = choices[Math.floor(Math.random() * choices.length)];
    
    let result;
    let color;
    
    if (userChoice === botChoice) {
        result = "It's a tie!";
        color = '#ffaa00';
    } else if (
        (userChoice === 'rock' && botChoice === 'scissors') ||
        (userChoice === 'paper' && botChoice === 'rock') ||
        (userChoice === 'scissors' && botChoice === 'paper')
    ) {
        result = 'You win!';
        color = '#00ff00';
    } else {
        result = 'You lose!';
        color = '#ff0000';
    }
    
    const emojis = {
        rock: '🗿',
        paper: '📄',
        scissors: '✂️'
    };
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🎮 Rock Paper Scissors')
        .setDescription(`You chose: ${emojis[userChoice]} **${userChoice}**\nI chose: ${emojis[botChoice]} **${botChoice}**\n\n**${result}**`)
        .setTimestamp();
    
    message.channel.send({ embeds: [embed] });
}

async function handleDiceRoll(message, args) {
    const sides = parseInt(args[0]) || 6;
    const count = parseInt(args[1]) || 1;
    
    if (sides < 2 || sides > 100) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Invalid Dice')
            .setDescription('Dice must have between 2 and 100 sides!')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    if (count < 1 || count > 10) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Invalid Count')
            .setDescription('You can roll between 1 and 10 dice!')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const rolls = [];
    let total = 0;
    
    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll);
        total += roll;
    }
    
    const embed = new EmbedBuilder()
        .setColor('#9932cc')
        .setTitle('🎲 Dice Roll')
        .setDescription(`Rolling ${count}d${sides}...\n\n**Results:** ${rolls.join(', ')}\n**Total:** ${total}`)
        .setTimestamp();
    
    message.channel.send({ embeds: [embed] });
}

// Utility Features

async function handleWeather(message, args) {
    if (!args.length) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Missing Location')
            .setDescription('Usage: `!weather <city>`')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const city = args.join(' ');
    
    try {
        const apiKey = process.env.WEATHER_API_KEY;
        if (!apiKey) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ API Key Missing')
                .setDescription('Weather API key not configured. Please add WEATHER_API_KEY to your .env file.')
                .setTimestamp();
            
            message.channel.send({ embeds: [embed] });
            return;
        }
        
        console.log(`Fetching weather for: ${city}`);
        console.log(`API Key: ${apiKey.substring(0, 8)}...`);
        
        // Try different weather APIs to find which one works with this key
        
        // 1. Try WeatherAPI.com
        try {
            console.log('Trying WeatherAPI.com...');
            const response = await axios.get(`https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city)}&aqi=no`);
            const data = response.data;
            
            console.log('WeatherAPI.com success!');
            
            const embed = new EmbedBuilder()
                .setColor('#00aaff')
                .setTitle(`🌤️ Weather in ${data.location.name}, ${data.location.country}`)
                .setDescription(`**${data.current.condition.text}**`)
                .addFields(
                    { name: '🌡️ Temperature', value: `${Math.round(data.current.temp_c)}°C`, inline: true },
                    { name: '🤔 Feels Like', value: `${Math.round(data.current.feelslike_c)}°C`, inline: true },
                    { name: '💧 Humidity', value: `${data.current.humidity}%`, inline: true },
                    { name: '💨 Wind Speed', value: `${data.current.wind_kph} km/h`, inline: true },
                    { name: '👁️ Visibility', value: `${data.current.vis_km} km`, inline: true },
                    { name: '🔽 Pressure', value: `${data.current.pressure_mb} mb`, inline: true }
                )
                .setThumbnail(`https:${data.current.condition.icon}`)
                .setFooter({ text: 'Powered by WeatherAPI.com' })
                .setTimestamp();
            
            message.channel.send({ embeds: [embed] });
            return;
            
        } catch (weatherApiError) {
            console.log('WeatherAPI.com error:', weatherApiError.response?.status, weatherApiError.response?.data?.error?.message);
        }
        
        // 2. Try OpenWeatherMap
        try {
            console.log('Trying OpenWeatherMap...');
            const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`);
            const weather = response.data;
            
            console.log('OpenWeatherMap success!');
            
            const embed = new EmbedBuilder()
                .setColor('#00aaff')
                .setTitle(`🌤️ Weather in ${weather.name}, ${weather.sys.country}`)
                .setDescription(`**${weather.weather[0].description.charAt(0).toUpperCase() + weather.weather[0].description.slice(1)}**`)
                .addFields(
                    { name: '🌡️ Temperature', value: `${Math.round(weather.main.temp)}°C`, inline: true },
                    { name: '🤔 Feels Like', value: `${Math.round(weather.main.feels_like)}°C`, inline: true },
                    { name: '💧 Humidity', value: `${weather.main.humidity}%`, inline: true },
                    { name: '💨 Wind Speed', value: `${weather.wind?.speed || 'N/A'} m/s`, inline: true },
                    { name: '👁️ Visibility', value: `${weather.visibility ? (weather.visibility / 1000).toFixed(1) : 'N/A'} km`, inline: true },
                    { name: '🔽 Pressure', value: `${weather.main.pressure} hPa`, inline: true }
                )
                .setThumbnail(`https://openweathermap.org/img/w/${weather.weather[0].icon}.png`)
                .setFooter({ text: 'Powered by OpenWeatherMap' })
                .setTimestamp();
            
            message.channel.send({ embeds: [embed] });
            return;
            
        } catch (openWeatherError) {
            console.log('OpenWeatherMap error:', openWeatherError.response?.status, openWeatherError.response?.data?.message);
        }
        
        // 3. Try AccuWeather (alternative format)
        try {
            console.log('Trying AccuWeather format...');
            // AccuWeather uses different endpoint structure, but let's try a basic format
            const response = await axios.get(`http://dataservice.accuweather.com/currentconditions/v1/locationkey?apikey=${apiKey}`);
            console.log('AccuWeather might work but needs location key');
        } catch (accuError) {
            console.log('AccuWeather error:', accuError.response?.status);
        }
        
        // If all APIs fail, show detailed error
        throw new Error('All weather APIs failed');
        
    } catch (error) {
        console.error('All Weather APIs failed. Full error:', error);
        
        let errorMessage = 'Could not fetch weather data from any weather service.';
        let helpText = '';
        
        if (error.message === 'All weather APIs failed') {
            errorMessage = 'Your API key doesn\'t seem to work with WeatherAPI.com or OpenWeatherMap.';
            helpText = 'Please verify your API key is from one of these services:\n• [WeatherAPI.com](https://www.weatherapi.com/) (Free tier: 1M calls/month)\n• [OpenWeatherMap.org](https://openweathermap.org/api) (Free tier: 1K calls/day)';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Network error. Please check your internet connection.';
        }
        
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Weather Error')
            .setDescription(errorMessage)
            .addFields(
                { name: '🔍 Debug Info', value: `City: ${city}\nAPI Key: ${process.env.WEATHER_API_KEY?.substring(0, 8)}...` },
                { name: '💡 Get a Working API Key', value: helpText || 'Check the console for detailed error messages.' }
            )
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    }
}

async function handleCalculator(message, args) {
    if (!args.length) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Missing Expression')
            .setDescription('Usage: `!calc <mathematical expression>`\nExample: `!calc 2 + 2 * 3`')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const expression = args.join(' ');
    
    try {
        const result = evaluate(expression);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🧮 Calculator')
            .addFields(
                { name: 'Expression', value: `\`${expression}\``, inline: false },
                { name: 'Result', value: `\`${result}\``, inline: false }
            )
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Invalid Expression')
            .setDescription('Please provide a valid mathematical expression.')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    }
}

async function handleQRCode(message, args) {
    if (!args.length) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Missing Text')
            .setDescription('Usage: `!qr <text or URL>`')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const text = args.join(' ');
    
    try {
        const qrCodeDataURL = await QRCode.toDataURL(text);
        const buffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64');
        
        const embed = new EmbedBuilder()
            .setColor('#9932cc')
            .setTitle('📱 QR Code Generated')
            .setDescription(`QR Code for: \`${text}\``)
            .setImage('attachment://qrcode.png')
            .setTimestamp();
        
        message.channel.send({
            embeds: [embed],
            files: [{
                attachment: buffer,
                name: 'qrcode.png'
            }]
        });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ QR Code Error')
            .setDescription('Failed to generate QR code. Please try again.')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    }
}

async function handleMeme(message) {
    try {
        const response = await axios.get('https://meme-api.herokuapp.com/gimme');
        const meme = response.data;
        
        const embed = new EmbedBuilder()
            .setColor('#ff6900')
            .setTitle(`😂 ${meme.title}`)
            .setImage(meme.url)
            .setFooter({ text: `From r/${meme.subreddit} • 👍 ${meme.ups}` })
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Meme Error')
            .setDescription('Failed to fetch a meme. Please try again later.')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    }
}

async function handleQuote(message) {
    try {
        const response = await axios.get('https://api.quotable.io/random');
        const quote = response.data;
        
        const embed = new EmbedBuilder()
            .setColor('#9932cc')
            .setTitle('💭 Random Quote')
            .setDescription(`*"${quote.content}"*`)
            .setFooter({ text: `— ${quote.author}` })
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Quote Error')
            .setDescription('Failed to fetch a quote. Please try again later.')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    }
}

// AI Chat Feature
async function handleAI(message, args) {
    if (!args.length) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Missing Question')
            .setDescription('Usage: `!ai <your question>`\nExample: `!ai What is the capital of France?`')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const question = args.join(' ');
    
    // Show typing indicator
    message.channel.sendTyping();
    
    try {
        let aiResponse = '';
        
        // Try OpenAI API first (if API key is available)
        const openaiKey = process.env.OPENAI_API_KEY;
        if (openaiKey) {
            try {
                const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful Discord bot assistant. Keep responses concise and friendly, under 1500 characters.'
                        },
                        {
                            role: 'user',
                            content: question
                        }
                    ],
                    max_tokens: 300,
                    temperature: 0.7
                }, {
                    headers: {
                        'Authorization': `Bearer ${openaiKey}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                aiResponse = response.data.choices[0].message.content;
            } catch (openaiError) {
                console.log('OpenAI API failed, trying alternative...');
                aiResponse = await getFreeAIResponse(question);
            }
        } else {
            // Use free AI alternative
            aiResponse = await getFreeAIResponse(question);
        }
        
        // Split response if too long for Discord
        if (aiResponse.length > 2000) {
            aiResponse = aiResponse.substring(0, 1900) + '...';
        }
        
        const embed = new EmbedBuilder()
            .setColor('#9932cc')
            .setTitle('🤖 AI Assistant')
            .addFields(
                { name: '❓ Your Question', value: question, inline: false },
                { name: '💭 AI Response', value: aiResponse, inline: false }
            )
            .setFooter({ text: 'Powered by AI • Results may vary' })
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
        
    } catch (error) {
        console.error('AI Error:', error);
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ AI Error')
            .setDescription('Sorry, I couldn\'t process your question right now. Please try again later.')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
    }
}

// Free AI alternative using a public API
async function getFreeAIResponse(question) {
    try {
        // Using a free AI API (Hugging Face Inference API)
        const hfToken = process.env.HUGGINGFACE_API_KEY;
        
        if (hfToken) {
            const response = await axios.post(
                'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
                {
                    inputs: question,
                    parameters: {
                        max_length: 200,
                        temperature: 0.7,
                        do_sample: true
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${hfToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (response.data && response.data[0] && response.data[0].generated_text) {
                return response.data[0].generated_text;
            }
        }
        
        // Fallback to a simple response system
        return getSmartResponse(question);
        
    } catch (error) {
        console.log('Free AI API failed, using fallback...');
        return getSmartResponse(question);
    }
}

// Smart fallback response system
function getSmartResponse(question) {
    const lowerQuestion = question.toLowerCase();
    
    // Programming questions
    if (lowerQuestion.includes('javascript') || lowerQuestion.includes('js') || lowerQuestion.includes('node')) {
        return "JavaScript is a versatile programming language! For Node.js development, I recommend checking MDN docs and practicing with small projects. What specific aspect would you like to know more about?";
    }
    
    if (lowerQuestion.includes('python')) {
        return "Python is great for beginners and experts alike! It's used for web development, data science, AI, and automation. The syntax is clean and readable. Are you looking to learn Python or solve a specific problem?";
    }
    
    if (lowerQuestion.includes('discord') || lowerQuestion.includes('bot')) {
        return "Discord bots are awesome! You can create them with discord.js (JavaScript) or discord.py (Python). They can moderate servers, play music, manage economy systems, and much more. What kind of bot feature interests you?";
    }
    
    // General questions
    if (lowerQuestion.includes('how') && lowerQuestion.includes('learn')) {
        return "Learning is a journey! Start with the basics, practice regularly, build projects, and don't be afraid to make mistakes. Online resources like freeCodeCamp, Codecademy, and YouTube are great. What would you like to learn?";
    }
    
    if (lowerQuestion.includes('what') && lowerQuestion.includes('time')) {
        const now = new Date();
        return `The current time is ${now.toLocaleTimeString()}. Time zones can be tricky - make sure to specify which timezone you're interested in!`;
    }
    
    if (lowerQuestion.includes('weather')) {
        return "I can help you check the weather! Use the `!weather <city>` command to get current weather information for any city. You'll need to set up a weather API key for it to work.";
    }
    
    if (lowerQuestion.includes('help') || lowerQuestion.includes('command')) {
        return "I have lots of commands! Use `!help` to see all available commands. I can help with economy, games, utilities, moderation, and more. What would you like to do?";
    }
    
    // Math questions
    if (lowerQuestion.includes('calculate') || lowerQuestion.includes('math') || /\d+[\+\-\*\/]\d+/.test(lowerQuestion)) {
        return "I can help with math! Use the `!calc <expression>` command for calculations. For example: `!calc 2 + 2 * 3` or `!calc sqrt(16)`. I support basic arithmetic, trigonometry, and more!";
    }
    
    // Motivational responses
    if (lowerQuestion.includes('sad') || lowerQuestion.includes('depressed') || lowerQuestion.includes('down')) {
        return "I'm sorry you're feeling down. Remember that tough times don't last, but tough people do! Consider talking to friends, family, or a professional. You're stronger than you think! 💪";
    }
    
    if (lowerQuestion.includes('motivation') || lowerQuestion.includes('inspire')) {
        return "Here's some motivation: Every expert was once a beginner. Every pro was once an amateur. Every icon was once an unknown. Don't give up on your dreams! 🌟";
    }
    
    // Fun responses
    if (lowerQuestion.includes('joke') || lowerQuestion.includes('funny')) {
        const jokes = [
            "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
            "How many programmers does it take to change a light bulb? None, that's a hardware problem! 💡",
            "Why do Java developers wear glasses? Because they can't C#! 👓",
            "A SQL query goes into a bar, walks up to two tables and asks: 'Can I join you?' 🍺"
        ];
        return jokes[Math.floor(Math.random() * jokes.length)];
    }
    
    // Default responses
    const defaultResponses = [
        "That's an interesting question! While I don't have a specific answer, I'd suggest researching that topic further. Is there something more specific I can help you with?",
        "I'm not entirely sure about that, but I'm always learning! You might want to check reliable sources or ask in a specialized community. What else can I help you with?",
        "Great question! I don't have all the answers, but I'm here to help with Discord server management, games, utilities, and more. Try `!help` to see what I can do!",
        "Hmm, that's beyond my current knowledge, but I'm constantly improving! I'm great at helping with server moderation, economy systems, and fun games though. What would you like to try?",
        "I wish I had a perfect answer for that! While I'm still learning, I can definitely help you with Discord server features, calculations, weather, and entertainment. What sounds interesting?"
    ];
    
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

// Server Management Features

async function handlePoll(message, args) {
    if (args.length < 3) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Invalid Poll')
            .setDescription('Usage: `!poll <question> <option1> <option2> [option3] [option4]`')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const question = args[0];
    const options = args.slice(1);
    
    if (options.length > 4) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Too Many Options')
            .setDescription('Polls can have a maximum of 4 options.')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const reactions = ['🇦', '🇧', '🇨', '🇩'];
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📊 Poll')
        .setDescription(`**${question}**`)
        .setFooter({ text: `Poll created by ${message.author.tag}` })
        .setTimestamp();
    
    options.forEach((option, index) => {
        embed.addFields({
            name: `${reactions[index]} Option ${index + 1}`,
            value: option,
            inline: false
        });
    });
    
    const pollMessage = await message.channel.send({ embeds: [embed] });
    
    for (let i = 0; i < options.length; i++) {
        await pollMessage.react(reactions[i]);
    }
}

async function handleReminder(message, args) {
    if (args.length < 2) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Invalid Reminder')
            .setDescription('Usage: `!reminder <time> <message>`\nExample: `!reminder 10m Take a break`')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const timeStr = args[0];
    const reminderText = args.slice(1).join(' ');
    
    // Parse time (e.g., "10m", "1h", "30s")
    const timeMatch = timeStr.match(/^(\d+)([smhd])$/);
    if (!timeMatch) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Invalid Time Format')
            .setDescription('Use format like: 30s, 10m, 2h, 1d')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const value = parseInt(timeMatch[1]);
    const unit = timeMatch[2];
    
    let milliseconds = 0;
    switch (unit) {
        case 's': milliseconds = value * 1000; break;
        case 'm': milliseconds = value * 60 * 1000; break;
        case 'h': milliseconds = value * 60 * 60 * 1000; break;
        case 'd': milliseconds = value * 24 * 60 * 60 * 1000; break;
    }
    
    if (milliseconds > 24 * 60 * 60 * 1000) { // Max 24 hours
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Time Too Long')
            .setDescription('Reminders can be set for a maximum of 24 hours.')
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
        return;
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('⏰ Reminder Set')
        .setDescription(`I'll remind you in ${timeStr}: "${reminderText}"`)
        .setTimestamp();
    
    message.channel.send({ embeds: [embed] });
    
    setTimeout(() => {
        const reminderEmbed = new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('⏰ Reminder!')
            .setDescription(`${message.author}, you asked me to remind you:\n\n"${reminderText}"`)
            .setTimestamp();
        
        message.channel.send({ embeds: [reminderEmbed] });
    }, milliseconds);
}

async function handleServerStats(message) {
    const guild = message.guild;
    
    const totalMembers = guild.memberCount;
    const onlineMembers = guild.members.cache.filter(member => member.presence?.status !== 'offline').size;
    const textChannels = guild.channels.cache.filter(channel => channel.type === 0).size;
    const voiceChannels = guild.channels.cache.filter(channel => channel.type === 2).size;
    const roles = guild.roles.cache.size;
    const emojis = guild.emojis.cache.size;
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`📊 ${guild.name} Server Stats`)
        .setThumbnail(guild.iconURL())
        .addFields(
            { name: '👥 Total Members', value: totalMembers.toString(), inline: true },
            { name: '🟢 Online Members', value: onlineMembers.toString(), inline: true },
            { name: '📝 Text Channels', value: textChannels.toString(), inline: true },
            { name: '🔊 Voice Channels', value: voiceChannels.toString(), inline: true },
            { name: '🎭 Roles', value: roles.toString(), inline: true },
            { name: '😀 Emojis', value: emojis.toString(), inline: true },
            { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false },
            { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true }
        )
        .setFooter({ text: `Server ID: ${guild.id}` })
        .setTimestamp();
    
    message.channel.send({ embeds: [embed] });
}

module.exports = {
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
};
