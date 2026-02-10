import { useState } from 'react';
import { Download, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Language } from '../translations';

interface DataTableProps {
  headers: string[];
  rows: string[][];
  language: Language;
  title?: string;
}

export default function DataTable({ headers, rows, language, title }: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Filter rows
  const filteredRows = rows.filter(row => 
    row.some(cell => String(cell).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);

  const handleExportCSV = () => {
    // BOM for Excel to recognize UTF-8
    const BOM = "\uFEFF"; 
    const csvContent = BOM + [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `export_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm my-2 w-full max-w-full">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-50">
        <div className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            {title || (language === 'zh' ? '查询结果' : 'Query Result')}
            <span className="text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                {rows.length} {language === 'zh' ? '行' : 'rows'}
            </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder={language === 'zh' ? "搜索..." : "Search..."}
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-8 pr-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 w-32 md:w-48 bg-white"
            />
          </div>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700 transition-colors shadow-sm font-medium whitespace-nowrap"
          >
            <Download size={12} />
            {language === 'zh' ? '导出 CSV' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Table Area */}
      <div className="overflow-x-auto custom-scrollbar w-full">
        <table className="w-full text-left border-collapse text-xs md:text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-3 border-b border-slate-200 border-r border-slate-100 w-12 text-center text-slate-400 font-mono text-xs bg-slate-50">#</th>
              {headers.map((h, i) => (
                <th key={i} className="p-3 border-b border-slate-200 border-r border-slate-100 font-bold text-slate-600 min-w-[100px] whitespace-nowrap text-xs uppercase tracking-wider bg-slate-50">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.length > 0 ? (
                currentRows.map((row, i) => (
                <tr key={i} className="hover:bg-indigo-50/50 group transition-colors even:bg-slate-50/30">
                    <td className="p-2 border-b border-slate-100 border-r border-slate-100 text-center text-slate-400 font-mono text-xs group-hover:text-slate-600">
                    {startIndex + i + 1}
                    </td>
                    {row.map((cell, j) => (
                    <td key={j} className="p-2 border-b border-slate-100 border-r border-slate-100 text-slate-600 truncate max-w-[300px] font-mono text-xs group-hover:text-slate-900 selection:bg-indigo-100" title={String(cell)}>
                        {String(cell)}
                    </td>
                    ))}
                </tr>
                ))
            ) : (
                <tr>
                    <td colSpan={headers.length + 1} className="p-8 text-center text-slate-400 italic">
                        {language === 'zh' ? '无匹配数据' : 'No matching records'}
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
            <span>
                {language === 'zh' 
                 ? `显示 ${startIndex + 1}-${Math.min(startIndex + rowsPerPage, filteredRows.length)} 共 ${filteredRows.length}` 
                 : `Showing ${startIndex + 1}-${Math.min(startIndex + rowsPerPage, filteredRows.length)} of ${filteredRows.length}`}
            </span>
            <div className="flex items-center gap-1">
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={14} />
                </button>
                <span className="font-mono px-2">{currentPage} / {totalPages}</span>
                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
      )}
    </div>
  );
}
