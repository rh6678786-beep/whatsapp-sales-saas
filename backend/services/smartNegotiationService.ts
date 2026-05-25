import { Product } from "../../src/types";

export interface NegotiationState {
  isNegotiating: boolean;
  originalPrice: number;
  currentOfferedPrice: number;
  discountGiven: number;
  negotiationCount: number;
  lastOfferAt: string | null;
  offerHistory: { discount: number; price: number; at: string }[];
  customerSatisfactionLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface NegotiationResult {
  shouldOfferDiscount: boolean;
  discountAmount: number;
  newPrice: number;
  message: string;
  negotiationState: NegotiationState;
  maxDiscountReached: boolean;
  customerSatisfied: boolean;
}

const MIN_MESSAGE_COUNT_FOR_NEGOTIATION = 20;
const NO_DISCOUNT_PRICE_THRESHOLD = 3500;
const LOW_DISCOUNT_MAX = 200;
const HIGH_DISCOUNT_MAX = 400;
const DISCOUNT_STEPS_LOW = [100, 200];
const DISCOUNT_STEPS_HIGH = [100, 200, 300, 400];
const MIN_PRODUCT_PRICE_FOR_NEGOTIATION = 3501;

export class SmartNegotiationService {

  static getInitialNegotiationState(): NegotiationState {
    return {
      isNegotiating: false,
      originalPrice: 0,
      currentOfferedPrice: 0,
      discountGiven: 0,
      negotiationCount: 0,
      lastOfferAt: null,
      offerHistory: [],
      customerSatisfactionLevel: 'HIGH'
    };
  }

  static getNegotiationState(metadata: any): NegotiationState {
    if (!metadata?.negotiationState) {
      return this.getInitialNegotiationState();
    }
    return metadata.negotiationState;
  }

  static saveNegotiationState(metadata: any, negotiationState: NegotiationState): any {
    return {
      ...metadata,
      negotiationState
    };
  }

  static getMaxDiscountForProduct(product: Product): number {
    if (product.price > 6000) {
      return HIGH_DISCOUNT_MAX;
    } else if (product.price > NO_DISCOUNT_PRICE_THRESHOLD) {
      return LOW_DISCOUNT_MAX;
    }
    return 0;
  }

  static getDiscountStepsForProduct(product: Product): number[] {
    const maxDiscount = this.getMaxDiscountForProduct(product);
    if (maxDiscount === LOW_DISCOUNT_MAX) {
      return DISCOUNT_STEPS_LOW;
    } else if (maxDiscount === HIGH_DISCOUNT_MAX) {
      return DISCOUNT_STEPS_HIGH;
    }
    return [];
  }

  static isPriceNegotiationRequest(message: string): boolean {
    const text = message.toLowerCase();
    const negotiationKeywords = [
      'kam', 'km', 'less', 'sasta', 'mehngi', 'zyada', 'expensive', 
      'discount', 'rate', 'gprice', 'lower', 'chep',
      'price', 'qeemat', 'kitna', 'cost', 'kami'
    ];
    
    const hasNegotiationIntent = negotiationKeywords.some(keyword => text.includes(keyword));
    return hasNegotiationIntent;
  }

  static isCustomerDissatisfied(message: string, previousOffer?: number): boolean {
    const text = message.toLowerCase();
    
    const dissatisfactionKeywords = [
      'nahi', 'no', 'not', 'dont', 'cant', 'cannot', 'wrong',
      'expensive', 'mehngi', 'zyada', 'nhi', 'mushkil',
      'impossible', 'aur', 'or', 'dosra', 'dusra', 'koi',
      'baqi', 'baki', 'achha', 'acha', 'matlab', 'iska'
    ];
    
    const hasDissatisfaction = dissatisfactionKeywords.some(keyword => text.includes(keyword));
    
    if (previousOffer && hasDissatisfaction) {
      return true;
    }
    
    return hasDissatisfaction;
  }

  static isCustomerPositive(message: string): boolean {
    const text = message.toLowerCase();
    const positiveKeywords = ['ok', 'okay', 'thik', 'theek', 'hana', 'han', 'good', 'great', 'nice', 'deal', 'done', 'hmm', 'aise', 'theko'];
    return positiveKeywords.some(k => text.includes(k));
  }

  static analyzeCustomerSatisfaction(message: string, offerHistory: { discount: number; price: number }[]): 'HIGH' | 'MEDIUM' | 'LOW' {
    const text = message.toLowerCase();
    
    const positiveKeywords = ['ok', 'okay', 'thik', 'theek', 'hana', 'han', 'good', 'great', 'nice', 'deal', 'done', 'hmm', 'aise', 'theko'];
    const negativeKeywords = ['nahi', 'no', 'not', 'never', 'impossible', 'mushkil', 'nhi', 'bad', 'wrong', 'matlab', 'iska'];
    
    const hasPositive = positiveKeywords.some(k => text.includes(k));
    const hasNegative = negativeKeywords.some(k => text.includes(k));
    
    if (offerHistory.length === 0) return 'HIGH';
    
    const lastOffer = offerHistory[offerHistory.length - 1];
    const maxDiscount = lastOffer.discount >= 300 ? HIGH_DISCOUNT_MAX : LOW_DISCOUNT_MAX;
    
    if (hasNegative && lastOffer.discount >= maxDiscount * 0.75) {
      return 'LOW';
    }
    
    if (hasPositive) return 'HIGH';
    if (hasNegative) return 'MEDIUM';
    
    return 'MEDIUM';
  }

  static calculateMinimumProfitablePrice(product: Product): number {
    const costPrice = product.costPrice || 0;
    const minimumProfitMargin = costPrice * 0.15;
    return Math.ceil((costPrice + minimumProfitMargin) / 100) * 100;
  }

  static canOfferDiscount(product: Product, currentDiscount: number): boolean {
    if (product.price <= NO_DISCOUNT_PRICE_THRESHOLD) {
      return false;
    }
    
    const minPrice = this.calculateMinimumProfitablePrice(product);
    const potentialPrice = product.price - currentDiscount;
    
    return potentialPrice > minPrice;
  }

  static calculateNextDiscount(
    negotiationState: NegotiationState,
    product: Product
  ): { discount: number; newPrice: number; canProceed: boolean; maxDiscount: number } {
    const currentDiscount = negotiationState.discountGiven;
    const maxDiscount = this.getMaxDiscountForProduct(product);
    const discountSteps = this.getDiscountStepsForProduct(product);
    
    const nextDiscountStep = discountSteps.find(step => step > currentDiscount) || maxDiscount;
    
    const potentialNewPrice = product.price - nextDiscountStep;
    const minProfitablePrice = this.calculateMinimumProfitablePrice(product);
    
    if (potentialNewPrice < minProfitablePrice && nextDiscountStep > currentDiscount) {
      const maxAllowedDiscount = product.price - minProfitablePrice;
      const roundedDiscount = Math.floor(maxAllowedDiscount / 100) * 100;
      
      if (roundedDiscount <= currentDiscount || roundedDiscount <= 0) {
        return {
          discount: currentDiscount,
          newPrice: product.price - currentDiscount,
          canProceed: false,
          maxDiscount
        };
      }
      
      return {
        discount: roundedDiscount,
        newPrice: product.price - roundedDiscount,
        canProceed: roundedDiscount > currentDiscount,
        maxDiscount
      };
    }
    
    return {
      discount: nextDiscountStep,
      newPrice: product.price - nextDiscountStep,
      canProceed: nextDiscountStep <= maxDiscount,
      maxDiscount
    };
  }

  static processNegotiation(
    customerMessage: string,
    product: Product,
    negotiationState: NegotiationState,
    messageCount: number
  ): NegotiationResult {
    const isNegotiationRequest = this.isPriceNegotiationRequest(customerMessage);
    const satisfactionLevel = this.analyzeCustomerSatisfaction(customerMessage, negotiationState.offerHistory);
    const maxDiscount = this.getMaxDiscountForProduct(product);
    
    if (product.price <= NO_DISCOUNT_PRICE_THRESHOLD) {
      return {
        shouldOfferDiscount: false,
        discountAmount: 0,
        newPrice: product.price,
        message: 'no_discount_available',
        negotiationState: {
          ...negotiationState,
          customerSatisfactionLevel: satisfactionLevel
        },
        maxDiscountReached: true,
        customerSatisfied: true
      };
    }
    
    if (!isNegotiationRequest) {
      return {
        shouldOfferDiscount: false,
        discountAmount: negotiationState.discountGiven,
        newPrice: product.price - negotiationState.discountGiven,
        message: '',
        negotiationState: {
          ...negotiationState,
          customerSatisfactionLevel: satisfactionLevel
        },
        maxDiscountReached: negotiationState.discountGiven >= maxDiscount,
        customerSatisfied: satisfactionLevel === 'HIGH'
      };
    }
    
    if (messageCount < MIN_MESSAGE_COUNT_FOR_NEGOTIATION) {
      const timeRemaining = MIN_MESSAGE_COUNT_FOR_NEGOTIATION - messageCount;
      return {
        shouldOfferDiscount: false,
        discountAmount: negotiationState.discountGiven,
        newPrice: product.price - negotiationState.discountGiven,
        message: `chat_${timeRemaining}_more`,
        negotiationState: {
          ...negotiationState,
          isNegotiating: true,
          customerSatisfactionLevel: satisfactionLevel
        },
        maxDiscountReached: false,
        customerSatisfied: true
      };
    }
    
    if (negotiationState.lastOfferAt) {
      const lastOfferTime = new Date(negotiationState.lastOfferAt).getTime();
      const now = Date.now();
      const timeDiffMinutes = (now - lastOfferTime) / (1000 * 60);
      
      if (timeDiffMinutes < 5) {
        return {
          shouldOfferDiscount: false,
          discountAmount: negotiationState.discountGiven,
          newPrice: product.price - negotiationState.discountGiven,
          message: 'recent_offer',
          negotiationState,
          maxDiscountReached: negotiationState.discountGiven >= maxDiscount,
          customerSatisfied: false
        };
      }
    }
    
    const { discount, newPrice, canProceed } = this.calculateNextDiscount(negotiationState, product);
    
    if (!canProceed || negotiationState.discountGiven >= maxDiscount) {
      return {
        shouldOfferDiscount: false,
        discountAmount: negotiationState.discountGiven,
        newPrice: product.price - negotiationState.discountGiven,
        message: 'max_discount_reached',
        negotiationState: {
          ...negotiationState,
          customerSatisfactionLevel: satisfactionLevel
        },
        maxDiscountReached: true,
        customerSatisfied: false
      };
    }
    
    const isDissatisfied = this.isCustomerDissatisfied(customerMessage, negotiationState.currentOfferedPrice);
    const isPositive = this.isCustomerPositive(customerMessage);
    
    if (negotiationState.discountGiven === 0 && (isPositive || !isDissatisfied)) {
      const initialDiscount = 100;
      const initialPrice = product.price - initialDiscount;
      
      return {
        shouldOfferDiscount: true,
        discountAmount: initialDiscount,
        newPrice: initialPrice,
        message: `first_offer_${initialDiscount}`,
        negotiationState: {
          ...negotiationState,
          isNegotiating: true,
          originalPrice: product.price,
          currentOfferedPrice: initialPrice,
          discountGiven: initialDiscount,
          negotiationCount: negotiationState.negotiationCount + 1,
          lastOfferAt: new Date().toISOString(),
          offerHistory: [
            ...negotiationState.offerHistory,
            { discount: initialDiscount, price: initialPrice, at: new Date().toISOString() }
          ],
          customerSatisfactionLevel: satisfactionLevel
        },
        maxDiscountReached: initialDiscount >= maxDiscount,
        customerSatisfied: false
      };
    }
    
    if (isDissatisfied && discount <= maxDiscount) {
      return {
        shouldOfferDiscount: true,
        discountAmount: discount,
        newPrice: newPrice,
        message: `next_offer_${discount}`,
        negotiationState: {
          ...negotiationState,
          isNegotiating: true,
          currentOfferedPrice: newPrice,
          discountGiven: discount,
          negotiationCount: negotiationState.negotiationCount + 1,
          lastOfferAt: new Date().toISOString(),
          offerHistory: [
            ...negotiationState.offerHistory,
            { discount, price: newPrice, at: new Date().toISOString() }
          ],
          customerSatisfactionLevel: satisfactionLevel
        },
        maxDiscountReached: discount >= maxDiscount,
        customerSatisfied: satisfactionLevel === 'HIGH'
      };
    }
    
    return {
      shouldOfferDiscount: false,
      discountAmount: negotiationState.discountGiven,
      newPrice: product.price - negotiationState.discountGiven,
      message: 'satisfied_or_no_request',
      negotiationState: {
        ...negotiationState,
        customerSatisfactionLevel: satisfactionLevel
      },
      maxDiscountReached: negotiationState.discountGiven >= maxDiscount,
      customerSatisfied: satisfactionLevel === 'HIGH'
    };
  }

  static generateNegotiationMessage(
    result: NegotiationResult,
    productName: string,
    isFirstTime: boolean = false
  ): string | null {
    if (!result.shouldOfferDiscount) {
      if (result.message === 'max_discount_reached') {
        if (result.discountAmount > 0) {
          return `Sir, honestly main aapke liye already Rs.${result.discountAmount} ki special cut kar chuka hoon — ab price Rs.${result.newPrice} hai. Market mein yeh price honestly milni mushkil hai, free delivery bhi upar se. Ab toh banta hai na? 😊`;
        }
        return `Sir, ${productName} already itni reasonable price pe hai ke honestly yahan discount ki gunjaaish nahi — lekin quality pe main personally guarantee deta hoon. Free delivery bhi saath. Ab order kar lein? 😊`;
      }
      
      if (result.message === 'recent_offer') {
        return `Sir, main ne abhi thodi der pehle aapko best possible price share ki thi 😊 Sochiye aaram se — jab bhi ready ho, batayein, main order abhi lock kar deta hoon.`;
      }
      
      if (result.message === 'no_discount_available') {
        return `Sir, ${productName} honestly itni affordable price pe hai — market mein dhundhein ge toh double milega. Yahan discount nahi, but free delivery aur full quality assurance saath hai. Laga lein? 😊`;
      }
      
      if (result.message?.startsWith('chat_')) {
        return null;
      }
      
      return null;
    }
    
    const discount = result.discountAmount;
    const newPrice = result.newPrice;
    const maxDiscount = result.maxDiscountReached ? discount : (discount >= 200 ? 200 : 100);
    
    if (discount === 100) {
      if (maxDiscount === 200) {
        return `Sir aapke liye main Rs.100 ki cut laga raha hoon — price ab Rs.${newPrice} ho gayi. Yeh main personally aapke liye kar raha hoon, baaki sab ko original price pe milta hai. Free delivery bhi saath hai. Ab ho jaye? 😊`;
      }
        return `Sir, dekho — shuru karte hain Rs.100 ki special cut se. Price ab Rs.${newPrice} hai, aur free delivery + warranty bhi included hai. Quality pe koi sawaal nahi hoga. Ab lock kar lein? 😊`;
    }
    
    if (discount === 200) {
      if (maxDiscount === 200) {
        return `Sir, main ne Rs.200 tak aa gaya — honestly yeh meri last limit hai, aage honestly mere liye mushkil hai. Price ab Rs.${newPrice} hai, free delivery + replacement guarantee bhi saath. Yeh deal genuinely solid hai. Ab kar lete hain? 😊`;
      }
        return `Sir, aapke liye Rs.200 aur nicha laya hoon — price ab Rs.${newPrice} hai. Free delivery bhi upar se. Honestly, yeh paisa wasooli deal hai. Kar lein? 😊`;
    }
    
    if (discount === 300) {
      return `Sir, dekho — Rs.300 ki full cut laga di, ab Rs.${newPrice} hai. Main ne honestly apni taraf se jo ho sakta tha kar diya. Free express delivery bhi add kar raha hoon. Ab sach batao, kya bolta hai? 😊`;
    }
    
    if (discount === 400) {
      return `Sir, yaar honestly yeh meri hard limit hai — Rs.400 OFF, price ab Rs.${newPrice}. Upar se free delivery aur ek surprise gift bhi pack kar dunga. Main se zyada honestly ho nahi sakta. Ab ho jata hai na? 😊`;
    }
    
    return `Sir, ${productName} aapke liye Rs.${newPrice} kar diya hai — Rs.${discount} ki special cut + free delivery. Karte hain? 😊`;
  }
}