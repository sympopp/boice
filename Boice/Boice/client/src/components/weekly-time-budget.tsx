import React from 'react';

type WeeklyTimeBudgetProps = {
  weeklyTimeLeft: {
    prewriting: number;
    writing: number;
    rewriting: number;
    skillbuilding: number;
  };
};

const WeeklyTimeBudget: React.FC<WeeklyTimeBudgetProps> = ({ weeklyTimeLeft }) => {
  const DEFAULT_WEEKLY_TIME = 18000; // 5 hours in seconds
  const ADJUSTED_PREWRITING_TIME = 18000; // Full 5 hours for calculation

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}:00`;
  };

  const calculatePercentage = (type: string, timeLeft: number) => {
    // Use full 5 hours as baseline for all types
    const baseTime = type === 'prewriting' ? ADJUSTED_PREWRITING_TIME : DEFAULT_WEEKLY_TIME;
    return Math.min(100, Math.round((timeLeft / baseTime) * 100));
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Weekly Time Budget</h2>
      <div className="space-y-3">
        {Object.entries(weeklyTimeLeft).map(([type, timeLeft]) => (
          <div className="flex items-center" key={type}>
            <div className="w-24 text-sm font-medium text-gray-700">
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </div>
            <div className="flex-1">
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full" 
                  style={{ width: `${calculatePercentage(type, timeLeft)}%` }}
                ></div>
              </div>
            </div>
            <div className="ml-3 text-sm font-mono text-gray-600">{formatTime(timeLeft)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeeklyTimeBudget;
