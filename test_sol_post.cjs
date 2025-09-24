const crypto = require('crypto');

const API_KEY = "4d489c26282861673fe7d497cb91eb25096e4b67cbfd1dc5";
const API_SECRET = "59465708774c241ff19872def99e4cd896453d661241df971cedf4077694e809";

async function testFuturesOrder() {
  const timestamp = Date.now();
  
  // Create SOL futures order - using exact format from working wallet balance
  const requestBody = {
    "timestamp": timestamp,
    "side": "buy",
    "pair": "SOLUSDT", // Try without B- prefix first
    "order_type": "limit",
    "price": 220,
    "total_quantity": 1,
    "leverage": 10
  };

  console.log("🚀 SOL Futures Order Test");
  console.log("📊 Request Body:", JSON.stringify(requestBody, null, 2));
  
  const payload = JSON.stringify(requestBody);
  const signature = crypto.createHmac('sha256', API_SECRET).update(payload).digest('hex');
  
  console.log("🔐 Signature:", signature.substring(0, 16) + "...");
  
  try {
    // Test POST to futures order creation endpoint
    const response = await fetch('https://api.coindcx.com/exchange/v1/derivatives/futures/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': API_KEY,
        'X-AUTH-SIGNATURE': signature
      },
      body: payload
    });
    
    const data = await response.text();
    console.log(`📊 Status: ${response.status}`);
    console.log(`🎯 Response: ${data}`);
    
    if (response.status === 400 && !data) {
      console.log("❌ Empty 400 response - likely parameter issue");
      
      // Try with B- prefix
      console.log("\n🧪 Trying with B- prefix...");
      
      const requestBody2 = {
        ...requestBody,
        "pair": "B-SOLUSDT",
        "timestamp": Date.now()
      };
      
      const payload2 = JSON.stringify(requestBody2);
      const signature2 = crypto.createHmac('sha256', API_SECRET).update(payload2).digest('hex');
      
      const response2 = await fetch('https://api.coindcx.com/exchange/v1/derivatives/futures/orders/create', {
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
          'X-AUTH-APIKEY': API_KEY,
          'X-AUTH-SIGNATURE': signature2
        },
        body: payload2
      });
      
      const data2 = await response2.text();
      console.log(`📊 Status with B- prefix: ${response2.status}`);
      console.log(`🎯 Response with B- prefix: ${data2}`);
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testFuturesOrder();
