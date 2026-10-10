'use client';

import React, { useState, useEffect } from 'react';
import { Language } from '@/lib/translations';
import { X, Send, MessageSquare, Check } from 'lucide-react';
import { analytics } from '@/lib/services/analytics';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  theme?: 'dark' | 'light';
}

export default function FeedbackModal({ isOpen, onClose, language, theme = 'dark' }: FeedbackModalProps) {
  const [category, setCategory] = useState<'toll_issue' | 'car_request' | 'general'>('toll_issue');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    analytics.track('feedback_opened', {
      category,
      messageLength: message.length,
    });

    // Save locally in localStorage so feedback is never lost
    try {
      const storageKey = 'yolpay_user_feedback';
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      existing.unshift({
        category,
        message,
        date: new Date().toISOString(),
        theme,
        language,
      });
      localStorage.setItem(storageKey, JSON.stringify(existing.slice(0, 50)));
    } catch {
      // safe fallback
    }

    // Format mailto link
    const subject = encodeURIComponent(`[YolPay Feedback] ${category}`);
    const body = encodeURIComponent(
      `Category: ${category}\nLanguage: ${language}\n\nMessage:\n${message}\n\nSent via YolPay Web App`
    );
    const mailto = `mailto:feedback@yolpay.app?subject=${subject}&body=${body}`;

    // Also copy to clipboard for convenience if email client doesn't launch
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`Category: ${category}\n${message}`).catch(() => {});
    }

    // Try opening mailto
    try {
      window.location.href = mailto;
    } catch {
      // safe fallback
    }

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setMessage('');
      onClose();
    }, 2500);
  };

  const isLight = theme === 'light';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className={`relative w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col gap-5 border transition-colors ${
          isLight 
            ? 'bg-white border-neutral-200 text-neutral-900 shadow-xl' 
            : 'bg-[#121212] border-white/10 text-white shadow-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-2xl border flex items-center justify-center ${
              isLight 
                ? 'bg-red-50 border-red-200 text-red-600' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              <MessageSquare size={18} />
            </div>
            <div>
              <h2 className={`text-lg font-bold tracking-tight ${isLight ? 'text-neutral-900' : 'text-white'}`}>
                {language === 'tr' ? 'Geri Bildirim & İstek' : 'Feedback & Requests'}
              </h2>
              <p className={`text-xs ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                {language === 'tr' 
                  ? 'Ücret hatası veya yeni araç modeli bildirin' 
                  : 'Report a toll issue or request a new car model'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isLight 
                ? 'text-neutral-400 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200' 
                : 'text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10'
            }`}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
              <Check size={24} />
            </div>
            <h3 className={`font-bold text-lg ${isLight ? 'text-neutral-900' : 'text-white'}`}>
              {language === 'tr' ? 'Teşekkürler!' : 'Thank you!'}
            </h3>
            <p className={`text-xs max-w-xs ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
              {language === 'tr' 
                ? 'Geri bildiriminiz kaydedildi. E-posta uygulamanız açılıyor...' 
                : 'Your feedback was saved and prepared in your email client.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Category Select */}
            <div className="flex flex-col gap-1.5">
              <label className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                {language === 'tr' ? 'Kategori' : 'Category'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCategory('toll_issue')}
                  className={`px-2.5 py-2 text-xs font-semibold rounded-xl border transition-all text-center ${
                    category === 'toll_issue' 
                      ? 'bg-red-500/15 border-red-500/40 text-red-600 shadow-sm' 
                      : isLight 
                        ? 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:bg-neutral-200' 
                        : 'bg-white/5 border-white/5 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  {language === 'tr' ? 'Ücret / Rota' : 'Tolls / Route'}
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('car_request')}
                  className={`px-2.5 py-2 text-xs font-semibold rounded-xl border transition-all text-center ${
                    category === 'car_request' 
                      ? 'bg-red-500/15 border-red-500/40 text-red-600 shadow-sm' 
                      : isLight 
                        ? 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:bg-neutral-200' 
                        : 'bg-white/5 border-white/5 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  {language === 'tr' ? 'Araç İsteği' : 'New Car'}
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('general')}
                  className={`px-2.5 py-2 text-xs font-semibold rounded-xl border transition-all text-center ${
                    category === 'general' 
                      ? 'bg-red-500/15 border-red-500/40 text-red-600 shadow-sm' 
                      : isLight 
                        ? 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:bg-neutral-200' 
                        : 'bg-white/5 border-white/5 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  {language === 'tr' ? 'Görüş / Öneri' : 'General'}
                </button>
              </div>
            </div>

            {/* Message Area */}
            <div className="flex flex-col gap-1.5">
              <label className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                {language === 'tr' ? 'Mesajınız' : 'Your Message'}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  language === 'tr'
                    ? 'Örn: Avrasya Tüneli gece tarifesi veya Mercedes Vito yakıt tüketimi hakkında...'
                    : 'e.g. Note about bridge toll rates, or asking for a specific car model...'
                }
                rows={4}
                required
                className={`w-full rounded-2xl p-3.5 text-sm outline-none transition-all resize-none border ${
                  isLight 
                    ? 'bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus:border-red-500 focus:bg-white focus:ring-1 focus:ring-red-500' 
                    : 'bg-white/5 border-white/10 text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50'
                }`}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full mt-1 py-3 px-4 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-red-900/25 flex items-center justify-center gap-2 cursor-pointer hover:shadow-red-900/40 active:scale-[0.99]"
            >
              <Send size={14} className="text-white" />
              <span className="text-white font-bold">{language === 'tr' ? 'Geri Bildirimi Gönder' : 'Send Feedback'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
