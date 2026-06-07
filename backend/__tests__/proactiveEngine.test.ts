import { describe, it, expect, vi } from 'vitest';

// Mock @prisma/adapter-pg — regular function so `new PrismaPg(pool)` works
vi.mock('@prisma/adapter-pg', () => {
  function MockPrismaPg() {
    // no-op
  }
  return { PrismaPg: MockPrismaPg };
});

vi.mock('pg', () => {
  function MockPool() {
    return { connect: vi.fn(), query: vi.fn(), end: vi.fn(), on: vi.fn() };
  }
  return { default: { Pool: MockPool }, Pool: MockPool };
});

vi.mock('../lib/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
  isRedisConnected: vi.fn().mockReturnValue(false),
  connectRedis: vi.fn(),
  disconnectRedis: vi.fn(),
}));
vi.mock('../lib/logger.js', () => ({
  createChildLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));
vi.mock('../lib/encryption.js', () => ({
  encrypt: vi.fn((v: string) => v),
  decrypt: vi.fn((v: string) => v),
  isEncrypted: vi.fn(() => false),
}));

// ---- Shared mock instance for PrismaClient ----
const mockPrismaInstance = vi.hoisted(() => {
  const instance: Record<string, any> = {};
  return instance;
});

vi.mock('../../generated/client', () => {
  function MockPrismaClient() {
    mockPrismaInstance.$queryRaw = vi.fn().mockResolvedValue([{ now: new Date() }]);
    mockPrismaInstance.$executeRaw = vi.fn().mockResolvedValue([]);
    mockPrismaInstance.$disconnect = vi.fn();
    mockPrismaInstance.admin = { findUnique: vi.fn().mockResolvedValue({ adminId: 'test-admin' }) };
    mockPrismaInstance.purchase = { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]), aggregate: vi.fn() };
    mockPrismaInstance.product = {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([
        { id: 'prod-1', name: 'Test Product', price: 1000, costPrice: 700, features: ['Feature 1'], images: [], videos: [] },
      ]),
      count: vi.fn().mockResolvedValue(0),
    };
    mockPrismaInstance.session = {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue({}),
    };
    mockPrismaInstance.message = { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) };
    mockPrismaInstance.order = { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) };
    mockPrismaInstance.otpStore = { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() };
    mockPrismaInstance.deal = { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), updateMany: vi.fn() };
    mockPrismaInstance.dripCampaign = {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    };
    return mockPrismaInstance;
  }
  return { PrismaClient: MockPrismaClient };
});

import { dbService } from '../services/dbService.js';

describe('Proactive Engine', () => {
  describe('getDailyProactiveCount', () => {
    it('should return 0 when no reminder sent today', async () => {
      const count = await dbService.getDailyProactiveCount('test-admin', 'user-1');
      expect(count).toBe(0);
    });

    it('should return remindersCount when reminder was sent today', async () => {
      // Use shared mock instance directly
      mockPrismaInstance.session.findUnique = vi.fn().mockResolvedValue({
        lastReminderAt: new Date(),
        remindersCount: 3,
      });
      const count = await dbService.getDailyProactiveCount('test-admin', 'user-1');
      expect(count).toBe(3);
    });
  });

  describe('getInactiveSessions', () => {
    it('should return inactive sessions list', async () => {
      const sessions = await dbService.getInactiveSessions('test-admin', 7);
      expect(Array.isArray(sessions)).toBe(true);
    });
  });

  describe('getCustomersWithBirthdays', () => {
    it('should return customers with today birthdays', async () => {
      const sessions = await dbService.getCustomersWithBirthdays('test-admin');
      expect(Array.isArray(sessions)).toBe(true);
    });
  });

  describe('getSessionsForDripCampaign', () => {
    it('should return sessions for abandoned cart trigger', async () => {
      const sessions = await dbService.getSessionsForDripCampaign('test-admin', 'abandoned_cart');
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('should return empty for manual trigger', async () => {
      const sessions = await dbService.getSessionsForDripCampaign('test-admin', 'manual');
      expect(sessions).toEqual([]);
    });
  });
});
