import React from 'react';
import { Button } from "@/components/ui/button";

type Session = {
  type: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  plan?: string;
  notes?: string;
  date: string;
  isManual?: boolean;
};

type SessionHistoryProps = {
  sessions: Session[];
  onViewSession: (session: Session) => void;
  onManualLogOpen: () => void;
};

const SessionHistory: React.FC<SessionHistoryProps> = ({
  sessions,
  onViewSession,
  onManualLogOpen
}) => {
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} ${minutes === 1 ? 'min' : 'mins'}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Session History</h2>
      
      <div className="overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sessions.length > 0 ? (
              sessions.map((session, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {session.type.charAt(0).toUpperCase() + session.type.slice(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{session.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{session.startTime} - {session.endTime}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDuration(session.duration)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      className="text-primary hover:text-blue-700"
                      onClick={() => onViewSession(session)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  No sessions recorded yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex justify-center mt-4">
          <Button 
            className="py-2 px-4 text-sm font-medium text-primary bg-transparent border border-primary rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            onClick={onManualLogOpen}
            variant="outline"
          >
            Log Manual Session
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SessionHistory;
