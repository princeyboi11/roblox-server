const express = require('express');
const app = express();

app.use(express.json());

let jobIdsList = [];

app.post('/jobs', (req, res) => {
  const { jobIds } = req.body;
  
  if (!jobIds || !Array.isArray(jobIds)) {
    return res.status(400).json({ error: 'Invalid job IDs format' });
  }
  
  jobIdsList = jobIds;
  console.log(`✓ Received ${jobIds.length} job IDs at ${new Date().toISOString()}`);
  
  res.json({ 
    success: true, 
    count: jobIds.length,
    message: 'Job IDs received successfully'
  });
});

app.get('/jobs', (req, res) => {
  res.json({ 
    count: jobIdsList.length,
    jobIds: jobIdsList 
  });
});

// NEW ENDPOINT: Remove a job ID when used
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
  
  res.json({ 
    success: true,
    remaining: jobIdsList.length
  });
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'online',
    message: 'Roblox Job ID Server',
    storedJobIds: jobIdsList.length
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});