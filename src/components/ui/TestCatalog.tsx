import { Activity, Dna, Lock, ArrowRight } from 'lucide-react';
import { Test } from '@prisma/client';

export function TestCatalog({ tests, unlockedIds }: { tests: Test[], unlockedIds: string[] }) {
    // Merge Prisma tests with icons (mocking icons based on name)
    const displayTests = tests.map(t => {
        let Icon = Activity;
        if (t.name.includes('Zoe') || t.name.includes('Epigenetic')) Icon = Dna;

        const isUnlocked = t.is_public || unlockedIds.includes(t.id);

        return {
            ...t,
            isUnlocked,
            icon: Icon,
        };
    });

    return (
        <section className="py-20 bg-brand-bg relative w-full">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
                <div className="text-center mb-16">
                    <h2 className="text-3xl lg:text-4xl font-bold text-brand-blue mb-4">Diagnostics Catalog</h2>
                    <p className="text-gray-600 max-w-2xl mx-auto text-lg">
                        Explore our state-of-the-art longevity diagnostics. Advanced tests require a consultation with our specialists.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {displayTests.map((test) => (
                        <div
                            key={test.id}
                            className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${test.isUnlocked
                                    ? 'bg-white border-brand-mint shadow-lg hover:shadow-xl hover:-translate-y-1'
                                    : 'bg-gray-50 border-gray-200 grayscale opacity-75'
                                }`}
                        >
                            <div className="p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`p-3 rounded-lg ${test.isUnlocked ? 'bg-brand-mint text-brand-mint-dark' : 'bg-gray-200 text-gray-500'}`}>
                                        <test.icon className="h-6 w-6" />
                                    </div>
                                    {!test.isUnlocked && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-gray-200 text-gray-600 rounded-full">
                                            <Lock className="w-3.5 h-3.5" />
                                            Consultation Required
                                        </span>
                                    )}
                                    {test.isUnlocked && !test.is_public && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-brand-mint-dark text-white rounded-full shadow-sm">
                                            Unlocked for You
                                        </span>
                                    )}
                                    {test.is_public && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
                                            Available Now
                                        </span>
                                    )}
                                </div>

                                <h3 className={`text-xl font-bold mb-3 ${test.isUnlocked ? 'text-brand-blue' : 'text-gray-600'}`}>
                                    {test.name}
                                </h3>
                                <p className={`mb-6 line-clamp-2 ${test.isUnlocked ? 'text-gray-600' : 'text-gray-500'}`}>
                                    {test.description}
                                </p>

                                <div className="pt-4 border-t border-gray-100">
                                    <button
                                        disabled={!test.isUnlocked}
                                        className={`inline-flex items-center font-semibold transition-colors ${test.isUnlocked
                                                ? 'text-brand-mint-dark hover:text-brand-blue'
                                                : 'text-gray-400 cursor-not-allowed'
                                            }`}
                                    >
                                        View Details
                                        <ArrowRight className="ml-2 w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
