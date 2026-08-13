import { DashboardThemeProvider, ThemeWrapper } from '@/components/dashboard/ThemeContext';
import React from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardThemeProvider>
            <ThemeWrapper>
                <div className="min-h-screen font-sans w-full">
                    <div className="flex w-full">
                        {children}
                    </div>
                </div>
            </ThemeWrapper>
        </DashboardThemeProvider>
    );
}
