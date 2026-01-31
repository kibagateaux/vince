/**
 * @module MetricCard
 * Reusable metric card component for dashboard stats
 */

import { FC, ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: number;
  icon?: ReactNode;
  className?: string;
}

export const MetricCard: FC<MetricCardProps> = ({
  label,
  value,
  subValue,
  trend,
  icon,
  className = '',
}) => {
  const trendColor = trend === undefined ? '' : trend >= 0 ? 'text-green-600' : 'text-red-600';
  const trendIcon = trend === undefined ? '' : trend >= 0 ? '↑' : '↓';

  return (
    <div className={`rounded-xl bg-white p-6 shadow-sm border border-gray-200 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-gray-500">{label}</div>
          <div className="mt-1 text-3xl font-bold text-gray-900">{value}</div>
          {(subValue || trend !== undefined) && (
            <div className="mt-1 flex items-center gap-2 text-sm">
              {trend !== undefined && (
                <span className={trendColor}>
                  {trendIcon} {Math.abs(trend)}%
                </span>
              )}
              {subValue && <span className="text-gray-500">{subValue}</span>}
            </div>
          )}
        </div>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
    </div>
  );
};
