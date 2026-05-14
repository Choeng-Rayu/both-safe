#!/bin/bash
set -e

SELLER_COOKIE=$(curl -s -X POST http://localhost:3003/v1/auth/login -H "Content-Type: application/json" -d '{"email":"testseller@example.com","password":"testpassword123"}' -D - | grep -i set-cookie | head -1 | sed 's/Set-Cookie: \([^;]*\).*/\1/')
BUYER_COOKIE=$(curl -s -X POST http://localhost:3003/v1/auth/login -H "Content-Type: application/json" -d '{"email":"testbuyer@example.com","password":"testpassword123"}' -D - | grep -i set-cookie | head -1 | sed 's/Set-Cookie: \([^;]*\).*/\1/')
echo "Seller: ${SELLER_COOKIE:0:30}..."
echo "Buyer: ${BUYER_COOKIE:0:30}..."

DEAL=$(curl -s -X POST http://localhost:3003/v1/deals -H "Content-Type: application/json" -H "Cookie: $SELLER_COOKIE" -d '{"source":"web","creator_role":"seller","language":"en","product_title":"Dispute Curl","amount":50,"currency":"USD","creator_name":"Dispute Seller"}')
PUBLIC_ID=$(echo $DEAL | python3 -c "import sys,json; print(json.load(sys.stdin).get('public_id',''))")
CREATOR_ACCESS=$(echo $DEAL | python3 -c "import sys,json; print(json.load(sys.stdin).get('creator_access_url',''))" | python3 -c "import sys,urllib.parse; print(urllib.parse.parse_qs(urllib.parse.urlparse(sys.stdin.read().strip()).query).get('access',[''])[0])")
INVITE=$(echo $DEAL | python3 -c "import sys,json; print(json.load(sys.stdin).get('invite_url',''))" | python3 -c "import sys,urllib.parse; print(urllib.parse.parse_qs(urllib.parse.urlparse(sys.stdin.read().strip()).query).get('invite',[''])[0])")
echo "Deal: $PUBLIC_ID"

JOIN=$(curl -s -X POST "http://localhost:3003/v1/deals/${PUBLIC_ID}/join?invite=${INVITE}" -H "Content-Type: application/json" -H "Cookie: $BUYER_COOKIE" -d "{\"invite_token\":\"${INVITE}\",\"role\":\"buyer\",\"name\":\"Dispute Buyer\",\"preferred_language\":\"en\"}")
BUYER_ACCESS=$(echo $JOIN | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
echo "Join: $(echo $JOIN | python3 -c "import sys,json; print(json.load(sys.stdin).get('status'))")"

# Approve seller
curl -s -X POST "http://localhost:3003/v1/deals/${PUBLIC_ID}/approval?access=${CREATOR_ACCESS}" -H "Cookie: $SELLER_COOKIE" > /tmp/approve-seller.log
echo "Seller approved"

# Update payout
curl -s -X PATCH "http://localhost:3003/v1/deals/${PUBLIC_ID}/sections/payout?access=${CREATOR_ACCESS}" -H "Content-Type: application/json" -H "Cookie: $SELLER_COOKIE" -d '{"payout_khqr":"test@aba","payout_bank_name":"ABA","payout_account_name":"Test","payout_account_number":"123"}' > /tmp/payout.log
echo "Payout updated"

# Get deal status
STATUS=$(curl -s "http://localhost:3003/v1/deals/${PUBLIC_ID}?access=${CREATOR_ACCESS}" -H "Cookie: $SELLER_COOKIE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('status:', d.get('status'), 'missing:', d.get('missing_fields'), 'approved:', [p.get('approved_at') for p in d.get('participants',[])])")
echo "Deal state: $STATUS"

# Approve buyer
APPROVE=$(curl -s -X POST "http://localhost:3003/v1/deals/${PUBLIC_ID}/approval?access=${BUYER_ACCESS}" -H "Cookie: $BUYER_COOKIE")
echo "Buyer approve: $(echo $APPROVE | python3 -c "import sys,json; d=json.load(sys.stdin); print('status:', d.get('status'), 'missing:', d.get('missing_fields'))")"

# Payment proof
PAYMENT=$(curl -s -X POST "http://localhost:3003/v1/deals/${PUBLIC_ID}/payment-proofs?access=${BUYER_ACCESS}" -H "Cookie: $BUYER_COOKIE" -F "paid_amount=50" -F "buyer_note=test")
echo "Payment proof: $PAYMENT"
