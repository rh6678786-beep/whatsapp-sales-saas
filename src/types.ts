export enum SalesState {
  NEW = 'NEW',
  INTERESTED = 'INTERESTED',
  PRODUCT_SELECTED = 'PRODUCT_SELECTED',
  NEGOTIATING = 'NEGOTIATING',
  PAYMENT_AWAITING = 'PAYMENT_AWAITING',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAYMENT_SENT = 'PAYMENT_SENT',
  VERIFIED = 'VERIFIED',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  DELIVERED = 'DELIVERED'
}

export interface SessionMetadata {
  leadScore?: number;
  leadStatus?: 'HOT' | 'WARM' | 'COLD';
  budget?: string;
  urgencyLevel?: string;
  messageCount?: number;
  lastCustomerMessage?: string;
  productInterestShown?: boolean;
  useCase?: string;
  handoffTriggered?: boolean;
  handoffReason?: string;
  handoffSummary?: any;
  followUpHandoff?: boolean;
  followUpHandoffReason?: string;
  lastClosingTags?: string[];
  lastBuyingSignal?: boolean;
  lastReEngagementMessage?: string;
  lastReEngagementAt?: string;
  [key: string]: any;
}

export interface Deal {
  id: string;
  title: string;
  description: string;
  productIds: string[];
  discountPrice?: number | null;
  image: string;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  features: string[];
  images: string[];
  videos?: string[];
}

export interface Session {
  id: string;
  userId: string;
  state: SalesState;
  selectedProductId?: string;
  lastMessageAt: string;
  remindersCount: number;
  lastReminderAt?: string;
  isBlocked?: boolean;
  metadata?: SessionMetadata;
}

export interface Message {
  id?: string;
  sessionId: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  imageUrl?: string;
  videoUrl?: string;
}

export interface Order {
  id: string;
  userId: string;
  productId: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SHIPPED' | 'DELIVERED';
  paymentScreenshotUrl?: string;
  shippingAddress?: string;
  customerName?: string;
  customerPhone?: string;
  amount: number;
  costPrice: number;
  createdAt: string;
  trackingId?: string;
  courier?: string;
}

export function formatUserId(userId: string): string {
  if (!userId) return 'Unknown';
  let cleaned = userId
    .replace(/^whatsapp:/, '')
    .replace(/@.+$/, '')
    .replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+92')) {
    const num = cleaned.slice(3);
    if (num.startsWith('3')) return `0${num}`;
    return cleaned;
  }
  if (cleaned.startsWith('92')) {
    const num = cleaned.slice(2);
    if (num.startsWith('3')) return `0${num}`;
    return `+${cleaned}`;
  }
  if (cleaned.length >= 10) return cleaned;
  return userId.slice(-8);
}
