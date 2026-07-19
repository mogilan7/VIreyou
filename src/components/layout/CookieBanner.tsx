"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";

export default function CookieBanner() {
    const [isVisible, setIsVisible] = useState(false);
    const locale = useLocale();
    const isRu = locale === "ru";

    useEffect(() => {
        const consent = localStorage.getItem("cookie_consent");
        if (!consent) {
            setIsVisible(true);
        }
    }, []);

    if (!isVisible) return null;

    const acceptCookies = () => {
        localStorage.setItem("cookie_consent", "true");
        setIsVisible(false);
    };

    return (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-brand-sage shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-[90] p-4 md:p-6 flex flex-col md:flex-row items-center justify-center md:justify-between gap-4">
            <p className="text-xs md:text-sm text-brand-gray leading-relaxed max-w-4xl text-center md:text-left">
                {isRu 
                    ? "Мы используем файлы cookie для обеспечения корректной работы сайта и улучшения пользовательского опыта. Продолжая использовать сайт, вы соглашаетесь с нашей Политикой конфиденциальности."
                    : "We use cookies to ensure the proper functioning of the site and improve your user experience. By continuing to use the site, you consent to our Privacy Policy."
                }
            </p>
            <button 
                onClick={acceptCookies}
                className="whitespace-nowrap px-8 py-2.5 bg-brand-leaf text-white text-sm font-medium rounded-full hover:bg-brand-leaf-light transition-colors"
            >
                {isRu ? "Соглашаюсь" : "I Accept"}
            </button>
        </div>
    );
}
