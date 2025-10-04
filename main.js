const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const dotenv = require('dotenv');
const express = require('express');

// Load environment variables from .env file
dotenv.config();

// Bot configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

// Create a new Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// When the bot is ready
client.once('ready', () => {
  console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
  joinVC();
});

// Function to join voice channel
function joinVC() {
  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error('❌ Guild not found!');
      return;
    }

    const channel = guild.channels.cache.get(CHANNEL_ID);
    if (!channel) {
      console.error('❌ Voice channel not found!');
      return;
    }

    if (channel.type !== 2) { // 2 = GUILD_VOICE
      console.error('❌ Channel is not a voice channel!');
      return;
    }

    // Join the voice channel
    const connection = joinVoiceChannel({
      channelId: CHANNEL_ID,
      guildId: GUILD_ID,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });

    console.log(`🎤 Joined voice channel: ${channel.name}`);

    // Handle connection state changes
    connection.on('stateChange', (oldState, newState) => {
      console.log(`Connection state changed: ${oldState.status} -> ${newState.status}`);
    });

    // Handle disconnection
    connection.on('error', (error) => {
      console.error('❌ Connection error:', error);
      setTimeout(() => joinVC(), 5000); // Try to rejoin after error
    });

  } catch (error) {
    console.error('❌ Error joining voice channel:', error);
  }
}

// Handle messages (optional - for manual control)
client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  // Command to join VC
  if (message.content.toLowerCase() === '$join') {
    joinVC();
    message.reply('Joining voice channel...');
  }

  // Command to leave VC
  if (message.content.toLowerCase() === '$leave') {
    const connection = getVoiceConnection(GUILD_ID);
    if (connection) {
      connection.destroy();
      message.reply('Left voice channel!');
      console.log('👋 Left voice channel');
    } else {
      message.reply('Not in a voice channel!');
    }
  }
});

// Handle bot disconnection from voice
client.on('voiceStateUpdate', (oldState, newState) => {
  if (oldState.member?.id === client.user.id && !newState.channelId) {
    console.log('⚠️ Bot was disconnected from voice. Rejoining in 5 seconds...');
    setTimeout(() => joinVC(), 5000);
  }
});

// Login to Discord
client.login(BOT_TOKEN);

// ------------------ Express Web Server ------------------ //
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ Discord bot is running on Render!");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});
