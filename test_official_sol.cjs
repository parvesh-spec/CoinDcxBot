const crypto = require('crypto');

const API_KEY = "4d489c26282861673fe7d497cb91eb25096e4b67cbfd1dc5";
const API_SECRET = "59465708774c241ff19872def99e4cd896453d661241df971cedf4077694e809";

async function testOfficialSOLOrder() {
  console.log("🚀 Testing SOL Order with OFFICIAL CoinDCX Format\n");
  
  const timeStamp = Math.floor(Date.now());
  console.log("⏰ Timestamp:", timeStamp);

  // Official CoinDCX format - exactly as per documentation
  const body = {
    "timestamp": timeStamp,
    "order": {
      "side": "buy", 
      "pair": "B-SOL_USDT",
      "order_type": "limit_order", // Official format
      "price": 220,
      "total_quantity": 1,
      "leverage": 50,
      "notification": "email_notification",
      "time_in_force": "good_till_cancel",
      "hidden": false,
      "post_only": false
    }
  };

  console.log("📊 Official Request Body:");
  console.log(JSON.stringify(body, null, 2));
  
  const payload = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', API_SECRET).update(payload).digest('hex');
  
  console.log("🔐 Signature:", signature.substring(0, 16) + "...");

  const options = {
    method: 'POST',
    headers: {
      'X-AUTH-APIKEY': API_KEY,
      'X-AUTH-SIGNATURE': signature,
      'Content-Type': 'application/json'
    },
    body: payload
  };

  try {
    const response = await fetch("https://api.coindcx.com/exchange/v1/derivatives/futures/orders/create", options);
    
    const responseText = await response.text();
    
    console.log(`\n📊 Status: ${response.status} ${response.statusText}`);
    console.log(`🎯 Response: ${responseText}`);
    
    if (responseText) {
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log("✅ Parsed Response:", JSON.stringify(jsonResponse, null, 2));
        
        if (jsonResponse.id) {
          console.log(`🎉 SUCCESS! Order ID: ${jsonResponse.id}`);
        }
      } catch (e) {
        console.log("⚠️ Response is not JSON");
      }
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testOfficialSOLOrder();
