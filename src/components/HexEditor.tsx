import { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Binary, Search, Hash, ChevronUp, ChevronDown, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface HexEditorProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  initialContent: Uint8Array;
  onSave?: (content: Uint8Array) => Promise<void>;
}

export default function HexEditor({
  isOpen,
  onClose,
  fileName,
  initialContent,
  onSave,
}: HexEditorProps) {
  const [content, setContent] = useState<Uint8Array>(initialContent);
  const [selectedOffset, setSelectedOffset] = useState<number | null>(null);
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [gotoOffset, setGotoOffset] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'success' | 'error' } | null>(null);

  
  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<'text' | 'hex'>('text');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Virtualization / Pagination state
  const ROW_SIZE = 16;
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Derived values
  const totalRows = Math.ceil(content.length / ROW_SIZE);
  
  // Handle scroll to render visible rows only (simple optimization)
  const visibleRowsCount = 60; // Render enough to fill screen + buffer
  const itemHeight = 24; // Approximate height of a row in px
  const [startRow, setStartRow] = useState(0);

  // DataView for inspector
  const dataView = useMemo(() => {
    return new DataView(content.buffer, content.byteOffset, content.byteLength);
  }, [content]);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const showToast = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2000);
  };

  const getSelectionRange = () => {
    if (selectedOffset === null) return null;
    const start = selectionAnchor !== null ? selectionAnchor : selectedOffset;
    const end = selectedOffset;
    return {
      start: Math.min(start, end),
      end: Math.max(start, end)
    };
  };

  const copyHex = () => {
    const range = getSelectionRange();
    if (!range) return;
    const slice = content.slice(range.start, range.end + 1);
    const text = Array.from(slice).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    navigator.clipboard.writeText(text);
    showToast('Hex copied to clipboard', 'success');
  };

  const copyText = () => {
    const range = getSelectionRange();
    if (!range) return;
    const slice = content.slice(range.start, range.end + 1);
    const text = Array.from(slice).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
    navigator.clipboard.writeText(text);
    showToast('Text copied to clipboard', 'success');
  };

  // Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'c') {
         if (selectedOffset !== null) {
            e.preventDefault();
            copyHex();
         }
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
         if (selectedOffset !== null) {
            e.preventDefault();
            copyText();
         }
      }

      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false);
        } else {
          onClose();
        }
      }
      if (showSearch && e.key === 'Enter') {
          if (e.shiftKey) {
             handlePrevMatch();
          } else {
             handleNextMatch();
          }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen, showSearch, selectedOffset, selectionAnchor, content]); // Added dependencies


  // Search Logic
  useEffect(() => {
    if (!searchQuery) {
        setSearchResults([]);
        setCurrentMatchIndex(-1);
        return;
    }

    const timer = setTimeout(() => {
        const results: number[] = [];
        let searchBytes: number[] = [];

        if (searchMode === 'text') {
            const encoder = new TextEncoder();
            searchBytes = Array.from(encoder.encode(searchQuery));
        } else {
            // Hex mode: parse "4A 4B" or "4A4B"
            const cleanHex = searchQuery.replace(/\s/g, '');
            if (cleanHex.length % 2 !== 0) return; // Incomplete hex
            for (let i = 0; i < cleanHex.length; i += 2) {
                const byte = parseInt(cleanHex.substr(i, 2), 16);
                if (!isNaN(byte)) searchBytes.push(byte);
            }
        }

        if (searchBytes.length === 0) return;

        // Naive search
        for (let i = 0; i <= content.length - searchBytes.length; i++) {
            let match = true;
            for (let j = 0; j < searchBytes.length; j++) {
                if (content[i + j] !== searchBytes[j]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                results.push(i);
                // Limit results to avoid freezing on massive matches (e.g. searching "00")
                if (results.length > 1000) break; 
            }
        }

        setSearchResults(results);
        if (results.length > 0) {
            setCurrentMatchIndex(0);
            scrollToOffset(results[0]);
        } else {
            setCurrentMatchIndex(-1);
        }
    }, 300); // Debounce

    return () => clearTimeout(timer);
  }, [searchQuery, searchMode, content]);

  const scrollToOffset = (offset: number) => {
      setSelectedOffset(offset);
      const row = Math.floor(offset / ROW_SIZE);
      if (containerRef.current) {
          containerRef.current.scrollTop = row * itemHeight - (containerRef.current.clientHeight / 2);
      }
  };

  const handleNextMatch = () => {
      if (searchResults.length === 0) return;
      const nextIndex = (currentMatchIndex + 1) % searchResults.length;
      setCurrentMatchIndex(nextIndex);
      scrollToOffset(searchResults[nextIndex]);
  };

  const handlePrevMatch = () => {
      if (searchResults.length === 0) return;
      const prevIndex = (currentMatchIndex - 1 + searchResults.length) % searchResults.length;
      setCurrentMatchIndex(prevIndex);
      scrollToOffset(searchResults[prevIndex]);
  };

  const handleMouseDown = (offset: number) => {
      setSelectionAnchor(offset);
      setSelectedOffset(offset);
      setIsSelecting(true);
  };

  const handleMouseEnter = (offset: number) => {
      if (isSelecting) {
          setSelectedOffset(offset);
      }
  };

  const handleMouseUp = () => {
      setIsSelecting(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setStartRow(Math.floor(scrollTop / itemHeight));
  };

  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  const toAscii = (n: number) => {
    return (n >= 32 && n <= 126) ? String.fromCharCode(n) : '.';
  };

  const handleGoto = (e: React.FormEvent) => {
    e.preventDefault();
    let offset = parseInt(gotoOffset.startsWith("0x") ? gotoOffset : `0x${gotoOffset}`, 16);
    if (isNaN(offset)) {
      offset = parseInt(gotoOffset, 10);
    }

    if (!isNaN(offset) && offset >= 0 && offset < content.length) {
      scrollToOffset(offset);
    }
  };

  const copyToClipboard = async (text: string) => {
      try {
          await navigator.clipboard.writeText(text);
          showToast('Copied to clipboard', 'success');
      } catch (err) {
          console.error('Failed to copy:', err);
          showToast('Failed to copy', 'error');
      }
  };

  // Generate visible rows
  const renderRows = () => {
    const rows = [];
    const endRow = Math.min(startRow + visibleRowsCount + 5, totalRows); // +5 buffer
    const range = getSelectionRange();
    
    for (let i = startRow; i < endRow; i++) {
      const offset = i * ROW_SIZE;
      const bytes = content.slice(offset, offset + ROW_SIZE);
      const hexPart = [];
      const asciiPart = [];
      
      for (let j = 0; j < ROW_SIZE; j++) {
        if (j < bytes.length) {
          const b = bytes[j];
          const byteOffset = offset + j;
          const isCursor = selectedOffset === byteOffset;
          const isInRange = range && byteOffset >= range.start && byteOffset <= range.end;
          const isMatch = searchResults.includes(byteOffset);
          const isCurrentMatch = searchResults[currentMatchIndex] === byteOffset;

          let bgClass = '';
          let textClass = 'text-slate-400';
          
          if (isCursor) {
              bgClass = 'bg-emerald-500 rounded shadow-lg scale-110 z-10';
              textClass = 'text-black font-bold';
          } else if (isInRange) {
              bgClass = 'bg-emerald-500/40';
              textClass = 'text-white';
          } else if (isCurrentMatch) {
              bgClass = 'bg-orange-500 rounded';
              textClass = 'text-black font-bold';
          } else if (isMatch) {
              bgClass = 'bg-yellow-500/30 rounded';
              textClass = 'text-yellow-200';
          } else {
              bgClass = 'hover:bg-sky-500/20 rounded cursor-pointer';
              textClass = 'text-slate-400 hover:text-sky-300';
          }

          hexPart.push(
            <span 
              key={`hex-${i}-${j}`} 
              onMouseDown={() => handleMouseDown(byteOffset)}
              onMouseEnter={() => handleMouseEnter(byteOffset)}
              className={`inline-block w-6 text-center ${j === 8 ? 'ml-2' : ''} ${bgClass} ${textClass} transition-all duration-75 select-none`}
            >
              {toHex(b)}
            </span>
          );
          asciiPart.push(
            <span 
              key={`ascii-${i}-${j}`} 
              onMouseDown={() => handleMouseDown(byteOffset)}
              onMouseEnter={() => handleMouseEnter(byteOffset)}
              className={`inline-block w-[1ch] text-center 
                ${isCursor 
                  ? 'bg-emerald-500 text-black font-bold scale-110 z-10 rounded' 
                  : isInRange
                    ? 'bg-emerald-500/40 text-white'
                    : isCurrentMatch
                        ? 'bg-orange-500 text-black font-bold rounded'
                        : isMatch
                            ? 'bg-yellow-500/30 text-yellow-200 rounded'
                            : 'text-slate-500 hover:text-sky-300 hover:bg-sky-500/20 rounded cursor-pointer'
                } transition-all duration-75 select-none`}
            >
              {toAscii(b)}
            </span>
          );
        } else {
           hexPart.push(<span key={`hex-${i}-${j}`} className={`inline-block w-6 ${j === 8 ? 'ml-2' : ''}`}></span>);
           asciiPart.push(<span key={`ascii-${i}-${j}`} className="inline-block w-[1ch]"> </span>);
        }
      }

      rows.push(
        <div 
          key={i} 
          className={`flex font-mono text-xs leading-6 hover:bg-white/5 ${selectedOffset !== null && Math.floor(selectedOffset / ROW_SIZE) === i ? 'bg-white/[0.02]' : ''}`}
          style={{ height: itemHeight }}
        >
          {/* Offset */}
          <div className="w-24 text-slate-600 select-none border-r border-white/5 mr-4 font-medium">
            {offset.toString(16).padStart(8, '0').toUpperCase()}
          </div>
          
          {/* Hex */}
          <div className="flex gap-1 mr-4">
            {hexPart}
          </div>
          
          {/* ASCII */}
          <div className="border-l border-white/5 pl-4 tracking-widest">
            {asciiPart}
          </div>
        </div>
      );
    }
    return rows;
  };

  const DataInspector = () => {
    if (selectedOffset === null) return (
        <div className="p-6 text-slate-500 text-xs flex flex-col items-center justify-center h-full gap-2 opacity-50">
            <Binary size={32} />
            <span>Select a byte to inspect</span>
        </div>
    );

    const safeRead = (fn: () => any) => {
        try { return fn(); } catch { return 'N/A'; }
    };

    return (
        <div className="p-4 space-y-4 text-xs font-mono overflow-auto h-full custom-scrollbar">
            <div className="pb-2 border-b border-white/10 mb-4 flex justify-between items-start">
                <div>
                    <h3 className="text-white font-medium mb-1">Inspector</h3>
                    <div className="text-slate-500">Offset: <span className="text-emerald-400">0x{selectedOffset.toString(16).toUpperCase()}</span></div>
                </div>
                <button 
                    onClick={() => copyToClipboard(`0x${selectedOffset.toString(16).toUpperCase()}`)}
                    className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
                    title="Copy Offset"
                >
                    <Copy size={12} />
                </button>
            </div>

            <div className="space-y-3">
                <InspectorItem label="Int8" value={safeRead(() => dataView.getInt8(selectedOffset))} />
                <InspectorItem label="Uint8" value={safeRead(() => dataView.getUint8(selectedOffset))} />
                <InspectorItem label="Binary" value={safeRead(() => dataView.getUint8(selectedOffset).toString(2).padStart(8, '0'))} />
                
                <div className="pt-2 border-t border-white/5 mt-2">
                    <h4 className="text-slate-500 mb-2 text-[10px] uppercase">16-bit</h4>
                    <InspectorItem label="Int16 (LE)" value={safeRead(() => dataView.getInt16(selectedOffset, true))} />
                    <InspectorItem label="Int16 (BE)" value={safeRead(() => dataView.getInt16(selectedOffset, false))} />
                    <InspectorItem label="Uint16 (LE)" value={safeRead(() => dataView.getUint16(selectedOffset, true))} />
                    <InspectorItem label="Uint16 (BE)" value={safeRead(() => dataView.getUint16(selectedOffset, false))} />
                </div>

                <div className="pt-2 border-t border-white/5 mt-2">
                    <h4 className="text-slate-500 mb-2 text-[10px] uppercase">32-bit</h4>
                    <InspectorItem label="Int32 (LE)" value={safeRead(() => dataView.getInt32(selectedOffset, true))} />
                    <InspectorItem label="Int32 (BE)" value={safeRead(() => dataView.getInt32(selectedOffset, false))} />
                    <InspectorItem label="Uint32 (LE)" value={safeRead(() => dataView.getUint32(selectedOffset, true))} />
                    <InspectorItem label="Uint32 (BE)" value={safeRead(() => dataView.getUint32(selectedOffset, false))} />
                    <InspectorItem label="Float (LE)" value={safeRead(() => dataView.getFloat32(selectedOffset, true).toExponential(4))} />
                </div>
                
                <div className="pt-2 border-t border-white/5 mt-2">
                    <h4 className="text-slate-500 mb-2 text-[10px] uppercase">64-bit</h4>
                    <InspectorItem label="Int64 (LE)" value={safeRead(() => dataView.getBigInt64(selectedOffset, true).toString())} />
                    <InspectorItem label="Uint64 (LE)" value={safeRead(() => dataView.getBigUint64(selectedOffset, true).toString())} />
                    <InspectorItem label="Double (LE)" value={safeRead(() => dataView.getFloat64(selectedOffset, true).toExponential(4))} />
                </div>
            </div>
        </div>
    );
  };

  const InspectorItem = ({ label, value }: { label: string, value: string | number }) => (
      <div className="flex justify-between items-center group">
          <span className="text-slate-400 group-hover:text-slate-300 transition-colors cursor-default">{label}</span>
          <button 
              onClick={() => copyToClipboard(value.toString())}
              className="text-sky-300 font-medium hover:text-white hover:bg-sky-500/20 px-1 rounded transition-colors text-right truncate max-w-[120px]"
              title="Click to Copy"
          >
              {value}
          </button>
      </div>
  );

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="w-full max-w-6xl h-[85vh] bg-[#0a0a0f]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <Binary size={20} className="text-emerald-400" />
                </div>
                <div>
                    <h2 className="text-sm font-medium text-white tracking-wide flex items-center gap-2">
                        Hex Editor Pro
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">BETA</span>
                    </h2>
                    <p className="text-xs text-slate-400 font-mono">{fileName} • {content.length.toLocaleString()} bytes</p>
                </div>
              </div>
              
              {/* Toolbar Actions */}
              <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowSearch(!showSearch)}
                    className={`p-2 rounded-lg transition-colors ${showSearch ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-white/10 text-slate-400 hover:text-white'}`}
                    title="Find (Ctrl+F)"
                  >
                      <Search size={18} />
                  </button>

                  <div className="h-6 w-px bg-white/10 mx-1"></div>

                  <form onSubmit={handleGoto} className="flex items-center bg-black/30 border border-white/10 rounded-lg px-2 py-1 focus-within:border-sky-500/50 transition-colors">
                      <Hash size={14} className="text-slate-500 mr-2" />
                      <input 
                        type="text" 
                        placeholder="Go to Offset" 
                        value={gotoOffset}
                        onChange={(e) => setGotoOffset(e.target.value)}
                        className="bg-transparent border-none text-xs text-white placeholder-slate-600 focus:outline-none w-24 font-mono"
                      />
                  </form>
                  
                  <div className="h-6 w-px bg-white/10 mx-1"></div>

                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
              </div>
            </div>

            {/* Search Bar */}
            <AnimatePresence>
                {showSearch && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-b border-white/10 bg-black/40 overflow-hidden"
                    >
                        <div className="p-3 px-6 flex items-center gap-4">
                            <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 flex-1 focus-within:border-sky-500/50 transition-colors">
                                <Search size={14} className="text-slate-400 mr-2" />
                                <input 
                                    ref={searchInputRef}
                                    type="text" 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={searchMode === 'hex' ? "Search Hex (e.g. 4A 4B)" : "Search TextString"}
                                    className="bg-transparent border-none text-xs text-white placeholder-slate-600 focus:outline-none w-full font-mono"
                                />
                            </div>
                            
                            <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/5">
                                <button 
                                    onClick={() => setSearchMode('text')}
                                    className={`px-3 py-1 rounded text-[10px] font-medium transition-all ${searchMode === 'text' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Text
                                </button>
                                <button 
                                    onClick={() => setSearchMode('hex')}
                                    className={`px-3 py-1 rounded text-[10px] font-medium transition-all ${searchMode === 'hex' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Hex
                                </button>
                            </div>

                            <div className="flex items-center gap-1">
                                <button onClick={handlePrevMatch} disabled={searchResults.length === 0} className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white disabled:opacity-30">
                                    <ChevronUp size={16} />
                                </button>
                                <button onClick={handleNextMatch} disabled={searchResults.length === 0} className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white disabled:opacity-30">
                                    <ChevronDown size={16} />
                                </button>
                            </div>

                            <div className="text-[10px] text-slate-500 font-mono w-24 text-right">
                                {searchResults.length > 0 ? `${currentMatchIndex + 1} of ${searchResults.length > 1000 ? '1000+' : searchResults.length}` : 'No results'}
                            </div>
                            
                            <button onClick={() => setShowSearch(false)} className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white">
                                <X size={14} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content Area - Split View */}
            <div className="flex flex-1 overflow-hidden">
                {/* Editor Area */}
                <div className="flex-1 flex flex-col min-w-0">
                     {/* Column Headers */}
                     <div className="px-6 pt-3 pb-2 border-b border-white/5 bg-[#0a0a0f] flex font-mono text-[10px] text-slate-500 select-none sticky top-0 z-10">
                         <div className="w-24 mr-4 font-bold">OFFSET</div>
                         <div className="flex gap-1 mr-4 w-[340px] font-bold">
                            {Array.from({length: 16}).map((_, i) => (
                                <span key={i} className={`w-6 text-center ${i === 8 ? 'ml-2' : ''}`}>{i.toString(16).toUpperCase().padStart(2, '0')}</span>
                            ))}
                         </div>
                         <div className="pl-4 border-l border-white/5 font-bold">DECODED TEXT</div>
                    </div>

                    <div 
                        className="flex-1 overflow-auto custom-scrollbar bg-black/20 relative outline-none"
                        onScroll={handleScroll}
                        ref={containerRef}
                        tabIndex={0}
                    >
                        <div style={{ height: totalRows * itemHeight, position: 'relative' }}>
                            <div 
                                style={{ 
                                    position: 'absolute', 
                                    top: startRow * itemHeight, 
                                    left: 0, 
                                    right: 0,
                                    padding: '0 24px' // Match header px-6
                                }}
                            >
                                {renderRows()}
                            </div>
                        </div>
                    </div>
                    
                     {/* Footer Info */}
                    <div className="px-6 py-1.5 border-t border-white/10 bg-white/[0.02] text-[10px] text-slate-500 flex justify-between font-mono">
                        <div>
                            {selectedOffset !== null ? (
                                <span>
                                    Offset: <span className="text-emerald-400">0x{selectedOffset.toString(16).toUpperCase()}</span> ({selectedOffset})
                                    {selectionAnchor !== null && selectionAnchor !== selectedOffset && (
                                        <span className="ml-4 text-slate-400">
                                            Selection: {Math.abs(selectedOffset - selectionAnchor) + 1} bytes 
                                            (0x{Math.min(selectionAnchor, selectedOffset).toString(16).toUpperCase()} - 0x{Math.max(selectionAnchor, selectedOffset).toString(16).toUpperCase()})
                                        </span>
                                    )}
                                </span>
                            ) : 'Ready'}
                        </div>
                        <div>READ ONLY MODE</div>
                    </div>
                </div>

                {/* Data Inspector Sidebar */}
                <div className="w-64 border-l border-white/10 bg-black/20 flex flex-col backdrop-blur-md">
                    <DataInspector />
                </div>
            </div>

          </motion.div>
        </motion.div>
      )}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 20, x: '-50%' }}
          className={`fixed bottom-12 left-1/2 px-4 py-2 rounded-lg shadow-lg text-xs font-medium backdrop-blur-md border z-[200]
            ${toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
              toast.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
              'bg-sky-500/10 text-sky-400 border-sky-500/20'}`}
        >
          {toast.msg}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
