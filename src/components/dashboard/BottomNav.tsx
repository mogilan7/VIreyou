"use client";
import { useState, useEffect } from "react";
import { Link as IntlLink, usePathname } from "@/i18n/routing";
import { Heart, Wallet, Users } from "lucide-react";
import { useDashboardTheme } from "./ThemeContext";
import { useTranslations } from "next-intl";

export default function BottomNav() {
    const pathname = usePathname();
    const { theme } = useDashboardTheme();
    const [pendingHref, setPendingHref] = useState<string | null>(null);
    const t = useTranslations('Dashboard.Sidebar');

    // Reset pendingHref when pathname changes
    useEffect(() => {
        setPendingHref(null);
    }, [pathname]);

    const links = [
        { name: t('cAssgn'), href: "/cabinet/lifestyle", icon: <Heart size={20} /> },
        { name: t('cWallet'), href: "/cabinet/wallet", icon: <Wallet size={20} /> },
        { name: t('cSquads'), href: "/cabinet/squads", icon: <Users size={20} /> },
    ];

    return (
        <nav className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around py-3 px-2 border-t backdrop-blur-md pb-safe transition-colors ${
            theme === 'dark' 
            ? 'bg-slate-900/90 border-white/10 text-slate-400' 
            : 'bg-white/90 border-slate-200 text-slate-500'
        }`}>
            {links.map((link) => {
                const isActive = (pendingHref ? pendingHref === link.href : (pathname === link.href || pathname.startsWith(link.href + '/')));
                return (
                    <IntlLink
                        key={link.name}
                        href={link.href as any}
                        onClick={() => setPendingHref(link.href)}
                        className={`flex flex-col items-center gap-1 min-w-[64px] transition-all active:scale-90 ${
                            isActive 
                            ? (theme === 'dark' ? 'text-teal-400' : 'text-[#60B76F]') 
                            : 'hover:opacity-70'
                        }`}
                    >
                        <div className={`p-1.5 rounded-full transition-all duration-300 ${isActive ? (theme === 'dark' ? 'bg-teal-400/10 scale-110' : 'bg-[#60B76F]/10 scale-110') : ''}`}>
                            {link.icon}
                        </div>
                        <span className={`text-[10px] font-medium tracking-tight transition-all ${isActive ? 'opacity-100 font-bold' : 'opacity-70'}`}>
                            {link.name}
                        </span>
                    </IntlLink>
                );
            })}
        </nav>
    );
}
