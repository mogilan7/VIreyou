"use client";
import { LayoutDashboard, Users, Calendar, Activity, Settings, FileText, CheckSquare, MessageSquare, LogOut, Sun, Moon, Menu, X, Heart } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Link as IntlLink, usePathname } from "@/i18n/routing";
import { useDashboardTheme } from "./ThemeContext";
import { logout } from "@/app/[locale]/login/actions/auth";
import { getSidebarProfile } from "@/actions/profile";

import Image from "next/image";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import BottomNav from "./BottomNav";

export default function Sidebar({ role, profileName }: { role: "client" | "specialist", profileName?: string }) {
    const pathname = usePathname();
    const locale = useLocale();
    const t = useTranslations('Dashboard.Sidebar');
    const { theme, toggleTheme } = useDashboardTheme();
    const [isOpen, setIsOpen] = useState(false);

    const toggleLocale = locale === 'en' ? 'ru' : 'en';

    const [user, setUser] = useState<any>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('sidebar_avatar_url');
        }
        return null;
    });
    const [fetchedName, setFetchedName] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('sidebar_fetched_name');
        }
        return null;
    });


    // Close sidebar on navigation (mobile)
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            setUser(currentUser);
            
            if (currentUser) {
                const profile = await getSidebarProfile();
                if (profile?.avatar_url) {
                    setAvatarUrl(profile.avatar_url);
                    localStorage.setItem('sidebar_avatar_url', profile.avatar_url);
                }
                if (profile?.full_name) {
                    setFetchedName(profile.full_name);
                    localStorage.setItem('sidebar_fetched_name', profile.full_name);
                }
            }

        };
        fetchUser();
    }, []);




    const handleLogout = async () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('sidebar_avatar_url');
            localStorage.removeItem('sidebar_fetched_name');
        }
        await logout(locale);
    };

    const clientLinks = [
        { name: t('cDash'), href: "/cabinet", icon: <LayoutDashboard size={18} /> },
        { name: t('cRes'), href: "/cabinet/results", icon: <Activity size={18} /> },
        { name: t('cArch'), href: "/cabinet/archive", icon: <FileText size={18} /> },
        { name: t('cAssgn'), href: "/cabinet/lifestyle", icon: <Heart size={18} /> },
        { name: t('cCons'), href: "/cabinet/consultations", icon: <MessageSquare size={18} /> },
        { name: t('cSquads'), href: "/cabinet/squads", icon: <Users size={18} /> },
        { name: t('cProf'), href: "/cabinet/profile", icon: <Settings size={18} /> },
    ];

    const specialistLinks = [
        { name: t('sDash'), href: "/specialist", icon: <LayoutDashboard size={18} /> },
        { name: t('sClient'), href: "/specialist/clients", icon: <Users size={18} /> },
        { name: t('sSched'), href: "/specialist/schedule", icon: <Calendar size={18} /> },
        { name: t('sAnalyt'), href: "/specialist/analytics", icon: <Activity size={18} /> },
        { name: t('sSet'), href: "/specialist/settings", icon: <Settings size={18} /> },
    ];

    let links = role === "specialist" ? [...specialistLinks] : [...clientLinks];

    if (user?.email?.toLowerCase() === 'mogilev.andrey@gmail.com' && role === 'client') {
        links.splice(1, 0, { name: 'Панель Специалиста', href: "/specialist", icon: <LayoutDashboard size={18} /> });
    }



    return (
        <>
            {/* Mobile Header Menu Button - Floating (HIDDEN FOR NOW) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`hidden fixed top-6 right-6 z-50 p-3 rounded-full shadow-lg border transition-all active:scale-95 ${theme === 'dark' ? 'bg-slate-800 border-white/5 text-teal-400' : 'bg-white border-brand-sage/30 text-brand-leaf'}`}
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Backdrop for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] lg:hidden transition-opacity duration-300"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <aside className={`fixed left-0 top-0 h-screen w-72 lg:w-64 border-r flex flex-col py-8 z-50 transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${theme === 'dark' ? 'bg-slate-900 border-white/5 shadow-2xl lg:shadow-none' : 'bg-brand-bg border-brand-sage/30 shadow-xl lg:shadow-none'}`}>

                {/* Brand */}
                <div className="px-6 flex items-center justify-between mb-8">
                    <IntlLink href="/">
                        <Image
                            src="/logo.png"
                            alt="VIReYou Logo"
                            width={120}
                            height={80}
                            className={`h-20 w-auto object-contain ${theme === 'dark' ? 'brightness-0 invert' : ''}`}
                        />
                    </IntlLink>
                    <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 opacity-50 hover:opacity-100 transition-opacity">
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-grow overflow-y-auto custom-scrollbar">
                    <ul className="space-y-1.5 px-4">
                        {links.map((link) => {
                            const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== "/cabinet" && link.href !== "/specialist");
                            return (
                                <li key={link.name}>
                                    <IntlLink
                                        href={link.href as any}
                                        className={`flex items-center gap-4 py-3.5 px-5 rounded-2xl transition-all ${isActive
                                            ? (theme === 'dark' ? "bg-teal-500/10 text-teal-400 font-bold" : "bg-brand-leaf/10 text-brand-leaf font-bold shadow-sm")
                                            : (theme === 'dark' ? "text-slate-400 hover:bg-slate-800/80" : "text-brand-gray hover:bg-brand-sage/20 hover:text-brand-text")
                                            }`}
                                    >
                                        <div className={`${isActive ? (theme === 'dark' ? "text-teal-400" : "text-brand-leaf") : (theme === 'dark' ? "text-slate-500" : "text-brand-gray/60")}`}>
                                            {link.icon}
                                        </div>
                                        <span className="text-sm tracking-tight">{link.name}</span>
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
                            href={pathname as any}
                            locale={toggleLocale}
                            className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all hover:scale-105 ${theme === 'dark' ? 'bg-slate-800 text-teal-400 border border-white/5' : 'bg-brand-sage/20 text-brand-leaf'}`}
                        >
                            {locale === 'en' ? 'RU' : 'EN'}
                        </IntlLink>
                    </div>

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 mb-4 rounded-2xl text-sm font-medium transition-all ${theme === 'dark' ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-brand-sage/10 text-brand-gray hover:bg-brand-sage/20 hover:text-brand-text'}`}
                    >
                        <div className="flex items-center gap-3">
                            {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
                            <span>{theme === 'dark' ? t('lightTheme') : t('darkTheme')}</span>
                        </div>
                    </button>

                    {role === "client" ? (
                        <div className="flex items-center gap-3 py-4 border-t dark:border-white/5 border-brand-sage/20">
                            <div className={`w-11 h-11 rounded-full flex-shrink-0 overflow-hidden relative border-2 border-brand-leaf/20 shadow-md ${avatarUrl ? 'bg-transparent' : 'bg-slate-800'}`}>
                                <img src={avatarUrl || "/andrei-avatar.png"} alt={profileName || "User"} width={44} height={44} className="object-cover w-full h-full rounded-full" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold dark:text-slate-50 text-brand-text leading-tight truncate">{fetchedName || profileName || t('userFallback')}</p>


                                <p className="text-[10px] text-brand-gray tracking-widest uppercase mt-1 opacity-60 font-medium">{t('cPlan')}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 py-4 border-t dark:border-white/5 border-brand-sage/20">
                            <div className={`w-11 h-11 rounded-full flex-shrink-0 overflow-hidden relative border-2 border-teal-500/20 shadow-md ${avatarUrl ? 'bg-transparent' : 'bg-brand-sage/50'}`}>
                                <img src={avatarUrl || "/hero-specialist.png"} alt="Dr. Valentina" width={44} height={44} className="object-cover w-full h-full rounded-full" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold dark:text-slate-50 text-brand-text leading-tight truncate">{fetchedName || profileName || t('specFallback')}</p>


                                <p className="text-[10px] text-brand-gray tracking-widest uppercase mt-1 opacity-60 font-medium">{t('sRole')}</p>
                            </div>
                        </div>
                    )}



                    <button
                        onClick={handleLogout}
                        className={`w-full mt-4 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl border transition-all text-sm font-semibold active:scale-95 ${theme === 'dark' ? 'border-white/5 text-slate-400 hover:bg-white/5' : 'border-brand-sage/30 text-brand-gray/80 hover:bg-brand-sage/20 hover:text-brand-text'}`}
                    >
                        <LogOut size={16} className="opacity-60" /> Logout
                    </button>

                </div>
            </aside>
            {role === "client" && <BottomNav />}
        </>
    );
}
