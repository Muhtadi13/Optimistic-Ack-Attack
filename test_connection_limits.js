#!/usr/bin/env node

const http = require('http');

/**
 * Test script to verify that legitimate browsers can make many concurrent requests
 * without being blocked by connection limits
 */

const SERVER_HOST = 'localhost';
const SERVER_PORT = 3000;

async function testConnectionLimits() {
  console.log('🧪 Testing connection limits for legitimate browsers...');
  
  // Test: Make 100 concurrent requests (more than old limit of 50)
  const promises = [];
  const numRequests = 100;
  
  console.log(`\\n🚀 Making ${numRequests} concurrent requests with legitimate browser user agent...`);
  
  for (let i = 0; i < numRequests; i++) {
    promises.push(makeRequest(i));
  }
  
  const results = await Promise.allSettled(promises);
  
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
  
  console.log(`\\n📊 Results:`);
  console.log(`✅ Successful requests: ${successful}/${numRequests}`);
  console.log(`❌ Failed requests: ${failed}/${numRequests}`);
  
  if (successful >= numRequests * 0.95) { // Allow 5% failure for network issues
    console.log(`\\n🎉 SUCCESS: Legitimate browsers are not blocked by connection limits!`);
  } else {
    console.log(`\\n⚠️  ISSUE: Too many requests failed. Connection limits may still be blocking legitimate users.`);
  }
  
  // Wait a bit, then test attack tool (should be blocked)
  console.log(`\\n🔍 Testing that attack tools are still blocked...`);
  await testAttackTool();
}

function makeRequest(index) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: '/download/small-file.txt',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ success: true, index, status: res.statusCode });
        } else {
          console.log(`Request ${index}: ${res.statusCode} - ${data}`);
          resolve({ success: false, index, status: res.statusCode, data });
        }
      });
    });

    req.on('error', (err) => {
      console.log(`Request ${index}: ERROR - ${err.message}`);
      resolve({ success: false, index, error: err.message });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ success: false, index, error: 'timeout' });
    });

    req.end();
  });
}

async function testAttackTool() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: '/download/small-file.txt',
      method: 'GET',
      headers: {
        'User-Agent': 'OptimisticACK-Attack-Tool/1.0',
        'Accept': '*/*'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 403) {
          console.log(`✅ Attack tool correctly blocked: ${res.statusCode}`);
        } else {
          console.log(`⚠️  Attack tool not blocked: ${res.statusCode} - ${data}`);
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      console.log(`Attack tool test ERROR: ${err.message}`);
      resolve();
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve();
    });

    req.end();
  });
}

// Run the test
testConnectionLimits().catch(console.error);
