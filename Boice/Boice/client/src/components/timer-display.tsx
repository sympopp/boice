import React from 'react';

type TimerDisplayProps = {
  sessionTime: number;
  dailyTimeLeft: number;
  mayStopTime: number;
  mustStopTime: number;
};

const TimerDisplay: React.FC<TimerDisplayProps> = ({
  sessionTime,
  dailyTimeLeft,
  mayStopTime,
  mustStopTime
}) => {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">Time Tracking</h2>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-sm text-gray-500 mb-1">Daily Time Left</div>
          <div className="timer-display text-2xl font-semibold text-gray-800 font-mono">{formatTime(dailyTimeLeft)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-sm text-gray-500 mb-1">Session Time</div>
          <div className="timer-display text-2xl font-semibold text-gray-800 font-mono">{formatTime(sessionTime)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-sm text-gray-500 mb-1">May Stop In</div>
          <div className="timer-display text-2xl font-semibold text-amber-600 font-mono">{formatTime(mayStopTime)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-sm text-gray-500 mb-1">Must Stop In</div>
          <div className="timer-display text-2xl font-semibold text-red-600 font-mono">{formatTime(mustStopTime)}</div>
        </div>
      </div>
    </div>
  );
};

export default TimerDisplay;
