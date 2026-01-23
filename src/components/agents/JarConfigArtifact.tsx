import { useState } from 'react';
import { FileCode, Database, Search } from 'lucide-react';

interface ConfigFile {
  path: string;
  content: string;
  size: number;
}

interface JarAnalysisResult {
  jar_path: string;
  timestamp: string;
  files: ConfigFile[];
}

interface JarConfigArtifactProps {
  data: JarAnalysisResult;
}

export default function JarConfigArtifact({ data }: JarConfigArtifactProps) {
  const [selectedFile, setSelectedFile] = useState<ConfigFile | null>(data.files.length > 0 ? data.files[0] : null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFiles = data.files.filter(f => 
    f.path.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[500px] border border-gray-700 rounded-lg bg-[#1e1e1e] text-gray-300 font-mono text-sm overflow-hidden my-4">
      {/* Header */}
      <div className="bg-[#2d2d2d] px-4 py-2 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-white">JAR Config Analysis</span>
        </div>
        <span className="text-xs text-gray-500">{data.jar_path}</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - File List */}
        <div className="w-1/3 border-r border-gray-700 flex flex-col bg-[#252526]">
          <div className="p-2 border-b border-gray-700">
            <div className="relative">
              <Search className="absolute left-2 top-1.5 w-3 h-3 text-gray-500" />
              <input 
                type="text" 
                placeholder="Filter files..." 
                className="w-full bg-[#3c3c3c] text-white text-xs rounded px-2 pl-6 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredFiles.map((file, idx) => (
              <div 
                key={idx}
                onClick={() => setSelectedFile(file)}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#2a2d2e] ${selectedFile?.path === file.path ? 'bg-[#37373d] text-white' : ''}`}
              >
                <FileCode className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                <span className="truncate" title={file.path}>{file.path}</span>
              </div>
            ))}
            {filteredFiles.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-xs">No config files found</div>
            )}
          </div>
        </div>

        {/* Main Content - Code Viewer */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
          {selectedFile ? (
            <>
              <div className="px-4 py-2 border-b border-gray-700 bg-[#252526] flex items-center justify-between">
                <span className="font-bold text-white">{selectedFile.path}</span>
                <span className="text-xs text-gray-500">{selectedFile.size} bytes</span>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {selectedFile.content.split('\n').map((line, i) => {
                    // Simple highlighting for sensitive keys
                    const isSensitive = /password|secret|key|token|credential/i.test(line);
                    const isDb = /jdbc|url|host|port|database/i.test(line);
                    
                    return (
                      <div key={i} className={`${isSensitive ? 'bg-red-900/30 text-red-200' : isDb ? 'bg-blue-900/30 text-blue-200' : ''}`}>
                        <span className="text-gray-600 select-none w-8 inline-block text-right mr-4">{i + 1}</span>
                        {line}
                      </div>
                    );
                  })}
                </pre>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a file to view content
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
