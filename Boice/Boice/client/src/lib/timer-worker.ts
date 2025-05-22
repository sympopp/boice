// This file isn't directly imported; its content is used to generate a Web Worker blob

const workerCode = `
  let isRunning = false;
  let sessionTime = 0;
  let dailyTimeLeft = 14400; // 4 hours in seconds
  let weeklyTypeTimeLeft = 18000; // 5 hours in seconds
  let mayStopTime = 600; // 10 minutes in seconds
  let mustStopTime = 3000; // 50 minutes in seconds
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

export default workerCode;
