const crypto = require('crypto');

const API_KEY = "4d489c26282861673fe7d497cb91eb25096e4b67cbfd1dc5";
const API_SECRET = "59465708774c241ff19872def99e4cd896453d661241df971cedf4077694e809";

async function checkEndpoint(path, method = 'GET', body = null) {
  const timestamp = Date.now();
  let payload = '';
  
  if (body) {
    body.timestamp = timestamp;
    payload = JSON.stringify(body);
  }
  
  const signature = crypto.createHmac('sha256', API_SECRET).update(payload).digest('hex');
  
  console.log(`🧪 Testing ${method} ${path}`);
  
  try {
    const response = await fetch(`https://api.coindcx.com${path}`, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': API_KEY,
        'X-AUTH-SIGNATURE': signature
      },
      body: payload || undefined
    });
    
    const data = await response.text();
    console.log(`📊 Status: ${response.status}`);
    console.log(`🎯 Response: ${data}`);
    
    // Try to parse as JSON
    try {
      const jsonData = JSON.parse(data);
      console.log(`📋 Parsed:`, JSON.stringify(jsonData, null, 2));
    } catch (e) {
      // Response is not JSON
    }
    
    console.log('---\n');
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
  }
}

async function runChecks() {
  console.log("🔍 Checking CoinDCX Account Status & Permissions...\n");
  
  // 1. Check account details
  await checkEndpoint('/exchange/v1/account/balances');
  
  // 2. Check futures wallet  
  await checkEndpoint('/exchange/v1/derivatives/futures/wallet-balance');
  
  // 3. Check active positions
  await checkEndpoint('/exchange/v1/derivatives/futures/positions');
  
  // 4. Check futures trading info
  await checkEndpoint('/exchange/v1/derivatives/futures/trading-info');
  
  // 5. Test simple market data (no auth needed)
  await checkEndpoint('/exchange/v1/derivatives/futures/markets');
}

runChecks();
