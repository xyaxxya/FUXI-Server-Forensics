import { useMemo, useState } from 'react';
import { Download, ChevronLeft, ChevronRight, Search, WrapText } from 'lucide-react';
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
  const [wrapMode, setWrapMode] = useState(false);
  const rowsPerPage = 10;

  // Filter rows
  const filteredRows = rows.filter(row =>
    row.some(cell => String(cell).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);
  const matchedRows = useMemo(() => filteredRows.length, [filteredRows.length]);

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
    <div className="ui-shell my-2 flex w-full max-w-full flex-col overflow-hidden rounded-[1.4rem]">
      <div className="flex flex-col gap-3 border-b border-slate-200/70 p-3 md:flex-row md:items-center md:justify-between">
        <div className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            {title || (language === 'zh' ? '查询结果' : 'Query Result')}
            <span className="ui-chip text-xs font-normal text-slate-500 px-2 py-0.5 rounded-full">
                {rows.length} {language === 'zh' ? '行' : 'rows'}
            </span>
            {searchTerm && (
              <span className="ui-chip-active text-xs font-normal px-2 py-0.5 rounded-full">
                {language === 'zh' ? `命中 ${matchedRows}` : `${matchedRows} matched`}
              </span>
            )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder={language === 'zh' ? "搜索..." : "Search..."}
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="ui-input-base w-32 rounded-xl py-2 pl-8 pr-2 text-xs md:w-48"
            />
          </div>
          <button
            onClick={() => setWrapMode(v => !v)}
            className={`ui-pressable flex items-center gap-1 px-2.5 py-2 text-xs rounded-xl transition-colors ${
              wrapMode
                ? "ui-chip-active"
                : "ui-button text-slate-600"
            }`}
          >
            <WrapText size={12} />
            {language === 'zh' ? '自动换行' : 'Wrap'}
          </button>
          <button 
            onClick={handleExportCSV}
            className="ui-button-primary ui-pressable flex items-center gap-1 px-3 py-2 text-white text-xs rounded-xl font-medium whitespace-nowrap"
          >
            <Download size={12} />
            {language === 'zh' ? '导出 CSV' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="overflow-auto custom-scrollbar w-full max-h-[520px]">
        <table className="w-full text-left border-collapse text-xs md:text-sm">
          <thead className="bg-slate-50/95 sticky top-0 z-10 shadow-sm backdrop-blur-sm">
            <tr>
              <th className="p-3 border-b border-slate-200 border-r border-slate-100 w-12 text-center text-slate-400 font-mono text-xs bg-slate-50/95">#</th>
              {headers.map((h, i) => (
                <th key={i} className="p-3 border-b border-slate-200 border-r border-slate-100 font-bold text-slate-600 min-w-[100px] whitespace-nowrap text-xs uppercase tracking-wider bg-slate-50/95">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.length > 0 ? (
                currentRows.map((row, i) => (
                <tr key={i} className="group transition-colors even:bg-slate-50/20 hover:bg-blue-50/55">
                    <td className="p-2 border-b border-slate-100 border-r border-slate-100 text-center text-slate-400 font-mono text-xs group-hover:text-slate-600">
                    {startIndex + i + 1}
                    </td>
                    {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`p-2 border-b border-slate-100 border-r border-slate-100 text-slate-600 max-w-[420px] font-mono text-xs group-hover:text-slate-900 selection:bg-indigo-100 align-top ${
                        wrapMode ? "whitespace-pre-wrap break-all" : "truncate whitespace-nowrap"
                      }`}
                      title={String(cell)}
                    >
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between p-2 border-t border-slate-200/70 bg-slate-50/75 text-xs text-slate-500">
            <span>
                {language === 'zh' 
                 ? `显示 ${startIndex + 1}-${Math.min(startIndex + rowsPerPage, filteredRows.length)} 共 ${filteredRows.length}` 
                 : `Showing ${startIndex + 1}-${Math.min(startIndex + rowsPerPage, filteredRows.length)} of ${filteredRows.length}`}
            </span>
            <div className="flex items-center gap-1">
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="ui-button ui-pressable rounded-lg p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={14} />
                </button>
                <span className="font-mono px-2">{currentPage} / {totalPages}</span>
                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="ui-button ui-pressable rounded-lg p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
      )}
    </div>
  );
}
