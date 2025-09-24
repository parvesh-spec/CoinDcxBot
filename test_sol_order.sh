#!/bin/bash

# CoinDCX API credentials
API_KEY="4d489c26282861673fe7d497cb91eb25096e4b67cbfd1dc5"
API_SECRET="59465708774c241ff19872def99e4cd896453d661241df971cedf4077694e809"

# Generate timestamp
TIMESTAMP=$(date +%s%3N)

# Create request body for SOL futures order
REQUEST_BODY='{
  "timestamp": '$TIMESTAMP',
  "side": "buy",
  "pair": "B-SOL_USDT",
  "order_type": "limit",
  "price": 220,
  "total_quantity": 1,
  "leverage": 50
}'

echo "🚀 Request Body:"
echo "$REQUEST_BODY" | jq .

# Generate HMAC-SHA256 signature
SIGNATURE=$(echo -n "$REQUEST_BODY" | openssl dgst -sha256 -hmac "$API_SECRET" -binary | xxd -p -c 256)

echo "🔐 Signature: $SIGNATURE"

# Make curl request
curl -X POST "https://api.coindcx.com/exchange/v1/derivatives/futures/orders/create" \
  -H "Content-Type: application/json" \
  -H "X-AUTH-APIKEY: $API_KEY" \
  -H "X-AUTH-SIGNATURE: $SIGNATURE" \
  -d "$REQUEST_BODY" \
  -v

