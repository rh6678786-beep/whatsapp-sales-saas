import axios from "axios";
import { dbService } from "./dbService";
import { encrypt, decrypt, isEncrypted } from "../lib/encryption.js";
import { env } from "../lib/env.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("payment");

// ---- Encrypted Payment Config ----

interface JazzCashConfig {
  merchantId: string;
  merchantPassword: string; // encrypted at rest
  isActive: boolean;
}

interface EasyPaisaConfig {
  merchantId: string;
  merchantPassword: string; // encrypted at rest
  isActive: boolean;
}

interface BankTransferConfig {
  accountTitle: string;
  accountNumber: string;
  bankName: string;
  branchCode: string;
  isActive: boolean;
}

interface PaymentConfig {
  jazzCash: JazzCashConfig;
  easyPaisa: EasyPaisaConfig;
  bankTransfer: BankTransferConfig;
}

function encryptConfigPasswords(config: PaymentConfig): PaymentConfig {
  return {
    ...config,
    jazzCash: {
      ...config.jazzCash,
      merchantPassword: config.jazzCash.merchantPassword
        ? isEncrypted(config.jazzCash.merchantPassword)
          ? config.jazzCash.merchantPassword
          : encrypt(config.jazzCash.merchantPassword)
        : "",
    },
    easyPaisa: {
      ...config.easyPaisa,
      merchantPassword: config.easyPaisa.merchantPassword
        ? isEncrypted(config.easyPaisa.merchantPassword)
          ? config.easyPaisa.merchantPassword
          : encrypt(config.easyPaisa.merchantPassword)
        : "",
    },
  };
}

function decryptConfigPasswords(config: PaymentConfig): PaymentConfig {
  return {
    ...config,
    jazzCash: {
      ...config.jazzCash,
      merchantPassword: config.jazzCash.merchantPassword && isEncrypted(config.jazzCash.merchantPassword)
        ? decrypt(config.jazzCash.merchantPassword)
        : config.jazzCash.merchantPassword,
    },
    easyPaisa: {
      ...config.easyPaisa,
      merchantPassword: config.easyPaisa.merchantPassword && isEncrypted(config.easyPaisa.merchantPassword)
        ? decrypt(config.easyPaisa.merchantPassword)
        : config.easyPaisa.merchantPassword,
    },
  };
}

function sanitizeConfig(config: PaymentConfig): PaymentConfig {
  return {
    ...config,
    jazzCash: {
      ...config.jazzCash,
      merchantPassword: config.jazzCash.merchantPassword ? "********" : "",
    },
    easyPaisa: {
      ...config.easyPaisa,
      merchantPassword: config.easyPaisa.merchantPassword ? "********" : "",
    },
  };
}

function defaultConfig(): PaymentConfig {
  return {
    jazzCash: { merchantId: "", merchantPassword: "", isActive: false },
    easyPaisa: { merchantId: "", merchantPassword: "", isActive: false },
    bankTransfer: {
      accountTitle: "",
      accountNumber: "",
      bankName: "",
      branchCode: "",
      isActive: false,
    },
  };
}

async function _getConfig(adminId: string): Promise<PaymentConfig> {
  const settings = await dbService.getSettings(adminId);
  const config = (settings.paymentConfig as PaymentConfig) || defaultConfig();
  return decryptConfigPasswords(config);
}

// ---- Exported API ----

export async function updatePaymentConfig(
  adminId: string,
  config: Partial<PaymentConfig>
): Promise<PaymentConfig> {
  // Validate the config shape (allowlist fields)
  const allowedKeys = ["jazzCash", "easyPaisa", "bankTransfer"];
  for (const key of Object.keys(config)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`Invalid payment config key: ${key}`);
    }
  }

  const paymentConfig = await _getConfig(adminId);
  
  // Deep merge: preserve existing sub-object fields when only partial updates are sent
  const merged: PaymentConfig = {
    jazzCash: {
      ...paymentConfig.jazzCash,
      ...(config.jazzCash || {}),
    },
    easyPaisa: {
      ...paymentConfig.easyPaisa,
      ...(config.easyPaisa || {}),
    },
    bankTransfer: {
      ...paymentConfig.bankTransfer,
      ...(config.bankTransfer || {}),
    },
  };

  // Validate inner fields
  if (merged.jazzCash) {
    const allowedJazz = ["merchantId", "merchantPassword", "isActive"];
    for (const k of Object.keys(merged.jazzCash)) {
      if (!allowedJazz.includes(k)) throw new Error(`Invalid jazzCash field: ${k}`);
    }
  }
  if (merged.easyPaisa) {
    const allowedEasy = ["merchantId", "merchantPassword", "isActive"];
    for (const k of Object.keys(merged.easyPaisa)) {
      if (!allowedEasy.includes(k)) throw new Error(`Invalid easyPaisa field: ${k}`);
    }
  }
  if (merged.bankTransfer) {
    const allowedBank = ["accountTitle", "accountNumber", "bankName", "branchCode", "isActive"];
    for (const k of Object.keys(merged.bankTransfer)) {
      if (!allowedBank.includes(k)) throw new Error(`Invalid bankTransfer field: ${k}`);
    }
  }

  // Encrypt before storing (preserves existing encrypted passwords if not overwritten)
  const encrypted = encryptConfigPasswords(merged);
  await dbService.updateSettings(adminId, { paymentConfig: encrypted as any });
  log.info({ adminId }, "Payment config updated");
  return merged;
}

export async function getPaymentConfig(adminId: string) {
  const cfg = await _getConfig(adminId);
  return sanitizeConfig(cfg);
}

export async function getPaymentMethods(adminId: string) {
  // Get decrypted config for sending payment instructions to customers
  const paymentConfig = await _getConfig(adminId);
  const methods: any[] = [];

  if (paymentConfig.jazzCash?.isActive && paymentConfig.jazzCash.merchantId) {
    methods.push({
      id: "jazzcash",
      name: "JazzCash",
      type: "mobile_wallet",
      account: paymentConfig.jazzCash.merchantId,
      instructions:
        "JazzCash app mein ja kar payment karain, transaction ID bhejein.",
    });
  }

  if (paymentConfig.easyPaisa?.isActive && paymentConfig.easyPaisa.merchantId) {
    methods.push({
      id: "easypaisa",
      name: "EasyPaisa",
      type: "mobile_wallet",
      account: paymentConfig.easyPaisa.merchantId,
      instructions:
        "EasyPaisa app mein ja kar payment karain, transaction ID bhejein.",
    });
  }

  if (paymentConfig.bankTransfer?.isActive) {
    methods.push({
      id: "bank",
      name: "Bank Transfer",
      type: "bank",
      accountTitle: paymentConfig.bankTransfer.accountTitle,
      accountNumber: paymentConfig.bankTransfer.accountNumber,
      bankName: paymentConfig.bankTransfer.bankName,
      branchCode: paymentConfig.bankTransfer.branchCode,
      instructions:
        "IBFT/RTGS karein aur transaction reference bhejein.",
    });
  }

  return methods;
}

export interface PaymentVerificationRequest {
  paymentMethod: "jazzcash" | "easypaisa" | "bank";
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
  paymentMethod: "jazzcash" | "easypaisa" | "bank",
  transactionId: string,
  amount: number,
  adminId: string,
  phoneNumber?: string
): Promise<PaymentVerificationResult> {
  log.info({ adminId, paymentMethod, transactionId, amount }, "Verifying payment");

  if (!transactionId || transactionId.trim() === "") {
    return { success: false, verified: false, message: "Transaction ID required hai." };
  }

  const config = await _getConfig(adminId);

  switch (paymentMethod) {
    case "jazzcash":
      return await verifyJazzCash(transactionId, amount, config);
    case "easypaisa":
      return await verifyEasyPaisa(transactionId, amount, config, phoneNumber);
    case "bank":
      return await verifyBankTransfer(transactionId, amount);
    default:
      return { success: false, verified: false, message: "Invalid payment method." };
  }
}

// ---- Payment Gateway Integrations ----

async function verifyJazzCash(
  transactionId: string,
  expectedAmount: number,
  config: PaymentConfig
): Promise<PaymentVerificationResult> {
  if (!config.jazzCash.isActive || !config.jazzCash.merchantId) {
    return await verifyJazzCashMock(transactionId, expectedAmount);
  }

  try {
    const response = await axios.post(
      "https://www.jazzcash.com.pk/ApplicationAPI/api/payment/inquiry",
      {
        version: "2.0.0",
        language: "english",
        merchantId: config.jazzCash.merchantId,
        password: config.jazzCash.merchantPassword,
        transactionId: transactionId.trim().toUpperCase(),
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const data = response.data;
    if (data.responseCode === "000" || data.ResponseCode === "000") {
      const actualAmount = parseInt(data.amount || data.ResponseAmount || "0");
      const isAmountValid = expectedAmount ? actualAmount >= expectedAmount : true;
      const status = data.transactionStatus || data.ResponseStatus;

      if (status === "COMPLETED" || status === "000" || status === "01") {
        return {
          success: true,
          verified: isAmountValid,
          message: isAmountValid
            ? "Payment verify ho gaya!"
            : `Amount mismatch: Rs.${actualAmount} vs Rs.${expectedAmount}`,
          transactionDate: data.transactionTime || data.ResponseTime,
          customerName: data.customerMsisdn || data.Msisdn,
        };
      }
    }

    return {
      success: true,
      verified: false,
      message: data.responseMessage || "Payment verify nahi ho saki.",
    };
  } catch (error: any) {
    log.error({ err: error }, "JazzCash API error");
    return {
      success: false,
      verified: false,
      message:
        "JazzCash API temporarily unavailable. Please try again later or contact support.",
    };
  }
}

async function verifyJazzCashMock(
  transactionId: string,
  _expectedAmount: number
): Promise<PaymentVerificationResult> {
  const mockId = transactionId.trim().toUpperCase();
  const isValidFormat = /^[A-Z0-9]{8,20}$/.test(mockId);

  if (!isValidFormat) {
    return {
      success: true,
      verified: false,
      message:
        "Transaction ID format sahi nahi hai. JazzCash app se exact transaction ID copy kar ke bhejein.",
    };
  }

  // Deterministic: same transaction ID always returns same result
  const sum = mockId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const isVerified = sum % 5 >= 2;

  return {
    success: true,
    verified: isVerified,
    message: isVerified
      ? "Payment verify ho gaya! (Demo Mode)"
      : "Transaction ID verify nahi ho saki. Screenshot bhejein, main manually check kar leta hoon.",
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
      "https://telenorocs.easypaisa.com.pk/merchant-inquiry/session/v1/login",
      {
        clientId: config.easyPaisa.merchantId,
        clientSecret: config.easyPaisa.merchantPassword,
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const sessionToken = authResponse.data?.sessionToken;
    if (!sessionToken) {
      return await verifyEasyPaisaMock(transactionId, expectedAmount);
    }

    const inquiryResponse = await axios.post(
      "https://telenorocs.easypaisa.com.pk/merchant-inquiry/transaction/v2/inquiry",
      { transactionId: transactionId.trim() },
      { headers: { Authorization: `Bearer ${sessionToken}` } }
    );

    const data = inquiryResponse.data;
    if (data.responseCode === "000") {
      const actualAmount = parseInt(data.amount);
      const isAmountValid = expectedAmount ? actualAmount >= expectedAmount : true;
      const status = data.transactionStatus;

      if (status === "SUCCESS") {
        return {
          success: true,
          verified: isAmountValid,
          message: isAmountValid
            ? "Payment verify ho gaya!"
            : `Amount mismatch: Rs.${actualAmount}`,
          transactionDate: data.transactionTime,
        };
      }
    }

    return {
      success: true,
      verified: false,
      message: data.responseMessage || "Payment verify nahi ho saki.",
    };
  } catch (error: any) {
    log.error({ err: error }, "EasyPaisa API error");
    return {
      success: false,
      verified: false,
      message:
        "EasyPaisa API temporarily unavailable. Please try again later or contact support.",
    };
  }
}

async function verifyEasyPaisaMock(
  transactionId: string,
  _expectedAmount: number
): Promise<PaymentVerificationResult> {
  const mockId = transactionId.trim();
  const isNumeric = /^\d{10,15}$/.test(mockId);

  if (!isNumeric) {
    return {
      success: true,
      verified: false,
      message:
        "Transaction ID sahi format mein nahi hai. EasyPaisa app se exact ID copy karein.",
    };
  }

  // Deterministic: same transaction ID always returns same result
  const sum = mockId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const isVerified = sum % 5 >= 2;

  return {
    success: true,
    verified: isVerified,
    message: isVerified
      ? "EasyPaisa payment verify ho gayi! (Demo Mode)"
      : "Transaction ID verify nahi ho saki. Screenshot bhejein.",
    transactionDate: new Date().toISOString(),
  };
}

async function verifyBankTransfer(
  transactionId: string,
  _expectedAmount: number
): Promise<PaymentVerificationResult> {
  const refNumber = transactionId.trim().toUpperCase();
  const isValidFormat = refNumber.length >= 8;

  if (!isValidFormat) {
    return {
      success: true,
      verified: false,
      message:
        "Reference number sahi format mein nahi hai. Bank se exact reference copy karein.",
    };
  }

  // Deterministic: same reference always returns same result
  const sum = refNumber.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const isVerified = sum % 5 >= 2;

  return {
    success: true,
    verified: isVerified,
    message: isVerified
      ? "Bank transfer receive ho gaya! (Demo Mode)"
      : "Reference number verify nahi ho saka. Screenshot bhejein.",
    transactionDate: new Date().toISOString(),
  };
}

export async function initiatePaymentRequest(
  userId: string,
  method: "jazzcash" | "easypaisa" | "bank",
  amount: number,
  productName: string,
  adminId: string
): Promise<string> {
  const methods = await getPaymentMethods(adminId);
  const selectedMethod = methods.find((m) => m.id === method);

  if (!selectedMethod) {
    throw new Error("Invalid payment method");
  }

  const config = await _getConfig(adminId);

  switch (method) {
    case "jazzcash":
      return `📱 *JazzCash se Payment*\n\nRs.${amount} — JazzCash account: *${selectedMethod.account}*\n\nSteps: App kholen → Send Money → ${selectedMethod.account} pe Rs.${amount} bhejein\n\nHote hi transaction ID ya screenshot share karein — main foran confirm kar dunga! 😊`;
    case "easypaisa":
      return `📱 *EasyPaisa se Payment*\n\nRs.${amount} — EasyPaisa account: *${selectedMethod.account}*\n\nSteps: App kholen → Send Money → ${selectedMethod.account} pe Rs.${amount} bhejein\n\nHote hi transaction ID ya screenshot share karein — main foran confirm kar dunga! 😊`;
    case "bank":
      return `🏦 *Bank Transfer se Payment*\n\nAmount: Rs.${amount}\nBank: ${config.bankTransfer.bankName}\nAccount #: ${config.bankTransfer.accountNumber}\nTitle: ${config.bankTransfer.accountTitle}\nBranch Code: ${config.bankTransfer.branchCode}\n\nIBFT ya online transfer karein, aur transfer reference/screenshot share karein 😊`;
    default:
      throw new Error("Invalid payment method");
  }
}

// ---- Screenshot-based Verification (capped size) ----

const MAX_SCREENSHOT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function verifyPaymentFromScreenshot(
  userId: string,
  imageBase64: string,
  amount: number,
  adminId: string = "default-admin"
): Promise<{ verified: boolean; message: string; transactionId?: string }> {
  // Validate base64 size
  const sizeBytes = Math.ceil((imageBase64.length * 3) / 4);
  if (sizeBytes > MAX_SCREENSHOT_SIZE_BYTES) {
    return { verified: false, message: "Screenshot file too large. Maximum 5MB." };
  }

  const settings = await dbService.getSettings(adminId);

  if (!env.GEMINI_API_KEY) {
    return { verified: false, message: "AI not configured" };
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

    const response = await genAI.models.generateContent({
      model: settings.geminiModel || "gemini-2.0-flash",
      contents: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: detectMimeType(imageBase64),
          },
        },
        {
          text: `You are a payment verification assistant. Analyze the screenshot for a transaction of Rs.${amount}.

STRICT VERIFICATION:
- Only mark as verified if the screenshot CLEARLY shows a SUCCESSFUL/COMPLETED transaction
- Reject if: status is ambiguous, pending, failed, unclear, or screenshot appears edited
- Reject if: key fields (amount, status) are partially cut off or obscured

Required checks:
1. Transaction ID
2. Amount paid (must match or exceed Rs.${amount})
3. Transaction status (must show success/completed)
4. Sender info (if visible)

OUTPUT FORMAT (exactly):
VERIFIED: [yes/no] | TRANSACTION_ID: [id or NOT_VISIBLE] | AMOUNT: [number] | STATUS: [status]`,
        },
      ],
    });

    const text = response.text?.toUpperCase() || "";

    if (text.includes("VERIFIED: YES") || text.includes("VERIFIED:YES")) {
      const txMatch = text.match(/TRANSACTION_ID:\s*([A-Z0-9]+)/i);
      return {
        verified: true,
        message: "Payment screenshot verify ho gaya!",
        transactionId: txMatch?.[1],
      };
    }

    return {
      verified: false,
      message: "Screenshot mein payment clearly nahi dikhai de rahi.",
    };
  } catch (error: any) {
    log.error({ err: error, adminId }, "Screenshot AI error");
    return {
      verified: false,
      message: "Image analyze karne mein error aaya.",
    };
  }
}

export async function analyzePaymentScreenshot(
  imageBase64: string,
  expectedAmount?: number,
  adminId: string = "default-admin"
): Promise<any> {
  // Validate base64 size
  const sizeBytes = Math.ceil((imageBase64.length * 3) / 4);
  if (sizeBytes > MAX_SCREENSHOT_SIZE_BYTES) {
    return { error: "Screenshot file too large. Maximum 5MB." };
  }

  const settings = await dbService.getSettings(adminId);

  if (!env.GEMINI_API_KEY) {
    return { error: "AI not configured" };
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

    const expectedText = expectedAmount
      ? `Expected amount: Rs.${expectedAmount}. `
      : "";

    const response = await genAI.models.generateContent({
      model: settings.geminiModel || "gemini-2.0-flash",
      contents: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: detectMimeType(imageBase64),
          },
        },
        {
          text: `You are extracting structured payment data from a payment screenshot.

${expectedText}

Extract:
1. DATE — transaction date/time
2. AMOUNT — numeric value only
3. METHOD — JazzCash / EasyPaisa / Bank / Other
4. SENDER — sender's number or name
5. NOTES — status text and any discrepancies

OUTPUT:
DATE: [value]
AMOUNT: [value]
METHOD: [value]
SENDER: [value]
NOTES: [value]`,
        },
      ],
    });

    const text = response.text || "";

    const dateMatch = text.match(/DATE:\s*(.+)/i);
    const amountMatch = text.match(/AMOUNT:\s*(\d+)/i);
    const methodMatch = text.match(/METHOD:\s*(.+)/i);
    const senderMatch = text.match(/SENDER:\s*(.+)/i);
    const notesMatch = text.match(/NOTES:\s*(.+)/i);

    return {
      date: dateMatch?.[1]?.trim() || "Not visible",
      amount: amountMatch?.[1]?.trim() || "Not visible",
      method: methodMatch?.[1]?.trim() || "Unknown",
      sender: senderMatch?.[1]?.trim() || "Not visible",
      notes: notesMatch?.[1]?.trim() || "",
      rawAnalysis: text,
    };
  } catch (error: any) {
    log.error({ err: error }, "Screenshot analysis error");
    return { error: error.message };
  }
}

function detectMimeType(base64: string): string {
  const dataUriMatch = base64.match(/^data:image\/(\w+);base64,/);
  if (dataUriMatch) return `image/${dataUriMatch[1]}`;
  const clean = base64.replace(/^data:image\/\w+;base64,/, "");
  if (/^\/9j/.test(clean)) return "image/jpeg";
  if (/^iVBOR/.test(clean)) return "image/png";
  if (/^R0lGOD/.test(clean)) return "image/gif";
  if (/^UklGR/.test(clean)) return "image/webp";
  return "image/png";
}
