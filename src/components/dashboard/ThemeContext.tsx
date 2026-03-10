"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function DashboardThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>('dark');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem('dashboard-theme') as Theme;
        if (savedTheme) {
            setTheme(savedTheme);
        }
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            localStorage.setItem('dashboard-theme', theme);
            // Also apply to document element for global Tailwind support
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    }, [theme, mounted]);

    const toggleTheme = () => {
        setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            <div className={theme}>
                {children}
            </div>
        </ThemeContext.Provider>
    );
}

export const useDashboardTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useDashboardTheme must be used within a DashboardThemeProvider');
    }
    return context;
};

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
    const { theme } = useDashboardTheme();
    return (
        <div className={theme === 'dark' ? 'bg-slate-900 text-slate-50 transition-colors duration-300' : 'bg-brand-bg text-brand-text transition-colors duration-300'}>
            {children}
        </div>
    );
}
