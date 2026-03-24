"use client";

import React from 'react';

export default function ReportViewer({ markdown }: { markdown: string }) {
    if (!markdown) return <div className="text-gray-400">Нет данных для отчета.</div>;

    const lines = markdown.split('\n');
    const rendered: React.ReactNode[] = [];
    let tableRows: string[][] = [];
    let isInsideTable = false;

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        // Handle Tables
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            isInsideTable = true;
            if (!trimmed.includes('---')) { // Skip header divider line
                 const row = trimmed.split('|')
                     .filter((_, i, arr) => i > 0 && i < arr.length - 1)
                     .map(v => v.trim());
                 tableRows.push(row);
            }
            return;
        } else if (isInsideTable) {
            // End of Table, Render it
            const [headers, ...rows] = tableRows;
            rendered.push(
                <div key={`table-${index}`} className="overflow-x-auto my-4">
                    <table className="w-full text-left border-collapse border border-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                {headers?.map((h, i) => <th key={i} className="p-2 border border-slate-200 font-bold">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, ri) => (
                                <tr key={ri} className="hover:bg-slate-50">
                                    {row.map((cell, ci) => <td key={ci} className="p-2 border border-slate-200">{cell}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            tableRows = [];
            isInsideTable = false;
        }

        // Handle Headers
        if (trimmed.startsWith('# ')) {
            rendered.push(<h1 key={index} className="text-2xl font-bold font-serif mb-4 text-brand-text">{trimmed.replace('# ', '')}</h1>);
        } else if (trimmed.startsWith('## ')) {
            rendered.push(<h2 key={index} className="text-xl font-bold font-serif mt-6 mb-3 text-brand-text border-b pb-2">{trimmed.replace('## ', '')}</h2>);
        } else if (trimmed.startsWith('### ')) {
            rendered.push(<h3 key={index} className="text-lg font-bold font-serif mt-4 mb-2">{trimmed.replace('### ', '')}</h3>);
        } else if (trimmed.startsWith('• ')) {
            rendered.push(<li key={index} className="ml-4 text-sm text-gray-700 list-disc">{trimmed.replace('• ', '')}</li>);
        } else if (trimmed.startsWith('*') && trimmed.endsWith('*')) {
            rendered.push(<p key={index} className="text-sm font-semibold text-gray-800">{trimmed.replace(/\*/g, '')}</p>);
        } else if (trimmed) {
            rendered.push(<p key={index} className="text-sm text-gray-600 mb-1">{trimmed}</p>);
        } else {
             rendered.push(<br key={index} />);
        }
    });

    // Cleanup hanging table if file ends inside table
    if (isInsideTable && tableRows.length > 0) {
         const [headers, ...rows] = tableRows;
         rendered.push(
             <div key="table-end" className="overflow-x-auto my-4">
                 <table className="w-full text-left border-collapse border border-slate-200 text-sm">
                     <thead className="bg-slate-50">
                         <tr>
                             {headers?.map((h, i) => <th key={i} className="p-2 border border-slate-200 font-bold">{h}</th>)}
                         </tr>
                     </thead>
                     <tbody>
                         {rows.map((row, ri) => (
                             <tr key={ri} className="hover:bg-slate-50">
                                 {row.map((cell, ci) => <td key={ci} className="p-2 border border-slate-200">{cell}</td>)}
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
         );
    }

    return <div className="space-y-1">{rendered}</div>;
}
