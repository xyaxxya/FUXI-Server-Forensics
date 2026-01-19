import { Bot } from "lucide-react";

export default function AgentPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-50 text-slate-500">
      <div className="w-24 h-24 bg-white rounded-3xl shadow-sm border border-slate-200 flex items-center justify-center mb-6">
        <Bot size={48} className="text-blue-500" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Agent Panel</h2>
      <p className="max-w-md text-center">
        This is the placeholder for the main agent answering panel. 
        Features will be implemented in future updates.
      </p>
    </div>
  );
}
