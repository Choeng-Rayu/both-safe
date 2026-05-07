/**
 * Cambodian banks and financial institutions that support KHQR.
 * Used for seller payout bank selection dropdown.
 */
export const CAMBODIA_KHQR_BANKS = [
  { code: 'ABA', name: 'ABA Bank' },
  { code: 'ACLEDA', name: 'ACLEDA Bank' },
  { code: 'ACLB', name: 'ACLEDA Bank (ACLB)' },
  { code: 'WING', name: 'Wing Bank' },
  { code: 'TRUEMONEY', name: 'TrueMoney' },
  { code: 'CANADIA', name: 'Canadia Bank' },
  { code: 'CHIPMONG', name: 'Chip Mong Bank' },
  { code: 'PRINCE', name: 'Prince Bank' },
  { code: 'PPBC', name: 'Phnom Penh Commercial Bank' },
  { code: 'FTB', name: 'Foreign Trade Bank' },
  { code: 'CATHAY', name: 'Cathay United Bank' },
  { code: 'BRED', name: 'BRED Bank' },
  { code: 'BIDC', name: 'BIDC Bank' },
  { code: 'PRASAC', name: 'PRASAC' },
  { code: 'AMRET', name: 'Amret' },
  { code: 'HATTHA', name: 'Hattha Bank' },
  { code: 'SATHAPANA', name: 'Sathapana Bank' },
  { code: 'UCB', name: 'UCB Bank' },
  { code: 'MOHANOKOR', name: 'Mohanokor' },
  { code: 'VATTANAC', name: 'Vattanac Bank' },
  { code: 'MAYBANK', name: 'Maybank Cambodia' },
  { code: 'RHB', name: 'RHB Bank' },
  { code: 'SBC', name: 'SBC Bank' },
  { code: 'EMONEY', name: 'eMoney' },
  { code: 'LYHOUR', name: 'Ly Hour Pay Pro' },
  { code: 'AMK', name: 'AMK' },
  { code: 'WOORI', name: 'Woori Bank Cambodia' },
  { code: 'KB', name: 'KB Prasac Bank' },
  { code: 'PHILIP', name: 'Philip Bank' },
  { code: 'OTHER', name: 'Other Bank' },
] as const;

export type CambodiaBankCode = (typeof CAMBODIA_KHQR_BANKS)[number]['code'];
