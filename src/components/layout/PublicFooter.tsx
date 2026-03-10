import { Link } from "@/i18n/routing";

export default function PublicFooter() {
    return (
        <footer className="bg-white py-12 border-t border-brand-sage/50">
            <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-0">
                <div className="flex flex-col items-center md:items-start max-w-xs">
                    <div className="bg-brand-forest w-6 h-6 flex items-center justify-center text-white text-[10px] font-bold font-serif mb-4">
                        VI
                    </div>
                    <p className="text-brand-gray text-[10px] leading-relaxed text-center md:text-left">
                        Scientific wellness and holistic anti-aging by Dr. Valentina. Redefining the dialogue between you and your body.
                    </p>
                </div>

                <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-[10px] tracking-widest font-semibold text-brand-gray-dark uppercase">
                    <Link href="/#philosophy" className="hover:text-brand-leaf">Philosophy</Link>
                    <Link href="/diagnostics" className="hover:text-brand-leaf">Diagnostics</Link>
                    <Link href="/pricing" className="hover:text-brand-leaf">Pricing</Link>
                    <Link href="#" className="hover:text-brand-leaf">Legal Notice</Link>
                    <Link href="#" className="hover:text-brand-leaf">Privacy Policy</Link>
                    <Link href="#" className="hover:text-brand-leaf">Contact</Link>
                </div>

                <div className="text-[10px] text-brand-gray/60 text-center md:text-right">
                    &copy; {new Date().getFullYear()} VI antiage.<br />
                    Science-backed holistic wellness and longevity specialist.
                </div>
            </div>
        </footer>
    );
}
