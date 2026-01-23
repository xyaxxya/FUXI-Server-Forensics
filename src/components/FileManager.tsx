import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Folder, File, ArrowUp, RefreshCw, Upload, Download, Loader2, Trash2 } from 'lucide-react';

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

    return (
        <div 
            className="flex flex-col h-full text-slate-300 font-mono text-sm bg-[#1e1e2e] relative"
            onClick={() => setContextMenu(null)}
        >
            {/* Context Menu */}
            {contextMenu && (
                <div 
                    className="fixed bg-slate-800 border border-slate-600 rounded shadow-xl z-50 py-1 min-w-[120px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    {!contextMenu.file.is_dir && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                            className="w-full text-left px-4 py-2 hover:bg-slate-700 flex items-center gap-2 text-xs"
                        >
                            <Download size={14} /> Download
                        </button>
                    )}
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-700 flex items-center gap-2 text-xs text-red-400"
                    >
                        <Trash2 size={14} /> Delete
                    </button>
                </div>
            )}

            {/* Hidden Input */}
            <input 
                type="file" 
                multiple 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileChange} 
            />

            <div className="flex items-center gap-2 p-2 border-b border-slate-700 bg-slate-800">
                <button onClick={handleUp} disabled={path === '/'} className="p-1 hover:bg-slate-700 rounded disabled:opacity-50 text-slate-300">
                    <ArrowUp size={16} />
                </button>
                <input 
                    type="text" 
                    value={path} 
                    readOnly 
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
                />
                <button 
                    onClick={handleUploadClick} 
                    className="p-1 hover:bg-slate-700 rounded text-slate-300"
                    title="Upload File"
                    disabled={uploading}
                >
                    <Upload size={16} />
                </button>
                <button onClick={() => loadFiles(path)} className="p-1 hover:bg-slate-700 rounded text-slate-300">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>
            
            <div className="flex-1 overflow-auto relative">
                {uploading && (
                    <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-20 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 size={24} className="animate-spin text-blue-400" />
                            <span className="text-xs text-blue-200">Processing...</span>
                        </div>
                    </div>
                )}

                {error && <div className="p-4 text-red-400 text-xs break-all border-b border-red-900/30 bg-red-900/10">{error}</div>}
                
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-800 text-xs text-slate-400 sticky top-0 z-10">
                        <tr>
                            <th className="p-2 font-medium border-b border-slate-700">Name</th>
                            <th className="p-2 w-20 font-medium border-b border-slate-700">Size</th>
                            <th className="p-2 w-24 font-medium border-b border-slate-700">Modified</th>
                        </tr>
                    </thead>
                    <tbody>
                        {files.map((file) => (
                            <tr 
                                key={file.name} 
                                className="hover:bg-slate-700/30 cursor-pointer border-b border-slate-800/50 transition-colors"
                                onDoubleClick={() => handleNavigate(file)}
                                onContextMenu={(e) => handleContextMenu(e, file)}
                            >
                                <td className="p-2 flex items-center gap-2">
                                    {file.is_dir ? <Folder size={14} className="text-blue-400 shrink-0" /> : <File size={14} className="text-slate-500 shrink-0" />}
                                    <span className="truncate max-w-[150px] text-xs" title={file.name}>{file.name}</span>
                                </td>
                                <td className="p-2 text-xs text-slate-500 whitespace-nowrap">{file.is_dir ? '-' : formatSize(file.size)}</td>
                                <td className="p-2 text-xs text-slate-500 whitespace-nowrap">
                                    {new Date(file.mtime * 1000).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {files.length === 0 && !loading && !error && (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
                        <Folder size={24} className="opacity-50" />
                        <span className="text-xs">No files found</span>
                    </div>
                )}
            </div>
        </div>
    );
}
