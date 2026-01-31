/**
 * @module TimeRangeSelector
 * Time range selector buttons
 */

import { FC } from 'react';
import type { TimeRange } from '../../lib/governance/types';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  options?: TimeRange[];
}

export const TimeRangeSelector: FC<TimeRangeSelectorProps> = ({
  value,
  onChange,
  options = ['1W', '1M', '3M', '1Y', 'ALL'],
}) => {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      {options.map((range) => (
        <button
          key={range}
          onClick={() => onChange(range)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === range
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {range}
        </button>
      ))}
    </div>
  );
};
