import React from 'react';
import { Button } from "@/components/ui/button";

type SessionControlsProps = {
  isRunning: boolean;
  sessionType: string;
  projectTitle: string;
  onSessionTypeChange: (type: string) => void;
  onProjectTitleChange: (title: string) => void;
  onStart: () => void;
  onStop: () => void;
};

const SessionControls: React.FC<SessionControlsProps> = ({
  isRunning,
  sessionType,
  projectTitle,
  onSessionTypeChange,
  onProjectTitleChange,
  onStart,
  onStop
}) => {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">Session Controls</h2>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Writing Type</label>
        <select 
          className="w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary" 
          value={sessionType}
          onChange={(e) => onSessionTypeChange(e.target.value)}
          disabled={isRunning}
        >
          <option value="" disabled>Select type...</option>
          <option value="prewriting">Prewriting</option>
          <option value="writing">Writing</option>
          <option value="rewriting">Rewriting</option>
          <option value="skillbuilding">Skill Building</option>
        </select>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
        <input 
          type="text" 
          className="w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
          placeholder="Enter project title"
          value={projectTitle}
          onChange={(e) => onProjectTitleChange(e.target.value)}
          disabled={isRunning}
        />
      </div>
      
      <div className="flex space-x-2">
        {!isRunning ? (
          <Button 
            className="flex-1 py-2 px-4 bg-primary text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            onClick={onStart}
          >
            Start Session
          </Button>
        ) : (
          <Button 
            className="flex-1 py-2 px-4 bg-destructive text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-destructive"
            onClick={onStop}
            variant="destructive"
          >
            Stop Session
          </Button>
        )}
      </div>
    </div>
  );
};

export default SessionControls;
