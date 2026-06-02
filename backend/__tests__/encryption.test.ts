import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../lib/encryption.js";

describe("Encryption Service", () => {
  it("should encrypt and decrypt correctly", () => {
    const original = "super-secret-password-123";
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toContain(":"); // iv:encrypted format

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("should produce different ciphertexts for same input", () => {
    const input = "same-value";
    const e1 = encrypt(input);
    const e2 = encrypt(input);
    expect(e1).not.toBe(e2); // IV should differ
  });

  it("should handle empty string", () => {
    const encrypted = encrypt("");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe("");
  });

  it("should throw on tampered ciphertext", () => {
    const encrypted = encrypt("secret");
    const tampered = encrypted.split(":").slice(0, -1).join(":") + ":tampered";
    expect(() => decrypt(tampered)).toThrow();
  });

  it("should handle special characters", () => {
    const original = "p@ssw0rd!£$%^&*()_+-=[]{}|;':\",./<>?~`你好";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });
});
