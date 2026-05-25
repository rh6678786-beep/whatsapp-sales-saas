import { Session } from "../../src/types";

// Lead Qualification Scoring Rules (as per user requirements)
export class LeadQualificationService {
  /**
   * Calculate lead score based on customer message and session data
   * @param message The customer's message
   * @param session Current session data
   * @returns Score delta to add/subtract from current score
   */
  static calculateScoreDelta(message: string, session: Session): number {
    const text = message.toLowerCase().trim();
    let delta = 0;

    // Positive scoring signals (+ points)
    if (this.isPriceInquiry(text)) delta += 20;
    if (this.isDeliveryInquiry(text)) delta += 15;
    if (this.isSpecificProductInquiry(text, session)) delta += 15;
    if (this.isUrgencyRequirement(text)) delta += 25;
    if (this.hasClearBudget(text, session)) delta += 20;
    if (this.isReadyToPurchase(text)) delta += 15;
    if (this.asksPaymentMethods(text)) delta += 10;
    if (this.asksWarranty(text)) delta += 10;
    if (this.isRepeatEngagement(session)) delta += 10;

    // Negative scoring signals (- points)
    if (this.isNoReply(session)) delta -= 20;
    if (this.isVagueResponse(text)) delta -= 15;
    if (this.hasUnrealisticExpectations(text)) delta -= 15;
    if (this.isRandomInquiry(text)) delta -= 10;
    if (this.lacksBudgetInterest(text, session)) delta -= 10;

    return delta;
  }

  /**
   * Classify lead based on score
   * @param score Current lead score (0-100)
   * @returns Lead classification: HOT, WARM, or COLD
   */
  static classifyLead(score: number): 'HOT' | 'WARM' | 'COLD' {
    if (score >= 70) return 'HOT';
    if (score >= 40) return 'WARM';
    return 'COLD';
  }

  /**
   * Determine if human handoff is recommended
   * @param score Current lead score
   * @param session Current session data
   * @returns Object with handoff recommendation and reason
   */
  static shouldHandoffToHuman(score: number, session: Session): { 
    shouldHandoff: boolean; 
    reason?: string 
  } {
    // Immediate handoff for HOT leads
    if (score >= 70) {
      return { shouldHandoff: true, reason: 'HOT_LEAD_READY_TO_BUY' };
    }

    // Handoff if customer explicitly requests human agent
    if (this.customerRequestsHuman(session)) {
      return { shouldHandoff: true, reason: 'CUSTOMER_REQUESTED_HUMAN' };
    }

    // Handoff for enterprise-level inquiries
    if (this.isEnterpriseInquiry(session)) {
      return { shouldHandoff: true, reason: 'ENTERPRISE_INQUIRY' };
    }

    // Handoff if customer is angry/frustrated
    if (this.isCustomerAngry(session)) {
      return { shouldHandoff: true, reason: 'CUSTOMER_ANGRY' };
    }

    return { shouldHandoff: false };
  }

  /**
   * Generate handoff summary for human agent
   * @param session Current session data
   * @returns Structured handoff summary
   */
  static generateHandoffSummary(session: Session): any {
    return {
      customer_interest: session.selectedProductId || 'Not specified',
      budget: session.metadata?.budget || 'Not disclosed',
      urgency: session.metadata?.urgencyLevel || 'Normal',
      intent_level: this.getBuyingIntentLevel(session),
      lead_score: session.metadata?.leadScore || 0,
      lead_type: this.classifyLead(session.metadata?.leadScore || 0),
      recommended_action: this.getRecommendedAction(session),
      conversation_summary: this.generateConversationSummary(session)
    };
  }

  // Helper methods for scoring logic
  private static isPriceInquiry(text: string): boolean {
    const priceKeywords = ['price', 'cost', 'kitna', 'rate', 'qeemat', 'paisa', 'rupee'];
    return priceKeywords.some(keyword => text.includes(keyword));
  }

  private static isDeliveryInquiry(text: string): boolean {
    const deliveryKeywords = ['delivery', 'delivery time', 'kitni der', 'kab tak', 'delivery date', 'delivery time'];
    return deliveryKeywords.some(keyword => text.includes(keyword));
  }

  private static isSpecificProductInquiry(text: string, session: Session): boolean {
    // Check if customer mentioned specific product attributes
    const specificKeywords = ['model', 'brand', 'specification', 'feature', 'color', 'size', 'variant'];
    return specificKeywords.some(keyword => text.includes(keyword));
  }

  private static isUrgencyRequirement(text: string): boolean {
    const urgencyKeywords = ['urgent', 'immediately', 'asap', 'jaldi', 'har tanzi', 'shidi', 'emergency', 'today', 'aj kal'];
    return urgencyKeywords.some(keyword => text.includes(keyword));
  }

  private static hasClearBudget(text: string, session: Session): boolean {
    // Check if budget information is present in message or session
    if (session.metadata?.budget) return true;
    
    const budgetPatterns = [
      /\d+\s*(?:k|hazaar|thousand)/i,
      /\d+\s*(?:lakh|lac)/i,
      /\d{4,6}/, // Simple number that could be price
      /budget\s*:?\s*\d+/i,
      /can\s+(?:afford|spend)\s*:?\s*\d+/i
    ];
    
    return budgetPatterns.some(pattern => pattern.test(text));
  }

  private static isReadyToPurchase(text: string): boolean {
    const purchaseKeywords = ['buy', 'purchase', 'order', 'lena hai', 'lenge', 'book karna', 'confirm karna'];
    return purchaseKeywords.some(keyword => text.includes(keyword));
  }

  private static asksPaymentMethods(text: string): boolean {
    const paymentKeywords = ['payment', 'pay', 'paisa', 'easypaisa', 'jazzcash', 'bank transfer', 'credit card', 'debit card', 'cod', 'cash on delivery'];
    return paymentKeywords.some(keyword => text.includes(keyword));
  }

  private static asksWarranty(text: string): boolean {
    const warrantyKeywords = ['warranty', 'guarantee', 'warrantee', 'guaranty', 'qaima', 'kefalat'];
    return warrantyKeywords.some(keyword => text.includes(keyword));
  }

  private static isRepeatEngagement(session: Session): boolean {
    // Check if this is a repeat engagement (more than 1 message exchange)
    return (session.metadata?.messageCount || 0) > 1;
  }

  private static isNoReply(session: Session): boolean {
    // Check if customer hasn't replied in a while (would need timestamp comparison)
    // For now, we'll rely on the calling code to detect this
    return false;
  }

  private static isVagueResponse(text: string): boolean {
    // Remove punctuation and extra whitespace for better matching
    const cleanText = text.trim().toLowerCase().replace(/[.?!,]/g, '');
    const vaguePatterns = [
      /^details?$/,
      /^price$/,
      /^info$/,
      /^tell me more$/,
      /^kya hai$/,
      /^theek hai$/,
      /^ok$/,
      /^hmm$/,
      /^maybe$/,
      /^details$/,
      /^detail$/,
      /^price$/
    ];
    
    return vaguePatterns.some(pattern => pattern.test(cleanText));
  }

  private static hasUnrealisticExpectations(text: string): boolean {
    // Simple check for obviously unrealistic demands
    const unrealisticPatterns = [
      /free/i,
      /discount\s*[5-9][0-9]%/i, // 50%+ discount
      /\[\s*0\s*\]/i // Price of 0
    ];
    
    return unrealisticPatterns.some(pattern => pattern.test(text));
  }

  private static isRandomInquiry(text: string): boolean {
    // Check for random, non-serious inquiries
    const randomPatterns = [
      /^hi$/i,
      /^hello$/i,
      /^how are you/i,
      /^kaisa hai/i,
      /^what's up/i,
      /^time pass/i,
      /^bored/i
    ];
    
    return randomPatterns.some(pattern => pattern.test(text.trim()));
  }

  private static lacksBudgetInterest(text: string, session: Session): boolean {
    // Customer shows interest but avoids budget discussion
    const interestKeywords = ['interested', 'like', 'want', 'chahiye', 'pasand'];
    const budgetAvoidance = ['not discussing price', 'price later', 'budget nahi'];
    
    const showsInterest = interestKeywords.some(keyword => text.includes(keyword));
    const avoidsBudget = budgetAvoidance.some(phrase => text.includes(phrase));
    
    return showsInterest && avoidsBudget && !this.hasClearBudget(text, session);
  }

  private static customerRequestsHuman(session: Session): boolean {
    if (!session.metadata?.lastCustomerMessage) return false;
    
    const humanRequestPatterns = [
      /human/i,
      /insan/i,
      /agent/i,
      /manager/i,
      /supervisor/i,
      /real person/i,
      /talk to/i,
      /baat karna/i
    ];
    
    return humanRequestPatterns.some(pattern => pattern.test(session.metadata.lastCustomerMessage));
  }

  private static isEnterpriseInquiry(session: Session): boolean {
    // Check for enterprise/business indicators
    const enterpriseIndicators = [
      session.metadata?.businessUse === true,
      session.metadata?.quantity && parseInt(session.metadata.quantity) > 5,
      session.metadata?.inquiryType === 'bulk',
      session.metadata?.companyName !== undefined
    ];
    
    return enterpriseIndicators.some(indicator => indicator === true);
  }

  private static isCustomerAngry(session: Session): boolean {
    if (!session.metadata?.lastCustomerMessage) return false;
    
    const angerPatterns = [
      /angry/i,
      /frustrat/i,
      /naraaz/i,
      /gussa/i,
      /bad experience/i,
      /worst/i,
      /rubbish/i,
      /bakwaas/i,
      /stupid/i,
      /nonsense/i
    ];
    
    return angerPatterns.some(pattern => pattern.test(session.metadata.lastCustomerMessage.toLowerCase()));
  }

  private static getBuyingIntentLevel(session: Session): string {
    const score = session.metadata?.leadScore || 0;
    if (score >= 70) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  }

  private static getRecommendedAction(session: Session): string {
    const score = session.metadata?.leadScore || 0;
    if (score >= 70) return 'Immediate human agent assignment';
    if (score >= 40) return 'Add to nurture sequence';
    return 'Add to marketing campaign';
  }

  private static generateConversationSummary(session: Session): string {
    // In a real implementation, this would summarize the conversation
    // For now, we'll return a basic summary
    const messageCount = session.metadata?.messageCount || 0;
    const durationMinutes = Math.floor((Date.now() - new Date(session.lastMessageAt || 0).getTime()) / 60000);
    
    return `Conversation with ${messageCount} messages over ${durationMinutes} minutes. ` +
           `Lead score: ${session.metadata?.leadScore || 0}. ` +
           `Product interest: ${session.selectedProductId || 'Not specified'}.`;
  }

  /**
   * Update session with lead qualification data
   * @param session Current session
   * @param message Customer's latest message
   * @returns Updated session with qualification data
   */
  static updateSessionWithQualification(session: Session, message: string): Session {
    // Initialize metadata if not present
    if (!session.metadata) {
      session.metadata = {};
    }

    // Increment message count
    session.metadata.messageCount = (session.metadata.messageCount || 0) + 1;
    session.metadata.lastCustomerMessage = message;

    // Calculate score delta and update total score
    const scoreDelta = this.calculateScoreDelta(message, session);
    session.metadata.leadScore = Math.max(0, Math.min(100, 
      (session.metadata.leadScore || 0) + scoreDelta));

    // Update lead classification
    session.metadata.leadStatus = this.classifyLead(session.metadata.leadScore);

    // Extract and store specific qualification data
    this.extractQualificationData(message, session);

    return session;
  }

  /**
   * Extract specific qualification data from customer message
   * @param message Customer message
   * @param session Session to update
   */
  private static extractQualificationData(message: string, session: Session): void {
    const text = message.toLowerCase();

    // Extract budget information
    if (!session.metadata.budget) {
      const budgetMatch = text.match(/(?:budget\s*:?\s*|can\s+(?:afford|spend)\s*:?\s*)(\d+(?:\s*k|\s*hazaar)?)/i);
      if (budgetMatch) {
        session.metadata.budget = budgetMatch[1];
      }
    }

    // Extract urgency level
    if (!session.metadata.urgencyLevel) {
      if (this.isUrgencyRequirement(text)) {
        session.metadata.urgencyLevel = 'High';
      } else if (text.includes('soon') || text.includes('jaldi')) {
        session.metadata.urgencyLevel = 'Medium';
      } else {
        session.metadata.urgencyLevel = 'Low';
      }
    }

    // Extract product interest
    if (!session.selectedProductId) {
      // This would normally come from product matching logic
      // For now, we'll note that product interest was shown
      session.metadata.productInterestShown = true;
    }

    // Extract use case (business/personal)
    if (!session.metadata.useCase) {
      const businessKeywords = ['business', 'office', 'shop', 'store', 'company', 'commerce', 'trade'];
      const personalKeywords = ['personal', 'home', 'family', 'self', 'individual'];
      
      const businessScore = businessKeywords.filter(kw => text.includes(kw)).length;
      const personalScore = personalKeywords.filter(kw => text.includes(kw)).length;
      
      if (businessScore > personalScore) {
        session.metadata.useCase = 'Business';
      } else if (personalScore > businessScore) {
        session.metadata.useCase = 'Personal';
      } else {
        session.metadata.useCase = 'Unknown';
      }
    }
  }
}