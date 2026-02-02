/**
 * @module TreasurySection
 * Treasury overview section with metrics, chart, and strategy table
 */

'use client';

import { FC, useState, useMemo } from 'react';
import { MetricCard } from './MetricCard';
import { TimeRangeSelector } from './TimeRangeSelector';
import { StackedAreaChart } from '../../lib/d3/charts/StackedAreaChart';
import type {
  TreasuryMetrics,
  TreasurySnapshot,
  StrategyPerformance,
  BlendedYieldMetrics,
  TimeRange,
  TokenSymbol,
} from '../../lib/governance/types';

const assetColors: Record<TokenSymbol, string> = {
  ETH: '#627EEA',
  USDC: '#2775CA',
  DAI: '#F5AC37',
  WBTC: '#F7931A',
  USDT: '#26A17B',
};

interface TreasurySectionProps {
  metrics: TreasuryMetrics;
  snapshots: TreasurySnapshot[];
  strategies: StrategyPerformance[];
  blendedYields: BlendedYieldMetrics[];
}

export const TreasurySection: FC<TreasurySectionProps> = ({
  metrics,
  snapshots,
  strategies,
  blendedYields,
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');
  const [sortBy, setSortBy] = useState<'allocation' | 'apy'>('allocation');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredSnapshots = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    switch (timeRange) {
      case '1W':
        cutoff.setDate(now.getDate() - 7);
        break;
      case '1M':
        cutoff.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        cutoff.setMonth(now.getMonth() - 3);
        break;
      case '1Y':
        cutoff.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return snapshots;
    }
    return snapshots.filter((s) => s.timestamp >= cutoff);
  }, [snapshots, timeRange]);

  const chartData = useMemo(() => {
    return filteredSnapshots.map((snapshot) => {
      const point: { date: Date; [key: string]: number | Date } = { date: snapshot.timestamp };
      snapshot.holdings.forEach((h) => {
        point[h.asset] = (point[h.asset] as number || 0) + h.valueUSD;
      });
      return point;
    });
  }, [filteredSnapshots]);

  const chartKeys = useMemo(() => {
    const assets = new Set<string>();
    filteredSnapshots.forEach((s) => s.holdings.forEach((h) => assets.add(h.asset)));
    return Array.from(assets);
  }, [filteredSnapshots]);

  const sortedStrategies = useMemo(() => {
    return [...strategies].sort((a, b) => {
      const aVal = sortBy === 'allocation' ? a.allocation.percentage : a.yield.currentAPY;
      const bVal = sortBy === 'allocation' ? b.allocation.percentage : b.yield.currentAPY;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [strategies, sortBy, sortOrder]);

  const handleSort = (column: 'allocation' | 'apy') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <span className="text-green-600">↑</span>;
      case 'down':
        return <span className="text-red-600">↓</span>;
      default:
        return <span className="text-gray-500">→</span>;
    }
  };

  return (
    <section className="space-y-6">
      {/* Metrics Bar */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          label="Total Treasury"
          value={formatCurrency(metrics.totalValue.current)}
          trend={metrics.totalValue.change30d}
          subValue="(30d)"
        />
        <MetricCard
          label="Current APY"
          value={`${metrics.currentAPY.blended.toFixed(1)}%`}
          trend={metrics.currentAPY.change7d}
          subValue="(7d)"
        />
        <MetricCard
          label="Lifetime Yield"
          value={formatCurrency(metrics.lifetimeYield.total)}
          subValue="since inception"
        />
        <MetricCard
          label="Active Strategies"
          value={metrics.activeStrategies.count}
          subValue={`across ${metrics.activeStrategies.uniqueAssets} assets`}
        />
      </div>

      {/* Chart and Yields Panel */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Chart */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Treasury Holdings</h3>
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>
          <div className="h-[350px]">
            <StackedAreaChart
              data={chartData}
              keys={chartKeys}
              colors={assetColors}
              formatTooltip={(key, value) => formatCurrency(value)}
            />
          </div>
          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4">
            {chartKeys.map((key) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded"
                  style={{ backgroundColor: assetColors[key as TokenSymbol] || '#ccc' }}
                />
                <span className="text-sm text-gray-600">{key}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Blended Yields Panel */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Blended Yields by Asset</h3>
          <div className="space-y-6">
            {blendedYields.map((yield_) => (
              <div key={yield_.asset} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="h-4 w-4 rounded"
                    style={{ backgroundColor: assetColors[yield_.asset] }}
                  />
                  <span className="font-medium text-gray-900">{yield_.asset}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg APY</span>
                    <span className="font-medium text-gray-900">{yield_.blendedAPY.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">30d Yield</span>
                    <span className="text-gray-700">{formatCurrency(yield_.yield30d)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">90d Yield</span>
                    <span className="text-gray-700">{formatCurrency(yield_.yield90d)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vaults Table */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Vaults</h3>
          <a
            href="/?context=vaults"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Consult Vince
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm font-semibold text-gray-900">
                <th className="px-4 py-3">Vault Name</th>
                <th className="px-4 py-3">Vault Asset</th>
                <th className="px-4 py-3">Debt Asset</th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('allocation')}
                >
                  Allocation % {sortBy === 'allocation' && (sortOrder === 'desc' ? '↓' : '↑')}
                </th>
                <th className="px-4 py-3 text-right">Total Deposited</th>
                <th className="px-4 py-3 text-right">Total Debt</th>
                <th className="px-4 py-3 text-right">30d APY</th>
                <th
                  className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('apy')}
                >
                  90d APY {sortBy === 'apy' && (sortOrder === 'desc' ? '↓' : '↑')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedStrategies.map((vault) => (
                <tr
                  key={vault.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-gray-900">{vault.name}</div>
                      {vault.vaultToken?.address && (
                        <div className="text-xs text-gray-400 font-mono">{vault.vaultToken.address}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded"
                        style={{ backgroundColor: assetColors[vault.asset] || '#ccc' }}
                      />
                      <div>
                        <span className="font-medium text-gray-700">{vault.reserveToken?.symbol ?? vault.asset}</span>
                        {vault.reserveToken?.address && (
                          <div className="text-xs text-gray-400 font-mono">{vault.reserveToken.address}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {vault.debtAsset ? (
                      <div>
                        <span className="font-medium text-gray-700">{vault.debtAsset.symbol}</span>
                        {vault.debtAsset.address && (
                          <div className="text-xs text-gray-400 font-mono">{vault.debtAsset.address}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {vault.allocation.percentage.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-gray-900 font-medium">
                      {vault.totalDeposited !== undefined
                        ? `${vault.totalDeposited.toFixed(4)} ${vault.reserveToken?.symbol ?? vault.asset}`
                        : '—'}
                    </div>
                    {vault.totalDepositedUsd !== undefined && vault.totalDepositedUsd > 0 && (
                      <div className="text-xs text-gray-500">{formatCurrency(vault.totalDepositedUsd)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-gray-900 font-medium">
                      {vault.totalDebt !== undefined && vault.totalDebt > 0
                        ? `${vault.totalDebt.toFixed(4)} ${vault.debtAsset?.symbol ?? '—'}`
                        : '—'}
                    </div>
                    {vault.totalDebtUsd !== undefined && vault.totalDebtUsd > 0 && (
                      <div className="text-xs text-gray-500">{formatCurrency(vault.totalDebtUsd)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {vault.yield.trailing30d.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-medium text-gray-900">
                      {vault.yield.trailing90d.toFixed(2)}%
                    </span>{' '}
                    {getTrendIcon(vault.yield.trend)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
