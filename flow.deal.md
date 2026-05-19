# BothSafe Deal Flow

## Flow A: Seller Creates The Deal

1. Seller: "I sign in to BothSafe."

   Fill one login method:
   - Email and password
   - Telegram login
   - Google login

2. Seller: "I create a new protected deal as the seller."

   Fill required deal info:
   - Your name
   - Product title
   - Deal amount
   - Currency: USD or KHR

    remove this {
        Fill optional deal info:
   - Phone number
   - Product type
   - Product description
   - Seller payout KHQR
   - Payout bank name
   - Payout account name
   - Payout account number }

3. System: "The Deal Room is created."

   System creates:
   - Deal public id
   - Seller private creator link
   - Buyer invite link

   Seller receives:
   - Private creator link: `https://bothsafe.app/d/{publicId}?access={creatorAccessToken}`
   - Invite link: `https://bothsafe.app/d/{publicId}?invite={inviteToken}`

   Current status:
   - `AWAITING_COUNTERPARTY`

4. Seller: "I keep my private link safe."

   Seller should not send this link:
   - `https://bothsafe.app/d/{publicId}?access={creatorAccessToken}`

   Reason:
   - Anyone with this private link can access the seller side of the deal.

5. Seller: "I send only the invite link to the buyer."

   Seller sends:
   - `https://bothsafe.app/d/{publicId}?invite={inviteToken}`

   Seller can send it through:
   - Telegram
   - Messenger
   - WeChat
   - Facebook
   - Any chat app

6. Buyer: "I click the invite link."

   Buyer sees preview info:
   - Product title
   - Deal amount
   - Currency

   Buyer does not see private seller access token.

7. Buyer: "I sign in before joining."

   Fill one login method if not already logged in:
   - Email and password
   - Telegram login
   - Google login

8. Buyer: "I join this deal as the buyer."

   Fill required join info:
   - Role: buyer
   - Buyer name

   Fill optional join info:
   - Buyer phone number

   System creates buyer private access:
   - `https://bothsafe.app/d/{publicId}?access={buyerAccessToken}`

   Current status:
   - `AWAITING_BOTH_APPROVAL`

9. System: "The invite link is now used."

   System invalidates:
   - Original invite token

   Reason:
   - No third person can join with the same invite link after the buyer joins.

10. Buyer and Seller: "We review the Deal Room."

    Both sides review:
    - Product title
    - Product type
    - Product description
    - Quantity
    - Condition
    - Deal amount
    - Currency
    - Buyer name
    - Seller name
    - Price summary
    - Missing fields checklist
    - Timeline

11. Buyer and Seller: "We complete any missing required fields."

    Required before payment:
    - Product title
    - Product type
    - Deal amount
    - Buyer name
    - Seller name

    If any of these are missing, the deal cannot move to payment.

12. Buyer or Seller: "I edit product info if needed."

    Fill or edit:
    - Product title
    - Product type
    - Product description
    - Quantity
    - Condition
    - Deal amount
    - Currency

    Important:
    - If product title, description, amount, or currency changes, previous approvals reset.
    - Both sides must approve again after important deal changes.

13. Buyer or Seller: "I edit my own participant info if needed."

    Fill or edit:
    - Name
    - Phone number
    - Preferred language
    - Telegram chat id
    - WeChat id
    - Messenger name

14. Seller: "I approve the deal terms."

    Fill:
    - No extra fields

    Action:
    - Click `Approve deal`

    Result:
    - Seller approval is saved.

15. Buyer: "I approve the deal terms."

    Fill:
    - No extra fields

    Action:
    - Click `Approve deal`

    Result:
    - Buyer approval is saved.

16. System: "Both sides approved and all required fields are complete."

    Current status:
    - `READY_FOR_PAYMENT`

    Meaning:
    - Buyer can now pay BothSafe.
    - Seller waits for payment confirmation.

17. Buyer: "I pay BothSafe, not the seller."

    Payment option 1: BothSafe Wallet

    Required:
    - Buyer must have enough wallet balance.

    Action:
    - Click `Pay now`

    Result:
    - Payment is verified automatically.
    - Status moves to `SELLER_PREPARING`.

18. Buyer: "If I do not use wallet, I pay by Bakong KHQR."

    Buyer sees:
    - Amount due
    - Currency
    - BothSafe receiver account
    - BothSafe Bakong account id
    - KHQR code
    - Reference note

    Buyer action:
    - Scan the KHQR with Bakong or banking app
    - Or tap `Open Bakong App to Pay`

19. Buyer: "After paying by KHQR, I save payment details in the Deal Room."

    Fill optional payment info:
    - Paid amount
    - Receipt screenshot, image, or PDF
    - Buyer note

    Action:
    - Click `Save receipt details`

    Current status:
    - `PAYMENT_PENDING_VERIFICATION`

20. System or Admin: "Payment is checked."

    If Bakong auto-check succeeds:
    - Payment is verified automatically.

    If auto-check is not available:
    - Admin manually verifies or rejects the payment.

    If payment is verified:
    - Status moves to `SELLER_PREPARING`

    If payment is rejected:
    - Status returns to `READY_FOR_PAYMENT`
    - Buyer must pay again or upload corrected payment details.

21. Seller: "I see the payment is confirmed, so I prepare the item."

    Current status:
    - `SELLER_PREPARING`

    Seller action:
    - Pack the item
    - Arrange delivery

22. Seller: "I upload shipping proof."

    Fill optional shipping info:
    - Delivery company
    - Tracking number
    - Package photo
    - Delivery receipt
    - Seller note

    Action:
    - Click `Send shipping proof`

    Current status:
    - `SHIPPED`

23. Buyer: "I check the shipping proof."

    Buyer sees:
    - Delivery company if provided
    - Tracking number if provided
    - Package photo if provided
    - Delivery receipt if provided
    - Seller note if provided

24. Buyer: "I receive the item."

    Buyer chooses one action:
    - Confirm received
    - Open dispute

25. Buyer: "The item is correct, so I confirm received."

    Fill:
    - No extra fields

    Action:
    - Click `Confirm received`
    - Confirm in the dialog

    Current status:
    - `RELEASE_PENDING`

26. Admin: "I release escrow to the seller."

    Fill required:
    - Payout reference

    Fill optional:
    - Admin note
    - Idempotency key

    Result:
    - Seller receives the net seller amount in their BothSafe wallet.
    - Ledger records seller payout.

    Final status:
    - `RELEASED`

27. Seller: "I withdraw money from my BothSafe wallet."

    Fill withdrawal info:
    - Currency
    - Amount
    - Destination type: Bakong KHQR or bank account

    If destination is Bakong KHQR, fill:
    - KHQR string or QR image

    If destination is bank account, fill:
    - Bank name
    - Account name
    - Account number

    Result:
    - Admin reviews and processes the withdrawal separately.

## Flow B: Buyer Creates The Deal

1. Buyer: "I sign in to BothSafe."

   Fill one login method:
   - Email and password
   - Telegram login
   - Google login

2. Buyer: "I create a new protected deal as the buyer."

   Fill required deal info:
   - Your name
   - Product title
   - Deal amount
   - Currency: USD or KHR

   Fill optional deal info:
   - Phone number
   - Product type
   - Product description or note

3. System: "The Deal Room is created."

   Buyer receives:
   - Private creator link: `https://bothsafe.app/d/{publicId}?access={creatorAccessToken}`
   - Seller invite link: `https://bothsafe.app/d/{publicId}?invite={inviteToken}`

   Current status:
   - `AWAITING_COUNTERPARTY`

4. Buyer: "I keep my private link safe and send only the invite link to the seller."

   Buyer sends:
   - `https://bothsafe.app/d/{publicId}?invite={inviteToken}`

5. Seller: "I click the invite link."

   Seller sees preview info:
   - Product title
   - Deal amount
   - Currency

6. Seller: "I sign in before joining."

   Fill one login method if not already logged in:
   - Email and password
   - Telegram login
   - Google login

7. Seller: "I join this deal as the seller."

   Fill required join info:
   - Role: seller
   - Seller name

   Fill optional join info:
   - Seller phone number

   System creates seller private access:
   - `https://bothsafe.app/d/{publicId}?access={sellerAccessToken}`

   Current status:
   - `AWAITING_BOTH_APPROVAL`

8. Buyer and Seller: "We review and complete the deal."

   Required before payment:
   - Product title
   - Product type
   - Deal amount
   - Buyer name
   - Seller name

   Optional fields either side can add before payment:
   - Product description
   - Quantity
   - Condition
   - Phone number
   - Preferred language
   - Telegram chat id
   - WeChat id
   - Messenger name

9. Seller: "I approve the deal terms."

   Fill:
   - No extra fields

   Action:
   - Click `Approve deal`

10. Buyer: "I approve the deal terms."

    Fill:
    - No extra fields

    Action:
    - Click `Approve deal`

11. System: "Both sides approved and all required fields are complete."

    Current status:
    - `READY_FOR_PAYMENT`

12. Buyer: "I pay BothSafe."

    Payment option 1:
    - Pay with BothSafe Wallet if balance is enough.

    Payment option 2:
    - Pay with Bakong KHQR.
    - Optionally save paid amount, receipt file, and buyer note.

13. System or Admin: "Payment is verified."

    Current status after verification:
    - `SELLER_PREPARING`

14. Seller: "I ship the item and upload shipping proof."

    Fill optional shipping info:
    - Delivery company
    - Tracking number
    - Package photo
    - Delivery receipt
    - Seller note

    Current status:
    - `SHIPPED`

15. Buyer: "I receive the item."

    Buyer chooses:
    - Confirm received
    - Open dispute

16. If buyer confirms received:

    Current status:
    - `RELEASE_PENDING`

    Admin releases payment:
    - Seller wallet gets credited.

    Final status:
    - `RELEASED`

17. If buyer or seller opens dispute:

    Current status:
    - `DISPUTED`

    Admin resolves:
    - Release to seller, final status `RELEASED`
    - Refund to buyer, final status `REFUNDED`

## Dispute Flow

1. Buyer or Seller: "There is a problem, so I open a dispute."

   Dispute can be opened after payment flow starts, including:
   - `PAYMENT_PENDING_VERIFICATION`
   - `PAID_ESCROWED`
   - `SELLER_PREPARING`
   - `SHIPPED`

2. Buyer or Seller: "I fill the dispute form."

   Fill required:
   - Reason
   - Message

   Fill optional:
   - Evidence file

   Reason options:
   - `ITEM_NOT_RECEIVED`
   - `WRONG_ITEM`
   - `DAMAGED_ITEM`
   - `FAKE_ITEM`
   - `PAYMENT_PROBLEM`
   - `OTHER`

   Current status:
   - `DISPUTED`

3. Admin: "I review the dispute."

   Admin reviews:
   - Deal details
   - Payment proof
   - Shipping proof
   - Dispute reason
   - Dispute message
   - Evidence files
   - Timeline
   - Audit log

4. Admin: "I decide to release or refund."

   If admin releases:
   - Fill payout reference
   - Optional admin note
   - Seller wallet gets credited
   - Final status becomes `RELEASED`

   If admin refunds:
   - Fill refund reference
   - Optional admin note
   - Buyer wallet gets credited
   - Final status becomes `REFUNDED`

## Telegram Create Flow

1. User: "I open the BothSafe Telegram bot."

   Action:
   - Send `/start`

2. Bot: "I show the main menu."

   Menu options:
   - Create deal
   - My deals
   - Language
   - Help

3. User: "I start a new deal."

   Action:
   - Send `/newdeal`
   - Or tap Create deal

4. Bot: "What is your role?"

   User chooses:
   - Seller
   - Buyer

5. Bot: "What is the product title?"

   Fill required:
   - Product title

6. Bot: "What is the price?"

   Fill required:
   - Deal amount

7. If creator is seller, Bot: "What is the product type?"

   Fill optional:
   - Product type
   - Or skip

8. If creator is buyer, Bot: "Add a note."

   Fill optional:
   - Product description or note
   - Or skip

9. System: "Telegram deal is created."

   Bot sends:
   - Private creator link
   - Counterparty invite link

10. User: "I send the invite link to the other party."

    After this point, both parties continue in the web Deal Room for:
    - Joining
    - Reviewing fields
    - Editing deal info
    - Approving
    - Buyer payment
    - Seller shipping proof
    - Buyer confirmation
    - Dispute
    - Admin release or refund
    - Wallet withdrawal
