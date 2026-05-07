/**
 * Bot localization messages.
 * Keys follow the bot.* convention from AGENTS.md.
 * Fallback language is always English.
 */
export type BotLang = 'km' | 'en' | 'zh';

const messages: Record<string, Record<BotLang, string>> = {
  // ── /start ─────────────────────────────────────────────────────────
  'bot.start.title': {
    km: '🛡️ ស្វាគមន៍មកកាន់ BothSafe!\nយើងជាប្រព័ន្ធ Escrow សម្រាប់ការទូទាត់ប្រាក់ដែលមានសុវត្ថិភាព។\nអ្នកអាចបង្កើតដំណើរការទូទាត់ការពារបាន!',
    en: '🛡️ Welcome to BothSafe!\nWe are a secure escrow payment system for safe transactions.\nYou can create protected deals directly from Telegram!',
    zh: '🛡️ 欢迎使用 BothSafe！\n我们是安全的代管支付系统。\n您可以直接从 Telegram 创建受保护的交易！',
  },
  // ── menu buttons ────────────────────────────────────────────────────
  'bot.menu.create_deal': {
    km: '➕ បង្កើតការទូទាត់ការពារ',
    en: '➕ Create Protected Deal',
    zh: '➕ 创建受保护交易',
  },
  'bot.menu.my_deals': {
    km: '📋 ការទូទាត់របស់ខ្ញុំ',
    en: '📋 My Deals',
    zh: '📋 我的交易',
  },
  'bot.menu.language': {
    km: '🌐 ភាសា',
    en: '🌐 Language',
    zh: '🌐 语言',
  },
  'bot.menu.help': {
    km: '❓ ជំនួយ',
    en: '❓ Help',
    zh: '❓ 帮助',
  },
  // ── role selection ───────────────────────────────────────────────────
  'bot.role.ask': {
    km: 'អ្នកជានរណា?',
    en: 'What is your role in this deal?',
    zh: '您在此交易中的角色是什么？',
  },
  'bot.role.seller': {
    km: '🏪 ខ្ញុំជាអ្នកលក់',
    en: '🏪 I am Seller',
    zh: '🏪 我是卖家',
  },
  'bot.role.buyer': {
    km: '🛒 ខ្ញុំជាអ្នកទិញ',
    en: '🛒 I am Buyer',
    zh: '🛒 我是买家',
  },
  // ── new deal flow ────────────────────────────────────────────────────
  'bot.deal.ask_title': {
    km: '📦 តើផលិតផលអ្វីដែលអ្នកលក់/ទិញ? (ឈ្មោះផលិតផល)',
    en: '📦 What product are you selling/buying? (Product title)',
    zh: '📦 您要出售/购买什么产品？（产品名称）',
  },
  'bot.deal.ask_price': {
    km: '💰 តើតម្លៃជាប៉ុន្មាន? (ជា USD, ឧ. 25.00)',
    en: '💰 What is the price? (in USD, e.g. 25.00)',
    zh: '💰 价格是多少？（以美元计，例如 25.00）',
  },
  'bot.deal.ask_type_seller': {
    km: '🏷️ តើប្រភេទផលិតផលអ្វី? (ជម្រើស — ចុច Skip ដើម្បីរំលង)',
    en: '🏷️ Product type? (Optional — tap Skip to skip)',
    zh: '🏷️ 产品类型？（可选 — 点击跳过）',
  },
  'bot.deal.ask_note_buyer': {
    km: '📝 មានកំណត់ចំណាំអ្វីទៅអ្នកលក់? (ជម្រើស — ចុច Skip ដើម្បីរំលង)',
    en: '📝 Any note to the seller? (Optional — tap Skip to skip)',
    zh: '📝 给卖家的备注？（可选 — 点击跳过）',
  },
  'bot.deal.skip': {
    km: '⏭️ រំលង',
    en: '⏭️ Skip',
    zh: '⏭️ 跳过',
  },
  'bot.deal.cancel': {
    km: '❌ លុបចោល',
    en: '❌ Cancel',
    zh: '❌ 取消',
  },
  'bot.deal.creating': {
    km: '⏳ កំពុងបង្កើតការទូទាត់ ...',
    en: '⏳ Creating your deal ...',
    zh: '⏳ 正在创建您的交易...',
  },
  'bot.deal.created': {
    km: '✅ ការទូទាត់ត្រូវបានបង្កើតហើយ!',
    en: '✅ Deal created successfully!',
    zh: '✅ 交易创建成功！',
  },
  'bot.deal.cancelled': {
    km: '❌ ការទូទាត់ត្រូវបានលុបចោល។',
    en: '❌ Deal flow cancelled.',
    zh: '❌ 交易流程已取消。',
  },
  // ── links ─────────────────────────────────────────────────────────────
  'bot.link.private_warning': {
    km: '🔐 តំណរភ្ជាប់ *ឯកជន* របស់អ្នក (ត្រូវការ!)\nកុំចែករំលែកតំណរនេះ — វាជាតំណរចូលផ្ទាល់ខ្លួនរបស់អ្នក:',
    en: '🔐 Your *Private* link (Keep this safe!)\nDo NOT share this link — it is your personal access link:',
    zh: '🔐 您的*私人*链接（请妥善保管！）\n请勿分享此链接 — 这是您的个人访问链接：',
  },
  'bot.link.share_this': {
    km: '📤 ចែករំលែកតំណរនេះជាមួយភាគីម្ខាងទៀត:',
    en: '📤 Share this link with the other party:',
    zh: '📤 将此链接分享给另一方：',
  },
  'bot.link.open_deal_room': {
    km: '🌐 បើក Deal Room',
    en: '🌐 Open Deal Room',
    zh: '🌐 打开交易室',
  },
  'bot.link.share_invite': {
    km: '📤 ចែករំលែកតំណរអញ្ជើញ',
    en: '📤 Share Invite Link',
    zh: '📤 分享邀请链接',
  },
  // ── my deals ─────────────────────────────────────────────────────────
  'bot.mydeals.title': {
    km: '📋 ការទូទាត់ចុងក្រោយរបស់អ្នក:',
    en: '📋 Your recent deals:',
    zh: '📋 您最近的交易：',
  },
  'bot.mydeals.empty': {
    km: '😕 អ្នកមិនទាន់មានការទូទាត់ណាមួយទេ។ ចុច "➕ បង្កើតការទូទាត់ការពារ" ដើម្បីចាប់ផ្តើម!',
    en: '😕 You have no deals yet. Tap "➕ Create Protected Deal" to get started!',
    zh: '😕 您还没有任何交易。点击"➕ 创建受保护交易"开始吧！',
  },
  // ── help ──────────────────────────────────────────────────────────────
  'bot.help.escrow_explain': {
    km: `❓ *តើ BothSafe ដំណើរការយ៉ាងដូចម្តេច?*

1️⃣ *ការទូទាត់* — អ្នកទិញបង់ប្រាក់ទៅ BothSafe (ការទូទាត់ Escrow)
2️⃣ *ការផ្ញើ* — BothSafe ជូនដំណឹងដល់អ្នកលក់ ហើយអ្នកលក់ផ្ញើទំនិញ
3️⃣ *ការបញ្ជាក់* — អ្នកទិញបញ្ជាក់ថាបានទទួលទំនិញ
4️⃣ *ការផ្ញើប្រាក់* — BothSafe ផ្ញើប្រាក់ទៅអ្នកលក់
5️⃣ *វិវាទ* — ប្រសិនបើមានបញ្ហា អ្នកអាចបើកវិវាទ ហើយ Admin នឹងពិនិត្យ`,
    en: `❓ *How does BothSafe work?*

1️⃣ *Payment* — Buyer pays BothSafe (escrow hold)
2️⃣ *Shipping* — BothSafe notifies seller; seller ships the item
3️⃣ *Confirmation* — Buyer confirms they received the item
4️⃣ *Payout* — BothSafe releases funds to the seller
5️⃣ *Dispute* — If there is an issue, open a dispute and admin will review`,
    zh: `❓ *BothSafe 如何运作？*

1️⃣ *付款* — 买家向 BothSafe 付款（托管保留）
2️⃣ *发货* — BothSafe 通知卖家；卖家发货
3️⃣ *确认* — 买家确认收到商品
4️⃣ *打款* — BothSafe 将资金释放给卖家
5️⃣ *争议* — 如有问题，可发起争议，管理员将进行审核`,
  },
  // ── errors ────────────────────────────────────────────────────────────
  'bot.error.invalid_amount': {
    km: '❌ ចំនួនទឹកប្រាក់មិនត្រឹមត្រូវ។ សូមបញ្ចូលជាលេខ ឧ. 25.00',
    en: '❌ Invalid amount. Please enter a number, e.g. 25.00',
    zh: '❌ 金额无效。请输入数字，例如 25.00',
  },
  'bot.error.session_expired': {
    km: '⏰ សមាជិកភាពផុតកំណត់ហើយ។ សូម /newdeal ឡើងវិញ។',
    en: '⏰ Session expired. Please start /newdeal again.',
    zh: '⏰ 会话已过期。请重新输入 /newdeal。',
  },
  'bot.error.unexpected': {
    km: '❌ មានបញ្ហាបច្ចេកទេស។ សូមព្យាយាមម្តងទៀតក្រោយ។',
    en: '❌ Something went wrong. Please try again later.',
    zh: '❌ 出现技术问题。请稍后再试。',
  },
  'bot.error.unknown_command': {
    km: '❓ ពាក្យបញ្ជាមិនត្រូវបានគេស្គាល់ទេ។ សូមប្រើ /start ដើម្បីមើលម៉ឺនុយ។',
    en: '❓ Unknown command. Use /start to see the menu.',
    zh: '❓ 未知命令。使用 /start 查看菜单。',
  },
  // ── language ──────────────────────────────────────────────────────────
  'bot.language.ask': {
    km: '🌐 ជ្រើសរើសភាសា:',
    en: '🌐 Select your preferred language:',
    zh: '🌐 选择您的首选语言：',
  },
  'bot.language.set': {
    km: '✅ ភាសាត្រូវបានកំណត់ទៅ ខ្មែរ',
    en: '✅ Language set to English',
    zh: '✅ 语言已设置为中文',
  },
  // ── status labels ─────────────────────────────────────────────────────
  'bot.status.DRAFT': { km: '📝 ព្រាង', en: '📝 Draft', zh: '📝 草稿' },
  'bot.status.PENDING_BUYER_PAYMENT': { km: '💳 រង់ចាំអ្នកទិញបង់ប្រាក់', en: '💳 Waiting for buyer payment', zh: '💳 等待买家付款' },
  'bot.status.PENDING_SELLER_APPROVAL': { km: '⏳ រង់ចាំអ្នកលក់យល់ព្រម', en: '⏳ Waiting for seller approval', zh: '⏳ 等待卖家确认' },
  'bot.status.PAYMENT_PENDING_VERIFICATION': { km: '🔍 កំពុងពិនិត្យការទូទាត់ដោយស្វ័យប្រវត្តិ', en: '🔍 Checking payment automatically', zh: '🔍 正在自动验证付款' },
  'bot.status.PAID_WAITING_SELLER_APPROVAL': { km: '🔒 បានបង់ប្រាក់ រង់ចាំអ្នកលក់', en: '🔒 Paid, waiting for seller', zh: '🔒 已付款，等待卖家' },
  'bot.status.SELLER_ACCEPTED_PACKING': { km: '📦 អ្នកលក់កំពុងរៀបចំ', en: '📦 Seller packing', zh: '📦 卖家备货中' },
  'bot.status.PAID_ESCROWED': { km: '🔒 ការទូទាត់ Escrow ហើយ', en: '🔒 Paid & Escrowed', zh: '🔒 已付款托管' },
  'bot.status.SHIPPED': { km: '🚚 ផ្ញើទំនិញហើយ', en: '🚚 Shipped', zh: '🚚 已发货' },
  'bot.status.DISPUTED': { km: '⚠️ មានវិវាទ', en: '⚠️ Disputed', zh: '⚠️ 有争议' },
  'bot.status.RELEASED': { km: '✅ ប្រាក់ត្រូវបានផ្ញើ', en: '✅ Released', zh: '✅ 已释放' },
  'bot.status.REFUNDED': { km: '↩️ ប្រាក់ត្រូវបានដង', en: '↩️ Refunded', zh: '↩️ 已退款' },
  'bot.status.CANCELLED': { km: '❌ បានលុបចោល', en: '❌ Cancelled', zh: '❌ 已取消' },
  'bot.status.EXPIRED': { km: '⌛ ផុតកំណត់', en: '⌛ Expired', zh: '⌛ 已过期' },
  // ── notifications ─────────────────────────────────────────────────────
  'bot.notify.COUNTERPARTY_JOINED': {
    km: '👤 ភាគីម្ខាងទៀតបានចូលរួមការទូទាត់របស់អ្នក!',
    en: '👤 The other party joined your deal!',
    zh: '👤 对方已加入您的交易！',
  },
  'bot.notify.DEAL_UPDATED': {
    km: '✏️ ព័ត៌មានការទូទាត់ត្រូវបានផ្លាស់ប្តូរ។ សូមពិនិត្យម្តងទៀត។',
    en: '✏️ Deal information was updated. Please review again.',
    zh: '✏️ 交易信息已更新，请重新查看。',
  },
  'bot.notify.BOTH_APPROVED': {
    km: '✅ ភាគីទាំងពីរបានអនុម័ត! អ្នកទិញ អាចបង់ប្រាក់ឥឡូវ។',
    en: '✅ Both parties approved! Buyer can now proceed with payment.',
    zh: '✅ 双方均已确认！买家现在可以付款了。',
  },
  'bot.notify.PAYMENT_PROOF_UPLOADED': {
    km: '💳 អ្នកទិញបានរក្សាទុកព័ត៌មានបង់ប្រាក់។ ប្រព័ន្ធកំពុងពិនិត្យ Bakong។',
    en: '💳 Buyer saved payment details. Bakong checking is running automatically.',
    zh: '💳 买家已保存付款信息，系统正在自动检查 Bakong。',
  },
  'bot.notify.PAYMENT_VERIFIED': {
    km: '✅ ការទូទាត់ត្រូវបានបញ្ជាក់ដោយស្វ័យប្រវត្តិ! សូមបន្តជំហានបន្ទាប់។',
    en: '✅ Payment confirmed automatically! Please continue to the next step.',
    zh: '✅ 付款已验证！请现在发货。',
  },
  'bot.notify.PAYMENT_REJECTED': {
    km: '❌ ភស្តុតាងការទូទាត់ត្រូវបានបដិសេធ។ សូមផ្ទុកឡើងម្តងទៀត។',
    en: '❌ Payment proof rejected. Please upload again.',
    zh: '❌ 付款凭证被拒绝，请重新上传。',
  },
  'bot.notify.SHIPPING_UPLOADED': {
    km: '🚚 អ្នកលក់បានផ្ញើទំនិញ! សូមបញ្ជាក់នៅពេលទទួលបាន។',
    en: '🚚 Seller uploaded shipping proof. Please confirm when received.',
    zh: '🚚 卖家已上传发货凭证，收到后请确认。',
  },
  'bot.notify.BUYER_CONFIRMED': {
    km: '✅ អ្នកទិញបានបញ្ជាក់ថាទទួលបានហើយ។ ប្រព័ន្ធកំពុងផ្ញើប្រាក់ទៅអ្នកលក់។',
    en: '✅ Buyer confirmed receipt. The system is sending the seller payout.',
    zh: '✅ 买家已确认收货，系统正在向卖家付款。',
  },
  'bot.notify.DISPUTE_OPENED': {
    km: '⚠️ ការទូទាត់ត្រូវបានដាក់ជាវិវាទ។ Admin នឹងពិនិត្យ។',
    en: '⚠️ A dispute has been opened. Admin will review.',
    zh: '⚠️ 争议已提交，管理员将进行审核。',
  },
  'bot.notify.PAYOUT_RELEASED': {
    km: '🎉 ការផ្ញើប្រាក់ត្រូវបានដំណើរការ! ប្រាក់ត្រូវបានផ្ញើ។',
    en: '🎉 Payout released! Funds have been sent.',
    zh: '🎉 款项已释放！资金已发送。',
  },
  'bot.notify.REFUND_COMPLETED': {
    km: '↩️ ការដង់ប្រាក់ត្រូវបានដំណើរការ! ប្រាក់ត្រូវបានផ្ញើត្រលប់ទៅអ្នកទិញ។',
    en: '↩️ Refund completed! Funds sent back to buyer.',
    zh: '↩️ 退款已完成！资金已退回给买家。',
  },
  'bot.notify.BUYER_CONFIRMED_PAYOUT_REQUIRED': {
    km: '🔔 *ត្រូវការផ្ញើប្រាក់ទៅអ្នកលក់!*\n\nអ្នកទិញបានបញ្ជាក់ទទួលបានទំនិញ។ សូម login ទៅ Admin Dashboard ហើយប្រើ Bakong Deeplink ដើម្បីផ្ញើប្រាក់ទៅអ្នកលក់។',
    en: '🔔 *Payout Required!*\n\nBuyer has confirmed receipt. Please open the Admin Dashboard and use the Bakong Deeplink button to send payment to the seller.',
    zh: '🔔 *需要付款！*\n\n买家已确认收货。请打开管理员面板，使用 Bakong 深度链接按钮向卖家付款。',
  },
  // ── admin dev ─────────────────────────────────────────────────────────
  'bot.dev.chat_id': {
    km: '🔧 Chat ID របស់អ្នក:',
    en: '🔧 Your Chat ID:',
    zh: '🔧 您的 Chat ID：',
  },
};

export function t(key: string, lang: BotLang = 'en'): string {
  const entry = messages[key];
  if (!entry) return key;
  return entry[lang] ?? entry['en'] ?? key;
}

export function statusLabel(status: string, lang: BotLang = 'en'): string {
  return t(`bot.status.${status}`, lang);
}
