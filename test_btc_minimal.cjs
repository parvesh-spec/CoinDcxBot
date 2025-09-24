const crypto = require('crypto');

const API_KEY = "4d489c26282861673fe7d497cb91eb25096e4b67cbfd1dc5";
const API_SECRET = "59465708774c241ff19872def99e4cd896453d661241df971cedf4077694e809";

async function testMinimalOrder() {
  console.log("🧪 Testing MINIMAL BTC Futures Order...\n");
  
  const timestamp = Date.now();
  
  // Minimal BTC futures order - guaranteed to be supported
  const requestBody = {
    "timestamp": timestamp,
    "side": "buy",
    "pair": "B-BTCUSDT", 
    "order_type": "market", // Market order - no price required
    "total_quantity": 0.001, // Minimal quantity
    "leverage": 2 // Minimal leverage
  };

  console.log("📊 Minimal BTC Order:", JSON.stringify(requestBody, null, 2));
  
  const payload = JSON.stringify(requestBody);
  const signature = crypto.createHmac('sha256', API_SECRET).update(payload).digest('hex');
  
  try {
    const response = await fetch('https://api.coindcx.com/exchange/v1/derivatives/futures/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': API_KEY,
        'X-AUTH-SIGNATURE': signature
      },
      body: payload
    });
    
    // Get both text and status
    const responseText = await response.text();
    const headers = Object.fromEntries([...response.headers]);
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Headers:`, headers);
    console.log(`🎯 Response Body: "${responseText}"`);
    console.log(`📏 Response Length: ${responseText.length} characters`);
    
    if (responseText) {
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log("📝 Parsed JSON:", JSON.stringify(jsonResponse, null, 2));
      } catch (e) {
        console.log("⚠️ Response is not JSON:", responseText);
      }
    } else {
      console.log("❌ COMPLETELY EMPTY RESPONSE - This suggests account/permission issue");
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

// Also test account info endpoint
async function testAccountInfo() {
  console.log("\n🔍 Testing Account Info...");
  
  const timestamp = Date.now();
  const requestBody = { "timestamp": timestamp };
  const payload = JSON.stringify(requestBody);
  const signature = crypto.createHmac('sha256', API_SECRET).update(payload).digest('hex');
  
  try {
    const response = await fetch('https://api.coindcx.com/exchange/v1/user/info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': API_KEY,
        'X-AUTH-SIGNATURE': signature
      },
      body: payload
    });
    
    const data = await response.text();
    console.log(`📊 Account Info Status: ${response.status}`);
    console.log(`🎯 Account Info: ${data}`);
    
  } catch (error) {
    console.log(`❌ Account Info Error: ${error.message}`);
  }
}

async function runTests() {
  await testMinimalOrder();
  await testAccountInfo();
}

runTests();
