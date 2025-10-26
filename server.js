const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

let jobIdsList = [];
let notificationLogs = [];

// Discord webhook URLs - UPDATE THESE WITH YOUR WEBHOOKS
const DISCORD_WEBHOOKS = {
  low: 'https://discord.com/api/webhooks/1426745792751861932/YyEw-PY6lwy3oyovUAiZzPPg9O2d3s5z9JpK6XxBFA7xGRDUlbiwc9keacJjC3sThugD',
  medium: 'https://discord.com/api/webhooks/1426745911614111808/TALLNJ2HMSnh5cGosYwG6WH1Q4Mk-ZiHhN8M600lTWBkSECbIOKLyvOB1Q3DYZJjollW',
  high: 'https://discord.com/api/webhooks/1426746079197532171/ljNbiIZ19CmVkMwvXvF4cLjBmWtGWvyUtkHZmC9ltJnwnllZVXyzutgGzaHQ4uwqEYFe',
  veryHigh: 'https://discord.com/api/webhooks/1426746162261786726/VOiVSIvlJsKsF6epPxqUu5H7ifCqifXEo2tQcVaWbxMgAXG2i4mdQg5yQj9mwXh6a278',
  extreme: 'https://discord.com/api/webhooks/1426746229437763675/yv1Wc8OeEaQRD6t7MwJj__6_1f7hhLLTMAKPTOPcR5-Wi0cqK9mYF8MUKz8DvcwGlcMC'
};

// Extract generation number from string like "$2.4M/s" or "$2.5B/s"
function extractGeneration(genString) {
  if (!genString) return 0;
  
  // Check for billions (B/s)
  const billionMatch = genString.match(/\$?([\d.]+)B\/s/i);
  if (billionMatch) {
    return parseFloat(billionMatch[1]) * 1000; // Convert billions to millions
  }
  
  // Check for millions (M/s)
  const millionMatch = genString.match(/\$?([\d.]+)M\/s/i);
  if (millionMatch) {
    return parseFloat(millionMatch[1]);
  }
  
  return 0;
}

// Pick webhook based on generation value (in millions)
function pickWebhookUrl(gen) {
  if (gen <= 1) return null;
  if (gen <= 10) return DISCORD_WEBHOOKS.low;
  if (gen <= 50) return DISCORD_WEBHOOKS.medium;
  if (gen <= 100) return DISCORD_WEBHOOKS.high;
  if (gen <= 500) return DISCORD_WEBHOOKS.veryHigh;
  return DISCORD_WEBHOOKS.extreme; // 500M+ or any billions
}

// ==================== JOB ID ENDPOINTS ====================

app.post('/jobs', (req, res) => {
  const { jobIds } = req.body;
  if (!jobIds || !Array.isArray(jobIds)) {
    return res.status(400).json({ error: 'Invalid job IDs format' });
  }
  jobIdsList = jobIds;
  console.log(`✓ Received ${jobIds.length} job IDs at ${new Date().toISOString()}`);
  res.json({ success: true, count: jobIds.length, message: 'Job IDs received' });
});

app.get('/jobs', (req, res) => {
  res.json({ count: jobIdsList.length, jobIds: jobIdsList });
});

app.post('/remove', (req, res) => {
  const { jobId } = req.body;
  if (!jobId) {
    return res.status(400).json({ error: 'No job ID provided' });
  }
  const index = jobIdsList.indexOf(jobId);
  if (index > -1) {
    jobIdsList.splice(index, 1);
    console.log(`Removed job ID: ${jobId}. Remaining: ${jobIdsList.length}`);
  }
  res.json({ success: true, remaining: jobIdsList.length });
});

// ==================== NOTIFICATION ENDPOINT ====================

app.post('/notify', async (req, res) => {
  try {
    console.log('📥 Received notification');
    
    const data = req.body;
    let brainrotName = 'Unknown';
    let generation = '0M/s';
    let genValue = 0;
    let serverId = 'Unknown';
    let players = 'Unknown';
    let owner = 'Unknown';
    
    // Extract info from Discord embed format
    if (data.embeds && data.embeds[0]) {
      const embed = data.embeds[0];
      
      // Try to extract from title
      if (embed.title) {
        const titleMatch = embed.title.match(/(\d+x\s+[\w\s]+)\s+\[\$?([\d.]+[MB]\/s)\]/i);
        if (titleMatch) {
          brainrotName = titleMatch[1].trim();
          generation = titleMatch[2];
          genValue = extractGeneration(generation);
        }
      }
      
      // Extract from fields
      if (embed.fields) {
        // Server ID
        const serverField = embed.fields.find(f => f.name && f.name.includes('Server ID'));
        if (serverField && serverField.value) {
          serverId = serverField.value.replace(/```/g, '').trim();
        }
        
        // Players
        const playersField = embed.fields.find(f => f.name && f.name.includes('Players'));
        if (playersField && playersField.value) {
          players = playersField.value.replace(/```/g, '').trim();
        }
        
        // Owner
        const ownerField = embed.fields.find(f => f.name && f.name.includes('Base Owner'));
        if (ownerField && ownerField.value) {
          owner = ownerField.value.replace(/```/g, '').trim();
        }
        
        // Try to extract brainrot from fields if not found in title
        if (brainrotName === 'Unknown') {
          const brainrotField = embed.fields.find(f => f.name && f.name.includes('Brainrot'));
          if (brainrotField && brainrotField.value) {
            const fieldMatch = brainrotField.value.match(/\*\*(.*?)\*\*\s+\[`\$?([\d.]+[MB]\/s)`\]/i);
            if (fieldMatch) {
              brainrotName = fieldMatch[1].trim();
              generation = fieldMatch[2];
              genValue = extractGeneration(generation);
            }
          }
        }
      }
    }
    
    // Store in logs
    const logEntry = {
      brainrot: brainrotName,
      generation: generation,
      genValue: genValue,
      serverId: serverId,
      players: players,
      owner: owner,
      timestamp: new Date().toISOString(),
      fullData: data
    };
    
    notificationLogs.unshift(logEntry);
    
    // Keep only last 100 logs
    if (notificationLogs.length > 100) {
      notificationLogs = notificationLogs.slice(0, 100);
    }
    
    console.log(`📝 Logged: ${brainrotName} [${generation}] (${genValue}M) | Server: ${serverId} | Players: ${players}`);
    console.log(`🎯 Will forward to Discord in 10s | Gen: ${genValue}M | Webhook: ${pickWebhookUrl(genValue) ? 'Selected' : 'SKIPPED (too low)'}`);
    
    // Respond immediately to Roblox
    res.json({ 
      success: true,
      message: 'Notification received',
      brainrot: brainrotName,
      generation: generation
    });
    
    // Forward to Discord after 10 second delay
    setTimeout(async () => {
      const webhookUrl = pickWebhookUrl(genValue);
      
      try {
        if (webhookUrl) {
          // Clean up the embed data for Discord
          const cleanedData = JSON.parse(JSON.stringify(data));
          
          if (cleanedData.embeds && cleanedData.embeds[0]) {
            const embed = cleanedData.embeds[0];
            
            // Fix thumbnail - remove if invalid
            if (embed.thumbnail) {
              if (Array.isArray(embed.thumbnail) || 
                  !embed.thumbnail.url || 
                  embed.thumbnail.url === null || 
                  embed.thumbnail.url === '' ||
                  typeof embed.thumbnail.url !== 'string') {
                delete embed.thumbnail;
              }
            }
            
            // Fix image - remove if invalid
            if (embed.image) {
              if (Array.isArray(embed.image) || 
                  !embed.image.url || 
                  embed.image.url === null || 
                  embed.image.url === '' ||
                  typeof embed.image.url !== 'string') {
                delete embed.image;
              }
            }
          }
          
          // Send the cleaned data
          const response = await axios.post(webhookUrl, cleanedData, {
            headers: { 
              'Content-Type': 'application/json'
            }
          });
          console.log(`✅ Forwarded to Discord: ${brainrotName} [${generation}] | Status: ${response.status}`);
        } else {
          console.log(`⏭️  Skipped Discord (gen too low: ${genValue}M): ${brainrotName} [${generation}]`);
        }
      } catch (error) {
        console.error('❌ Error forwarding to Discord:', error.message);
        console.error('Generation value:', genValue, 'M');
        console.error('Webhook URL:', webhookUrl || 'NULL');
        if (error.response) {
          console.error('Discord Error Response:', JSON.stringify(error.response.data));
          console.error('Status:', error.response.status);
        }
        console.error('Data being sent:', JSON.stringify(data, null, 2));
      }
    }, 10000); // 10 second delay
    
  } catch (error) {
    console.error('❌ Error processing notification:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ==================== LOGS ENDPOINTS ====================

app.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({
    total: notificationLogs.length,
    showing: Math.min(limit, notificationLogs.length),
    logs: notificationLogs.slice(0, limit).map(log => ({
      brainrot: log.brainrot,
      generation: log.generation,
      owner: log.owner,
      serverId: log.serverId,
      players: log.players,
      timestamp: log.timestamp
    }))
  });
});

app.get('/logs/json', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({
    total: notificationLogs.length,
    logs: notificationLogs.slice(0, limit).map(log => ({
      brainrot: log.brainrot,
      generation: log.generation,
      serverId: log.serverId,
      players: log.players,
      owner: log.owner,
      timestamp: log.timestamp
    }))
  });
});

// ==================== HOME ENDPOINT ====================

app.get('/', (req, res) => {
  res.json({ 
    status: 'online',
    message: 'Roblox Job ID & Notification Server',
    storedJobIds: jobIdsList.length,
    totalNotifications: notificationLogs.length,
    endpoints: {
      jobs: 'POST /jobs - Store job IDs | GET /jobs - View job IDs | POST /remove - Remove job ID',
      notifications: 'POST /notify - Receive notification from Roblox',
      logs: 'GET /logs - View logs (HTML) | GET /logs/json - View logs (JSON)'
    }
  });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Logs: http://localhost:${PORT}/logs`);
  console.log(`📡 Ready to receive notifications!`);
  console.log(`💎 Billions support enabled!`);
});