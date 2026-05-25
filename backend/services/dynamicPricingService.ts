import { Product, Session, Message } from "../../src/types";

export interface CustomerProfile {
  isReturning: boolean;
  totalOrders: number;
  totalSpent: number;
  leadStatus: 'HOT' | 'WARM' | 'COLD';
  leadScore: number;
  hasShownPriceConcern: boolean;
  hasAskedForDiscount: boolean;
  messageCount: number;
  lastOrderDate?: string;
  daysSinceLastMessage: number;
}

export interface Offer {
  type: 'discount' | 'bundle' | 'limited_time' | 'loyalty' | 'premium_package' | 'free_shipping';
  title: string;
  description: string;
  discountPercentage?: number;
  discountAmount?: number;
  bonusItems?: string[];
  validUntil?: string;
  minPurchase?: number;
  code?: string;
}

export interface PricingDecision {
  basePrice: number;
  finalPrice: number;
  discountApplied: number;
  offer: Offer | null;
  reason: string;
}

export class DynamicPricingService {

  /**
   * Analyze customer profile for pricing decisions
   */
  static analyzeCustomerProfile(session: Session, messageCount: number, recentMessages: Message[] = []): CustomerProfile {
    const now = new Date();
    const lastMessageDate = session.lastMessageAt ? new Date(session.lastMessageAt) : now;
    const daysSinceLastMessage = Math.floor((now.getTime() - lastMessageDate.getTime()) / (1000 * 60 * 60 * 24));

    const metadata = session.metadata || {};

    return {
      isReturning: (metadata.totalOrders || 0) > 0,
      totalOrders: metadata.totalOrders || 0,
      totalSpent: metadata.totalSpent || 0,
      leadStatus: (metadata.leadStatus as 'HOT' | 'WARM' | 'COLD') || 'COLD',
      leadScore: metadata.leadScore || 0,
      hasShownPriceConcern: this.hasPriceConcern(recentMessages),
      hasAskedForDiscount: this.hasAskedForDiscount(recentMessages),
      messageCount: messageCount,
      lastOrderDate: metadata.lastOrderDate,
      daysSinceLastMessage
    };
  }

  /**
   * Check if customer has shown price concerns
   */
  private static hasPriceConcern(messages: Message[]): boolean {
    const recentMessages = messages.slice(-5);
    const priceConcernKeywords = ['mehngi', 'zyada', 'jada', 'expensive', 'too much', 'kam', 'sasta', 'discount'];
    return recentMessages.some(m =>
      m.role === 'user' && priceConcernKeywords.some(kw => m.text?.toLowerCase().includes(kw))
    );
  }

  /**
   * Check if customer has asked for discount
   */
  private static hasAskedForDiscount(messages: Message[]): boolean {
    const recentMessages = messages.slice(-5);
    const discountKeywords = ['discount', 'kam', 'rate', 'gprice', 'price low', 'lower'];
    return recentMessages.some(m =>
      m.role === 'user' && discountKeywords.some(kw => m.text?.toLowerCase().includes(kw))
    );
  }

  /**
   * Generate personalized offers based on customer profile
   */
  static generateOffers(customerProfile: CustomerProfile, selectedProduct?: Product): Offer[] {
    const offers: Offer[] = [];

    // 1. RETURNING CUSTOMER - Loyalty discount
    if (customerProfile.isReturning && customerProfile.totalOrders >= 1) {
      offers.push({
        type: 'loyalty',
        title: '🎁 Khaas Aapke Liye',
        description: `Aap pehle ${customerProfile.totalOrders} baar order kar chuke hain — yeh sirf apne purane yaar ke liye hai: extra ${5 + (customerProfile.totalOrders * 2)}% special discount. No code needed.`,
        discountPercentage: 5 + (customerProfile.totalOrders * 2), // More orders = more discount
        code: `LOYAL${customerProfile.totalOrders}`
      });
    }

    // 2. HIGH-VALUE LEAD (HOT) - Premium package
    if (customerProfile.leadStatus === 'HOT' || customerProfile.leadScore >= 70) {
      offers.push({
        type: 'premium_package',
        title: '⭐ Premium Bundle — Sirf Aapke Liye',
        description: 'Sab kuch ek jagah: free accessories, express delivery, aur extended warranty — sab included. Best value option yahi hai.',
        bonusItems: ['Free Gift Box', 'Extended Warranty', 'Express Shipping'],
        minPurchase: 5000
      });
    }

    // 3. HESITATING BUYER - Limited time offer
    if (customerProfile.hasShownPriceConcern && !customerProfile.isReturning) {
      offers.push({
        type: 'limited_time',
        title: '⏰ Aaj Ka Khaas Offer',
        description: 'Sirf aaj ke liye: 15% discount + free delivery. Kal se wapis normal price. Abhi order karein toh seedha yeh rate milega.',
        discountPercentage: 15,
        validUntil: this.getTomorrowDate(),
        minPurchase: 2000
      });
    }

    // 4. NEW CUSTOMER - First order discount
    if (!customerProfile.isReturning && customerProfile.messageCount < 5) {
      offers.push({
        type: 'discount',
        title: '👋 Pehli Baar? Yeh Lo',
        description: 'Pehle order pe 10% off — bas is taraf se. Code: FIRST10. Quality dekh ke khud confirm ho jayenge.',
        discountPercentage: 10,
        code: 'FIRST10'
      });
    }

    // 5. BULK ORDER - Free shipping
    if (selectedProduct && selectedProduct.price >= 10000) {
      offers.push({
        type: 'free_shipping',
        title: '🚚 Free Delivery — Pakistan Bhar',
        description: 'Rs.10,000 ya us se upar ke har order pe free home delivery — Karachi, Lahore, Islamabad, sab jagah.',
        minPurchase: 10000
      });
    }

    // 6. WARM LEAD - Progressive discount
    if (customerProfile.leadStatus === 'WARM' && customerProfile.leadScore >= 40) {
      offers.push({
        type: 'discount',
        title: '🔥 Aaj Ka Deal',
        description: '10% discount + easy installments available — dono options hain. Batayein kya suit karta hai, arrange kar deta hoon.',
        discountPercentage: 10
      });
    }

    return offers;
  }

  /**
   * Get tomorrow's date as string
   */
  private static getTomorrowDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toLocaleDateString('en-PK');
  }

  /**
   * Calculate final price with dynamic pricing
   */
  static calculatePrice(
    productPrice: number,
    customerProfile: CustomerProfile,
    selectedOffer?: Offer
  ): PricingDecision {
    let discountPercentage = 0;
    let reason = 'Base price';

    // Apply offer if provided
    if (selectedOffer?.discountPercentage) {
      discountPercentage = selectedOffer.discountPercentage;
      reason = `Applied: ${selectedOffer.title}`;
    }
    // Auto-generate discount based on customer profile
    else {
      if (customerProfile.isReturning) {
        discountPercentage = 5 + (customerProfile.totalOrders * 2);
        reason = 'Returning customer discount';
      } else if (customerProfile.hasShownPriceConcern) {
        discountPercentage = 10;
        reason = 'Price concern handled';
      } else if (customerProfile.leadStatus === 'HOT') {
        discountPercentage = 3;
        reason = 'Premium customer';
      }
    }

    const discountAmount = Math.round(productPrice * (discountPercentage / 100));
    const finalPrice = productPrice - discountAmount;

    return {
      basePrice: productPrice,
      finalPrice,
      discountApplied: discountAmount,
      offer: selectedOffer || null,
      reason
    };
  }

  /**
   * Format offers for display in response
   */
  static formatOffers(offers: Offer[], productPrice?: number): string {
    if (offers.length === 0) return '';

    let message = '\n🎯 *Special Offers for You:*\n\n';

    offers.forEach((offer, index) => {
      message += `${index + 1}. *${offer.title}*\n`;
      message += `   ${offer.description}\n`;

      if (offer.discountPercentage) {
        message += `   💰 ${offer.discountPercentage}% OFF!\n`;
      }
      if (offer.bonusItems?.length) {
        message += `   🎁 Bonus: ${offer.bonusItems.join(', ')}\n`;
      }
      if (offer.code) {
        message += `   Use Code: ${offer.code}\n`;
      }
      if (offer.validUntil) {
        message += `   ⏰ Valid until: ${offer.validUntil}\n`;
      }
      message += '\n';
    });

    return message;
  }

}