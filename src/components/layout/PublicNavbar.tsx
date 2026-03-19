"use client";
import { Link, usePathname } from "@/i18n/routing";
import { User, Menu, X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect } from "react";

interface NavLinksProps {
    mobile?: boolean;
    isCabinet: boolean;
    isSpecialist: boolean;
    t: (key: string) => string;
    tDashboard: (key: string) => string;
    setIsMenuOpen: (open: boolean) => void;
}

const NavLinks = ({ mobile = false, isCabinet, isSpecialist, t, tDashboard, setIsMenuOpen }: NavLinksProps) => {
    if (isCabinet || isSpecialist) {
        const clientLinks = [
            { name: tDashboard('cDash'), href: "/cabinet" },
            { name: tDashboard('cRes'), href: "/cabinet/results" },
            { name: tDashboard('cArch'), href: "/cabinet/archive" },
            { name: tDashboard('cAssgn'), href: "/cabinet/lifestyle" },
            { name: tDashboard('cCons'), href: "/cabinet/consultations" },
            { name: tDashboard('cProf'), href: "/cabinet/profile" },
        ];

        const specialistLinks = [
            { name: tDashboard('sDash'), href: "/specialist" },
            { name: tDashboard('sClient'), href: "/specialist/clients" },
            { name: tDashboard('sSched'), href: "/specialist/schedule" },
            { name: tDashboard('sAnalyt'), href: "/specialist/analytics" },
            { name: tDashboard('sSet'), href: "/specialist/settings" },
        ];

        const links = isSpecialist ? specialistLinks : clientLinks;

        return (
            <>
                {links.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href as "/cabinet" | "/specialist"}
                        onClick={() => setIsMenuOpen(false)}
                        className={`hover:text-brand-forest transition-colors ${mobile ? 'text-xl font-serif py-4 border-b border-brand-sage/20 w-full text-center text-brand-text' : ''}`}
                    >
                        {link.name}
                    </Link>
                ))}
                <Link
                    href="/"
                    onClick={() => setIsMenuOpen(false)}
                    className={`hover:text-brand-forest transition-colors font-bold ${mobile ? 'text-xl font-serif py-4 border-b border-brand-sage/20 w-full text-center text-brand-leaf' : 'text-brand-leaf'}`}
                >
                    {t('home')}
                </Link>
            </>
        );
    }

    return (
        <>
            <Link
                href="/#philosophy"
                onClick={() => setIsMenuOpen(false)}
                className={`hover:text-brand-forest transition-colors ${mobile ? 'text-2xl font-serif py-4 border-b border-brand-sage/20 w-full text-center text-brand-text' : ''}`}
            >
                {t('philosophy')}
            </Link>
            <Link
                href="/diagnostics"
                onClick={() => setIsMenuOpen(false)}
                className={`hover:text-brand-forest transition-colors ${mobile ? 'text-2xl font-serif py-4 border-b border-brand-sage/20 w-full text-center text-brand-text' : ''}`}
            >
                {t('diagnostics')}
            </Link>
            <Link
                href="/pricing"
                onClick={() => setIsMenuOpen(false)}
                className={`hover:text-brand-forest transition-colors ${mobile ? 'text-2xl font-serif py-4 border-b border-brand-sage/20 w-full text-center text-brand-text' : ''}`}
            >
                {t('pricing')}
            </Link>
        </>
    );
};

interface LangSwitcherProps {
    mobile?: boolean;
    pathname: string;
    toggleLocale: string;
    locale: string;
    setIsMenuOpen: (open: boolean) => void;
}

const LangSwitcher = ({ mobile = false, pathname, toggleLocale, locale, setIsMenuOpen }: LangSwitcherProps) => (
    <Link
        href={pathname}
        locale={toggleLocale}
        onClick={() => setIsMenuOpen(false)}
        className={`text-brand-gray/60 hover:text-brand-forest font-bold ${mobile ? 'text-xl py-6 border-b border-brand-sage/20 w-full text-center text-brand-text' : 'text-[10px] tracking-widest'}`}
    >
        {locale === 'en' ? 'RU' : 'EN'}
    </Link>
);

export default function PublicNavbar() {
    const t = useTranslations('Nav');
    const locale = useLocale();
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleLocale = locale === 'en' ? 'ru' : 'en';

    // Prevent scrolling when menu is open
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isMenuOpen]);

    const isCabinet = pathname.includes('/cabinet');
    const isSpecialist = pathname.includes('/specialist');
    const tDashboard = useTranslations('Dashboard.Sidebar');

    return (
        <>
            <nav className={`fixed top-0 w-full z-50 py-2 px-6 md:px-12 flex items-center justify-between bg-brand-bg/60 backdrop-blur-[10px] border-b border-brand-sage/20 transition-all duration-300 ${(isCabinet || isSpecialist) ? 'lg:hidden' : ''}`}>
                {/* Brand Logo */}
                <div className="flex items-center">
                    <Link href="/" onClick={() => setIsMenuOpen(false)}>
                        <div className="relative h-20 w-40">
                            <img
                                src="/logo.png"
                                alt="VIReYou Logo"
                                className="h-full w-full object-contain mix-blend-multiply brightness-[1.05] contrast-[1.05]"
                            />
                        </div>
                    </Link>
                </div>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-8 text-xs tracking-widest font-semibold text-brand-gray-dark uppercase">
                    {!(isCabinet || isSpecialist) && (
                        <NavLinks
                            isCabinet={isCabinet}
                            isSpecialist={isSpecialist}
                            t={t}
                            tDashboard={tDashboard}
                            setIsMenuOpen={setIsMenuOpen}
                        />
                    )}
                    {!(isCabinet || isSpecialist) && (
                        <Link
                            href="/pricing"
                            className="bg-brand-leaf hover:bg-brand-leaf-light text-white px-6 py-2.5 rounded-full transition-colors flex items-center ml-2"
                        >
                            {t('consultation')}
                        </Link>
                    )}
                    <div className="flex items-center gap-4">
                        <LangSwitcher
                            pathname={pathname}
                            toggleLocale={toggleLocale}
                            locale={locale}
                            setIsMenuOpen={setIsMenuOpen}
                        />
                        <Link href={isSpecialist ? "/specialist" : "/cabinet"} className="text-brand-gray-dark hover:text-brand-forest">
                            <User size={18} />
                        </Link>
                    </div>
                </div>

                {/* Mobile Actions */}
                <div className="md:hidden flex items-center gap-4">
                    {!(isCabinet || isSpecialist) && (
                        <LangSwitcher
                            pathname={pathname}
                            toggleLocale={toggleLocale}
                            locale={locale}
                            setIsMenuOpen={setIsMenuOpen}
                        />
                    )}
                    {!(isCabinet || isSpecialist) && (
                        <Link href={isSpecialist ? "/specialist" : "/cabinet"} className="text-brand-gray-dark">
                            <User size={20} />
                        </Link>
                    )}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="text-brand-gray-dark focus:outline-none z-[110]"
                    >
                        {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
                    </button>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            <div className={`fixed inset-0 bg-white z-[200] transition-all duration-500 md:hidden flex flex-col items-center justify-start overflow-y-auto pt-24 pb-12 px-8 ${isMenuOpen ? 'opacity-100 visible shadow-2xl' : 'opacity-0 invisible pointer-events-none'} ${(isCabinet || isSpecialist) ? 'lg:hidden' : ''}`}>
                <div className={`flex flex-col items-center gap-1 w-full max-w-xs transition-transform duration-500 transform ${isMenuOpen ? 'translate-y-0' : '-translate-y-10'}`}>
                    <NavLinks
                        mobile
                        isCabinet={isCabinet}
                        isSpecialist={isSpecialist}
                        t={t}
                        tDashboard={tDashboard}
                        setIsMenuOpen={setIsMenuOpen}
                    />
                    {!(isCabinet || isSpecialist) && (
                        <Link
                            href="/pricing"
                            onClick={() => setIsMenuOpen(false)}
                            className="bg-brand-leaf hover:bg-brand-leaf-light text-white px-8 py-4 rounded-full transition-colors flex items-center justify-center w-full text-lg mt-8 shadow-lg shadow-brand-leaf/20 font-bold"
                        >
                            {t('consultation')}
                        </Link>
                    )}
                </div>

                {/* Visual Accent */}
                <div className="mt-12 opacity-5 grayscale pointer-events-none shrink-0">
                    <img src="/logo.png" alt="" className="h-48" />
                </div>
            </div>
        </>
    );
}
