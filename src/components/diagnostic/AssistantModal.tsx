"use client";

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Loader2, 
  User, 
  Activity, 
  ChevronRight, 
  CheckCircle2, 
  Info,
  MessageSquare,
  ArrowRight,
  Save,
  Lock
} from 'lucide-react';
import { talkToAssistant } from '@/app/actions/assistant-action';
import { createClient } from '@/utils/supabase/client';
import { saveTestResult } from '@/actions/save-test';

interface AssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const renderTextWithLinks = (text: string) => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }
        parts.push(
            <a key={match.index} href={match[2]} className="text-brand-mint font-bold hover:underline transition-all">
                {match[1]}
            </a>
        );
        lastIndex = linkRegex.lastIndex;
    }
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }
    return parts.length > 0 ? parts : text;
};

export default function AssistantModal({ isOpen, onClose }: AssistantModalProps) {
  const [step, setStep] = useState(0); // 0: Form, 1: Chat, 2: Finished/Report
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);


  const [formData, setFormData] = useState({
    name: '',
    age: '',
    sex: 'male',
    height: '',
    weight: '',
    waist: '',
    hips: '',
    activity: 'medium'
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Auth check on mount
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        
        // Import Server Action explicitly
        const { getSidebarProfile } = await import('@/actions/profile');
        const profile = await getSidebarProfile();
        
        if (profile) {
          const dob = (profile as any).date_of_birth ? new Date((profile as any).date_of_birth) : null;
          const calculatedAge = dob && !isNaN(dob.getTime()) ? String(new Date().getFullYear() - dob.getFullYear()) : '';

          setFormData(prev => ({
            ...prev,
            name: profile.full_name || user.user_metadata?.full_name || prev.name,
            height: (profile as any).height || prev.height,
            age: calculatedAge || prev.age,
            weight: profile.welcome_data?.weight || prev.weight,
            waist: profile.welcome_data?.waist || prev.waist,
            hips: profile.welcome_data?.hips || prev.hips
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            name: user.user_metadata?.full_name || ''
          }));
        }
      }
      setAuthLoading(false);
    };
    checkAuth();
  }, []);



  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const startAssistant = async () => {
    setStep(1);
    setLoading(true);
    try {
      // First call to initialize the chat with Form Data Context
      const response = await talkToAssistant([], formData);
      setMessages([{ role: 'assistant', content: response.content }]);
    } catch (err) {
      console.error(err);
      setMessages([{ role: 'assistant', content: "Произошла ошибка при запуске ассистента. Пожалуйста, попробуйте еще раз." }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: inputMessage };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await talkToAssistant(updatedMessages, formData);
      setMessages([...updatedMessages, { role: 'assistant', content: response.content }]);
    } catch (err) {
      console.error(err);
      setMessages([...updatedMessages, { role: 'assistant', content: "Ошибка соединения с ИИ. Попробуйте еще раз." }]);
    } finally {
      setLoading(false);
    }
  };

  const triggerFinish = async () => {
      setLoading(true);
      const finishMessage: Message = { role: 'user', content: "Сформируй, пожалуйста, итоговый отчет по нашему диалогу согласно инструкции (для специалиста и для меня)." };
      const updatedMessages = [...messages, finishMessage];
      setMessages(updatedMessages);
      
      try {
          const response = await talkToAssistant(updatedMessages, formData);
          setMessages([...updatedMessages, { role: 'assistant', content: response.content }]);
          // Transition to Step 2 to show the final report view
          setStep(2);
      } catch (err) {
          console.error(err);
      } finally {
          setLoading(false);
      }
  };

  const handleSaveToRecommendations = async () => {
      if (!user || isSaving || saveSuccess) return;
      setIsSaving(true);
      try {
          const reportContent = messages.length > 0 ? messages[messages.length - 1].content : '';
          
          // Извлекаем ID рекомендованных тестов
          const idsMatch = reportContent.match(/===RECOMMENDED_TEST_IDS===\s*([\s\S]*?)(\n|$)/);
          const recommendedTests = idsMatch 
              ? idsMatch[1].replace(/[\[\]\s\(\)]/g, '').split(',').filter(Boolean) 
              : [];

          const response = await saveTestResult({
              testType: 'ai-recommendation',
              score: 0,
              interpretation: 'ИИ-рекомендации по итогам диалога',
              rawData: { 
                  report: reportContent.split('===RECOMMENDED_TEST_IDS===')[0].trim(), 
                  recommendedTests 
              }
          });

          if (response.success) {
              setSaveSuccess(true);
              
              // Automatically assign to specialist
              const supabase = createClient();
              await supabase
                  .from('profiles')
                  .update({ assigned_specialist_id: '563938a6-2ca7-44db-9604-d60673b56c08' })
                  .eq('id', user.id);
                  
          } else {
              alert(`Ошибка сохранения: ${response.error}`);
          }
      } catch (err) {
          console.error(err);
          alert('Произошла ошибка при сохранении');
      } finally {
          setIsSaving(false);
      }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-brand-forest to-brand-forest-dark p-8 text-white relative">
          <div className="absolute top-0 right-10 w-32 h-32 bg-brand-mint/10 rounded-full blur-3xl -z-10" />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
              <MessageSquare className="w-8 h-8 text-brand-mint" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">ИИ-Коуч по долголетию</h1>
              <p className="text-white/70 text-sm font-medium">Ваш проводник в мир здоровья и системного anti-age</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col scrollbar-hide">
          
          {/* Auth loading spinner */}
          {authLoading && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-8 h-8 text-brand-forest animate-spin" />
                <p className="text-xs text-slate-400">Проверка доступа...</p>
            </div>
          )}

          {/* Auth Check for Guest */}
          {!authLoading && !user && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 my-auto max-w-sm mx-auto w-full text-center">
              <div className="p-5 bg-brand-mint/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-10 h-10 text-brand-forest" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Доступ ограничен</h2>
              <p className="text-slate-500 text-sm">
                ИИ-Коуч доступен только для авторизованных клиентов.
              </p>
              <div className="flex flex-col gap-4 mt-6">
                <a 
                  href="/ru/login" 
                  className="w-full px-8 py-4 bg-brand-forest text-white rounded-2xl font-bold text-center shadow-xl shadow-brand-forest/20 hover:bg-brand-forest-dark transition-all transform hover:scale-[1.02] active:scale-95"
                >
                  Войти или Создать аккаунт
                </a>
              </div>
            </div>
          )}

          {/* Step 0: Initial Form (Only if LOGGED IN) */}
          {step === 0 && !authLoading && user && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 my-auto max-w-md mx-auto w-full">

              <div className="text-center space-y-2 mb-6">
                <h2 className="text-xl font-bold text-slate-800">Приветственное анкетирование</h2>
                <p className="text-sm text-slate-500">Заполните базовые параметры для ИИ-ассистента</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Ваше Имя</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white outline-none" placeholder="Андрей" required />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Возраст</label>
                  <input type="number" name="age" value={formData.age} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white outline-none" placeholder="30" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Пол</label>
                  <select name="sex" value={formData.sex} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white outline-none appearance-none">
                    <option value="male">Мужской</option>
                    <option value="female">Женский</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Рост (см)</label>
                  <input type="number" name="height" value={formData.height} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white outline-none" placeholder="175" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Вес (кг)</label>
                  <input type="number" name="weight" value={formData.weight} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white outline-none" placeholder="70" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Талия (см)</label>
                  <input type="number" name="waist" value={formData.waist} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white outline-none" placeholder="80" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Бедра (см)</label>
                  <input type="number" name="hips" value={formData.hips} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white outline-none" placeholder="95" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Активность</label>
                <select name="activity" value={formData.activity} onChange={handleInputChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-forest focus:bg-white outline-none appearance-none">
                  <option value="low">Сидячий образ жизни</option>
                  <option value="medium">Средняя активность (1-3 тренировки)</option>
                  <option value="high">Высокая активность (Бег, Зал)</option>
                </select>
              </div>

              <button 
                onClick={startAssistant}
                className="w-full px-8 py-4 bg-brand-forest text-white rounded-2xl font-bold text-lg shadow-xl shadow-brand-forest/20 hover:bg-brand-forest-dark transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 mt-4"
              >
                Начать диалог <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step 1: Chat Interface */}
          {step === 1 && (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide pb-4">
                {messages.filter(m => m.role !== 'system').map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl border ${msg.role === 'user' ? 'bg-brand-forest text-white border-brand-forest rounded-br-none' : 'bg-slate-50 border-slate-100 text-slate-800 rounded-bl-none'}`}>
                      {msg.content.split('\n').map((line, j) => (
                        <p key={j} className="text-sm md:text-base leading-relaxed mb-1">{line}</p>
                      ))}
                    </div>
                  </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl rounded-bl-none flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-brand-forest animate-spin" />
                            <span className="text-xs text-slate-400">ИИ думает...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Кнопка ТГ-бота перенесена в финальный отчет */}

              {/* Action Buttons & Input */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex justify-between items-center px-1">
                    <button 
                        onClick={triggerFinish}
                        className="text-xs font-bold text-brand-forest hover:text-brand-forest-dark flex items-center gap-1 transition-all disabled:text-slate-400"
                        disabled={loading || messages.length < 3}
                    >
                        <CheckCircle2 className="w-4 h-4" /> Завершить и получить отчет
                    </button>
                    <span className="text-xs text-slate-400">Нажмите, если готовы к выводам</span>
                </div>

                <div className="flex gap-2">
                  <textarea 
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Напишите сообщение..."
                    className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-brand-forest/30 focus:ring-2 focus:ring-brand-forest/10 focus:bg-white outline-none resize-none text-sm transition-all h-24 leading-tight"
                    rows={3}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                    }}
                    disabled={loading}
                  />
                  <button 
                    onClick={sendMessage}
                    disabled={!inputMessage.trim() || loading}
                    className="p-4 bg-brand-forest text-white rounded-2xl font-bold shadow-lg shadow-brand-forest/10 hover:bg-brand-forest-dark transition-all transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Final Report / Summary Dashboard */}
          {step === 2 && (
              <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-8 duration-500">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-brand-mint/20 rounded-2xl flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-brand-forest" />
                      </div>
                      <div>
                          <h2 className="text-xl font-bold text-slate-900">Результат консультации</h2>
                          <p className="text-xs font-medium text-slate-500">Ваша дорожная карта anti-age</p>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide pb-4 prose prose-slate max-w-none text-slate-700 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 shadow-inner">
                      {messages.length > 0 && messages[messages.length - 1].content.split('\n').map((line, i) => {
                          if (line.startsWith('###')) return <h3 key={i} className="text-lg font-bold text-brand-forest mt-4 mb-2">{line.replace('###', '').trim()}</h3>;
                          if (line.startsWith('##')) return <h2 key={i} className="text-xl font-extrabold text-slate-900 border-b border-brand-forest/10 pb-2 mb-4 mt-6">{line.replace('##', '').trim()}</h2>;
                          if (line.startsWith('-') || line.startsWith('*')) return <li key={i} className="ml-4 list-none mb-2 relative pl-5 before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:bg-brand-mint before:rounded-full text-sm">{renderTextWithLinks(line.replace(/^[*-]\s*/, '').trim())}</li>;
                          if (line.trim() === '') return <div key={i} className="h-1" />;
                          return <p key={i} className="leading-relaxed font-medium opacity-90 text-sm mb-2">{renderTextWithLinks(line)}</p>;
                      })}
                  </div>

                  {/* Telegram CTA */}
                  <div className="mt-6 p-6 bg-gradient-to-r from-brand-forest to-brand-forest-dark rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-mint/20 rounded-full blur-2xl -z-1" />
                      <div className="flex flex-col items-center text-center gap-4">
                          <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-md">
                              <Activity className="w-8 h-8 text-brand-mint" />
                          </div>
                          <div className="space-y-1">
                              <h3 className="font-bold text-lg">Ваш следующий шаг: Telegram-бот</h3>
                              <p className="text-xs text-white/80 max-w-xs">Запустите мониторинг питания, сна и активности прямо сейчас.</p>
                          </div>
                          <a 
                            href="https://t.me/SayAndSaveBot" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full px-6 py-4 bg-white text-brand-forest rounded-2xl font-bold shadow-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-95"
                          >
                            Запустить @SayAndSaveBot <ChevronRight className="w-4 h-4" />
                          </a>
                      </div>
                  </div>

                  {/* Actions for Saving */}
                  <div className="mt-4 space-y-3">
                      {user ? (
                          <button 
                            onClick={handleSaveToRecommendations}
                            disabled={isSaving || saveSuccess}
                            className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all transform hover:scale-[1.01] active:scale-98
                                ${saveSuccess 
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                                    : 'bg-brand-mint text-brand-forest hover:bg-brand-mint/90'}`}
                          >
                              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                              {saveSuccess ? 'Сохранено в Назначения!' : 'Сохранить рекомендации в Кабинет'}
                          </button>
                      ) : (
                          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex flex-col items-center gap-3 text-center">
                              <p className="text-xs font-semibold text-amber-800">Чтобы сохранить рекомендации в Личный Кабинет, необходимо зарегистрироваться.</p>
                              <a href="/register" className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm shadow-md transition-all">
                                  Зарегистрироваться
                              </a>
                          </div>
                      )}

                      <button 
                        onClick={onClose}
                        className="w-full py-3 text-sm font-bold text-slate-400 hover:text-brand-forest transition-all"
                      >
                        Закрыть окно
                      </button>
                  </div>
              </div>
          )}

        </div>
      </div>
    </div>
  );
}

