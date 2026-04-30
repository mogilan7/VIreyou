import React from 'react';

export default function Loading() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F5F0] dark:bg-[#0F172A]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-[#60B76F]/20 border-t-[#60B76F] rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-slate-400 animate-pulse">Загрузка данных...</p>
            </div>
        </div>
    );
}
