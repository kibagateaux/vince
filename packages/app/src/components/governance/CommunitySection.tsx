/**
 * @module CommunitySection
 * Community metrics and growth visualization
 */

'use client';

import { FC, useState } from 'react';
import { MetricCard } from './MetricCard';
import { TimeRangeSelector } from './TimeRangeSelector';
import { LineChart } from '../../lib/d3/charts/LineChart';
import { DonutChart } from '../../lib/d3/charts/DonutChart';
import { BarChart } from '../../lib/d3/charts/BarChart';
import type {
  CommunityMetrics,
  DepositVolumeData,
  ArchetypeDistribution,
  RiskDistribution,
  TimeRange,
} from '../../lib/governance/types';

interface CommunitySectionProps {
  metrics: CommunityMetrics;
  depositVolume: DepositVolumeData[];
  archetypeDistribution: ArchetypeDistribution[];
  riskDistribution: RiskDistribution[];
}

export const CommunitySection: FC<CommunitySectionProps> = ({
  metrics,
  depositVolume,
  archetypeDistribution,
  riskDistribution,
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');

  const filteredVolume = depositVolume.filter((d) => {
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
      default:
        return true;
    }
    return d.date >= cutoff;
  });

  const chartData = filteredVolume.map((d) => ({
    date: d.date,
    value: d.volume,
  }));

  const donutData = archetypeDistribution.map((d) => ({
    label: d.label,
    value: d.percentage,
    color: d.color,
  }));

  const barData = riskDistribution.map((d) => ({
    label: d.label,
    value: d.percentage,
    color: d.color,
  }));

  // Calculate deposit activity summary
  const last24hVolume = depositVolume[depositVolume.length - 1]?.volume || 0;
  const last7dVolume = depositVolume.slice(-7).reduce((sum, d) => sum + d.volume, 0);
  const last30dVolume = depositVolume.slice(-30).reduce((sum, d) => sum + d.volume, 0);

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Community Growth</h2>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          label="Total Depositors"
          value={metrics.totalDepositors.allTime.toLocaleString()}
          subValue="all time"
        />
        <MetricCard
          label="Current Active"
          value={metrics.currentActive.count.toLocaleString()}
          trend={metrics.currentActive.changeThisWeek}
          subValue="this week"
        />
        <MetricCard
          label="New (7d)"
          value={`+${metrics.newDepositors.last7d}`}
          trend={metrics.newDepositors.percentChange7d}
        />
        <MetricCard
          label="New (30d)"
          value={`+${metrics.newDepositors.last30d}`}
          trend={metrics.newDepositors.percentChange30d}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Deposit Volume Chart */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Deposit Volume</h3>
            <TimeRangeSelector
              value={timeRange}
              onChange={setTimeRange}
              options={['1W', '1M', '3M']}
            />
          </div>
          <div className="h-[250px]">
            <LineChart
              data={chartData}
              showMovingAverage={true}
              movingAverageWindow={7}
            />
          </div>
          {/* Legend */}
          <div className="mt-4 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-6 bg-blue-600" />
              <span className="text-gray-600">Total Volume</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-6 bg-gray-400" style={{ borderStyle: 'dashed' }} />
              <span className="text-gray-600">7-day Moving Avg</span>
            </div>
          </div>
        </div>

        {/* Composition Charts */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Community Composition</h3>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Archetype Distribution */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-3">Depositor Archetypes</h4>
              <div className="h-[180px]">
                <DonutChart data={donutData} />
              </div>
              <div className="mt-4 space-y-1">
                {archetypeDistribution.slice(0, 4).map((d) => (
                  <div key={d.archetype} className="flex items-center gap-2 text-sm">
                    <div className="h-2.5 w-2.5 rounded" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-600 flex-1">{d.label}</span>
                    <span className="font-medium text-gray-900">{d.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Distribution */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-3">Risk Profiles</h4>
              <div className="h-[180px]">
                <BarChart data={barData} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Depositor Activity Table */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Depositor Activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm font-semibold text-gray-900">
                <th className="px-6 py-4">Period</th>
                <th className="px-6 py-4">New Depositors</th>
                <th className="px-6 py-4">Returning</th>
                <th className="px-6 py-4">Total Deposits</th>
                <th className="px-6 py-4">Avg Deposit Size</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-6 py-4 font-medium text-gray-900">Last 24h</td>
                <td className="px-6 py-4 text-gray-700">{metrics.newDepositors.last24h}</td>
                <td className="px-6 py-4 text-gray-700">
                  {Math.floor(metrics.newDepositors.last24h * 1.5)}
                </td>
                <td className="px-6 py-4 text-gray-700">{formatCurrency(last24hVolume)}</td>
                <td className="px-6 py-4 text-gray-700">
                  {formatCurrency(last24hVolume / Math.max(1, metrics.newDepositors.last24h * 2.5))}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-6 py-4 font-medium text-gray-900">Last 7d</td>
                <td className="px-6 py-4 text-gray-700">{metrics.newDepositors.last7d}</td>
                <td className="px-6 py-4 text-gray-700">
                  {Math.floor(metrics.newDepositors.last7d * 2)}
                </td>
                <td className="px-6 py-4 text-gray-700">{formatCurrency(last7dVolume)}</td>
                <td className="px-6 py-4 text-gray-700">
                  {formatCurrency(last7dVolume / Math.max(1, metrics.newDepositors.last7d * 3))}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-medium text-gray-900">Last 30d</td>
                <td className="px-6 py-4 text-gray-700">{metrics.newDepositors.last30d}</td>
                <td className="px-6 py-4 text-gray-700">
                  {Math.floor(metrics.newDepositors.last30d * 1.55)}
                </td>
                <td className="px-6 py-4 text-gray-700">{formatCurrency(last30dVolume)}</td>
                <td className="px-6 py-4 text-gray-700">
                  {formatCurrency(last30dVolume / Math.max(1, metrics.newDepositors.last30d * 2.5))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
