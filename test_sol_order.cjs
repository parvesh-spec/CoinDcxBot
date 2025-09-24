const crypto = require('crypto');
const https = require('https');

// CoinDCX API credentials
const API_KEY = "4d489c26282861673fe7d497cb91eb25096e4b67cbfd1dc5";
const API_SECRET = "59465708774c241ff19872def99e4cd896453d661241df971cedf4077694e809";

// Generate timestamp
const timestamp = Date.now();

// Create request body for SOL futures order
const requestBody = {
  "timestamp": timestamp,
  "side": "buy", 
  "pair": "B-SOL_USDT",
  "order_type": "limit",
  "price": 220,
  "total_quantity": 1,
  "leverage": 50
};

console.log("🚀 Request Body:");
console.log(JSON.stringify(requestBody, null, 2));

// Convert to JSON string for signature
const payload = JSON.stringify(requestBody);

// Generate HMAC-SHA256 signature
const signature = crypto
  .createHmac('sha256', API_SECRET)
  .update(payload)
  .digest('hex');

console.log("🔐 Signature:", signature);

// Prepare request options
const options = {
  hostname: 'api.coindcx.com',
  port: 443,
  path: '/exchange/v1/derivatives/futures/orders/create',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-AUTH-APIKEY': API_KEY,
    'X-AUTH-SIGNATURE': signature,
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log("📤 Making request to CoinDCX...");

// Make the request
const req = https.request(options, (res) => {
  console.log(`📊 Status: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log("🎯 Response Body:");
    try {
      const response = JSON.parse(data);
      console.log(JSON.stringify(response, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request Error:', error);
});

// Send the request
req.write(payload);
req.end();
