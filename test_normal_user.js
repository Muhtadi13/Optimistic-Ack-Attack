#!/usr/bin/env node

const http = require('http');

/**
 * Test script to verify that normal users can access the server
 * when defense is active, while attackers are blocked
 */

const SERVER_HOST = 'localhost';
const SERVER_PORT = 3000;

async function testNormalUserAccess() {
  console.log('🧪 Testing normal user access to server...');
  
  // Test 1: Normal browser request
  await testRequest('Normal Browser Request', {
    path: '/download/small-file.txt',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  // Test 2: cURL request
  await testRequest('cURL Request', {
    path: '/download/small-file.txt',
    headers: {
      'User-Agent': 'curl/7.68.0',
      'Accept': '*/*'
    }
  });

  // Test 3: Streaming request
  await testRequest('Streaming Request', {
    path: '/stream/sample-stream/playlist.m3u8',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      'Accept': 'application/vnd.apple.mpegurl'
    }
  });

  // Test 4: Attack tool (should be blocked)
  await testRequest('Attack Tool (Should Block)', {
    path: '/download/small-file.txt',
    headers: {
      'User-Agent': 'OptimisticACK-Attack-Tool/1.0',
      'Accept': '*/*'
    }
  });

  console.log('\\n✅ Normal user access test completed!');
}

function testRequest(testName, options) {
  return new Promise((resolve) => {
    console.log(`\\n🔍 ${testName}:`);
    
    const req = http.request({
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: options.path,
      method: 'GET',
      headers: options.headers
    }, (res) => {
      console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
      console.log(`   Headers: ${JSON.stringify(res.headers, null, 2)}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`   ✅ SUCCESS - ${data.length} bytes received`);
        } else if (res.statusCode === 403) {
          console.log(`   🚫 BLOCKED - ${data}`);
        } else {
          console.log(`   ⚠️  UNEXPECTED - ${data}`);
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      console.log(`   ❌ ERROR - ${err.message}`);
      resolve();
    });

    req.setTimeout(5000, () => {
      console.log(`   ⏰ TIMEOUT`);
      req.destroy();
      resolve();
    });

    req.end();
  });
}

// Run the test
testNormalUserAccess().catch(console.error);
