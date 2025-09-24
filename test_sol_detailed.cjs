const crypto = require('crypto');

// Test different parameter combinations
const API_KEY = "4d489c26282861673fe7d497cb91eb25096e4b67cbfd1dc5";
const API_SECRET = "59465708774c241ff19872def99e4cd896453d661241df971cedf4077694e809";

async function testOrder(requestBody) {
  const payload = JSON.stringify(requestBody);
  const signature = crypto.createHmac('sha256', API_SECRET).update(payload).digest('hex');
  
  console.log("🧪 Testing:", JSON.stringify(requestBody, null, 2));
  console.log("🔐 Signature:", signature.substring(0, 16) + "...");
  
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
    
    const data = await response.text();
    console.log(`📊 Status: ${response.status}`);
    console.log(`🎯 Response: ${data}\n`);
    
    return response.status;
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
    return null;
  }
}

async function runTests() {
  console.log("🚀 Testing different SOL order configurations...\n");
  
  // Test 1: Original request  
  await testOrder({
    "timestamp": Date.now(),
    "side": "buy",
    "pair": "B-SOL_USDT",
    "order_type": "limit",
    "price": 220,
    "total_quantity": 1,
    "leverage": 50
  });
  
  // Test 2: Lower leverage
  await testOrder({
    "timestamp": Date.now(),
    "side": "buy", 
    "pair": "B-SOL_USDT",
    "order_type": "limit",
    "price": 220,
    "total_quantity": 1,
    "leverage": 10
  });
  
  // Test 3: Market order (no price)
  await testOrder({
    "timestamp": Date.now(),
    "side": "buy",
    "pair": "B-SOL_USDT", 
    "order_type": "market",
    "total_quantity": 1,
    "leverage": 10
  });
  
  // Test 4: Smaller quantity
  await testOrder({
    "timestamp": Date.now(),
    "side": "buy",
    "pair": "B-SOL_USDT",
    "order_type": "limit",
    "price": 220,
    "total_quantity": 0.1,
    "leverage": 10
  });
}

runTests();
