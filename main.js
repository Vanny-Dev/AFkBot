const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const dotenv = require('dotenv');
const express = require('express');

// Load environment variables from .env file
dotenv.config();

// Bot configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID; // Main channel to monitor
const WAITING_AREA_ID = process.env.WAITING_AREA_ID; // Waiting area channel

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
  checkAndJoinAppropriateChannel();
});

// Function to count users in a voice channel (excluding the bot)
function countUsersInChannel(channelId) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return 0;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return 0;

  // Count members excluding the bot
  const userCount = channel.members.filter(member => !member.user.bot).size;
  return userCount;
}

// Function to join a specific voice channel
function joinSpecificChannel(channelId) {
  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error('❌ Guild not found!');
      return null;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      console.error('❌ Voice channel not found!');
      return null;
    }

    if (channel.type !== 2) { // 2 = GUILD_VOICE
      console.error('❌ Channel is not a voice channel!');
      return null;
    }

    // Check if already in the target channel
    const existingConnection = getVoiceConnection(GUILD_ID);
    if (existingConnection && existingConnection.joinConfig.channelId === channelId) {
      console.log(`✅ Already in ${channel.name}, no need to move`);
      return existingConnection;
    }

    // Destroy existing connection if any
    if (existingConnection) {
      existingConnection.destroy();
    }

    // Join the voice channel
    const connection = joinVoiceChannel({
      channelId: channelId,
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
      setTimeout(() => checkAndJoinAppropriateChannel(), 5000);
    });

    return connection;

  } catch (error) {
    console.error('❌ Error joining voice channel:', error);
    return null;
  }
}

// Function to check user count and join appropriate channel
function checkAndJoinAppropriateChannel() {
  const mainChannelUserCount = countUsersInChannel(CHANNEL_ID);
  
  console.log(`👥 Users in main channel: ${mainChannelUserCount}`);

  if (mainChannelUserCount === 1) {
    // Only 1 user in main channel - join and stay with them
    console.log('➡️ 1 user detected. Joining/staying in main channel...');
    joinSpecificChannel(CHANNEL_ID);
  } else if (mainChannelUserCount >= 2) {
    // 2 or more users in main channel - go to waiting area
    console.log('➡️ 2+ users detected. Moving to waiting area...');
    joinSpecificChannel(WAITING_AREA_ID);
  } else {
    // No users in main channel - check where bot currently is
    const connection = getVoiceConnection(GUILD_ID);
    if (connection && connection.joinConfig.channelId === CHANNEL_ID) {
      // Bot is already in main channel and alone - stay there
      console.log('✅ Bot is alone in main channel. Staying here...');
    } else {
      // Bot is not in main channel - go to waiting area
      console.log('➡️ No users in main channel. Going to waiting area...');
      joinSpecificChannel(WAITING_AREA_ID);
    }
  }
}

// Monitor voice state updates
client.on('voiceStateUpdate', (oldState, newState) => {
  // Ignore bot's own state changes
  if (newState.member?.id === client.user.id) {
    // Handle bot being disconnected
    if (oldState.channelId && !newState.channelId) {
      console.log('⚠️ Bot was disconnected from voice. Rejoining in 5 seconds...');
      setTimeout(() => checkAndJoinAppropriateChannel(), 5000);
    }
    return;
  }

  // Check if the change affects the main channel
  if (oldState.channelId === CHANNEL_ID || newState.channelId === CHANNEL_ID) {
    console.log('🔄 Voice state change detected in main channel');
    // Wait a moment for the state to fully update
    setTimeout(() => checkAndJoinAppropriateChannel(), 1000);
  }
});

// Handle messages (optional - for manual control)
client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  // Command to manually trigger check
  if (message.content.toLowerCase() === '$check') {
    checkAndJoinAppropriateChannel();
    const userCount = countUsersInChannel(CHANNEL_ID);
    message.reply(`Checking channels... Users in main channel: ${userCount}`);
  }

  // Command to join main channel
  if (message.content.toLowerCase() === '$join') {
    joinSpecificChannel(CHANNEL_ID);
    message.reply('Joining main channel...');
  }

  // Command to join waiting area
  if (message.content.toLowerCase() === '$wait') {
    joinSpecificChannel(WAITING_AREA_ID);
    message.reply('Joining waiting area...');
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

// Login to Discord
client.login(BOT_TOKEN);

// ------------------ Express Web Server ------------------ //
const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});
