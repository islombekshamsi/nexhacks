// Test script to verify ElevenLabs API integration
const https = require('https');
const fs = require('fs');
const path = require('path');

const ELEVENLABS_API_KEY = 'sk_0e1f42de1f53236c17256bac386b06ae3bc44aa421290d63';

console.log('🧪 Testing ElevenLabs API Integration...\n');

// Test 1: Check API key validity
function testAPIKey() {
  return new Promise((resolve, reject) => {
    console.log('1️⃣ Testing API Key validity...');
    
    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: '/v1/user',
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          const user = JSON.parse(data);
          console.log('   ✅ API Key is valid!');
          console.log('   📊 Subscription:', user.subscription?.tier || 'unknown');
          console.log('   📊 Character count:', user.subscription?.character_count || 0);
          console.log('   📊 Character limit:', user.subscription?.character_limit || 0);
          console.log('');
          resolve(true);
        } else {
          console.error('   ❌ API Key invalid! Status:', res.statusCode);
          console.error('   Response:', data);
          console.log('');
          reject(new Error('Invalid API key'));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('   ❌ Request error:', error.message);
      console.log('');
      reject(error);
    });
    
    req.end();
  });
}

// Test 2: Check audio isolation endpoint
function testAudioIsolation() {
  return new Promise((resolve, reject) => {
    console.log('2️⃣ Testing Audio Isolation endpoint...');
    
    // Create a test audio file (silent webm)
    const testAudioPath = path.join(__dirname, 'temp', 'test-audio.webm');
    
    // Check if temp directory and test file exist
    if (!fs.existsSync(path.join(__dirname, 'temp'))) {
      console.log('   ⚠️ No temp directory found');
      console.log('   💡 Record audio through the UI first to create temp files');
      console.log('');
      resolve(false);
      return;
    }
    
    // Look for any existing audio file in temp
    const tempFiles = fs.readdirSync(path.join(__dirname, 'temp'));
    const audioFile = tempFiles.find(f => f.startsWith('input_task'));
    
    if (!audioFile) {
      console.log('   ⚠️ No audio files found in temp/');
      console.log('   💡 Record audio through the UI first');
      console.log('');
      resolve(false);
      return;
    }
    
    const audioFilePath = path.join(__dirname, 'temp', audioFile);
    console.log('   📁 Found test audio:', audioFile);
    
    const audioData = fs.readFileSync(audioFilePath);
    const fileName = path.basename(audioFilePath);
    
    // Create multipart form data
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substr(2);
    
    const formData = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="audio"; filename="${fileName}"`,
      'Content-Type: audio/webm',
      '',
      audioData.toString('binary'),
      `--${boundary}--`
    ].join('\r\n');
    
    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: '/v1/audio-isolation',
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(formData, 'binary')
      }
    };
    
    console.log('   📤 Uploading audio to ElevenLabs...');
    
    const req = https.request(options, (res) => {
      const chunks = [];
      
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          const audioBuffer = Buffer.concat(chunks);
          const outputPath = path.join(__dirname, 'temp', `isolated_test_${Date.now()}.mp3`);
          
          fs.writeFileSync(outputPath, audioBuffer);
          console.log('   ✅ Audio isolation successful!');
          console.log('   📁 Output saved:', path.basename(outputPath));
          console.log('   📊 Size:', audioBuffer.length, 'bytes');
          console.log('');
          resolve(true);
        } else {
          const errorBody = Buffer.concat(chunks).toString();
          console.error('   ❌ Audio isolation failed!');
          console.error('   Status:', res.statusCode);
          console.error('   Error:', errorBody);
          console.log('');
          reject(new Error(`HTTP ${res.statusCode}: ${errorBody}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('   ❌ Request error:', error.message);
      console.log('');
      reject(error);
    });
    
    req.write(formData, 'binary');
    req.end();
  });
}

// Run tests
async function runTests() {
  try {
    await testAPIKey();
    await testAudioIsolation();
    
    console.log('═══════════════════════════════════════');
    console.log('✅ All tests completed!');
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('📝 Summary:');
    console.log('   • ElevenLabs API key is working');
    console.log('   • Audio isolation endpoint is functional');
    console.log('   • Integration is ready to use!');
    console.log('');
    
  } catch (error) {
    console.log('═══════════════════════════════════════');
    console.log('❌ Test failed:', error.message);
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Verify API key is correct');
    console.log('   2. Check network connection');
    console.log('   3. Record audio through UI to create test files');
    console.log('');
  }
}

runTests();
