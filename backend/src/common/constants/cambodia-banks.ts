/**
 * Cambodian banks and financial institutions that support KHQR.
 * Used for seller payout bank selection dropdown.
 */
export const CAMBODIA_KHQR_BANKS = [
  { code: 'ABA', name: 'ABA Bank', bakongSuffix: '@aba' },
  { code: 'ACLEDA', name: 'ACLEDA Bank', bakongSuffix: '@acleda' },
  { code: 'ACLB', name: 'ACLEDA Bank (ACLB)', bakongSuffix: '@aclb' },
  { code: 'WING', name: 'Wing Bank', bakongSuffix: '@wing' },
  { code: 'TRUEMONEY', name: 'TrueMoney', bakongSuffix: '@truemoney' },
  { code: 'CANADIA', name: 'Canadia Bank', bakongSuffix: '@canadia' },
  { code: 'CHIPMONG', name: 'Chip Mong Bank', bakongSuffix: '@chipmong' },
  { code: 'PRINCE', name: 'Prince Bank', bakongSuffix: '@prince' },
  { code: 'PPBC', name: 'Phnom Penh Commercial Bank', bakongSuffix: '@ppbc' },
  { code: 'FTB', name: 'Foreign Trade Bank', bakongSuffix: '@ftb' },
  { code: 'CATHAY', name: 'Cathay United Bank', bakongSuffix: '@cathay' },
  { code: 'BRED', name: 'BRED Bank', bakongSuffix: '@bred' },
  { code: 'BIDC', name: 'BIDC Bank', bakongSuffix: '@bidc' },
  { code: 'PRASAC', name: 'PRASAC', bakongSuffix: '@prasac' },
  { code: 'AMRET', name: 'Amret', bakongSuffix: '@amret' },
  { code: 'HATTHA', name: 'Hattha Bank', bakongSuffix: '@hattha' },
  { code: 'SATHAPANA', name: 'Sathapana Bank', bakongSuffix: '@sathapana' },
  { code: 'UCB', name: 'UCB Bank', bakongSuffix: '@ucb' },
  { code: 'MOHANOKOR', name: 'Mohanokor', bakongSuffix: '@mohanokor' },
  { code: 'VATTANAC', name: 'Vattanac Bank', bakongSuffix: '@vattanac' },
  { code: 'MAYBANK', name: 'Maybank Cambodia', bakongSuffix: '@maybank' },
  { code: 'RHB', name: 'RHB Bank', bakongSuffix: '@rhb' },
  { code: 'SBC', name: 'SBC Bank', bakongSuffix: '@sbc' },
  { code: 'EMONEY', name: 'eMoney', bakongSuffix: '@emoney' },
  { code: 'LYHOUR', name: 'Ly Hour Pay Pro', bakongSuffix: '@lyhour' },
  { code: 'AMK', name: 'AMK', bakongSuffix: '@amk' },
  { code: 'WOORI', name: 'Woori Bank Cambodia', bakongSuffix: '@woori' },
  { code: 'KB', name: 'KB Prasac Bank', bakongSuffix: '@kb' },
  { code: 'PHILIP', name: 'Philip Bank', bakongSuffix: '@philip' },
  { code: 'OTHER', name: 'Other Bank', bakongSuffix: '' },
] as const;

export type CambodiaBankCode = (typeof CAMBODIA_KHQR_BANKS)[number]['code'];
