/**
 * @module @bangui/agent/subagents/tx-generator.test
 * Test specifications for Transaction Generator
 */

import { describe, it, expect } from 'vitest';
import {
  buildDepositTx,
  simulateTx,
  getChainId,
  encodeDepositData,
} from './tx-generator.js';
import type { Chain, Address, BigIntString } from '@bangui/types';

describe('TransactionGenerator', () => {
  const mockContractAddress = '0x1234567890123456789012345678901234567890' as Address;
  const mockUserAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;

  describe('getChainId', () => {
    it('should return 1 for ethereum', () => {
      expect(getChainId('ethereum')).toBe(1);
    });

    it('should return 137 for polygon', () => {
      expect(getChainId('polygon')).toBe(137);
    });

    it('should return 42161 for arbitrum', () => {
      expect(getChainId('arbitrum')).toBe(42161);
    });
  });

  describe('encodeDepositData', () => {
    it('should return valid hex string', () => {
      const data = encodeDepositData(mockUserAddress, '1000000000000000000' as BigIntString);
      expect(data.startsWith('0x')).toBe(true);
      expect(data.length).toBeGreaterThan(2);
    });

    it('should include function selector', () => {
      const data = encodeDepositData(mockUserAddress, '1000000000000000000' as BigIntString);
      // deposit(address,uint256) selector
      expect(data.slice(0, 10)).toBe('0x47e7ef24');
    });
  });

  describe('buildDepositTx', () => {
    it('should return unsigned transaction with correct structure', () => {
      const tx = buildDepositTx({
        contractAddress: mockContractAddress,
        userAddress: mockUserAddress,
        amount: '1000000000000000000' as BigIntString,
        chain: 'ethereum',
      });

      expect(tx.to).toBe(mockContractAddress);
      expect(tx.chainId).toBe(1);
      expect(tx.value).toBe('1000000000000000000');
      expect(tx.data.startsWith('0x')).toBe(true);
      expect(tx.gasEstimate).toBeDefined();
    });

    it('should use correct chain ID for polygon', () => {
      const tx = buildDepositTx({
        contractAddress: mockContractAddress,
        userAddress: mockUserAddress,
        amount: '500000000000000000' as BigIntString,
        chain: 'polygon',
      });

      expect(tx.chainId).toBe(137);
    });
  });

  describe('simulateTx', () => {
    it('should return success for valid transactions', async () => {
      const tx = buildDepositTx({
        contractAddress: mockContractAddress,
        userAddress: mockUserAddress,
        amount: '1000000000000000000' as BigIntString,
        chain: 'ethereum',
      });

      const result = await simulateTx(tx);
      expect(result.success).toBe(true);
      expect(result.gasUsed).toBeDefined();
    });

    it('should return warnings array', async () => {
      const tx = buildDepositTx({
        contractAddress: mockContractAddress,
        userAddress: mockUserAddress,
        amount: '100000000000000000000000' as BigIntString, // Large amount
        chain: 'ethereum',
      });

      const result = await simulateTx(tx);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });
});
