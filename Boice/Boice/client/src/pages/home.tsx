import WritingTimerCore from "@/components/writing-timer-new";

export default function Home() {
  return (
    <div className="bg-app-bg min-h-screen">
      <div className="container mx-auto p-4 max-w-4xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Writing Timer</h1>
          <p className="text-gray-600">Based on Dr. Robert Boice's research on writing productivity</p>
        </header>
        
        <WritingTimerCore />
      </div>
    </div>
  );
}
