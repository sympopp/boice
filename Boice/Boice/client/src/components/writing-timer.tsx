import { useState, useEffect } from "react";
import TimerDisplay from "@/components/timer-display";
import SessionControls from "@/components/session-controls";
import WeeklyTimeBudget from "@/components/weekly-time-budget";
import PlanningSection from "@/components/planning-section";
import SessionHistory from "@/components/session-history";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogTitle,
  AlertDialogDescription
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTimerState } from "@/hooks/use-timer-state";
import { useSessionStorage } from "@/hooks/use-session-storage";

const FOUR_HOURS_IN_SECONDS = 14400; // 4 hours
const TEN_MINUTES_IN_SECONDS = 600; // 10 minutes
const FIFTY_MINUTES_IN_SECONDS = 3000; // 50 minutes

const WritingTimer = () => {
  const {
    isRunning,
    sessionTime,
    dailyTimeLeft,
    mayStopTime,
    mustStopTime,
    startSession,
    stopSession,
    updateTimeValues
  } = useTimerState();

  const {
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
    addSession,
    weeklyTimeLeft,
    updateWeeklyTimeLeft,
    loadSavedData
  } = useSessionStorage();

  // Dialog states
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showEarlyStopDialog, setShowEarlyStopDialog] = useState(false);
  const [showManualLog, setShowManualLog] = useState(false);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [selectedSessionForView, setSelectedSessionForView] = useState<any>(null);
  
  // Manual session form state
  const [manualSession, setManualSession] = useState({
    type: '',
    title: '',
    duration: '',
    startTime: '',
    notes: ''
  });

  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  // Load saved data on first mount
  useEffect(() => {
    const { isNewDay, hasNoDailyPlan } = loadSavedData();
    if (isNewDay || hasNoDailyPlan) {
      setShowPlanDialog(true);
    }
  }, []);

  // Calculate max session time based on remaining daily and weekly type time
  const calculateMaxSessionTime = () => {
    if (!sessionType) return FIFTY_MINUTES_IN_SECONDS;
    
    const weeklyTypeTime = weeklyTimeLeft[sessionType];
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
  };
  
  // Start a session
  const handleStart = () => {
    if (!sessionType) {
      alert("Please select a writing type first.");
      return;
    }
    
    if (!projectTitle.trim()) {
      alert("Please enter a project title before starting.");
      return;
    }
    
    const newMustStopTime = calculateMaxSessionTime();
    const now = new Date();
    setSessionStartTime(now);
    
    startSession(dailyTimeLeft, weeklyTimeLeft[sessionType], newMustStopTime, sessionType);
  };
  
  // Handle stop button click
  const handleStopClick = () => {
    const isManualStop = mustStopTime > 0;  // Not an auto-stop at must-stop time
    const isInFirstTenMinutes = mayStopTime > 0;  // Still in first 10 minutes
    const hasRemainingTime = dailyTimeLeft > 0 && weeklyTimeLeft[sessionType] > 0;  // Still have time left

    if (isManualStop && isInFirstTenMinutes && hasRemainingTime) {
      setShowEarlyStopDialog(true);
      return;
    }
    
    finishSession();
  };
  
  // Finish and record the session
  const finishSession = () => {
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
        startTime: startTime,
        endTime: endTime,
        duration: sessionTime,
        plan: sessionPlan,
        notes: processNotes,
        date: new Date().toLocaleDateString()
      };
      
      // Update weekly time budget
      updateWeeklyTimeLeft(sessionType, sessionTime);
      
      // Add to completed sessions
      addSession(newSession);
      
      // Update UI state
      stopSession();
      setShowEarlyStopDialog(false);
      
      // Reset form fields for next session
      setSessionPlan('');
      setProcessNotes('');
    }
  };
  
  // Handle manual session logging
  const handleManualLogSubmit = () => {
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
    updateWeeklyTimeLeft(manualSession.type, durationInSeconds);
    updateTimeValues(-durationInSeconds, -durationInSeconds);
    
    // Add to completed sessions
    addSession(newSession);
    
    // Reset form and close dialog
    setManualSession({
      type: '',
      title: '',
      duration: '',
      startTime: '',
      notes: ''
    });
    
    setShowManualLog(false);
  };
  
  // View session details
  const handleViewSession = (session) => {
    setSelectedSessionForView(session);
    setShowSessionSummary(true);
  };
  
  // Format session summary for display
  const formatSessionSummary = (session) => {
    if (!session) return "";
    
    const minutes = Math.floor(session.duration / 60);
    const seconds = session.duration % 60;
    const durationText = seconds > 0 
      ? `${minutes} minutes, ${seconds} seconds` 
      : `${minutes} minutes`;
    
    return `Session Summary:
Type: ${session.type.charAt(0).toUpperCase() + session.type.slice(1)}
Title: ${session.title}
Duration: ${durationText} (${session.startTime} - ${session.endTime})
${session.plan ? `\nPlan:\n${session.plan}` : ''}
${session.notes ? `\nNotes:\n${session.notes}` : ''}`;
  };
  
  // Copy session summary to clipboard
  const handleCopySessionSummary = () => {
    if (selectedSessionForView) {
      navigator.clipboard.writeText(formatSessionSummary(selectedSessionForView))
        .then(() => {
          alert('Copied to clipboard!');
        })
        .catch(err => {
          console.error('Error copying text: ', err);
        });
    }
  };

  return (
    <main>
      {/* Timer Dashboard */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column: Timers and Controls */}
          <div>
            <TimerDisplay 
              sessionTime={sessionTime}
              dailyTimeLeft={dailyTimeLeft}
              mayStopTime={mayStopTime}
              mustStopTime={mustStopTime}
            />
            
            <SessionControls 
              isRunning={isRunning}
              sessionType={sessionType}
              projectTitle={projectTitle}
              onSessionTypeChange={setSessionType}
              onProjectTitleChange={setProjectTitle}
              onStart={handleStart}
              onStop={handleStopClick}
            />
            
            <WeeklyTimeBudget weeklyTimeLeft={weeklyTimeLeft} />
          </div>

          {/* Right column: Planning and Notes */}
          <div>
            <PlanningSection 
              dailyPlan={dailyPlan}
              sessionPlan={sessionPlan}
              processNotes={processNotes}
              onDailyPlanChange={setDailyPlan}
              onSessionPlanChange={setSessionPlan}
              onProcessNotesChange={setProcessNotes}
            />
          </div>
        </div>
      </div>

      {/* Session History */}
      <SessionHistory 
        sessions={sessionsCompleted}
        onViewSession={handleViewSession}
        onManualLogOpen={() => setShowManualLog(true)}
      />

      {/* Dialogs */}
      {/* Planning Dialog */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Plan Your Writing Day</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Today's Writing Goal</label>
            <textarea 
              className="w-full h-32 py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary resize-none"
              placeholder="What do you plan to accomplish today?"
              value={dailyPlan}
              onChange={(e) => setDailyPlan(e.target.value)}
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
            <AlertDialogAction onClick={finishSession}>
              Yes, Stop Session
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Log Dialog */}
      <Dialog open={showManualLog} onOpenChange={setShowManualLog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Manual Session</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Writing Type</label>
              <select 
                className="w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={manualSession.type}
                onChange={(e) => setManualSession({...manualSession, type: e.target.value})}
              >
                <option value="" disabled>Select type...</option>
                <option value="prewriting">Prewriting</option>
                <option value="writing">Writing</option>
                <option value="rewriting">Rewriting</option>
                <option value="skillbuilding">Skill Building</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
              <input 
                type="text" 
                className="w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                placeholder="Enter project title"
                value={manualSession.title}
                onChange={(e) => setManualSession({...manualSession, title: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
              <input 
                type="number" 
                className="w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                placeholder="Enter duration in minutes"
                value={manualSession.duration}
                onChange={(e) => setManualSession({...manualSession, duration: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input 
                type="time" 
                className="w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={manualSession.startTime}
                onChange={(e) => setManualSession({...manualSession, startTime: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea 
                className="w-full h-24 py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary resize-none"
                placeholder="Session notes..."
                value={manualSession.notes}
                onChange={(e) => setManualSession({...manualSession, notes: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowManualLog(false)}>Cancel</Button>
            <Button onClick={handleManualLogSubmit}>Save Session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Summary Dialog */}
      <Dialog open={showSessionSummary} onOpenChange={setShowSessionSummary}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Session Summary</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <pre className="w-full p-4 bg-gray-50 rounded-md text-sm overflow-auto font-mono whitespace-pre-wrap">
              {formatSessionSummary(selectedSessionForView)}
            </pre>
          </div>
          <DialogFooter className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowSessionSummary(false)}>Close</Button>
            <Button onClick={handleCopySessionSummary}>Copy to Clipboard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default WritingTimer;
