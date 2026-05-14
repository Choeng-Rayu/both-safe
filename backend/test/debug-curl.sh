#!/bin/bash
set -e

SELLER_COOKIE=$(curl -s -X POST http://localhost:3003/v1/auth/login -H "Content-Type: application/json" -d '{"email":"testseller@example.com","password":"testpassword123"}' -D - | grep -i set-cookie | head -1 | sed 's/Set-Cookie: \([^;]*\).*/\1/')
BUYER_COOKIE=$(curl -s -X POST http://localhost:3003/v1/auth/login -H "Content-Type: application/json" -d '{"email":"testbuyer@example.com","password":"testpassword123"}' -D - | grep -i set-cookie | head -1 | sed 's/Set-Cookie: \([^;]*\).*/\1/')
echo "Seller cookie: ${SELLER_COOKIE:0:30}..."
echo "Buyer cookie: ${BUYER_COOKIE:0:30}..."

# Create deal
DEAL=$(curl -s -X POST http://localhost:3003/v1/deals -H "Content-Type: application/json" -H "Cookie: $SELLER_COOKIE" -d '{"source":"web","creator_role":"seller","language":"en","product_title":"Curl Test","product_type":"electronics","amount":100,"currency":"USD","creator_name":"Curl Seller","creator_phone":"+85512345678"}')
echo "Deal status: $(echo $DEAL | python3 -c "import sys,json; print(json.load(sys.stdin).get('status'))")"
PUBLIC_ID=$(echo $DEAL | python3 -c "import sys,json; print(json.load(sys.stdin).get('public_id',''))")
CREATOR_ACCESS=$(echo $DEAL | python3 -c "import sys,json; print(json.load(sys.stdin).get('creator_access_url',''))" | python3 -c "import sys,urllib.parse; print(urllib.parse.parse_qs(urllib.parse.urlparse(sys.stdin.read().strip()).query).get('access',[''])[0])")
INVITE=$(echo $DEAL | python3 -c "import sys,json; print(json.load(sys.stdin).get('invite_url',''))" | python3 -c "import sys,urllib.parse; print(urllib.parse.parse_qs(urllib.parse.urlparse(sys.stdin.read().strip()).query).get('invite',[''])[0])")
echo "Public ID: $PUBLIC_ID"

# Join as buyer
JOIN=$(curl -s -X POST "http://localhost:3003/v1/deals/${PUBLIC_ID}/join?invite=${INVITE}" -H "Content-Type: application/json" -H "Cookie: $BUYER_COOKIE" -d "{\"invite_token\":\"${INVITE}\",\"role\":\"buyer\",\"name\":\"Curl Buyer\",\"preferred_language\":\"en\"}")
echo "Join status: $(echo $JOIN | python3 -c "import sys,json; print(json.load(sys.stdin).get('status'))")"
BUYER_ACCESS=$(echo $JOIN | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
echo "Buyer access: ${BUYER_ACCESS:0:30}..."

# Update payout
curl -s -X PATCH "http://localhost:3003/v1/deals/${PUBLIC_ID}/sections/payout?access=${CREATOR_ACCESS}" -H "Content-Type: application/json" -H "Cookie: $SELLER_COOKIE" -d '{"payout_khqr":"test@aba","payout_bank_name":"ABA","payout_account_name":"Test","payout_account_number":"123"}' > /tmp/curl-payout.log

# Approve seller
curl -s -X POST "http://localhost:3003/v1/deals/${PUBLIC_ID}/approval?access=${CREATOR_ACCESS}" -H "Cookie: $SELLER_COOKIE" > /tmp/curl-approve-seller.log

# Approve buyer
APPROVE=$(curl -s -X POST "http://localhost:3003/v1/deals/${PUBLIC_ID}/approval?access=${BUYER_ACCESS}" -H "Cookie: $BUYER_COOKIE")
echo "After buyer approve: $(echo $APPROVE | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status'), d.get('message_key'))")"

# Now test payment proof with multipart using curl
PAYMENT=$(curl -s -X POST "http://localhost:3003/v1/deals/${PUBLIC_ID}/payment-proofs?access=${BUYER_ACCESS}" -H "Cookie: $BUYER_COOKIE" -F "paid_amount=100" -F "buyer_note=test payment")
echo "Payment proof response: $PAYMENT"

# Test shipping with multipart
SHIP=$(curl -s -X POST "http://localhost:3003/v1/deals/${PUBLIC_ID}/shipping-proofs?access=${CREATOR_ACCESS}" -H "Cookie: $SELLER_COOKIE" -F "delivery_company=Test" -F "tracking_number=TEST123")
echo "Shipping proof response: $SHIP"
