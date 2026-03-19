"use client";

import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  Activity, 
  User, 
  Heart, 
  Stethoscope, 
  AlertCircle, 
  ClipboardList, 
  Loader2, 
  CheckCircle2,
  Info,
  X
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { generateDiagnosticReport } from '@/app/actions/diagnostic-action';
import { getSidebarProfile } from '@/actions/profile';


interface DiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DiagnosticModal: React.FC<DiagnosticModalProps> = ({ isOpen, onClose }) => {
  const t = useTranslations('DiagnosticModal');
  const locale = useLocale();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      const loadProfileData = async () => {
        const profile = await getSidebarProfile();
        if (profile?.welcome_data) {
          setFormData(prev => ({
            ...prev,
            ...profile.welcome_data
          }));
        }
      };
      loadProfileData();
    }
  }, [isOpen]);

  const [formData, setFormData] = useState({

    name: '',
    age: '',
    sex: 'male',
    height: '',
    weight: '',
    waist: '',
    hips: '',
    smoking: 'no',
    alcohol: 'rarely',
    activity: 'medium',
    diet: 'omnivore',
    region: '',
    symptoms: [] as string[],
    chronic: '',
    meds: '',
    heredity: ''
  });

  const [regData, setRegData] = useState({ email: '', phone: '' });

  if (!isOpen) return null;

  const symptomsList = [
    t('symptom1'),
    t('symptom2'),
    t('symptom3'),
    t('symptom4'),
    t('symptom5'),
    t('symptom6'),
    t('symptom7'),
    t('symptom8')
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleSymptom = (symptom: string) => {
    setFormData(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter(s => s !== symptom)
        : [...prev.symptoms, symptom]
    }));
  };

  const calculateBMI = () => {
    if (!formData.weight || !formData.height) return null;
    const h = Number(formData.height) / 100;
    return (Number(formData.weight) / (h * h)).toFixed(1);
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const report = await generateDiagnosticReport(formData, locale);
      setResult(report);
      setStep(4);
    } catch (err: any) {
      setError(err.message || t('errorMessage'));
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  const StepIndicator = () => (
    <div className="flex items-center justify-between mb-8 px-4">
      {[0, 1, 2].map((i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 shadow-sm ${step >= i ? 'bg-brand-forest text-white ring-4 ring-brand-forest/20' : 'bg-slate-100 text-slate-400'}`}>
              {i + 1}
            </div>
            <span className={`text-[10px] font-medium uppercase tracking-wider ${step >= i ? 'text-brand-forest' : 'text-slate-400'}`}>
              {i === 0 ? t('step1') : i === 1 ? t('step2') : t('step3')}
            </span>
          </div>
          {i < 2 && <div className={`flex-1 h-1 mx-2 rounded-full transition-all duration-500 ${step > i ? 'bg-brand-forest' : 'bg-slate-100'}`} />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all z-20"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-brand-forest to-brand-forest-dark p-8 text-white relative">
          <div className="absolute top-0 right-10 w-32 h-32 bg-brand-mint/10 rounded-full blur-3xl -z-10" />
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
              <Activity className="w-8 h-8 text-brand-mint" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('assistantName')}</h1>
              <p className="text-white/70 text-sm font-medium">{t('assistantDesc')}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 scrollbar-hide">
          {step < 4 && <StepIndicator />}

          {/* Step 0: Personal Data */}
          {step === 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-2 text-brand-forest font-bold text-lg mb-4">
                <User className="w-5 h-5" />
                <h2>{t('section1Title')}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 ml-1">{t('nameLabel')}</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none" placeholder={t('namePlaceholder')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-slate-700 ml-1">{t('ageLabel')}</label>
                    <input type="number" name="age" value={formData.age} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-slate-700 ml-1">{t('sexLabel')}</label>
                    <select name="sex" value={formData.sex} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none appearance-none">
                      <option value="male">{t('male')}</option>
                      <option value="female">{t('female')}</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 ml-1">{t('heightLabel')}</label>
                  <input type="number" name="height" value={formData.height} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none" placeholder="180" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 ml-1">{t('weightLabel')}</label>
                  <input type="number" name="weight" value={formData.weight} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none" placeholder="75" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 ml-1">{t('waistLabel')}</label>
                  <input type="number" name="waist" value={formData.waist} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none" placeholder="85" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 ml-1">{t('hipsLabel')}</label>
                  <input type="number" name="hips" value={formData.hips} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none" placeholder="95" />
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Lifestyle */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-2 text-brand-forest font-bold text-lg mb-4">
                <Heart className="w-5 h-5" />
                <h2>{t('section2Title')}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 ml-1">{t('smokingLabel')}</label>
                  <select name="smoking" value={formData.smoking} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none appearance-none">
                    <option value="no">{t('smokingNo')}</option>
                    <option value="rarely">{t('smokingRarely')}</option>
                    <option value="yes">{t('smokingYes')}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 ml-1">{t('dietLabel')}</label>
                  <select name="diet" value={formData.diet} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none appearance-none">
                    <option value="omnivore">{t('dietOmnivore')}</option>
                    <option value="vegetarian">{t('dietVegetarian')}</option>
                    <option value="vegan">{t('dietVegan')}</option>
                    <option value="keto">{t('dietKeto')}</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 ml-1">{t('activityLabel')}</label>
                  <select name="activity" value={formData.activity} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none appearance-none">
                    <option value="low">{t('activityLow')}</option>
                    <option value="medium">{t('activityMedium')}</option>
                    <option value="high">{t('activityHigh')}</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 ml-1">{t('regionLabel')}</label>
                  <input type="text" name="region" value={formData.region} onChange={handleInputChange} placeholder={t('regionPlaceholder')} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Health */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-2 text-brand-forest font-bold text-lg mb-4">
                <Stethoscope className="w-5 h-5" />
                <h2>{t('section3Title')}</h2>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">{t('symptomsLabel')}</label>
                <div className="grid grid-cols-2 gap-3">
                  {symptomsList.map(s => (
                    <button
                      key={s}
                      onClick={() => toggleSymptom(s)}
                      className={`p-3 text-xs md:text-sm text-left rounded-2xl border transition-all duration-300 flex items-center gap-2 ${formData.symptoms.includes(s) ? 'bg-brand-forest/5 border-brand-forest text-brand-forest font-bold shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-forest/30 hover:bg-slate-50'}`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${formData.symptoms.includes(s) ? 'border-brand-forest bg-brand-forest' : 'border-slate-300'}`}>
                        {formData.symptoms.includes(s) && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-5 pt-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 ml-1">{t('chronicLabel')}</label>
                  <textarea name="chronic" value={formData.chronic} onChange={handleInputChange} rows={2} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none resize-none" placeholder={t('chronicPlaceholder')} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 ml-1">{t('medsLabel')}</label>
                  <textarea name="meds" value={formData.meds} onChange={handleInputChange} rows={2} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none resize-none" placeholder={t('medsPlaceholder')} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 ml-1">{t('heredityLabel')}</label>
                  <input type="text" name="heredity" value={formData.heredity} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none" placeholder={t('heredityPlaceholder')} />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Calculation & Loading */}
          {step === 3 && (
            <div className="text-center py-12 space-y-8 animate-in zoom-in duration-500 h-full flex flex-col justify-center">
              {loading ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 border-4 border-slate-100 rounded-full animate-pulse" />
                    <Loader2 className="w-24 h-24 text-brand-forest animate-spin absolute top-0 left-0" />
                    <Activity className="w-8 h-8 text-brand-mint absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900">{t('loadingTitle')}</h2>
                    <p className="text-slate-500 max-w-sm mx-auto">
                      {t('loadingDesc')}
                    </p>
                  </div>
                </div>
              ) : error ? (
                <div className="p-8 bg-red-50 rounded-[2.5rem] border border-red-100 text-red-700 max-w-md mx-auto">
                  <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-10 h-10" />
                  </div>
                  <p className="font-bold text-lg mb-2">{t('errorTitle')}</p>
                  <p className="opacity-80 text-sm mb-8">{error}</p>
                  <button 
                    onClick={handleGenerateReport} 
                    className="w-full px-8 py-4 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 transform active:scale-95 transition-all"
                  >
                    {t('errorRetry')}
                  </button>
                </div>
              ) : (
                <div className="space-y-8 max-w-md mx-auto">
                  <div className="bg-brand-forest/5 p-10 rounded-[3rem] inline-block border border-brand-forest/10 relative">
                    <div className="absolute -top-4 -right-4 w-12 h-12 bg-brand-mint rounded-2xl flex items-center justify-center shadow-lg animate-bounce">
                      <CheckCircle2 className="w-7 h-7 text-brand-forest" />
                    </div>
                    <ClipboardList className="w-20 h-20 text-brand-forest mx-auto" />
                    <h3 className="mt-4 font-bold text-xl text-brand-forest">{t('readyTitle')}</h3>
                  </div>
                  <p className="text-slate-600 leading-relaxed font-medium">
                    {t('readyDesc')}
                  </p>
                  <button 
                    onClick={handleGenerateReport}
                    className="w-full px-10 py-5 bg-brand-forest text-white rounded-2xl font-bold text-lg shadow-2xl shadow-brand-forest/20 hover:bg-brand-forest-dark transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                  >
                    {t('readyBtn')} <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Result Screen */}
          {step === 4 && result && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 pb-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-brand-mint/20 rounded-2xl flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-brand-forest" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 leading-tight">{t('resultTitle')}</h2>
                    <p className="text-sm font-medium text-slate-500">{t('resultSubtitle')}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setStep(0)} 
                  className="px-4 py-2 text-sm text-brand-forest hover:bg-brand-forest/5 rounded-xl font-bold transition-all"
                >
                  {t('restartBtn')}
                </button>
              </div>
              
              <div className="prose prose-slate max-w-none text-slate-700 space-y-4 bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 shadow-inner overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-forest/5 rounded-full blur-3xl" />
                {result.split('\n').map((line, i) => {
                  if (line.startsWith('###')) return <h3 key={i} className="text-xl font-bold text-brand-forest mt-8 mb-4 flex items-center gap-2">{line.replace('###', '').trim()}</h3>;
                  if (line.startsWith('##')) return <h2 key={i} className="text-2xl font-extrabold text-slate-900 border-b border-brand-forest/10 pb-3 mb-6 mt-10 uppercase tracking-tight">{line.replace('##', '').trim()}</h2>;
                  if (line.startsWith('-') || line.startsWith('*')) return <li key={i} className="ml-4 list-none mb-3 relative pl-6 before:content-[''] before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:bg-brand-mint before:rounded-full">{line.replace(/^[*-]\s*/, '').trim()}</li>;
                  if (line.trim() === '') return <div key={i} className="h-2" />;
                  return <p key={i} className="leading-relaxed font-medium opacity-90">{line}</p>;
                })}
              </div>

              <div className="flex flex-col gap-3 mt-8">
                <button 
                  onClick={() => setStep(5)}
                  className="w-full px-8 py-4 bg-brand-forest text-white rounded-2xl font-bold shadow-lg shadow-brand-forest/10 hover:bg-brand-forest/90 transition-all flex items-center justify-center gap-2"
                >
                  <ClipboardList className="w-5 h-5" /> {t('downloadBtn')}
                </button>
                <button 
                  onClick={() => setStep(6)}
                  className="w-full px-8 py-4 bg-white border-2 border-brand-forest text-brand-forest rounded-2xl font-bold hover:bg-brand-forest/5 transition-all flex items-center justify-center gap-2"
                >
                  <Activity className="w-5 h-5" /> {t('aiConsultBtn')}
                </button>
                <button 
                  onClick={() => setStep(7)}
                  className="w-full px-8 py-4 bg-white border-2 border-brand-leaf text-brand-leaf rounded-2xl font-bold hover:bg-brand-leaf/5 transition-all flex items-center justify-center gap-2"
                >
                  <User className="w-5 h-5" /> {t('humanConsultBtn')}
                </button>
              </div>

              <div className="mt-8 p-6 bg-amber-50/50 rounded-[2rem] border border-amber-100 flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Info className="w-6 h-6 text-amber-600" />
                </div>
                <p className="text-sm text-amber-900/80 leading-relaxed">
                  <strong className="text-amber-900 block mb-1">{t('warningTitle')}</strong> 
                  {t('warningDesc')}
                </p>
              </div>
            </div>
          )}

          {/* Registration Screen (Step 5) */}
          {step === 5 && (
            <div className="animate-in fade-in zoom-in duration-500 py-6 space-y-8">
              <div className="text-center space-y-3">
                <div className="w-20 h-20 bg-brand-forest/5 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <ClipboardList className="w-10 h-10 text-brand-forest" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">{t('regTitle')}</h2>
                <p className="text-slate-500 max-w-sm mx-auto">{t('regDesc')}</p>
              </div>

              <div className="space-y-4 max-w-sm mx-auto">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 ml-1">{t('emailLabel')}</label>
                  <input 
                    type="email" 
                    value={regData.email}
                    onChange={(e) => setRegData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none" 
                    placeholder="example@mail.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 ml-1">{t('phoneLabel')}</label>
                  <input 
                    type="tel" 
                    value={regData.phone}
                    onChange={(e) => setRegData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white transition-all outline-none" 
                    placeholder={t('phonePlaceholder')}
                  />
                </div>
                <button 
                  onClick={() => setStep(4)}
                  className="w-full px-8 py-5 bg-brand-forest text-white rounded-2xl font-bold shadow-xl shadow-brand-forest/20 hover:bg-brand-forest/90 transition-all transform hover:scale-[1.02] active:scale-95 mt-4"
                >
                  {t('subscribeBtn')}
                </button>
                <button 
                  onClick={() => setStep(4)}
                  className="w-full text-slate-400 text-sm font-medium hover:text-brand-forest transition-all"
                >
                  {t('backBtn')}
                </button>
              </div>
            </div>
          )}

          {/* AI Offer Screen (Step 6) */}
          {step === 6 && (
            <div className="animate-in fade-in zoom-in duration-500 py-6 space-y-8 text-center">
              <div className="w-24 h-24 bg-brand-forest/5 rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 border border-brand-forest/10">
                <Activity className="w-12 h-12 text-brand-forest" />
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-bold text-slate-900 font-serif">{t('aiOfferTitle')}</h2>
                <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">{t('aiOfferDesc')}</p>
              </div>

              <div className="max-w-xs mx-auto space-y-4 pt-6">
                <button 
                  onClick={() => setStep(4)}
                  className="w-full px-8 py-5 bg-brand-forest text-white rounded-2xl font-bold shadow-2xl shadow-brand-forest/20 hover:bg-brand-forest/90 transition-all transform hover:scale-[1.05]"
                >
                  {t('subscribeBtn')}
                </button>
                <button 
                  onClick={() => setStep(4)}
                  className="w-full text-slate-400 text-sm font-medium hover:text-brand-forest transition-all"
                >
                  {t('backBtn')}
                </button>
              </div>
            </div>
          )}

          {/* Premium Offer Screen (Step 7) */}
          {step === 7 && (
            <div className="animate-in fade-in zoom-in duration-500 py-6 space-y-8 text-center">
              <div className="w-24 h-24 bg-brand-leaf/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 border border-brand-leaf/20">
                <User className="w-12 h-12 text-brand-leaf" />
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-bold text-slate-900 font-serif">{t('premiumOfferTitle')}</h2>
                <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">{t('premiumOfferDesc')}</p>
              </div>

              <div className="max-w-xs mx-auto space-y-4 pt-6">
                <button 
                  onClick={() => setStep(4)}
                  className="w-full px-8 py-5 bg-brand-leaf text-white rounded-2xl font-bold shadow-2xl shadow-brand-leaf/20 hover:bg-brand-leaf/90 transition-all transform hover:scale-[1.05]"
                >
                  {t('subscribeBtn')}
                </button>
                <button 
                  onClick={() => setStep(4)}
                  className="w-full text-slate-400 text-sm font-medium hover:text-brand-forest transition-all"
                >
                  {t('backBtn')}
                </button>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          {step < 3 && (
            <div className="flex items-center justify-between mt-12 pt-6 border-t border-slate-100">
              <button
                onClick={prevStep}
                disabled={step === 0}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${step === 0 ? 'opacity-0 pointer-events-none' : 'text-slate-400 hover:text-brand-forest hover:bg-brand-forest/5'}`}
              >
                <ChevronLeft className="w-5 h-5" /> {t('backBtn')}
              </button>
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-10 py-4 bg-brand-forest text-white rounded-2xl font-bold shadow-xl shadow-brand-forest/20 hover:bg-brand-forest-dark transition-all transform hover:scale-[1.02] active:scale-95 group"
              >
                {t('nextBtn')} <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiagnosticModal;
