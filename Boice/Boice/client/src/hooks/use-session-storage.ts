import { useState, useEffect } from 'react';

const DEFAULT_WEEKLY_BUDGET = 18000; // 5 hours in seconds
const FOUR_HOURS_IN_SECONDS = 14400; // 4 hours

export const useSessionStorage = () => {
  // Core writing session state
  const [sessionType, setSessionType] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [sessionPlan, setSessionPlan] = useState('');
  const [processNotes, setProcessNotes] = useState('');
  const [dailyPlan, setDailyPlan] = useState('');
  const [sessionsCompleted, setSessionsCompleted] = useState<any[]>([]);
  
  // Weekly time budgets - 5 hours per activity type (with prewriting adjusted)
  const [weeklyTimeLeft, setWeeklyTimeLeft] = useState({
    prewriting: 3600,       // 1 hour left (5h - 4h = 1h)
    writing: DEFAULT_WEEKLY_BUDGET,         // 5 hours
    rewriting: DEFAULT_WEEKLY_BUDGET,       // 5 hours
    skillbuilding: DEFAULT_WEEKLY_BUDGET    // 5 hours
  });
  
  // Save data to localStorage whenever it changes
  useEffect(() => {
    try {
      const today = new Date().toLocaleDateString();
      
      localStorage.setItem('writingTimerData', JSON.stringify({
        weeklyTimeLeft,
        sessionsCompleted,
        dailyPlan,
        lastDate: today
      }));
    } catch (error) {
      console.error("Error saving data:", error);
    }
  }, [weeklyTimeLeft, sessionsCompleted, dailyPlan]);
  
  // Load saved data from localStorage
  const loadSavedData = () => {
    try {
      const savedData = localStorage.getItem('writingTimerData');
      const result = { isNewDay: false, hasNoDailyPlan: false };
      
      if (savedData) {
        const data = JSON.parse(savedData);
        
        // Check if today is a new day
        const today = new Date().toLocaleDateString();
        const lastDate = data.lastDate || '';
        result.isNewDay = lastDate !== today;
        
        if (result.isNewDay) {
          // New day - reset daily sessions and plan
          setSessionsCompleted([]);
          setDailyPlan('');
          result.hasNoDailyPlan = true;
        } else {
          // Same day - restore state
          setSessionsCompleted(data.sessionsCompleted || []);
          setDailyPlan(data.dailyPlan || '');
          result.hasNoDailyPlan = !data.dailyPlan;
        }
        
        // Check if this is a new week
        const lastDateObj = lastDate ? new Date(lastDate) : new Date();
        const currentDate = new Date();
        const lastSunday = new Date(currentDate);
        lastSunday.setDate(currentDate.getDate() - currentDate.getDay());
        lastSunday.setHours(0, 0, 0, 0);
        
        // If last saved date is before the start of this week, reset weekly times
        if (lastDateObj < lastSunday) {
          setWeeklyTimeLeft({
            prewriting: 3600,  // 1 hour left (pre-adjusted for 4 hours used)
            writing: DEFAULT_WEEKLY_BUDGET,
            rewriting: DEFAULT_WEEKLY_BUDGET,
            skillbuilding: DEFAULT_WEEKLY_BUDGET
          });
        } else {
          // Restore weekly time budgets
          setWeeklyTimeLeft(data.weeklyTimeLeft || {
            prewriting: 3600,
            writing: DEFAULT_WEEKLY_BUDGET,
            rewriting: DEFAULT_WEEKLY_BUDGET,
            skillbuilding: DEFAULT_WEEKLY_BUDGET
          });
        }
      } else {
        // First time use - start with adjusted budgets
        setWeeklyTimeLeft({
          prewriting: 3600,       // 1 hour left (5h - 4h used = 1h)
          writing: DEFAULT_WEEKLY_BUDGET,
          rewriting: DEFAULT_WEEKLY_BUDGET,
          skillbuilding: DEFAULT_WEEKLY_BUDGET
        });
        result.hasNoDailyPlan = true;
      }
      
      return result;
    } catch (error) {
      console.error("Error loading data:", error);
      // If error, reset to fresh state
      return { isNewDay: true, hasNoDailyPlan: true };
    }
  };
  
  // Add a completed session
  const addSession = (session: any) => {
    setSessionsCompleted(prev => [session, ...prev]);
  };
  
  // Update weekly time budget for a session type
  const updateWeeklyTimeLeft = (type: string, usedSeconds: number) => {
    setWeeklyTimeLeft(prev => ({
      ...prev,
      [type]: Math.max(0, prev[type as keyof typeof prev] - usedSeconds)
    }));
  };
  
  return {
    sessionType,
    setSessionType,
    projectTitle,
    setProjectTitle,
    sessionPlan,
    setSessionPlan,
    processNotes,
    setProcessNotes,
    dailyPlan,
    setDailyPlan,
    sessionsCompleted,
    weeklyTimeLeft,
    addSession,
    updateWeeklyTimeLeft,
    loadSavedData
  };
};
