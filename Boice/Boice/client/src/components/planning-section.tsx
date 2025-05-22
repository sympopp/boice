import React from 'react';

type PlanningSectionProps = {
  dailyPlan: string;
  sessionPlan: string;
  processNotes: string;
  onDailyPlanChange: (plan: string) => void;
  onSessionPlanChange: (plan: string) => void;
  onProcessNotesChange: (notes: string) => void;
};

const PlanningSection: React.FC<PlanningSectionProps> = ({
  dailyPlan,
  sessionPlan,
  processNotes,
  onDailyPlanChange,
  onSessionPlanChange,
  onProcessNotesChange
}) => {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Daily Plan</h2>
        <textarea 
          className="w-full h-24 py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary resize-none"
          placeholder="Your plan for today..."
          value={dailyPlan}
          onChange={(e) => onDailyPlanChange(e.target.value)}
        />
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Session Plan</h2>
        <textarea 
          className="w-full h-24 py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary resize-none"
          placeholder="What do you plan to accomplish in this session?"
          value={sessionPlan}
          onChange={(e) => onSessionPlanChange(e.target.value)}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Process Notes</h2>
        <textarea 
          className="w-full h-24 py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary resize-none"
          placeholder="Notes about your writing process..."
          value={processNotes}
          onChange={(e) => onProcessNotesChange(e.target.value)}
        />
      </div>
    </>
  );
};

export default PlanningSection;
