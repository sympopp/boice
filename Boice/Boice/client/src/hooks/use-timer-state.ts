import { useState, useEffect, useRef } from 'react';

export const useTimerState = () => {
  // Core timer state
  const [isRunning, setIsRunning] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [dailyTimeLeft, setDailyTimeLeft] = useState(14400); // 4 hours in seconds
  const [mayStopTime, setMayStopTime] = useState(600); // 10 minutes in seconds
  const [mustStopTime, setMustStopTime] = useState(3000); // 50 minutes in seconds
  
  // Web Worker reference
  const workerRef = useRef<Worker | null>(null);
  
  // Create worker on mount
  useEffect(() => {
    const workerCode = `
      let isRunning = false;
      let sessionTime = 0;
      let dailyTimeLeft = 14400;
      let weeklyTypeTimeLeft = 18000;
      let mayStopTime = 600;
      let mustStopTime = 3000;
      let timerInterval = null;
      let sessionType = '';

      self.onmessage = function(e) {
        const { type, payload } = e.data;

        switch (type) {
          case 'START':
            isRunning = true;
            sessionTime = 0;
            mayStopTime = 600;
            mustStopTime = payload.mustStopTime || 3000;
            dailyTimeLeft = payload.dailyTimeLeft;
            weeklyTypeTimeLeft = payload.weeklyTypeTimeLeft;
            sessionType = payload.sessionType;
            startTimer();
            break;

          case 'STOP':
            isRunning = false;
            clearInterval(timerInterval);
            break;
            
          case 'UPDATE_TIME_VALUES':
            dailyTimeLeft = Math.max(0, dailyTimeLeft + payload.dailyTimeChange);
            weeklyTypeTimeLeft = Math.max(0, weeklyTypeTimeLeft + payload.weeklyTimeChange);
            break;

          default:
            break;
        }
      };

      function startTimer() {
        clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
          if (!isRunning) return;

          sessionTime++;
          dailyTimeLeft = Math.max(0, dailyTimeLeft - 1);
          weeklyTypeTimeLeft = Math.max(0, weeklyTypeTimeLeft - 1);
          mayStopTime = Math.max(0, mayStopTime - 1);
          mustStopTime = Math.max(0, mustStopTime - 1);

          self.postMessage({
            type: 'TICK',
            payload: {
              sessionTime,
              dailyTimeLeft,
              weeklyTypeTimeLeft,
              mayStopTime,
              mustStopTime,
              sessionType
            }
          });

          if (mayStopTime === 0) {
            self.postMessage({ type: 'MAY_STOP' });
          }

          if (mustStopTime === 0 || dailyTimeLeft === 0 || weeklyTypeTimeLeft === 0) {
            self.postMessage({ type: 'MUST_STOP' });
            isRunning = false;
            clearInterval(timerInterval);
          }
        }, 1000);
      }
    `;
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    workerRef.current = new Worker(URL.createObjectURL(blob));

    workerRef.current.onmessage = (e) => {
      const { type, payload } = e.data;
      
      switch (type) {
        case 'TICK':
          setSessionTime(payload.sessionTime);
          setDailyTimeLeft(payload.dailyTimeLeft);
          setMayStopTime(payload.mayStopTime);
          setMustStopTime(payload.mustStopTime);
          break;
          
        case 'MAY_STOP':
          // Could add a sound or notification here
          break;
          
        case 'MUST_STOP':
          // Auto-stop the session
          setIsRunning(false);
          break;
      }
    };
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);
  
  // Start a session
  const startSession = (
    currentDailyTimeLeft: number, 
    currentWeeklyTypeTimeLeft: number, 
    newMustStopTime: number, 
    sessionType: string
  ) => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'START',
        payload: {
          dailyTimeLeft: currentDailyTimeLeft,
          weeklyTypeTimeLeft: currentWeeklyTypeTimeLeft,
          mustStopTime: newMustStopTime,
          sessionType
        }
      });
    }
    
    setIsRunning(true);
    setSessionTime(0);
    setMayStopTime(600);
    setMustStopTime(newMustStopTime);
  };
  
  // Stop a session
  const stopSession = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'STOP'
      });
    }
    
    setIsRunning(false);
  };
  
  // Update time values (for manual session logging)
  const updateTimeValues = (dailyTimeChange: number, weeklyTimeChange: number) => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'UPDATE_TIME_VALUES',
        payload: {
          dailyTimeChange,
          weeklyTimeChange
        }
      });
    }
    
    setDailyTimeLeft(prev => Math.max(0, prev + dailyTimeChange));
  };
  
  return {
    isRunning,
    sessionTime,
    dailyTimeLeft,
    mayStopTime,
    mustStopTime,
    startSession,
    stopSession,
    updateTimeValues
  };
};
