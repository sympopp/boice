import { useState, useEffect, useRef } from 'react';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogTitle,
  AlertDialogDescription
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Time constants
const FOUR_HOURS_IN_SECONDS = 14400; // 4 hours daily limit
const TEN_MINUTES_IN_SECONDS = 600; // 10 minutes minimum session
const FIFTY_MINUTES_IN_SECONDS = 3000; // 50 minutes maximum session

// Writing balance constants
const MAX_HOURS_PER_DAY = 4;
const MAX_DAYS_PER_WEEK = 5;
const TOTAL_MAX_HOURS_PER_WEEK = MAX_HOURS_PER_DAY * MAX_DAYS_PER_WEEK; // 20 hours
const STAGES = ["prewriting", "writing", "rewriting", "skillbuilding"];
const HOURS_PER_STAGE = TOTAL_MAX_HOURS_PER_WEEK / STAGES.length; // 5 hours per stage
const TOTAL_MAX_SECONDS = TOTAL_MAX_HOURS_PER_WEEK * 3600; // 72000 seconds
const STAGE_MAX_SECONDS = HOURS_PER_STAGE * 3600; // 18000 seconds

const WritingTimerCore = () => {
  // Core state - 4 hours = 14400 seconds
  const [isRunning, setIsRunning] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [dailyTimeLeft, setDailyTimeLeft] = useState(FOUR_HOURS_IN_SECONDS);
  const [sessionType, setSessionType] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [sessionPlan, setSessionPlan] = useState('');
  const [processNotes, setProcessNotes] = useState('');
  const [dailyPlan, setDailyPlan] = useState('');
  const [sessionsCompleted, setSessionsCompleted] = useState<any[]>([]);
  const [mayStopTime, setMayStopTime] = useState(TEN_MINUTES_IN_SECONDS);
  const [mustStopTime, setMustStopTime] = useState(FIFTY_MINUTES_IN_SECONDS);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [showTomorrowPlanDialog, setShowTomorrowPlanDialog] = useState(false);
  
  // Dialog state
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showEarlyStopDialog, setShowEarlyStopDialog] = useState(false);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [showFluencyDialog, setShowFluencyDialog] = useState(false);
  
  // Tomorrow's plan state
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  
  // Session completion state
  const [fluencyRating, setFluencyRating] = useState<number>(3);
  const [nextActions, setNextActions] = useState('');
  const [sessionSummary, setSessionSummary] = useState('');
  
  // Weekly time budgets with (5 hours = 18000 seconds per stage)
  const [weeklyTimeLeft, setWeeklyTimeLeft] = useState({
    prewriting: STAGE_MAX_SECONDS,    // 5 hours = 18000 seconds
    writing: STAGE_MAX_SECONDS,       // 5 hours = 18000 seconds
    rewriting: STAGE_MAX_SECONDS,     // 5 hours = 18000 seconds
    skillbuilding: STAGE_MAX_SECONDS  // 5 hours = 18000 seconds
  });
  
  // Weekly balance state
  const [weekPhase, setWeekPhase] = useState<'initial' | 'frontHalf' | 'backHalf'>('initial');
  const [weekStartDate, setWeekStartDate] = useState<string>('');
  const [currentDay, setCurrentDay] = useState(1);
  const [totalSecondsWorked, setTotalSecondsWorked] = useState(0);
  
  // Worker ref for background timing
  const workerRef = useRef<Worker | null>(null);
  
  // Function to determine the current week phase
  const determineWeekPhase = (
    totalSeconds: number, 
    day: number, 
    weeklyTimes: {[key: string]: number}
  ): 'initial' | 'frontHalf' | 'backHalf' => {
    // Calculate total time used across all stages
    const totalSecondsUsed = Object.values(weeklyTimes).reduce((sum, stageSecondsLeft) => {
      return sum + (STAGE_MAX_SECONDS - stageSecondsLeft);
    }, 0);
    
    // Initial phase = first two days AND less than 8 hours (28800 seconds) used
    if (day <= 2 && totalSecondsUsed < 28800) {
      return 'initial';
    }
    
    // Calculate if we're in the back half
    const daysRemaining = MAX_DAYS_PER_WEEK - day + 1;
    const maxSecondsLeft = daysRemaining * FOUR_HOURS_IN_SECONDS;
    
    // Back half = remaining potential time is less than or equal to time already used
    if (maxSecondsLeft <= totalSecondsUsed) {
      return 'backHalf';
    }
    
    // Otherwise, we're in the front half
    return 'frontHalf';
  };

  // Check if a writing stage should be available
  const isStageAvailable = (stage: string): boolean => {
    // Check if this stage still has time left for the week
    const timeLeft = weeklyTimeLeft[stage as keyof typeof weeklyTimeLeft];
    if (timeLeft <= 0) {
      return false; // Stage is used up for the week
    }
    
    // If daily time is used up, don't allow any stages
    if (dailyTimeLeft <= 0) {
      return false;
    }
    
    // In initial or front half, all stages are available
    if (weekPhase !== 'backHalf') {
      return true;
    }
    
    // In back half, apply balance logic
    // Calculate how many seconds used per stage
    const stageSecondsUsed: {[key: string]: number} = {};
    STAGES.forEach(stageKey => {
      stageSecondsUsed[stageKey] = STAGE_MAX_SECONDS - weeklyTimeLeft[stageKey as keyof typeof weeklyTimeLeft];
    });
    
    // Calculate percentages
    const totalUsed = Object.values(stageSecondsUsed).reduce((sum, value) => sum + value, 0);
    if (totalUsed === 0) return true; // Safety check
    
    const stagePercentages: {[key: string]: number} = {};
    STAGES.forEach(stageKey => {
      stagePercentages[stageKey] = (stageSecondsUsed[stageKey] / totalUsed) * 100;
    });
    
    // If this stage has >35% of total time AND at least one other stage has <15%,
    // remove it from dropdown options to encourage balance
    if (stagePercentages[stage] > 35) {
      // Check if any stage is severely underutilized
      for (const otherStage of STAGES) {
        if (otherStage !== stage && stagePercentages[otherStage] < 15) {
          // Hide overused stage from dropdown
          return false;
        }
      }
    }
    
    return true;
  };

  // Get available stages for dropdown
  const getAvailableStages = (): string[] => {
    return STAGES.filter(stage => isStageAvailable(stage));
  };
  
  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem('writingTimerData');
      if (savedData) {
        const data = JSON.parse(savedData);
        
        // Check if today is a new day
        const today = new Date().toLocaleDateString();
        if (data.lastDate !== today) {
          // New day - reset daily time and sessions
          setDailyTimeLeft(FOUR_HOURS_IN_SECONDS);
          setSessionsCompleted([]);
          setDailyPlan('');
          
          // Show plan dialog only if daily timer is full
          setShowPlanDialog(true);
          
          // Increment day count if we're in the same week
          const lastDate = new Date(data.lastDate);
          const currentDate = new Date();
          const lastSunday = new Date(currentDate);
          lastSunday.setDate(currentDate.getDate() - currentDate.getDay());
          lastSunday.setHours(0, 0, 0, 0);
          
          if (lastDate >= lastSunday && data.weekStartDate === lastSunday.toLocaleDateString()) {
            // Still in the same week, increment day
            setCurrentDay(data.currentDay + 1);
            setWeekStartDate(data.weekStartDate);
          } else {
            // New week
            setCurrentDay(1);
            setWeekStartDate(lastSunday.toLocaleDateString());
            // Reset weekly time
            setWeeklyTimeLeft({
              prewriting: STAGE_MAX_SECONDS,
              writing: STAGE_MAX_SECONDS,
              rewriting: STAGE_MAX_SECONDS,
              skillbuilding: STAGE_MAX_SECONDS
            });
            setTotalSecondsWorked(0);
            setWeekPhase('initial');
          }
        } else {
          // Same day - restore state
          setDailyTimeLeft(data.dailyTimeLeft || FOUR_HOURS_IN_SECONDS);
          setSessionsCompleted(data.sessionsCompleted || []);
          setDailyPlan(data.dailyPlan || '');
          setWeeklyTimeLeft(data.weeklyTimeLeft || {
            prewriting: STAGE_MAX_SECONDS,
            writing: STAGE_MAX_SECONDS,
            rewriting: STAGE_MAX_SECONDS,
            skillbuilding: STAGE_MAX_SECONDS
          });
          setTotalSecondsWorked(data.totalSecondsWorked || 0);
          setCurrentDay(data.currentDay || 1);
          setWeekStartDate(data.weekStartDate || new Date().toLocaleDateString());
          
          // Determine week phase
          const phase = determineWeekPhase(
            data.totalSecondsWorked || 0,
            data.currentDay || 1,
            data.weeklyTimeLeft || {
              prewriting: STAGE_MAX_SECONDS,
              writing: STAGE_MAX_SECONDS,
              rewriting: STAGE_MAX_SECONDS,
              skillbuilding: STAGE_MAX_SECONDS
            }
          );
          setWeekPhase(phase);
          
          // Show plan dialog if we have a full day's time and no plan set
          setShowPlanDialog(!data.dailyPlan);
        }
      } else {
        // First time use - start with defaults
        const today = new Date();
        const lastSunday = new Date(today);
        lastSunday.setDate(today.getDate() - today.getDay());
        lastSunday.setHours(0, 0, 0, 0);
        
        setWeekStartDate(lastSunday.toLocaleDateString());
        setCurrentDay(1);
        setWeekPhase('initial');
        setShowPlanDialog(true);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setDailyTimeLeft(FOUR_HOURS_IN_SECONDS);
      setShowPlanDialog(true);
    }
    
    // Initialize worker
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
          setWeeklyTimeLeft(prev => ({
            ...prev,
            [payload.sessionType]: payload.weeklyTypeTimeLeft
          }));
          setMayStopTime(payload.mayStopTime);
          setMustStopTime(payload.mustStopTime);
          break;
          
        case 'MAY_STOP':
          // Sound or notification could go here
          break;
          
        case 'MUST_STOP':
          // Auto-stop the session
          stopSession(true);
          break;
      }
    };
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // Save data to localStorage
  useEffect(() => {
    try {
      const today = new Date().toLocaleDateString();
      
      localStorage.setItem('writingTimerData', JSON.stringify({
        dailyTimeLeft,
        weeklyTimeLeft,
        sessionsCompleted,
        dailyPlan,
        lastDate: today,
        currentDay,
        weekStartDate,
        totalSecondsWorked,
        weekPhase
      }));
    } catch (error) {
      console.error("Error saving data:", error);
    }
  }, [dailyTimeLeft, weeklyTimeLeft, sessionsCompleted, dailyPlan, currentDay, weekStartDate, totalSecondsWorked, weekPhase]);

  // Format time display
  function formatTime(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
  
  // Format hour display for weekly progress
  function formatHours(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }
  
  // Calculate maximum session time
  function calculateMaxSessionTime() {
    if (!sessionType) return FIFTY_MINUTES_IN_SECONDS;
    
    const weeklyTypeTime = weeklyTimeLeft[sessionType as keyof typeof weeklyTimeLeft];
    const minRemaining = Math.min(dailyTimeLeft, weeklyTypeTime);
    
    // If less than 10 minutes left, just use what's left
    if (minRemaining <= TEN_MINUTES_IN_SECONDS) {
      return minRemaining;
    }
    
    // If between 10-60 minutes remain, handle specially
    if (minRemaining < 3600) {
      // If 50-60 minutes remain, leave 10 minutes for next session
      if (minRemaining > FIFTY_MINUTES_IN_SECONDS) {
        return minRemaining - TEN_MINUTES_IN_SECONDS;
      }
      // If 10-50 minutes remain, use all remaining time
      return minRemaining;
    }
    
    // Default for larger amounts: 50 minute session
    return FIFTY_MINUTES_IN_SECONDS;
  }
  
  // Start a session
  function handleStart() {
    const now = new Date();
    setSessionStartTime(now);
    setIsRunning(true);
    setSessionTime(0);
    setMayStopTime(TEN_MINUTES_IN_SECONDS);
    
    const newMustStopTime = calculateMaxSessionTime();
    setMustStopTime(newMustStopTime);
    
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'START',
        payload: {
          dailyTimeLeft,
          weeklyTypeTimeLeft: weeklyTimeLeft[sessionType as keyof typeof weeklyTimeLeft],
          mustStopTime: newMustStopTime,
          sessionType
        }
      });
    }
  }
  
  // Handle stop button click
  function handleStopClick() {
    const isManualStop = mustStopTime > 0;  // Not an auto-stop at must-stop time
    const isInFirstTenMinutes = mayStopTime > 0;  // Still in first 10 minutes
    const hasRemainingTime = dailyTimeLeft > 0 && weeklyTimeLeft[sessionType as keyof typeof weeklyTimeLeft] > 0;
    
    if (isManualStop && isInFirstTenMinutes && hasRemainingTime) {
      setShowEarlyStopDialog(true);
      return;
    }
    
    proceedWithSessionEnd();
  }
  
  // Proceed to fluency rating after session end
  function proceedWithSessionEnd() {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'STOP' });
    }
    setShowEarlyStopDialog(false);
    setShowFluencyDialog(true);
  }
  
  // Stop and finalize the session
  function stopSession(isAutoStop = false) {
    if (isAutoStop) {
      proceedWithSessionEnd();
    }
  }
  
  // Complete the session after fluency rating
  function completeSession() {
    if (sessionTime > 0) {
      const now = new Date();
      const endTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const startTime = sessionStartTime 
        ? sessionStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date(now.getTime() - sessionTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Create the session record
      const newSession = {
        type: sessionType,
        title: projectTitle,
        startTime,
        endTime,
        duration: sessionTime,
        plan: sessionPlan,
        notes: processNotes,
        fluency: fluencyRating,
        nextActions,
        date: new Date().toLocaleDateString()
      };
      
      // Update weekly time budget
      setWeeklyTimeLeft(prev => ({
        ...prev,
        [sessionType]: Math.max(0, prev[sessionType as keyof typeof prev] - sessionTime)
      }));
      
      // Add to completed sessions
      setSessionsCompleted(prev => [newSession, ...prev]);
      
      // Generate session summary
      const minutes = Math.floor(sessionTime / 60);
      const seconds = sessionTime % 60;
      const durationText = seconds > 0 
        ? `${minutes} minutes, ${seconds} seconds` 
        : `${minutes} minutes`;
      
      const summary = `**plan:** ${sessionPlan}
**start time:** ${startTime}
**stage:** ${sessionType}
**project:** [[${projectTitle}]]
**duration:** ${durationText}
**process:** ${processNotes}
**fluency:** ${fluencyRating}
**next actions:** ${nextActions}`;
      
      setSessionSummary(summary);
      
      // Show summary dialog
      setShowFluencyDialog(false);
      setShowSessionSummary(true);
      setIsRunning(false);
      
      // Reset form fields for next session
      setProcessNotes('');
      setSessionPlan('');
      setNextActions('');
      setFluencyRating(3);
    }
  }
  
  // Handle manual session logging
  function handleManualLogSubmit() {
    if (!manualSession.type || !manualSession.title || !manualSession.duration || !manualSession.startTime) {
      alert("Please fill in all required fields");
      return;
    }
    
    const durationInSeconds = parseInt(manualSession.duration) * 60;
    const startDateTime = new Date();
    startDateTime.setHours(
      parseInt(manualSession.startTime.split(':')[0]),
      parseInt(manualSession.startTime.split(':')[1]),
      0
    );
    
    const endDateTime = new Date(startDateTime.getTime() + (durationInSeconds * 1000));
    
    const newSession = {
      type: manualSession.type,
      title: manualSession.title,
      startTime: startDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      endTime: endDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: durationInSeconds,
      plan: "",
      notes: manualSession.notes,
      date: new Date().toLocaleDateString(),
      isManual: true
    };
    
    // Update weekly time budget
    setWeeklyTimeLeft(prev => ({
      ...prev,
      [manualSession.type]: Math.max(0, prev[manualSession.type as keyof typeof prev] - durationInSeconds)
    }));
    
    setDailyTimeLeft(prev => Math.max(0, prev - durationInSeconds));
    
    // Add to completed sessions
    setSessionsCompleted(prev => [newSession, ...prev]);
    
    // Reset form and close dialog
    setManualSession({
      type: '',
      title: '',
      duration: '',
      startTime: '',
      notes: '',
      fluency: '3'
    });
    
    setShowManualLog(false);
  }
  
  // Copy session summary to clipboard
  function handleCopySummary() {
    navigator.clipboard.writeText(sessionSummary)
      .then(() => {
        alert('Session summary copied to clipboard!');
        setShowSessionSummary(false);
      })
      .catch(err => {
        console.error('Error copying text: ', err);
        alert('Failed to copy. Please try again or copy manually.');
      });
  }

  // Calculate total weekly time used
  function calculateTotalWeeklyTime() {
    const total = Object.values(weeklyTimeLeft).reduce((sum, current) => {
      if (typeof current === 'number') {
        return sum + (18000 - current);
      }
      return sum;
    }, 0);
    
    return formatHours(total) + " / 20:00";
  }
  
  // Get started time display for active session
  function getStartedAtDisplay() {
    if (sessionStartTime) {
      return sessionStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return '';
  }

  // ----------------
  // Render functions
  // ----------------
  
  const renderTimerDisplay = () => {
    if (isRunning) {
      return (
        <div className="grid grid-cols-2 gap-4 my-4">
          {/* Top row */}
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">Session Time</div>
            <div className="text-3xl font-mono">{formatTime(sessionTime)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">Daily Time Left</div>
            <div className="text-3xl font-mono">{formatTime(dailyTimeLeft)}</div>
          </div>
          {/* Bottom row */}
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">May Stop In</div>
            <div className="text-3xl font-mono text-amber-600">{formatTime(mayStopTime)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">Must Stop In</div>
            <div className="text-3xl font-mono text-red-600">{formatTime(mustStopTime)}</div>
          </div>
        </div>
      );
    } else {
      // Non-session display
      return (
        <div className="my-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">Daily Time Left</div>
              <div className="text-3xl font-mono">{formatTime(dailyTimeLeft)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">Weekly Time Used</div>
              <div className="text-3xl font-mono">{formatHours(TOTAL_MAX_SECONDS - Object.values(weeklyTimeLeft).reduce((a, b) => a + b, 0))}</div>
            </div>
          </div>
          
          {/* Weekly stage progress */}
          <div className="flex space-x-1 text-sm text-center mb-4">
            {STAGES.map(stage => {
              const timeLeft = weeklyTimeLeft[stage as keyof typeof weeklyTimeLeft];
              const timeUsed = STAGE_MAX_SECONDS - timeLeft;
              const percentage = Math.round((timeUsed / STAGE_MAX_SECONDS) * 100);
              let statusColor = "bg-green-500";
              
              if (weekPhase === 'backHalf') {
                const totalUsed = Object.values(weeklyTimeLeft).reduce(
                  (sum, stageLeft) => sum + (STAGE_MAX_SECONDS - stageLeft), 
                  0
                );
                if (totalUsed > 0) {
                  const stagePercentage = (timeUsed / totalUsed) * 100;
                  if (stagePercentage > 35) {
                    statusColor = "bg-amber-500"; // Overused
                  } else if (stagePercentage < 15 && totalUsed > 28800) {
                    statusColor = "bg-red-500"; // Underused
                  }
                }
              }
              
              return (
                <div key={stage} className="flex-1">
                  <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${statusColor}`} 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-xs mt-1">{stage.charAt(0).toUpperCase()}</div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  };
  
  // Render the non-running setup UI
  const renderSetup = () => {
    return (
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-md mb-4">
          <h2 className="text-sm font-medium mb-1">Today's Plan:</h2>
          <div className="text-sm">{dailyPlan || "No plan set for today"}</div>
        </div>
        
        {renderTimerDisplay()}
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center">
              <Label htmlFor="sessionType">Writing Type</Label>
              {weekPhase === 'backHalf' && (
                <Badge variant="outline" className="text-xs">Balance mode active</Badge>
              )}
            </div>
            <Select value={sessionType} onValueChange={setSessionType}>
              <SelectTrigger id="sessionType" className="w-full">
                <SelectValue placeholder="Select writing type..." />
              </SelectTrigger>
              <SelectContent>
                {getAvailableStages().map(stage => (
                  <SelectItem key={stage} value={stage}>
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {sessionType && (
            <div>
              <Label htmlFor="projectTitle">Project Title *</Label>
              <Input
                id="projectTitle"
                type="text"
                placeholder="Enter project title"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="w-full"
              />
            </div>
          )}
          
          {sessionType && projectTitle && (
            <div>
              <Label htmlFor="sessionPlan">Session Plan (optional)</Label>
              <Textarea
                id="sessionPlan"
                placeholder="What will you work on specifically?"
                value={sessionPlan}
                onChange={(e) => setSessionPlan(e.target.value)}
                className="w-full h-24"
              />
            </div>
          )}
          
          <div className="flex">
            <Button 
              className="flex-1"
              onClick={handleStart}
              disabled={!sessionType || !projectTitle.trim() || getAvailableStages().length === 0}
            >
              Start Session
            </Button>
            {dailyTimeLeft <= 0 && (
              <Button 
                variant="outline"
                className="ml-2"
                onClick={() => setShowTomorrowPlanDialog(true)}
              >
                Plan Tomorrow
              </Button>
            )}
          </div>
        </div>
        
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-3">Weekly Progress (5h each)</h3>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(weeklyTimeLeft).map(([type, timeLeft]) => (
                <tr key={type}>
                  <td className="py-1">{type.charAt(0).toUpperCase() + type.slice(1)}:</td>
                  <td className="py-1 text-right font-mono">
                    {formatHours(timeLeft)} / 5:00
                  </td>
                </tr>
              ))}
              <tr className="border-t">
                <td className="py-1 font-medium">Total:</td>
                <td className="py-1 text-right font-mono font-medium">
                  {calculateTotalWeeklyTime()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  
  // Render the active session UI
  const renderActiveSession = () => {
    return (
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-md">
          <h2 className="text-sm font-medium mb-1">Today's Plan:</h2>
          <div className="text-sm">{dailyPlan || "No plan set for today"}</div>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-md">
          <h2 className="text-sm font-medium mb-1">Current Session Plan:</h2>
          <div className="text-sm">{sessionPlan || "No plan set for this session"}</div>
        </div>
        
        <div className="text-center font-medium">
          Current Session: {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} — {projectTitle}
          <div className="text-sm text-gray-500">Started at {getStartedAtDisplay()}</div>
        </div>
        
        {renderTimerDisplay()}
        
        <div>
          <Label htmlFor="processNotes">Process Notes</Label>
          <Textarea
            id="processNotes"
            placeholder="Record your thoughts, insights, or issues as you write..."
            value={processNotes}
            onChange={(e) => setProcessNotes(e.target.value)}
            className="w-full h-32 mt-2"
          />
        </div>
        
        <Button 
          variant="destructive"
          className="w-full"
          onClick={handleStopClick}
        >
          Stop Session
        </Button>
        
        <div>
          <h3 className="text-sm font-medium mb-2">Weekly Progress (5h each)</h3>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(weeklyTimeLeft).map(([type, timeLeft]) => {
                const isCurrentType = type === sessionType;
                return (
                  <tr key={type} className={isCurrentType ? "font-medium" : ""}>
                    <td className="py-1">{type.charAt(0).toUpperCase() + type.slice(1)}:</td>
                    <td className="py-1 text-right font-mono">
                      {isCurrentType && sessionTime > 0 ? 
                        `${formatHours(timeLeft - sessionTime)} / 5:00` : 
                        `${formatHours(timeLeft)} / 5:00`}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t">
                <td className="py-1 font-medium">Total:</td>
                <td className="py-1 text-right font-mono font-medium">
                  {calculateTotalWeeklyTime()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  
  // Render the main UI
  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        {!isRunning ? renderSetup() : renderActiveSession()}
      </div>
      
      {/* Session History (might be shown/hidden with a button or tab) */}
      <div className="border-t p-6">
        <h2 className="text-xl font-semibold mb-4">Session History</h2>
        
        {sessionsCompleted.length > 0 ? (
          <div className="space-y-3">
            {sessionsCompleted.map((session, index) => (
              <div 
                key={index} 
                className="p-3 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer"
                onClick={() => {
                  const summary = `**plan:** ${session.plan || ''}
**start time:** ${session.startTime}
**stage:** ${session.type}
**project:** [[${session.title}]]
**duration:** ${Math.floor(session.duration / 60)} min
**process:** ${session.notes || ''}
**fluency:** ${session.fluency || 'N/A'}
**next actions:** ${session.nextActions || ''}`;
                  
                  setSessionSummary(summary);
                  setShowSessionSummary(true);
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{session.title}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      ({session.type.charAt(0).toUpperCase() + session.type.slice(1)})
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {Math.floor(session.duration / 60)} min
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {session.startTime} - {session.endTime}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No sessions recorded yet</p>
        )}
      </div>
      
      {/* Dialogs */}
      {/* Daily Plan Dialog */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Plan Your Writing Day</DialogTitle>
            <DialogDescription>
              Setting a daily writing plan helps keep you focused and productive.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Label htmlFor="dailyPlan">Today's Writing Goal</Label>
            <Textarea 
              id="dailyPlan"
              placeholder="What do you plan to accomplish today?"
              value={dailyPlan}
              onChange={(e) => setDailyPlan(e.target.value)}
              className="w-full h-32 mt-2"
            />
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              onClick={() => setShowPlanDialog(false)}
            >
              Start Writing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Early Stop Dialog */}
      <AlertDialog open={showEarlyStopDialog} onOpenChange={setShowEarlyStopDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>
            Stop session early?
          </AlertDialogTitle>
          <AlertDialogDescription>
            You haven't reached the 10-minute minimum session time. Are you sure you want to stop?
          </AlertDialogDescription>
          <div className="flex justify-end space-x-2 mt-4">
            <AlertDialogCancel>Continue Writing</AlertDialogCancel>
            <AlertDialogAction onClick={proceedWithSessionEnd}>
              Yes, Stop Session
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Fluency Rating Dialog */}
      <Dialog open={showFluencyDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rate Your Writing Fluency</DialogTitle>
            <DialogDescription>
              How smoothly did your writing flow during this session?
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div>
              <Label>Fluency Rating (1-5)</Label>
              <div className="flex space-x-2 mt-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <Button
                    key={rating}
                    type="button"
                    variant={fluencyRating === rating ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setFluencyRating(rating)}
                  >
                    {rating}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="nextActions">Next Actions (Optional)</Label>
              <Textarea
                id="nextActions"
                placeholder="What will you do in your next writing session?"
                value={nextActions}
                onChange={(e) => setNextActions(e.target.value)}
                className="w-full h-24 mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={completeSession}>
              Finish Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Session Summary Dialog */}
      <Dialog open={showSessionSummary} onOpenChange={setShowSessionSummary}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Session Summary</DialogTitle>
            <DialogDescription>
              Review your session details and copy to clipboard if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <pre className="w-full p-4 bg-gray-50 rounded-md text-sm overflow-auto font-mono whitespace-pre-wrap">
              {sessionSummary}
            </pre>
          </div>
          <DialogFooter className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowSessionSummary(false)}>Close</Button>
            <Button onClick={handleCopySummary}>Copy to Clipboard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Tomorrow's Plan Dialog */}
      <Dialog open={showTomorrowPlanDialog} onOpenChange={setShowTomorrowPlanDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Plan for Tomorrow</DialogTitle>
            <DialogDescription>
              You've used all your writing time for today. Set your goals for tomorrow.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="tomorrowPlan">Tomorrow's Writing Goals</Label>
              <Textarea 
                id="tomorrowPlan"
                placeholder="What do you want to accomplish tomorrow?"
                value={tomorrowPlan}
                onChange={(e) => setTomorrowPlan(e.target.value)}
                className="h-32 mt-2"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowTomorrowPlanDialog(false)}>Cancel</Button>
            <Button onClick={() => {
              // Save tomorrow's plan
              localStorage.setItem('tomorrowPlan', tomorrowPlan);
              setShowTomorrowPlanDialog(false);
            }}>
              Save Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WritingTimerCore;