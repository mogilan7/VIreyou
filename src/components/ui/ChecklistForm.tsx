'use client';

import { useState } from 'react';
import { assignTestsToClient } from '@/app/actions';
import { CheckSquare, Square, Loader2 } from 'lucide-react';

interface ChecklistFormProps {
    clientId: string;
    clientName: string;
    telegramId?: string | null;
    tests: { id: string; name: string; is_public: boolean }[];
}

export function ChecklistForm({ clientId, clientName, telegramId, tests }: ChecklistFormProps) {
    const [selectedTests, setSelectedTests] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null; msg: string }>({ type: null, msg: '' });

    const lockedTests = tests.filter(t => !t.is_public);

    const toggleTest = (id: string) => {
        setSelectedTests(prev =>
            prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedTests.length === 0) {
            setStatus({ type: 'error', msg: 'Please select at least one test.' });
            return;
        }

        setIsSubmitting(true);
        setStatus({ type: null, msg: '' });

        const result = await assignTestsToClient(clientId, selectedTests, notes, telegramId);

        if (result.success) {
            setStatus({ type: 'success', msg: result.message });
            setSelectedTests([]);
            setNotes('');
        } else {
            setStatus({ type: 'error', msg: result.message });
        }

        setIsSubmitting(false);
    };

    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-brand-bg">
                <h3 className="text-xl font-bold text-brand-blue">Consultation Checklist</h3>
                <p className="text-sm text-gray-500">Assign diagnostics for {clientName}</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {status.type && (
                    <div className={`p-4 rounded-md text-sm font-medium ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        {status.msg}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Available Restricted Diagnostics</label>
                    <div className="space-y-3">
                        {lockedTests.map(test => (
                            <label
                                key={test.id}
                                className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${selectedTests.includes(test.id) ? 'bg-brand-mint/20 border-brand-mint-dark' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                    }`}
                            >
                                <div className="mt-0.5">
                                    {selectedTests.includes(test.id) ? (
                                        <CheckSquare className="w-5 h-5 text-brand-mint-dark" />
                                    ) : (
                                        <Square className="w-5 h-5 text-gray-400" />
                                    )}
                                </div>
                                <div className="ml-3">
                                    <span className="block text-sm font-medium text-gray-900">{test.name}</span>
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={selectedTests.includes(test.id)}
                                    onChange={() => toggleTest(test.id)}
                                />
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Consultation Notes (Sent to Client)</label>
                    <textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-mint focus:ring focus:ring-brand-mint focus:ring-opacity-50 text-sm p-3 border"
                        placeholder="E.g., Based on our review, I've unlocked these advanced scans for further analysis."
                    ></textarea>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-brand-blue hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:opacity-50 transition-all"
                >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Checklist & Notify Client'}
                </button>
            </form>
        </div>
    );
}
