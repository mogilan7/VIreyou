import { ArrowRight } from 'lucide-react';

export function Hero() {
    return (
        <section className="relative w-full bg-brand-bg py-20 lg:py-32 overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-white to-brand-bg -z-10" />
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center gap-12">
                {/* Text Content */}
                <div className="flex-1 space-y-8 text-center lg:text-left z-10">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-brand-blue leading-tight tracking-tight">
                        Reversing Biological Age <br />
                        <span className="text-brand-mint-dark">through Science.</span>
                    </h1>
                    <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto lg:mx-0">
                        Join the premium longevity platform. Discover your true biological age and get a personalized, science-backed anti-aging plan.
                    </p>
                    <div className="pt-4">
                        <button className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-brand-blue px-8 py-4 text-lg font-semibold text-white shadow-xl transition-all duration-300 hover:bg-brand-mint hover:text-brand-blue hover:shadow-2xl hover:-translate-y-1 scale-150 transform origin-left">
                            Get My Anti-Age Plan
                            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </button>
                    </div>
                </div>

                {/* Image / Portrait */}
                <div className="flex-1 w-full max-w-lg lg:max-w-none relative z-10 rounded-2xl overflow-hidden shadow-2xl ring-4 ring-brand-white">
                    {/* We assume the user has placed valentina.jpg in public/ */}
                    <div className="aspect-[4/5] w-full bg-gray-200 relative group">
                        <img
                            src="/valentina.jpg"
                            alt="Valentina Ul, Lead Specialist"
                            onError={(e) => {
                                e.currentTarget.src = 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=2070&auto=format&fit=crop';
                            }}
                            className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-white">
                            <h3 className="text-xl font-bold">Valentina Ul</h3>
                            <p className="text-brand-mint text-sm">Lead Anti-Aging Specialist</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
