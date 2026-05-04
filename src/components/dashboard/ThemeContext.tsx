"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function DashboardThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>('light');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Referral tracking logic: capture 'ref' from URL anywhere in the dashboard
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        if (ref) {
            console.log(`[AUTH] Referral code detected in URL: ${ref}`);
            document.cookie = `referral_code=${ref}; path=/; max-age=${30 * 24 * 60 * 60}`;
        }

        const savedTheme = localStorage.getItem('dashboard-theme') as Theme;
        if (savedTheme) {
            setTheme(savedTheme);
            // Apply immediately to prevent flicker if possible
            if (savedTheme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        } else {
            // Default to light
            document.documentElement.classList.remove('dark');
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
            <div className={`${theme} w-full`}>
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
        <div className={`w-full ${theme === 'dark' ? 'bg-slate-900 text-slate-50 transition-colors duration-300' : 'bg-brand-bg text-brand-text transition-colors duration-300'}`}>
            {children}
        </div>
    );
}
