const crypto = require('crypto');

const API_KEY = "4d489c26282861673fe7d497cb91eb25096e4b67cbfd1dc5";
const API_SECRET = "59465708774c241ff19872def99e4cd896453d661241df971cedf4077694e809";

async function testCorrectPriceSOL() {
  console.log("🚀 SOL Order with CORRECT MARKET PRICE\n");
  
  const timeStamp = Math.floor(Date.now());

  // Official CoinDCX format with correct price
  const body = {
    "timestamp": timeStamp,
    "order": {
      "side": "buy", 
      "pair": "B-SOL_USDT",
      "order_type": "limit_order",
      "price": 218, // Below 218.94 as requested by API
      "total_quantity": 1,
      "leverage": 50,
      "notification": "email_notification",
      "time_in_force": "good_till_cancel",
      "hidden": false,
      "post_only": false
    }
  };

  console.log("📊 SOL Order (Price: $218):");
  console.log(JSON.stringify(body, null, 2));
  
  const payload = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', API_SECRET).update(payload).digest('hex');

  try {
    const response = await fetch("https://api.coindcx.com/exchange/v1/derivatives/futures/orders/create", {
      method: 'POST',
      headers: {
        'X-AUTH-APIKEY': API_KEY,
        'X-AUTH-SIGNATURE': signature,
        'Content-Type': 'application/json'
      },
      body: payload
    });
    
    const responseText = await response.text();
    
    console.log(`\n📊 Status: ${response.status} ${response.statusText}`);
    console.log(`🎯 Response: ${responseText}`);
    
    if (responseText) {
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log("✅ Parsed Response:", JSON.stringify(jsonResponse, null, 2));
        
        if (jsonResponse.id) {
          console.log(`🎉 🎉 SUCCESS! SOL FUTURES ORDER PLACED! 🎉 🎉`);
          console.log(`💰 Order ID: ${jsonResponse.id}`);
          console.log(`📊 Pair: ${jsonResponse.pair}`);
          console.log(`💵 Price: $${jsonResponse.price}`);
          console.log(`📈 Quantity: ${jsonResponse.total_quantity} SOL`);
          console.log(`⚡ Leverage: ${jsonResponse.leverage}x`);
        } else if (jsonResponse.status === "error") {
          console.log(`❌ Order Failed: ${jsonResponse.message}`);
        }
      } catch (e) {
        console.log("⚠️ Response is not JSON");
      }
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testCorrectPriceSOL();
