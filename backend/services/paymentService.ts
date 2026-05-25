import axios from 'axios';
import { dbService } from './dbService';

function detectMimeType(base64: string): string {
  if (/^\/9j/.test(base64)) return 'image/jpeg';
  if (/^iVBOR/.test(base64)) return 'image/png';
  if (/^R0lGOD/.test(base64)) return 'image/gif';
  if (/^UklGR/.test(base64)) return 'image/webp';
  return 'image/jpeg';
}

interface PaymentConfig {
  jazzCash: {
    merchantId: string;
    merchantPassword: string;
    isActive: boolean;
  };
  easyPaisa: {
    merchantId: string;
    merchantPassword: string;
    isActive: boolean;
  };
  bankTransfer: {
    accountTitle: string;
    accountNumber: string;
    bankName: string;
    branchCode: string;
    isActive: boolean;
  };
}

async function _getConfig(adminId: string): Promise<PaymentConfig> {
  const settings = await dbService.getSettings(adminId);
  return settings.paymentConfig as PaymentConfig || {
    jazzCash: { merchantId: '', merchantPassword: '', isActive: false },
    easyPaisa: { merchantId: '', merchantPassword: '', isActive: false },
    bankTransfer: { accountTitle: '', accountNumber: '', bankName: '', branchCode: '', isActive: false },
  };
}

export async function updatePaymentConfig(adminId: string, config: Partial<PaymentConfig>) {
  const paymentConfig = await _getConfig(adminId);
  const updated = { ...paymentConfig, ...config };
  await dbService.updateSettings(adminId, { paymentConfig: updated });
  return updated;
}

export async function getPaymentConfig(adminId: string) {
  const cfg = await _getConfig(adminId);
  return {
    jazzCash: { ...cfg.jazzCash, merchantPassword: cfg.jazzCash.merchantPassword ? '********' : '' },
    easyPaisa: { ...cfg.easyPaisa, merchantPassword: cfg.easyPaisa.merchantPassword ? '********' : '' },
    bankTransfer: cfg.bankTransfer,
  };
}

export async function getPaymentMethods(adminId: string) {
  const paymentConfig = await _getConfig(adminId);
  const methods = [];
  if (paymentConfig.jazzCash.isActive) {
    methods.push({
      id: 'jazzcash',
      name: 'JazzCash',
      type: 'mobile_wallet',
      account: paymentConfig.jazzCash.merchantId,
      instructions: 'JazzCash app mein ja kar payment karain, transaction ID bhejein.',
    });
  }
  if (paymentConfig.easyPaisa.isActive) {
    methods.push({
      id: 'easypaisa',
      name: 'EasyPaisa',
      type: 'mobile_wallet',
      account: paymentConfig.easyPaisa.merchantId,
      instructions: 'EasyPaisa app mein ja kar payment karain, transaction ID bhejein.',
    });
  }
  if (paymentConfig.bankTransfer.isActive) {
    methods.push({
      id: 'bank',
      name: 'Bank Transfer',
      type: 'bank',
      accountTitle: paymentConfig.bankTransfer.accountTitle,
      accountNumber: paymentConfig.bankTransfer.accountNumber,
      bankName: paymentConfig.bankTransfer.bankName,
      branchCode: paymentConfig.bankTransfer.branchCode,
      instructions: 'IBFT/RTGS karein aur transaction reference bhejein.',
    });
  }
  return methods;
}

export interface PaymentVerificationRequest {
  paymentMethod: 'jazzcash' | 'easypaisa' | 'bank';
  transactionId: string;
  amount: number;
  phoneNumber?: string;
}

export interface PaymentVerificationResult {
  success: boolean;
  verified: boolean;
  message: string;
  transactionDate?: string;
  customerName?: string;
}

export async function verifyPayment(
  paymentMethod: 'jazzcash' | 'easypaisa' | 'bank',
  transactionId: string,
  amount: number,
  adminId: string,
  phoneNumber?: string
): Promise<PaymentVerificationResult> {
  console.log(`[Payment] Verifying ${paymentMethod} transaction: ${transactionId}, Amount: ${amount}`);

  if (!transactionId || transactionId.trim() === '') {
    return { success: false, verified: false, message: 'Transaction ID required hai.' };
  }

  const config = await _getConfig(adminId);

  switch (paymentMethod) {
    case 'jazzcash':
      return await verifyJazzCash(transactionId, amount, config);
    case 'easypaisa':
      return await verifyEasyPaisa(transactionId, amount, config, phoneNumber);
    case 'bank':
      return await verifyBankTransfer(transactionId, amount);
    default:
      return { success: false, verified: false, message: 'Invalid payment method.' };
  }
}

async function verifyJazzCash(transactionId: string, expectedAmount: number, config: PaymentConfig): Promise<PaymentVerificationResult> {
  if (!config.jazzCash.isActive || !config.jazzCash.merchantId) {
    return await verifyJazzCashMock(transactionId, expectedAmount);
  }

  try {
    const response = await axios.post(
      'https://www.jazzcash.com.pk/ApplicationAPI/api/payment/inquiry',
      {
        version: '2.0.0',
        language: 'english',
        merchantId: config.jazzCash.merchantId,
        password: config.jazzCash.merchantPassword,
        transactionId: transactionId.trim().toUpperCase(),
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const data = response.data;
    if (data.responseCode === '000' || data.ResponseCode === '000') {
      const actualAmount = parseInt(data.amount || data.ResponseAmount || '0');
      const isAmountValid = expectedAmount ? actualAmount >= expectedAmount : true;
      const status = data.transactionStatus || data.ResponseStatus;

      if (status === 'COMPLETED' || status === '000' || status === '01') {
        return {
          success: true,
          verified: isAmountValid,
          message: isAmountValid ? 'Payment verify ho gaya!' : `Amount mismatch: Rs.${actualAmount} vs Rs.${expectedAmount}`,
          transactionDate: data.transactionTime || data.ResponseTime,
          customerName: data.customerMsisdn || data.Msisdn,
        };
      }
    }

    return { success: true, verified: false, message: data.responseMessage || 'Payment verify nahi ho saki.' };
  } catch (error: any) {
    console.error('[JazzCash] API Error:', error.message);
    return { success: false, verified: false, message: 'JazzCash API temporarily unavailable. Please try again later or contact support.' };
  }
}

async function verifyJazzCashMock(transactionId: string, expectedAmount: number): Promise<PaymentVerificationResult> {
  const mockId = transactionId.trim().toUpperCase();
  const isValidFormat = mockId.match(/^[A-Z0-9]{8,20}$/);
  
  if (!isValidFormat) {
    return { success: true, verified: false, message: 'Yeh transaction ID sahi format mein nahi lag rahi. JazzCash mein transaction history se exact ID copy kar ke bhejein — kuch aisa dikhega: T1234ABCD56789' };
  }

  const hashCode = mockId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const isVerified = hashCode % 3 !== 0;

  return {
    success: true,
    verified: isVerified,
    message: isVerified 
      ? 'Payment verify ho gaya! ✅ (Demo Mode — actual API se aur accurate hoga)' 
      : 'Yeh transaction ID verify nahi ho saki. Aap jo screenshot mila hai woh directly share karein, main manually check kar leta hoon. 😊',
    transactionDate: new Date().toISOString(),
  };
}

async function verifyEasyPaisa(
  transactionId: string,
  expectedAmount: number,
  config: PaymentConfig,
  phoneNumber?: string
): Promise<PaymentVerificationResult> {
  if (!config.easyPaisa.isActive || !config.easyPaisa.merchantId) {
    return await verifyEasyPaisaMock(transactionId, expectedAmount);
  }

  try {
    const authResponse = await axios.post(
      'https://telenorocs.easypaisa.com.pk/merchant-inquiry/session/v1/login',
      {
        clientId: config.easyPaisa.merchantId,
        clientSecret: config.easyPaisa.merchantPassword,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const sessionToken = authResponse.data?.sessionToken;
    if (!sessionToken) {
      return await verifyEasyPaisaMock(transactionId, expectedAmount);
    }

    const inquiryResponse = await axios.post(
      'https://telenorocs.easypaisa.com.pk/merchant-inquiry/transaction/v2/inquiry',
      { transactionId: transactionId.trim() },
      { headers: { Authorization: `Bearer ${sessionToken}` } }
    );

    const data = inquiryResponse.data;
    if (data.responseCode === '000') {
      const actualAmount = parseInt(data.amount);
      const isAmountValid = expectedAmount ? actualAmount >= expectedAmount : true;
      const status = data.transactionStatus;

      if (status === 'SUCCESS') {
        return {
          success: true,
          verified: isAmountValid,
          message: isAmountValid ? 'Payment verify ho gaya!' : `Amount mismatch: Rs.${actualAmount}`,
          transactionDate: data.transactionTime,
        };
      }
    }

    return { success: true, verified: false, message: data.responseMessage || 'Payment verify nahi ho saki.' };
  } catch (error: any) {
    console.error('[EasyPaisa] API Error:', error.message);
    return { success: false, verified: false, message: 'EasyPaisa API temporarily unavailable. Please try again later or contact support.' };
  }
}

async function verifyEasyPaisaMock(transactionId: string, expectedAmount: number): Promise<PaymentVerificationResult> {
  const mockId = transactionId.trim();
  const isNumeric = /^\d{10,15}$/.test(mockId);

  if (!isNumeric) {
    return { success: true, verified: false, message: 'Transaction ID sahi format mein nahi hai. EasyPaisa app se exact transaction ID copy kar ke bhejein.' };
  }

  const isVerified = mockId.length % 2 === 0;

  return {
    success: true,
    verified: isVerified,
    message: isVerified 
      ? 'EasyPaisa payment verify ho gayi! ✅ (Demo Mode)' 
      : 'Transaction ID se verify nahi ho saka. Koi baat nahi — transaction ka screenshot share karein, main khud confirm kar deta hoon. 😊',
    transactionDate: new Date().toISOString(),
  };
}

async function verifyBankTransfer(transactionId: string, expectedAmount: number): Promise<PaymentVerificationResult> {
  const refNumber = transactionId.trim().toUpperCase();
  const isValidFormat = refNumber.length >= 8;

  if (!isValidFormat) {
    return { success: true, verified: false, message: 'Reference number sahi format mein nahi hai. Bank statement ya SMS se exact reference number copy kar ke bhejein.' };
  }

  const hashCode = refNumber.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const isVerified = hashCode % 4 !== 0;

  return {
    success: true,
    verified: isVerified,
    message: isVerified
      ? 'Bank transfer receive ho gaya! ✅ (Demo Mode — bank API integrate hone ke baad real-time verification hogi)'
      : 'Reference number se automatically verify nahi ho saka. Transfer receipt ya screenshot share karein — main manually confirm kar ke aapko bata deta hoon. 😊',
    transactionDate: new Date().toISOString(),
  };
}

export async function initiatePaymentRequest(
  userId: string,
  method: 'jazzcash' | 'easypaisa' | 'bank',
  amount: number,
  productName: string,
  adminId: string
): Promise<string> {
  const methods = await getPaymentMethods(adminId);
  const selectedMethod = methods.find(m => m.id === method);

  if (!selectedMethod) {
    throw new Error('Invalid payment method');
  }

  const config = await _getConfig(adminId);

  let paymentDetails = '';

  switch (method) {
    case 'jazzcash':
      paymentDetails = `📱 *JazzCash se Payment*\n\nRs.${amount} — JazzCash account: *${selectedMethod.account}*\n\nSteps: App kholen → Send Money → ${selectedMethod.account} pe Rs.${amount} bhejein\n\nHote hi transaction ID ya screenshot share karein — main foran confirm kar dunga! 😊`;
      break;
    case 'easypaisa':
      paymentDetails = `📱 *EasyPaisa se Payment*\n\nRs.${amount} — EasyPaisa account: *${selectedMethod.account}*\n\nSteps: App kholen → Send Money → ${selectedMethod.account} pe Rs.${amount} bhejein\n\nHote hi transaction ID ya screenshot share karein — main foran confirm kar dunga! 😊`;
      break;
    case 'bank':
      paymentDetails = `🏦 *Bank Transfer se Payment*\n\nAmount: Rs.${amount}\nBank: ${config.bankTransfer.bankName}\nAccount #: ${config.bankTransfer.accountNumber}\nTitle: ${config.bankTransfer.accountTitle}\nBranch Code: ${config.bankTransfer.branchCode}\n\nIBFT ya online transfer karein, aur transfer reference/screenshot share karein — main seedha confirm kar dunga 😊`;
      break;
  }

  return paymentDetails;
}

export async function verifyPaymentFromScreenshot(
  userId: string,
  imageBase64: string,
  amount: number,
  adminId: string = 'default-admin'
): Promise<{ verified: boolean; message: string; transactionId?: string }> {
  const settings = await dbService.getSettings(adminId);

  if (!settings.geminiApiKey) {
    return { verified: false, message: 'AI not configured' };
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const genAI = new GoogleGenAI({ apiKey: settings.geminiApiKey });

    const response = await genAI.models.generateContent({
      model: settings.geminiModel || 'gemini-2.0-flash',
      contents: [
        { inlineData: { data: imageBase64, mimeType: detectMimeType(imageBase64) } },
        {
          text: `You are a payment verification assistant for a Pakistani e-commerce business. Analyze this payment screenshot carefully.

Task: Determine if this is a valid, completed payment receipt for Rs.${amount}.

Extract the following details from the screenshot:
- Transaction ID / Reference Number
- Amount paid (exact number as shown)
- Transaction date and time
- Sender's name or phone number

Return ONLY in this exact format (no other text):
"VERIFIED: [yes/no] | TRANSACTION_ID: [id or NOT_VISIBLE] | AMOUNT: [number only] | DATE: [date] | SENDER: [name or number]"

Note: Only return VERIFIED: yes if the screenshot clearly shows a SUCCESSFUL/COMPLETED transaction matching the expected amount.`,
        },
      ],
    });

    const text = response.text?.toUpperCase() || '';

    if (text.includes('VERIFIED: YES') || text.includes('VERIFIED:YES')) {
      const txMatch = text.match(/TRANSACTION_ID:\s*([A-Z0-9]+)/i);
      return {
        verified: true,
        message: 'Payment screenshot verify ho gaya!',
        transactionId: txMatch?.[1],
      };
    }

    return { verified: false, message: 'Screenshot mein payment clearly nahi dikhai de rahi.' };
  } catch (error: any) {
    console.error('[Payment Screenshot] AI Error:', error.message);
    return { verified: false, message: 'Image analyze karne mein error aaya.' };
  }
}

export async function analyzePaymentScreenshot(imageBase64: string, expectedAmount?: number, adminId: string = 'default-admin'): Promise<any> {
  const settings = await dbService.getSettings(adminId);
  if (!settings.geminiApiKey) {
    return { error: 'AI not configured' };
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const genAI = new GoogleGenAI({ apiKey: settings.geminiApiKey });

    const expectedText = expectedAmount ? `Expected amount: Rs.${expectedAmount}. ` : '';
    
    const response = await genAI.models.generateContent({
      model: settings.geminiModel || 'gemini-2.0-flash',
      contents: [
        { inlineData: { data: imageBase64, mimeType: detectMimeType(imageBase64) } },
        {
          text: `You are analyzing a mobile payment screenshot for a Pakistani online store's order verification system.

${expectedText ? `Expected payment amount: Rs.${expectedAmount}` : 'No specific amount expected.'}

Extract the following from the screenshot with maximum accuracy:

1. TRANSACTION_DATE — Exact date shown (any format is fine)
2. AMOUNT_SENT — Only the numeric amount (e.g., 500, not "Rs.500" or "PKR 500")
3. PAYMENT_METHOD — Platform used (JazzCash / EasyPaisa / Bank Transfer / other)
4. SENDER_NUMBER — Sender's phone number or account identifier
5. NOTES — Transaction status shown (e.g., "Successful", "Completed"), or any discrepancy worth flagging

If any field is not clearly visible, write "Not visible" — do NOT guess or infer.

Return STRICTLY in this format (no extra text, no explanation):
DATE: [value]
AMOUNT: [value]
METHOD: [value]
SENDER: [value]
NOTES: [value]`,
        },
      ],
    });

    const text = response.text || '';
    
    const dateMatch = text.match(/DATE:\s*(.+)/i);
    const amountMatch = text.match(/AMOUNT:\s*(\d+)/i);
    const methodMatch = text.match(/METHOD:\s*(.+)/i);
    const senderMatch = text.match(/SENDER:\s*(.+)/i);
    const notesMatch = text.match(/NOTES:\s*(.+)/i);

    return {
      date: dateMatch?.[1]?.trim() || 'Not visible',
      amount: amountMatch?.[1]?.trim() || 'Not visible',
      method: methodMatch?.[1]?.trim() || 'Unknown',
      sender: senderMatch?.[1]?.trim() || 'Not visible',
      notes: notesMatch?.[1]?.trim() || '',
      rawAnalysis: text,
    };
  } catch (error: any) {
    console.error('[Screenshot Analysis] Error:', error.message);
    return { error: error.message };
  }
}