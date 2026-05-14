import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search, WrapText } from "lucide-react";
import { Language } from "../translations";

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

  const filteredRows = useMemo(
    () => rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(searchTerm.toLowerCase()))),
    [rows, searchTerm],
  );
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);

  const handleExportCSV = () => {
    const csvContent = `\uFEFF${[
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n")}`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `export_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ui-shell my-2 flex w-full max-w-full flex-col overflow-hidden rounded-[1.4rem]">
      <div className="flex flex-col gap-3 border-b border-slate-200/70 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          {title || (language === "zh" ? "查询结果" : "Query Result")}
          <span className="ui-chip rounded-full px-2 py-0.5 text-xs font-normal text-slate-500">
            {rows.length} {language === "zh" ? "行" : "rows"}
          </span>
          {searchTerm && (
            <span className="ui-chip-active rounded-full px-2 py-0.5 text-xs font-normal">
              {language === "zh" ? `命中 ${filteredRows.length}` : `${filteredRows.length} matched`}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={language === "zh" ? "搜索..." : "Search..."}
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setCurrentPage(1);
              }}
              className="ui-input-base w-32 rounded-xl py-2 pl-8 pr-2 text-xs md:w-48"
            />
          </div>
          <button
            type="button"
            onClick={() => setWrapMode((value) => !value)}
            className={`ui-pressable flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs transition-colors ${
              wrapMode ? "ui-chip-active" : "ui-button text-slate-600"
            }`}
          >
            <WrapText size={12} />
            {language === "zh" ? "自动换行" : "Wrap"}
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="ui-button-primary ui-pressable flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium text-white"
          >
            <Download size={12} />
            {language === "zh" ? "导出 CSV" : "Export CSV"}
          </button>
        </div>
      </div>

      <div className="custom-scrollbar max-h-[520px] w-full overflow-auto">
        <table className="w-full border-collapse text-left text-xs md:text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 shadow-sm backdrop-blur-sm">
            <tr>
              <th className="w-12 border-b border-r border-slate-200 bg-slate-50/95 p-3 text-center font-mono text-xs text-slate-400">#</th>
              {headers.map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  className="min-w-[100px] whitespace-nowrap border-b border-r border-slate-100 bg-slate-50/95 p-3 text-xs font-bold uppercase text-slate-600"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.length > 0 ? (
              currentRows.map((row, rowIndex) => (
                <tr key={`${startIndex}-${rowIndex}`} className="group transition-colors even:bg-slate-50/20 hover:bg-blue-50/55">
                  <td className="border-b border-r border-slate-100 p-2 text-center font-mono text-xs text-slate-400 group-hover:text-slate-600">
                    {startIndex + rowIndex + 1}
                  </td>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`max-w-[420px] border-b border-r border-slate-100 p-2 align-top font-mono text-xs text-slate-600 selection:bg-indigo-100 group-hover:text-slate-900 ${
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
                <td colSpan={headers.length + 1} className="p-8 text-center italic text-slate-400">
                  {language === "zh" ? "无匹配数据" : "No matching records"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200/70 bg-slate-50/75 p-2 text-xs text-slate-500">
          <span>
            {language === "zh"
              ? `显示 ${startIndex + 1}-${Math.min(startIndex + rowsPerPage, filteredRows.length)} / ${filteredRows.length}`
              : `Showing ${startIndex + 1}-${Math.min(startIndex + rowsPerPage, filteredRows.length)} of ${filteredRows.length}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="ui-button ui-pressable rounded-lg p-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-mono">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="ui-button ui-pressable rounded-lg p-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
