import "dotenv/config";

interface EnvConfig {
  GEMINI_API_KEY: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  ADMIN_PASSWORD: string;
  PORT: number;
  NODE_ENV: string;
  APP_URL: string;
  REDIS_URL: string;
  DB_SSL_REJECT_UNAUTHORIZED: boolean;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;
  FACEBOOK_CLIENT_ID: string;
  FACEBOOK_CLIENT_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_STARTER_PRICE_ID: string;
  STRIPE_PROFESSIONAL_PRICE_ID: string;
  STRIPE_ENTERPRISE_PRICE_ID: string;
  STRIPE_WEBHOOK_SECRET: string;
  AI_MONTHLY_BUDGET: number;
}

const requiredVars = [
  "GEMINI_API_KEY",
  "DATABASE_URL",
  "JWT_SECRET",
  "ADMIN_PASSWORD",
] as const;

const optionalDefaults: Record<string, string | number> = {
  PORT: 3000,
  NODE_ENV: "development",
  APP_URL: "",
  REDIS_URL: "",
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: 587,
  SMTP_USER: "",
  SMTP_PASS: "",
  SMTP_FROM: "noreply@saascloser.ai",
  FACEBOOK_CLIENT_ID: "",
  FACEBOOK_CLIENT_SECRET: "",
  STRIPE_SECRET_KEY: "",
  STRIPE_STARTER_PRICE_ID: "",
  STRIPE_PROFESSIONAL_PRICE_ID: "",
  STRIPE_ENTERPRISE_PRICE_ID: "",
  STRIPE_WEBHOOK_SECRET: "",
  AI_MONTHLY_BUDGET: 100,
};

function validateEnv(): EnvConfig {
  const missing = requiredVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[ENV] Missing required environment variables: ${missing.join(", ")}`);
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required env vars: ${missing.join(", ")}`);
    }
    console.warn("[ENV] Running in development mode with missing vars");
  }

  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required in production mode");
  }

  const config: EnvConfig = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
    DATABASE_URL: process.env.DATABASE_URL || "",
    JWT_SECRET: process.env.JWT_SECRET || "dev-secret-do-not-use-in-production",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin",
    PORT: parseInt(process.env.PORT || "3000", 10),
    NODE_ENV: process.env.NODE_ENV || "development",
    APP_URL: process.env.APP_URL || "",
    REDIS_URL: process.env.REDIS_URL || "",
    SMTP_HOST: process.env.SMTP_HOST || (optionalDefaults.SMTP_HOST as string),
    SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
    SMTP_USER: process.env.SMTP_USER || "",
    SMTP_PASS: process.env.SMTP_PASS || "",
    SMTP_FROM: process.env.SMTP_FROM || (optionalDefaults.SMTP_FROM as string),
    FACEBOOK_CLIENT_ID: process.env.FACEBOOK_CLIENT_ID || "",
    FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET || "",
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
    STRIPE_STARTER_PRICE_ID: process.env.STRIPE_STARTER_PRICE_ID || "",
    STRIPE_PROFESSIONAL_PRICE_ID: process.env.STRIPE_PROFESSIONAL_PRICE_ID || "",
    STRIPE_ENTERPRISE_PRICE_ID: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
    AI_MONTHLY_BUDGET: parseFloat(process.env.AI_MONTHLY_BUDGET || "100"),
    DB_SSL_REJECT_UNAUTHORIZED: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
  };

  console.log(`[ENV] Validated — ${Object.keys(config).length} variables loaded`);
  return config;
}

export const env = validateEnv();
