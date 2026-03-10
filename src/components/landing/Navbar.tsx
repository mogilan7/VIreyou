import Link from "next/link";
import { User } from "lucide-react";

export default function Navbar() {
    return (
        <nav className="absolute top-0 w-full z-50 py-6 px-12 flex items-center justify-between">
            {/* Brand Logo Placeholder */}
            <div className="flex items-center gap-3">
                <div className="bg-brand-forest w-8 h-8 flex items-center justify-center text-white text-xs font-bold font-serif">
                    VI
                </div>
            </div>

            <div className="hidden md:flex items-center gap-10 text-xs tracking-widest font-semibold text-brand-gray-dark uppercase">
                <Link href="#philosophy" className="hover:text-brand-forest transition-colors">Philosophy</Link>
                <Link href="#specialist" className="hover:text-brand-forest transition-colors">The Specialist</Link>
                <Link href="#process" className="hover:text-brand-forest transition-colors">Process</Link>

                <Link
                    href="/pricing"
                    className="bg-brand-leaf hover:bg-brand-leaf-light text-white px-6 py-2.5 rounded-full transition-colors flex items-center"
                >
                    Book Consultation
                </Link>
                <Link href="/cabinet" className="text-brand-gray-dark hover:text-brand-forest">
                    <User size={18} />
                </Link>
            </div>
        </nav>
    );
}
