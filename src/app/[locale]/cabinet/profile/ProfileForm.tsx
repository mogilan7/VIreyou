"use client";

import React, { useState, useRef } from 'react';
import { useTranslations } from "next-intl";
import { updateProfile } from '@/actions/profile';
import { Camera, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function ProfileForm({ initialProfile }: { initialProfile: any }) {
    const t = useTranslations('ProfileSettings');
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [avatarPreview, setAvatarPreview] = useState<string | null>(initialProfile?.avatar_url || null);

    // For file input triggering
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSaving(true);
        setStatus('idle');
        setErrorMessage('');

        const formData = new FormData(e.currentTarget);

        const result = await updateProfile(formData);

        if (result && result.success) {
            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
        } else {
            console.error("Profile update failed", result);
            setErrorMessage(result?.error || t('error'));
            setStatus('error');
        }
        setIsSaving(false);
    };


    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Avatar Section */}
            <div className="flex items-center gap-6">
                <div className="relative w-24 h-24 rounded-full border-4 border-brand-sage/30 bg-brand-sage/20 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {avatarPreview ? (
                        <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-brand-forest font-bold text-2xl">
                            {initialProfile?.full_name?.charAt(0) || "U"}
                        </span>
                    )}
                </div>
                <div>
                    <input
                        type="file"
                        name="avatar"
                        accept="image/png, image/jpeg, image/jpg"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 border border-brand-sage text-brand-forest rounded-xl hover:bg-brand-sage/20 transition-colors text-sm font-semibold mb-2"
                    >
                        <Camera size={16} />
                        {t('uploadPhoto')}
                    </button>
                    <p className="text-xs text-brand-gray">JPG, PNG up to 5MB.</p>
                </div>
            </div>

            <div className="space-y-5">
                {/* Full Name */}
                <div>
                    <label className="block text-sm font-semibold text-brand-text mb-2">
                        {t('fullName')}
                    </label>
                    <input
                        type="text"
                        name="fullName"
                        defaultValue={initialProfile?.full_name || ''}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-leaf/50 transition-shadow"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Date of Birth */}
                    <div>
                        <label className="block text-sm font-semibold text-brand-text mb-2">
                            {t('dob')}
                        </label>
                        <input
                            type="date"
                            name="dob"
                            defaultValue={
                              initialProfile?.date_of_birth 
                                ? (() => {
                                    const d = new Date(initialProfile.date_of_birth);
                                    return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
                                  })()
                                : ''
                            }
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-leaf/50 transition-shadow"
                        />

                    </div>


                    {/* Height */}
                    <div>
                        <label className="block text-sm font-semibold text-brand-text mb-2">
                            {t('height')} (см)
                        </label>
                        <input
                            type="number"
                            name="height"
                            defaultValue={initialProfile?.height || ''}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-leaf/50 transition-shadow"
                        />
                    </div>

                    {/* Gender */}
                    <div>
                        <label className="block text-sm font-semibold text-brand-text mb-2">
                            {t('gender')}
                        </label>
                        <select
                            name="gender"
                            defaultValue={initialProfile?.gender || ''}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-leaf/50 transition-shadow"
                        >
                            <option value="">{t('gender')}...</option>
                            <option value="male">{t('genderMale')}</option>
                            <option value="female">{t('genderFemale')}</option>
                        </select>
                    </div>
                </div>

                {/* --- Welcome Survey Data inputs --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                        <label className="block text-sm font-semibold text-brand-text mb-2">Вес (кг)</label>
                        <input type="number" name="weight" defaultValue={initialProfile?.welcome_data?.weight || ''} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-brand-text mb-2">Талия (см)</label>
                        <input type="number" name="waist" defaultValue={initialProfile?.welcome_data?.waist || ''} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-brand-text mb-2">Бедра (см)</label>
                        <input type="number" name="hips" defaultValue={initialProfile?.welcome_data?.hips || ''} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3" />
                    </div>
                </div>


            </div>

            {/* Submit Button & Status */}
            <div className="pt-6 border-t border-brand-sage/30 flex items-center justify-between">
                <div className="text-sm font-medium">
                    {status === 'success' && <span className="text-brand-leaf flex items-center gap-1"><CheckCircle size={16} /> {t('success')}</span>}
                    {status === 'error' && <span className="text-red-500 flex items-center gap-1 text-xs"><AlertCircle size={16} className="flex-shrink-0" /> {errorMessage}</span>}

                </div>

                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-brand-forest text-white px-8 py-3 rounded-xl hover:bg-brand-leaf transition-all shadow-md active:scale-95 disabled:opacity-70 font-semibold"
                >
                    {isSaving ? <><Loader2 size={18} className="animate-spin" /> {t('saving')}</> : t('saveChanges')}
                </button>
            </div>
        </form>
    );
}
