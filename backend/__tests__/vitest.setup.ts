import "dotenv/config";

// Ensure critical env vars exist for tests
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = "463b54ec3141548e7ecbcb42bfee907a8bcfd5b709cc168f85c62dee2f32b2ec";
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-for-testing-only";
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://localhost:5432/test";
}
