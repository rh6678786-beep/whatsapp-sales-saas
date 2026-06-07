import { describe, it, expect, vi } from 'vitest';

// Mock @prisma/adapter-pg — regular function so `new PrismaPg(pool)` works
vi.mock('@prisma/adapter-pg', () => {
  function MockPrismaPg() {
    // no-op
  }
  return { PrismaPg: MockPrismaPg };
});

// Mock pg.Pool — regular function so `new Pool()` works
vi.mock('pg', () => {
  function MockPool() {
    return { connect: vi.fn(), query: vi.fn(), end: vi.fn(), on: vi.fn() };
  }
  return { default: { Pool: MockPool }, Pool: MockPool };
});

vi.mock('../lib/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
  isRedisConnected: vi.fn().mockReturnValue(false),
}));
vi.mock('../lib/logger.js', () => ({
  createChildLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
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
    mockPrismaInstance.product = { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) };
    mockPrismaInstance.session = { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) };
    mockPrismaInstance.message = { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) };
    mockPrismaInstance.order = { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) };
    mockPrismaInstance.otpStore = { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() };
    mockPrismaInstance.deal = { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), updateMany: vi.fn() };
    mockPrismaInstance.dripCampaign = {
      findMany: vi.fn().mockResolvedValue([
        { id: 'campaign-1', name: 'Test Campaign', trigger: 'abandoned_cart', enabled: true, steps: [{ day: 1, message: 'Hello!' }], createdAt: new Date() },
      ]),
      create: vi.fn().mockImplementation(({ data }: any) => ({ id: 'campaign-new', ...data, createdAt: new Date() })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    return mockPrismaInstance;
  }
  return { PrismaClient: MockPrismaClient };
});

import { dbService } from '../services/dbService.js';

describe('Drip Campaign Service', () => {
  it('should list campaigns', async () => {
    const campaigns = await dbService.getCampaigns('test-admin');
    expect(Array.isArray(campaigns)).toBe(true);
    expect(campaigns.length).toBeGreaterThan(0);
    expect(campaigns[0]).toHaveProperty('name');
    expect(campaigns[0]).toHaveProperty('trigger');
  });

  it('should create a campaign', async () => {
    const campaign = await dbService.addCampaign('test-admin', {
      name: 'New Campaign',
      trigger: 'abandoned_cart',
      enabled: true,
      steps: [{ day: 1, message: 'Hi there!', aiGenerated: false }],
    });
    expect(campaign).toHaveProperty('id');
    expect(campaign.name).toBe('New Campaign');
  });

  it('should update a campaign', async () => {
    const result = await dbService.updateCampaign('test-admin', 'campaign-1', { enabled: false });
    expect(result).toBeUndefined();
  });

  it('should delete a campaign', async () => {
    const result = await dbService.deleteCampaign('test-admin', 'campaign-1');
    expect(result).toBeUndefined();
  });

  it('should handle errors gracefully', async () => {
    // Use shared mock instance directly
    mockPrismaInstance.dripCampaign.findMany = vi.fn().mockRejectedValue(new Error('DB error'));
    const campaigns = await dbService.getCampaigns('test-admin');
    expect(campaigns).toEqual([]);
  });
});
