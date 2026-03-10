"use client";
import { LayoutDashboard, Users, Calendar, Activity, Settings, FileText, CheckSquare, MessageSquare, LogOut, Sun, Moon } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Link as IntlLink, usePathname } from "@/i18n/routing";
import { useDashboardTheme } from "./ThemeContext";
import { logout } from "@/app/[locale]/login/actions/auth";
import Image from "next/image";

export default function Sidebar({ role, profileName }: { role: "client" | "specialist", profileName?: string }) {
    const pathname = usePathname();
    const locale = useLocale();
    const t = useTranslations('Dashboard.Sidebar');
    const { theme, toggleTheme } = useDashboardTheme();

    const toggleLocale = locale === 'en' ? 'ru' : 'en';

    const handleLogout = async () => {
        await logout(locale);
    };

    const clientLinks = [
        { name: t('cDash'), href: "/cabinet", icon: <LayoutDashboard size={18} /> },
        { name: t('cRes'), href: "/cabinet/results", icon: <Activity size={18} /> },
        { name: t('cArch'), href: "/cabinet/archive", icon: <FileText size={18} /> },
        { name: t('cAssgn'), href: "/cabinet/assignments", icon: <CheckSquare size={18} /> },
        { name: t('cCons'), href: "/cabinet/consultations", icon: <MessageSquare size={18} /> },
        { name: t('cProf'), href: "/cabinet/profile", icon: <Settings size={18} /> },
    ];

    const specialistLinks = [
        { name: t('sDash'), href: "/specialist", icon: <LayoutDashboard size={18} /> },
        { name: t('sClient'), href: "/specialist/clients", icon: <Users size={18} /> },
        { name: t('sSched'), href: "/specialist/schedule", icon: <Calendar size={18} /> },
        { name: t('sAnalyt'), href: "/specialist/analytics", icon: <Activity size={18} /> },
        { name: t('sSet'), href: "/specialist/settings", icon: <Settings size={18} /> },
    ];

    const links = role === "specialist" ? specialistLinks : clientLinks;

    return (
        <aside className={`fixed left-0 top-24 lg:top-0 h-[calc(100vh-6rem)] lg:h-screen w-64 border-r flex flex-col py-8 z-40 transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-brand-bg border-brand-sage/30'}`}>

            {/* Brand */}
            <div className="px-6 flex items-center mb-8">
                <IntlLink href="/">
                    <Image
                        src="/logo.png"
                        alt="VIReYou Logo"
                        width={120}
                        height={80}
                        className={`h-20 w-auto object-contain ${theme === 'dark' ? 'brightness-0 invert' : ''}`}
                    />
                </IntlLink>
            </div>

            {/* Navigation */}
            <nav className="flex-grow">
                <ul className="space-y-2 px-4">
                    {links.map((link) => {
                        const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== "/cabinet" && link.href !== "/specialist");
                        return (
                            <li key={link.name}>
                                <IntlLink
                                    href={link.href as "/cabinet" | "/cabinet/results" | "/cabinet/archive" | "/cabinet/assignments" | "/cabinet/consultations" | "/cabinet/profile" | "/specialist" | "/specialist/clients" | "/specialist/schedule" | "/specialist/analytics" | "/specialist/settings"}
                                    className={`flex items-center gap-4 py-3 px-4 rounded-xl transition-all ${isActive
                                        ? (theme === 'dark' ? "bg-teal-500/10 text-teal-400 font-semibold" : "bg-brand-leaf/10 text-brand-leaf font-semibold")
                                        : (theme === 'dark' ? "text-slate-400 hover:bg-slate-800/50" : "text-brand-gray hover:bg-brand-sage/20 hover:text-brand-text")
                                        }`}
                                >
                                    <div className={`${isActive ? (theme === 'dark' ? "text-teal-400" : "text-brand-leaf") : (theme === 'dark' ? "text-slate-500" : "text-brand-gray/60")}`}>
                                        {link.icon}
                                    </div>
                                    <span className="text-sm">{link.name}</span>
                                </IntlLink>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* User Profile & Actions */}
            <div className="px-6 mt-auto">
                <div className="flex items-center justify-between mb-4 px-2">
                    <span className="text-[10px] text-brand-gray tracking-widest uppercase font-bold opacity-50">Language</span>
                    <IntlLink
                        href={pathname as "/cabinet"}
                        locale={toggleLocale}
                        className={`text-[10px] font-bold px-2 py-1 rounded transition-opacity hover:opacity-80 ${theme === 'dark' ? 'bg-slate-800 text-teal-400' : 'bg-brand-sage/20 text-brand-leaf'}`}
                    >
                        {locale === 'en' ? 'RU' : 'EN'}
                    </IntlLink>
                </div>

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 mb-2 rounded-xl text-sm font-medium transition-all ${theme === 'dark' ? 'text-slate-400 hover:bg-slate-800/50' : 'text-brand-gray hover:bg-brand-sage/20 hover:text-brand-text'}`}
                >
                    <div className="flex items-center gap-3">
                        {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
                        <span>{theme === 'dark' ? 'Светлая тема' : 'Темная тема'}</span>
                    </div>
                </button>

                {role === "client" ? (
                    <div className="flex items-center gap-3 py-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex-shrink-0 overflow-hidden relative border border-brand-sage/20">
                            <Image src="/andrei-avatar.png" alt={profileName || "User"} width={40} height={40} className="object-cover w-full h-full" />
                        </div>
                        <div>
                            <p className="text-sm font-bold dark:text-slate-50 text-brand-text leading-tight">{profileName || "Пользователь"}</p>
                            <p className="text-[10px] text-brand-gray tracking-widest uppercase mt-0.5">{t('cPlan')}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 py-3">
                        <div className="w-10 h-10 rounded-full bg-brand-sage/50 flex-shrink-0 overflow-hidden relative border border-brand-sage/20">
                            <Image src="/hero-specialist.png" alt="Dr. Valentina" width={40} height={40} className="object-cover w-full h-full object-[center_top]" />
                        </div>
                        <div>
                            <p className="text-sm font-bold dark:text-slate-50 text-brand-text leading-tight">Valentina S.</p>
                            <p className="text-[10px] text-brand-gray tracking-widest uppercase mt-0.5">{t('sRole')}</p>
                        </div>
                    </div>
                )}
                <button
                    onClick={handleLogout}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-red-100 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 transition-colors text-sm font-semibold"
                >
                    <LogOut size={16} /> Logout
                </button>
            </div>
        </aside>
    );
}
