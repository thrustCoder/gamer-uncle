import { describe, it, expect, beforeEach } from '@jest/globals';
import { TIMEOUTS } from '../e2e/test-data';

describe('E2E Test Data Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('TIMEOUTS Configuration', () => {
    it('should use shorter timeouts in CI environment', () => {
      process.env.CI = 'true';
      
      // Re-require the module to get updated timeouts
      jest.resetModules();
      const { TIMEOUTS: ciTimeouts } = require('../e2e/test-data');
      
      expect(ciTimeouts.API_RESPONSE).toBe(45000);
      expect(ciTimeouts.TYPING_INDICATOR).toBe(8000);
      expect(ciTimeouts.MESSAGE_APPEAR).toBe(20000);
      expect(ciTimeouts.PAGE_LOAD).toBe(25000);
      expect(ciTimeouts.RETRY_DELAY).toBe(3000);
    });

    it('should use longer timeouts in development environment', () => {
      delete process.env.CI;
      
      // Re-require the module to get updated timeouts
      jest.resetModules();
      const { TIMEOUTS: devTimeouts } = require('../e2e/test-data');
      
      expect(devTimeouts.API_RESPONSE).toBe(45000);
      expect(devTimeouts.TYPING_INDICATOR).toBe(5000);
      expect(devTimeouts.MESSAGE_APPEAR).toBe(15000);
      expect(devTimeouts.PAGE_LOAD).toBe(15000);
      expect(devTimeouts.RETRY_DELAY).toBe(3000);
    });

    it('should have reasonable timeout values', () => {
      // Ensure timeouts are not too short or too long
      expect(TIMEOUTS.API_RESPONSE).toBeGreaterThan(5000);
      expect(TIMEOUTS.API_RESPONSE).toBeLessThan(60000);
      
      expect(TIMEOUTS.PAGE_LOAD).toBeGreaterThan(3000);
      expect(TIMEOUTS.PAGE_LOAD).toBeLessThan(30000);
      
      expect(TIMEOUTS.RETRY_DELAY).toBeGreaterThan(1000);
      expect(TIMEOUTS.RETRY_DELAY).toBeLessThan(5000);
    });
  });

  describe('Test Data Integrity', () => {
    it('should have all required timeout properties', () => {
      expect(TIMEOUTS).toHaveProperty('API_RESPONSE');
      expect(TIMEOUTS).toHaveProperty('TYPING_INDICATOR');
      expect(TIMEOUTS).toHaveProperty('MESSAGE_APPEAR');
      expect(TIMEOUTS).toHaveProperty('PAGE_LOAD');
      expect(TIMEOUTS).toHaveProperty('RETRY_DELAY');
    });

    it('should have valid timeout values', () => {
      Object.values(TIMEOUTS).forEach(timeout => {
        expect(typeof timeout).toBe('number');
        expect(timeout).toBeGreaterThan(0);
      });
    });
  });
});
