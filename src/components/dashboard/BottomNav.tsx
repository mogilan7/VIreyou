"use client";
import { Link as IntlLink, usePathname } from "@/i18n/routing";
import { Heart, Wallet, Users } from "lucide-react";
import { useDashboardTheme } from "./ThemeContext";
import { useTranslations } from "next-intl";

export default function BottomNav() {
    const pathname = usePathname();
    const { theme } = useDashboardTheme();
    // In a real app we might want to localize these strings
    const t = useTranslations('Dashboard.Sidebar');

    const links = [
        { name: "Дневник", href: "/cabinet/lifestyle", icon: <Heart size={20} /> },
        { name: "Кошелек", href: "/cabinet/wallet", icon: <Wallet size={20} /> },
        { name: "Марафоны", href: "/cabinet/squads", icon: <Users size={20} /> },
    ];

    return (
        <nav className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around py-3 px-2 border-t backdrop-blur-md pb-safe transition-colors ${
            theme === 'dark' 
            ? 'bg-slate-900/90 border-white/10 text-slate-400' 
            : 'bg-white/90 border-slate-200 text-slate-500'
        }`}>
            {links.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                return (
                    <IntlLink
                        key={link.name}
                        href={link.href as any}
                        className={`flex flex-col items-center gap-1 min-w-[64px] transition-colors ${
                            isActive 
                            ? (theme === 'dark' ? 'text-teal-400' : 'text-[#60B76F]') 
                            : 'hover:opacity-70'
                        }`}
                    >
                        <div className={`p-1.5 rounded-full ${isActive ? (theme === 'dark' ? 'bg-teal-400/10' : 'bg-[#60B76F]/10') : ''}`}>
                            {link.icon}
                        </div>
                        <span className="text-[10px] font-medium tracking-tight">
                            {link.name}
                        </span>
                    </IntlLink>
                );
            })}
        </nav>
    );
}
