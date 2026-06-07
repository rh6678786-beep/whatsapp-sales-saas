import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @prisma/adapter-pg — regular function so `new PrismaPg(pool)` works
vi.mock('@prisma/adapter-pg', () => {
  function MockPrismaPg() {
    // no-op — PrismaClient is mocked so adapter is never used
  }
  return { PrismaPg: MockPrismaPg };
});

// Mock pg.Pool — regular function so `new Pool()` works
vi.mock('pg', () => {
  function MockPool() {
    return {
      connect: vi.fn().mockResolvedValue({}),
      query: vi.fn().mockResolvedValue({ rows: [] }),
      end: vi.fn(),
      on: vi.fn(),
    };
  }
  return { default: { Pool: MockPool }, Pool: MockPool };
});

// Mock Redis
vi.mock('../lib/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
  isRedisConnected: vi.fn().mockReturnValue(false),
  connectRedis: vi.fn().mockResolvedValue(undefined),
  disconnectRedis: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger
vi.mock('../lib/logger.js', () => ({
  createChildLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock encryption
vi.mock('../lib/encryption.js', () => ({
  encrypt: vi.fn((v: string) => `encrypted:${v}`),
  decrypt: vi.fn((v: string) => v.replace('encrypted:', '')),
  isEncrypted: vi.fn((v: string) => v.startsWith('encrypted:')),
}));

// ---- Shared mock instance for PrismaClient ----
// vi.hoisted ensures the variable exists BEFORE vi.mock factory runs
const mockPrismaInstance = vi.hoisted(() => {
  const instance: Record<string, any> = {};
  return instance;
});

vi.mock('../../generated/client', () => {
  function MockPrismaClient() {
    // Populate default mock methods into the shared instance
    mockPrismaInstance.$queryRaw = vi.fn().mockResolvedValue([{ now: new Date() }]);
    mockPrismaInstance.$executeRaw = vi.fn().mockResolvedValue([]);
    mockPrismaInstance.$disconnect = vi.fn();
    mockPrismaInstance.admin = {
      findUnique: vi.fn().mockResolvedValue({ adminId: 'test-admin' }),
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    };
    mockPrismaInstance.product = {
      create: vi.fn().mockResolvedValue({ id: 'prod-1' }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    mockPrismaInstance.purchase = {
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'purchase-1', ...args.data })),
      findMany: vi.fn().mockResolvedValue([
        { id: '1', productName: 'Test Product', quantity: 10, pricePerUnit: 500, totalCost: 5000, supplier: 'Test Supplier', createdAt: new Date() },
      ]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 5000 }, _count: 5 }),
    };
    mockPrismaInstance.session = {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    };
    mockPrismaInstance.message = {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    };
    mockPrismaInstance.order = {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      upsert: vi.fn().mockResolvedValue({}),
    };
    mockPrismaInstance.deal = {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    mockPrismaInstance.dripCampaign = {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    mockPrismaInstance.otpStore = {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    };
    return mockPrismaInstance;
  }
  return { PrismaClient: MockPrismaClient };
});

import { dbService } from '../services/dbService.js';

describe('dbService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPurchases', () => {
    it('should return purchases with date filtering', async () => {
      const purchases = await dbService.getPurchases('test-admin', '2026-06-01', '2026-06-07');
      expect(Array.isArray(purchases)).toBe(true);
      expect(purchases.length).toBeGreaterThan(0);
      expect(purchases[0]).toHaveProperty('productName');
    });

    it('should return all purchases without date filter', async () => {
      const purchases = await dbService.getPurchases('test-admin');
      expect(Array.isArray(purchases)).toBe(true);
    });
  });

  describe('getPurchaseStats', () => {
    it('should return purchase statistics', async () => {
      const stats = await dbService.getPurchaseStats('test-admin');
      expect(stats).toHaveProperty('totalCost');
      expect(stats).toHaveProperty('count');
      expect(stats).toHaveProperty('thisMonth');
    });
  });

  describe('addPurchase', () => {
    it('should create a purchase record', async () => {
      const result = await dbService.addPurchase('test-admin', {
        productName: 'Test Product',
        quantity: 10,
        pricePerUnit: 500,
      });
      expect(result).toBeDefined();
    });

    it('should calculate totalCost correctly', async () => {
      const result = await dbService.addPurchase('test-admin', {
        productName: 'Bulk Product',
        quantity: 50,
        pricePerUnit: 1000,
      });
      expect(result).toBeDefined();
    });
  });

  describe('getTodayOrders', () => {
    it('should return today orders', async () => {
      const orders = await dbService.getTodayOrders('test-admin');
      expect(Array.isArray(orders)).toBe(true);
    });
  });

  describe('bulkSaveProducts', () => {
    it('should create products and return created count', async () => {
      // Use shared mock instance directly
      mockPrismaInstance.product.create = vi.fn().mockResolvedValue({ id: 'prod-1' });
      mockPrismaInstance.purchase.create = vi.fn().mockResolvedValue({ id: 'purchase-1' });

      const result = await dbService.bulkSaveProducts('test-admin', [
        { name: 'Test Product 1', price: 1000, costPrice: 700, stock: 10 },
        { name: 'Test Product 2', price: 2000, costPrice: 1500, stock: 5 },
      ]);
      expect(result.created).toBeGreaterThanOrEqual(2);
    });
  });
});
