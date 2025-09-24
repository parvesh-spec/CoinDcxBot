const crypto = require('crypto');

const API_KEY = "4d489c26282861673fe7d497cb91eb25096e4b67cbfd1dc5";
const API_SECRET = "59465708774c241ff19872def99e4cd896453d661241df971cedf4077694e809";

async function testSOLWithStopLossTarget() {
  console.log("🚀 SOL Order with STOP LOSS & TARGET\n");
  
  const timeStamp = Math.floor(Date.now());

  // SOL order with SL & TP - Current market ~$218
  const entryPrice = 216;     // Entry price
  const stopLoss = 210;       // Stop loss at $210 (2.8% loss)
  const target = 225;         // Target at $225 (4.2% profit)

  const body = {
    "timestamp": timeStamp,
    "order": {
      "side": "buy", 
      "pair": "B-SOL_USDT",
      "order_type": "limit_order",
      "price": entryPrice,
      "total_quantity": 1,
      "leverage": 50,
      "stop_loss_price": stopLoss,      // Add stop loss
      "take_profit_price": target,      // Add take profit
      "notification": "email_notification",
      "time_in_force": "good_till_cancel",
      "hidden": false,
      "post_only": false
    }
  };

  console.log("📊 SOL Order with SL/TP:");
  console.log(JSON.stringify(body, null, 2));
  console.log(`💰 Entry: $${entryPrice} | SL: $${stopLoss} | TP: $${target}`);
  console.log(`📊 Risk: ${((entryPrice - stopLoss) / entryPrice * 100).toFixed(1)}% | Reward: ${((target - entryPrice) / entryPrice * 100).toFixed(1)}%`);
  
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
    
    if (responseText) {
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log("✅ Parsed Response:", JSON.stringify(jsonResponse, null, 2));
        
        if (response.status === 200 && jsonResponse.length > 0) {
          const order = jsonResponse[0];
          console.log(`\n🎉 SUCCESS! SOL ORDER WITH SL/TP CREATED! 🎉`);
          console.log(`💰 Order ID: ${order.id}`);
          console.log(`📊 Pair: ${order.pair}`);
          console.log(`💵 Entry Price: $${order.price}`);
          console.log(`📈 Quantity: ${order.total_quantity} SOL`);
          console.log(`⚡ Leverage: ${order.leverage}x`);
          console.log(`🛡️ Stop Loss: $${order.stop_loss_price || 'Not set'}`);
          console.log(`🎯 Take Profit: $${order.take_profit_price || 'Not set'}`);
          console.log(`📊 Status: ${order.status}`);
          console.log(`💰 Required Margin: ${order.ideal_margin} USDT`);
        } else if (jsonResponse.status === "error") {
          console.log(`❌ Order Failed: ${jsonResponse.message}`);
        }
      } catch (e) {
        console.log("⚠️ Response is not JSON:", responseText);
      }
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testSOLWithStopLossTarget();
