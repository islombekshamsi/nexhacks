const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";
const ROOT = __dirname;

// API Configuration - Store your Overshoot API key here
const API_CONFIG = {
  apiKey:  "ovs_6bb8b4a55cdc183397938f68c9502c1a",
  apiUrl: "https://cluster1.overshoot.ai/api/v0.2"
};

// ElevenLabs API Configuration
const ELEVENLABS_API_KEY = 'sk_0e1f42de1f53236c17256bac386b06ae3bc44aa421290d63';
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io';

// Helper function to call ElevenLabs Audio Isolation API
async function isolateAudioWithElevenLabs(inputFilePath, outputDir) {
  return new Promise((resolve, reject) => {
    console.log('🔊 Calling ElevenLabs Audio Isolation API...');
    
    // Read the input audio file
    const audioData = fs.readFileSync(inputFilePath);
    const fileName = path.basename(inputFilePath);
    
    // Create multipart form data boundary
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substr(2);
    
    // Build multipart form data
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
    
    const req = https.request(options, (res) => {
      const chunks = [];
      
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          const audioBuffer = Buffer.concat(chunks);
          const outputFileName = `isolated_${Date.now()}.mp3`;
          const outputPath = path.join(outputDir, outputFileName);
          
          fs.writeFileSync(outputPath, audioBuffer);
          console.log('✅ Audio isolated successfully:', outputPath);
          
          resolve({
            success: true,
            outputPath: outputPath,
            outputFileName: outputFileName
          });
        } else {
          const errorBody = Buffer.concat(chunks).toString();
          console.error('❌ ElevenLabs API error:', res.statusCode, errorBody);
          reject(new Error(`ElevenLabs API error: ${res.statusCode} - ${errorBody}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ ElevenLabs request error:', error);
      reject(error);
    });
    
    req.write(formData, 'binary');
    req.end();
  });
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".data": "text/plain; charset=utf-8",
  ".webm": "audio/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

const serveFile = (filePath, res) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "text/plain" });
    res.end(data);
  });
};

const server = http.createServer((req, res) => {
  // CORS headers for all responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // API endpoint for configuration
  if (req.url === "/api/config" && req.method === "GET") {
    console.log('📡 API Config requested - sending API key');
    res.writeHead(200, { 
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders
    });
    res.end(JSON.stringify(API_CONFIG));
    return;
  }

  // ============ ELEVENLABS AUDIO ISOLATION ENDPOINT (NEW) ============
  if (req.url === "/api/voice/isolate" && req.method === "POST") {
    let body = [];
    
    req.on('data', chunk => {
      body.push(chunk);
    });
    
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(body);
        const boundary = req.headers['content-type']?.split('boundary=')[1];
        
        if (!boundary) {
          throw new Error('No multipart boundary found');
        }

        // Parse multipart form data manually (simple parser)
        const parts = buffer.toString('binary').split(`--${boundary}`);
        let audioData = null;
        let taskNumber = null;

        for (const part of parts) {
          if (part.includes('Content-Disposition: form-data; name="audio"')) {
            const dataStart = part.indexOf('\r\n\r\n') + 4;
            const dataEnd = part.lastIndexOf('\r\n');
            audioData = Buffer.from(part.substring(dataStart, dataEnd), 'binary');
          }
          if (part.includes('name="taskNumber"')) {
            const match = part.match(/\r\n\r\n(\d+)/);
            if (match) taskNumber = parseInt(match[1]);
          }
        }

        if (!audioData) {
          throw new Error('No audio data found in request');
        }

        console.log(`🎤 Received audio for Task ${taskNumber}, size: ${audioData.length} bytes`);

        // Create temp directory if it doesn't exist
        const tempDir = path.join(ROOT, 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir);
        }
        
        // Save original audio to temp file
        const inputFile = path.join(tempDir, `input_task${taskNumber}_${Date.now()}.webm`);
        fs.writeFileSync(inputFile, audioData);
        console.log(`💾 Saved input audio: ${inputFile}`);

        // ============ AUTOMATIC ELEVENLABS AUDIO ISOLATION ============
        console.log('🔊 Starting ElevenLabs Audio Isolation...');
        
        try {
          // Call ElevenLabs API to isolate audio
          const isolationResult = await isolateAudioWithElevenLabs(inputFile, tempDir);
          
          console.log('✅ Audio isolation complete!');
          console.log('   Original:', path.basename(inputFile));
          console.log('   Isolated:', isolationResult.outputFileName);
          
          const result = {
            success: true,
            taskNumber,
            inputAudioPath: `/temp/${path.basename(inputFile)}`,
            isolatedAudioPath: `/temp/${isolationResult.outputFileName}`,
            inputFileFullPath: inputFile,
            isolatedFileFullPath: isolationResult.outputPath,
            status: 'isolated',
            note: 'Audio successfully isolated with ElevenLabs'
          };

          res.writeHead(200, { 
            "Content-Type": "application/json; charset=utf-8",
            ...corsHeaders
          });
          res.end(JSON.stringify(result));
          
        } catch (elevenlabsError) {
          console.error('❌ ElevenLabs isolation failed:', elevenlabsError.message);
          console.log('📋 Falling back to original audio');
          
          // Fallback: return original audio if isolation fails
          const result = {
            success: true,
            taskNumber,
            inputAudioPath: `/temp/${path.basename(inputFile)}`,
            isolatedAudioPath: `/temp/${path.basename(inputFile)}`, // Use original
            status: 'fallback',
            note: 'ElevenLabs isolation failed, using original audio',
            error: elevenlabsError.message
          };

          res.writeHead(200, { 
            "Content-Type": "application/json; charset=utf-8",
            ...corsHeaders
          });
          res.end(JSON.stringify(result));
        }

        // Clean up temp files after 5 minutes
        setTimeout(() => {
          [inputFile].forEach(file => {
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
              console.log(`🗑️ Cleaned up: ${file}`);
            }
          });
        }, 300000); // 5 minutes

      } catch (error) {
        console.error('❌ Error in audio isolation endpoint:', error);
        res.writeHead(500, { 
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders
        });
        res.end(JSON.stringify({ 
          success: false, 
          error: error.message 
        }));
      }
    });
    return;
  }
  // ============ END ELEVENLABS ISOLATION ENDPOINT ============

  // ============ ELEVENLABS TRIGGER ENDPOINT ============
  // This endpoint expects Cursor AI to call mcp_elevenlabs_isolate_audio
  if (req.url === "/api/voice/trigger-isolation" && req.method === "POST") {
    let body = [];
    
    req.on('data', chunk => {
      body.push(chunk);
    });
    
    req.on('end', async () => {
      try {
        const data = JSON.parse(Buffer.concat(body).toString());
        const { inputFilePath } = data;
        
        if (!inputFilePath) {
          throw new Error('No input file path provided');
        }

        console.log('🎯 ISOLATION TRIGGER RECEIVED');
        console.log('   File to process:', inputFilePath);
        console.log('');
        console.log('   📋 THIS IS WHERE ELEVENLABS MCP SHOULD BE CALLED');
        console.log('   Waiting for Cursor AI to execute:');
        console.log('   mcp_elevenlabs_isolate_audio({');
        console.log('     input_file_path:', inputFilePath);
        console.log('     output_directory:', path.dirname(inputFilePath));
        console.log('   })');
        console.log('');

        const result = {
          success: true,
          message: 'Ready for ElevenLabs processing',
          inputFile: inputFilePath,
          status: 'trigger_received',
          note: 'Cursor AI should now call mcp_elevenlabs_isolate_audio'
        };

        res.writeHead(200, { 
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders
        });
        res.end(JSON.stringify(result));

      } catch (error) {
        console.error('❌ Error in trigger endpoint:', error);
        res.writeHead(500, { 
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders
        });
        res.end(JSON.stringify({ 
          success: false, 
          error: error.message 
        }));
      }
    });
    return;
  }
  // ============ END ELEVENLABS TRIGGER ENDPOINT ============

  /* ============ OLD ENDPOINT (COMMENTED FOR REFERENCE) ============
  // API endpoint for audio processing (ElevenLabs integration)
  if (req.url === "/api/voice/process" && req.method === "POST") {
    let body = [];
    
    req.on('data', chunk => {
      body.push(chunk);
    });
    
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(body);
        const boundary = req.headers['content-type']?.split('boundary=')[1];
        
        if (!boundary) {
          throw new Error('No multipart boundary found');
        }

        // Parse multipart form data manually (simple parser)
        const parts = buffer.toString('binary').split(`--${boundary}`);
        let audioData = null;
        let taskNumber = null;

        for (const part of parts) {
          if (part.includes('Content-Disposition: form-data; name="audio"')) {
            const dataStart = part.indexOf('\r\n\r\n') + 4;
            const dataEnd = part.lastIndexOf('\r\n');
            audioData = Buffer.from(part.substring(dataStart, dataEnd), 'binary');
          }
          if (part.includes('name="taskNumber"')) {
            const match = part.match(/\r\n\r\n(\d+)/);
            if (match) taskNumber = parseInt(match[1]);
          }
        }

        if (!audioData) {
          throw new Error('No audio data found in request');
        }

        console.log(`🎤 Processing audio for Task ${taskNumber}, size: ${audioData.length} bytes`);

        // Save audio to temp file
        const tempDir = path.join(ROOT, 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir);
        }
        
        const tempFile = path.join(tempDir, `task_${taskNumber}_${Date.now()}.webm`);
        fs.writeFileSync(tempFile, audioData);
        console.log(`💾 Saved audio to: ${tempFile}`);

        // This is where we would call ElevenLabs MCP tools
        // For now, return a placeholder response
        const result = {
          success: true,
          taskNumber,
          audioFile: tempFile,
          transcription: { text: '', confidence: 0.8 },
          note: 'ElevenLabs MCP integration requires server-side MCP client setup'
        };

        res.writeHead(200, { 
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders
        });
        res.end(JSON.stringify(result));

        // Clean up temp file after a delay
        setTimeout(() => {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
            console.log(`🗑️ Cleaned up temp file: ${tempFile}`);
          }
        }, 60000); // 1 minute

      } catch (error) {
        console.error('❌ Error processing audio:', error);
        res.writeHead(500, { 
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders
        });
        res.end(JSON.stringify({ 
          success: false, 
          error: error.message 
        }));
      }
    });
    return;
  }
  ============ END OLD ENDPOINT ============ */

  // Serve temp files (for audio playback)
  if (req.url.startsWith('/temp/')) {
    const tempPath = path.join(ROOT, req.url);
    serveFile(tempPath, res);
    return;
  }

  // Strip query parameters from URL (e.g., ?v=DEBUG001)
  const cleanUrl = req.url.split('?')[0];
  const urlPath = cleanUrl === "/" ? "/index.html" : cleanUrl;
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);
  serveFile(filePath, res);
});

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Server running at http://${HOST}:${PORT}`);
  console.log(`✅ API Key configured: ${API_CONFIG.apiKey.substring(0, 10)}...`);
  console.log(`📡 API endpoint available at: http://${HOST}:${PORT}/api/config\n`);
});
