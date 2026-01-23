import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { Folder, File, ArrowUp, RefreshCw, Upload, Download, Loader2, Trash2, FileCode, Edit } from 'lucide-react';
import FileEditor from './FileEditor';

interface FileEntry {
    name: string;
    is_dir: boolean;
    size: number;
    mtime: number;
}

export default function FileManager({ sessionId, initialPath = "/" }: { sessionId: string, initialPath?: string }) {
    const [path, setPath] = useState(initialPath);
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, file: FileEntry } | null>(null);
    const [editingFile, setEditingFile] = useState<{ name: string, path: string, content: string } | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadFiles = async (currentPath: string) => {
        if (!sessionId) return;
        setLoading(true);
        setError(null);
        try {
            const entries = await invoke<FileEntry[]>('sftp_ls', { sessionId, path: currentPath });
            setFiles(entries);
        } catch (e: any) {
            setError(e.toString());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles(path);
    }, [path, sessionId]);

    const handleNavigate = (entry: FileEntry) => {
        if (entry.is_dir) {
            const newPath = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;
            setPath(newPath);
        }
    };

    const handleUp = () => {
        if (path === '/') return;
        const parent = path.substring(0, path.lastIndexOf('/')) || '/';
        setPath(parent);
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // --- Upload Logic ---
    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const processUpload = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        
        setUploading(true);
        setError(null);

        try {
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                const arrayBuffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                const content = Array.from(uint8Array); // Convert to regular array for Rust serialization
                
                const remotePath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
                
                await invoke('sftp_write_binary', {
                    sessionId,
                    path: remotePath,
                    content
                });
            }
            // Refresh list
            loadFiles(path);
        } catch (e: any) {
            setError(`Upload failed: ${e.toString()}`);
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        processUpload(e.target.files);
        // Reset input so same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // --- Download & Delete Logic ---
    const handleContextMenu = (e: React.MouseEvent, file: FileEntry) => {
        e.preventDefault();
        // Allow context menu for both files and directories (for delete), but download only for files
        setContextMenu({ x: e.clientX, y: e.clientY, file });
    };

    const handleDownload = async () => {
        if (!contextMenu) return;
        const file = contextMenu.file;
        setContextMenu(null);
        if (file.is_dir) return; // Should not happen if UI is correct

        setUploading(true); // Re-use loading state indicator
        
        try {
            const remotePath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
            const content = await invoke<number[]>('sftp_read_binary', { sessionId, path: remotePath });
            
            // Create Blob and download
            const uint8Array = new Uint8Array(content);
            const blob = new Blob([uint8Array], { type: 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e: any) {
            setError(`Download failed: ${e.toString()}`);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!contextMenu) return;
        const file = contextMenu.file;
        setContextMenu(null);
        
        if (!confirm(`Are you sure you want to delete ${file.name}?`)) return;

        setUploading(true);
        try {
            const remotePath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
            await invoke('sftp_delete', { 
                sessionId, 
                path: remotePath,
                isDir: file.is_dir 
            });
            loadFiles(path);
        } catch (e: any) {
            setError(`Delete failed: ${e.toString()}`);
        } finally {
            setUploading(false);
        }
    };

    const handleEdit = async () => {
        if (!contextMenu) return;
        const file = contextMenu.file;
        setContextMenu(null);
        if (file.is_dir) return;

        setUploading(true); // Reuse loading spinner
        try {
            const remotePath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
            // Use sftp_read which returns string (UTF-8)
            const content = await invoke<string>('sftp_read', { sessionId, path: remotePath });
            setEditingFile({
                name: file.name,
                path: remotePath,
                content
            });
        } catch (e: any) {
            setError(`Failed to open file: ${e.toString()} (Binary files cannot be edited)`);
        } finally {
            setUploading(false);
        }
    };

    const handleEditorSave = async (newContent: string) => {
        if (!editingFile) return;
        
        try {
            // Convert string to bytes for sftp_write_binary
            const encoder = new TextEncoder();
            const bytes = Array.from(encoder.encode(newContent));
            
            await invoke('sftp_write_binary', {
                sessionId,
                path: editingFile.path,
                content: bytes
            });
            
            // Optional: Reload file list to update size/mtime if needed, but not strictly necessary for content edit
            // loadFiles(path); 
            
            // Update local state to reflect saved content (though editor does this too)
            setEditingFile(prev => prev ? { ...prev, content: newContent } : null);
        } catch (e: any) {
            // Re-throw to let Editor handle error display or handle here
            throw new Error(e.toString());
        }
    };

    return (
        <div 
            className="flex flex-col h-full text-slate-200 font-mono text-sm bg-transparent relative"
            onClick={() => setContextMenu(null)}
        >
            {/* Context Menu */}
            {contextMenu && createPortal(
                <>
                    <div 
                        className="fixed inset-0 z-[9998]" 
                        onClick={() => setContextMenu(null)} 
                    />
                    <div 
                        className="fixed glass-dark border border-white/10 rounded-xl shadow-2xl z-[9999] py-1.5 min-w-[140px] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        {!contextMenu.file.is_dir && (
                            <>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleEdit(); }}
                                    className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-2 text-xs text-slate-300 hover:text-white transition-colors"
                                >
                                    <Edit size={14} className="text-sky-400" /> Edit
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                                    className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-2 text-xs text-slate-300 hover:text-white transition-colors"
                                >
                                    <Download size={14} /> Download
                                </button>
                            </>
                        )}
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                            className="w-full text-left px-4 py-2 hover:bg-red-500/20 flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                    </div>
                </>,
                document.body
            )}

            {/* File Editor Modal */}
            {editingFile && (
                <FileEditor
                    isOpen={!!editingFile}
                    onClose={() => setEditingFile(null)}
                    fileName={editingFile.name}
                    initialContent={editingFile.content}
                    onSave={handleEditorSave}
                />
            )}

            {/* Hidden Input */}
            <input 
                type="file" 
                multiple 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileChange} 
            />

            <div className="flex items-center gap-2 p-3 border-b border-white/5 bg-white/[0.02]">
                <button onClick={handleUp} disabled={path === '/'} className="p-1.5 hover:bg-white/10 rounded-lg disabled:opacity-30 text-slate-400 hover:text-white transition-colors">
                    <ArrowUp size={16} />
                </button>
                <div className="flex-1 bg-black/20 border border-white/5 rounded-lg px-3 py-1.5 flex items-center">
                    <span className="text-sky-500 mr-2">/</span>
                    <input 
                        type="text" 
                        value={path} 
                        readOnly 
                        className="flex-1 bg-transparent border-none text-xs text-slate-300 focus:outline-none font-medium tracking-wide"
                    />
                </div>
                <button 
                    onClick={handleUploadClick} 
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-sky-400 transition-colors"
                    title="Upload File"
                    disabled={uploading}
                >
                    <Upload size={16} />
                </button>
                <button onClick={() => loadFiles(path)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>
            
            <div className="flex-1 overflow-auto relative custom-scrollbar">
                {uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3 glass-dark p-8 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="relative">
                                <div className="absolute inset-0 bg-sky-500/20 blur-xl rounded-full"></div>
                                <Loader2 size={32} className="animate-spin text-sky-400 relative z-10" />
                            </div>
                            <span className="text-xs text-sky-200 font-medium tracking-widest uppercase">Transmitting Data...</span>
                        </div>
                    </div>
                )}

                {error && <div className="p-3 m-2 text-red-300 text-xs break-all rounded-lg border border-red-500/20 bg-red-500/10 backdrop-blur-sm">{error}</div>}
                
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500 font-bold sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            <th className="p-3 pl-4 font-medium border-b border-white/5">Name</th>
                            <th className="p-3 font-medium border-b border-white/5 text-right">Size</th>
                            <th className="p-3 pr-4 font-medium border-b border-white/5 text-right">Modified</th>
                        </tr>
                    </thead>
                    <tbody>
                        {files.map((file) => (
                            <tr 
                                key={file.name} 
                                className="group hover:bg-white/[0.04] cursor-pointer border-b border-white/[0.02] transition-colors duration-150"
                                onDoubleClick={() => handleNavigate(file)}
                                onContextMenu={(e) => handleContextMenu(e, file)}
                            >
                                <td className="p-2.5 pl-4 flex items-center gap-3">
                                    {file.is_dir ? (
                                        <div className="p-1 rounded bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20 group-hover:scale-110 transition-all duration-200">
                                            <Folder size={14} fill="currentColor" fillOpacity={0.2} />
                                        </div>
                                    ) : (
                                        <div className="p-1 rounded bg-slate-500/10 text-slate-400 group-hover:text-slate-200 transition-colors">
                                            <File size={14} />
                                        </div>
                                    )}
                                    <span className="truncate max-w-[140px] text-xs font-medium text-slate-300 group-hover:text-white transition-colors" title={file.name}>{file.name}</span>
                                </td>
                                <td className="p-2.5 text-[11px] text-slate-500 font-mono text-right whitespace-nowrap group-hover:text-slate-400">{file.is_dir ? '-' : formatSize(file.size)}</td>
                                <td className="p-2.5 pr-4 text-[11px] text-slate-600 font-mono text-right whitespace-nowrap group-hover:text-slate-500">
                                    {new Date(file.mtime * 1000).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {files.length === 0 && !loading && !error && (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-3">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                            <Folder size={20} className="opacity-40" />
                        </div>
                        <span className="text-xs font-medium">Directory is empty</span>
                    </div>
                )}
            </div>
        </div>
    );
}
