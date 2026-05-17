import { describe, it, expect, vi } from 'vitest';

// Mock client-side globals to support safe headless Node execution
global.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(() => null),
  length: 0
};

global.window = {
  location: {
    origin: 'http://localhost:5173',
    search: ''
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
} as any;

Object.defineProperty(global, 'navigator', {
  value: {
    onLine: true
  },
  configurable: true,
  writable: true
});

// Dynamically import drugService AFTER global environment mocks are in place
const { drugService } = await import('../services/drugService');

describe('Drug Substitution Service Tests', () => {
  it('should return an empty array if the current item has no unit price', () => {
    const currentItem = { id: '1', medicine_name: 'Paracetamol 500mg' };
    const candidates = [
      { id: '2', medicine_name: 'Calpol 500mg', unit_price: 15, purchase_price: 5, composition: 'Paracetamol' }
    ];
    const results = drugService.findBetterMarginSubstitutes(currentItem, candidates);
    expect(results).toEqual([]);
  });

  it('should filter out candidates that have no chemical, generic, or name relationship', () => {
    const currentItem = {
      id: '1',
      medicine_name: 'Paracetamol 500mg',
      unit_price: 10,
      purchase_price: 8,
      composition: 'Paracetamol'
    };
    const candidates = [
      { id: '2', medicine_name: 'Amlodipine 5mg', unit_price: 30, purchase_price: 5, composition: 'Amlodipine' }
    ];
    const results = drugService.findBetterMarginSubstitutes(currentItem, candidates);
    expect(results).toEqual([]);
  });

  it('should identify a high-margin generic substitute matching composition', () => {
    const currentItem = {
      id: '1',
      medicine_name: 'Calpol 500mg',
      unit_price: 20,
      purchase_price: 15, // Profit = ₹5, Margin = 25%
      composition: 'Paracetamol'
    };
    const candidates = [
      {
        id: '2',
        medicine_name: 'Generic Paracetamol',
        unit_price: 18,
        purchase_price: 5, // Profit = ₹13, Margin = 72% (Significant gain: > ₹5 improvement)
        composition: 'Paracetamol'
      }
    ];
    const results = drugService.findBetterMarginSubstitutes(currentItem, candidates);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('2');
  });

  it('should exclude candidates that do not meet the minimum threshold of ₹5 profit or 5% margin gain', () => {
    const currentItem = {
      id: '1',
      medicine_name: 'Calpol 500mg',
      unit_price: 20,
      purchase_price: 15, // Profit = ₹5
      composition: 'Paracetamol'
    };
    const candidates = [
      {
        id: '2',
        medicine_name: 'Paracetamol Low Margins',
        unit_price: 20,
        purchase_price: 14.5, // Profit = ₹5.5 (only ₹0.5 gain, and margin gain is negligible)
        composition: 'Paracetamol'
      }
    ];
    const results = drugService.findBetterMarginSubstitutes(currentItem, candidates);
    expect(results).toEqual([]);
  });

  it('should sort returned substitutions descending by profit', () => {
    const currentItem = {
      id: '1',
      medicine_name: 'Calpol 500',
      unit_price: 20,
      purchase_price: 16, // Profit = ₹4
      composition: 'Paracetamol'
    };
    const candidates = [
      {
        id: '2',
        medicine_name: 'Generic Para Med',
        unit_price: 20,
        purchase_price: 10, // Profit = ₹10
        composition: 'Paracetamol'
      },
      {
        id: '3',
        medicine_name: 'Generic Para Premium',
        unit_price: 25,
        purchase_price: 11, // Profit = ₹14
        composition: 'Paracetamol'
      }
    ];
    const results = drugService.findBetterMarginSubstitutes(currentItem, candidates);
    expect(results.length).toBe(2);
    expect(results[0].id).toBe('3'); // Higher profit (₹14) first
    expect(results[1].id).toBe('2'); // Lower profit (₹10) second
  });
});
