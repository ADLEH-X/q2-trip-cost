'use client';

import React, { useState } from 'react';
import { getTranslation, Language } from '@/lib/translations';
import { X, Send, MessageSquare, Check, Sparkles } from 'lucide-react';
import { analytics } from '@/lib/services/analytics';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export default function FeedbackModal({ isOpen, onClose, language }: FeedbackModalProps) {
  const [category, setCategory] = useState<'toll_issue' | 'car_request' | 'general'>('toll_issue');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    analytics.track('feedback_opened', {
      category,
      messageLength: message.length,
    });

    // Generate mailto link as reliable zero-cost fallback
    const subject = encodeURIComponent(`[YolPay Feedback] ${category}`);
    const body = encodeURIComponent(`Category: ${category}\n\nMessage:\n${message}\n\nApp: YolPay Istanbul PWA`);
    const mailto = `mailto:feedback@yolpay.app?subject=${subject}&body=${body}`;

    // Open mail client or copy to clipboard
    window.location.href = mailto;

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setMessage('');
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#121212] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
              <MessageSquare size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {language === 'tr' ? 'Geri Bildirim & İstek' : 'Feedback & Requests'}
              </h2>
              <p className="text-xs text-neutral-400">
                {language === 'tr' ? 'Hatalı bir ücret mi gördünüz veya yeni araç mı istiyorsunuz?' : 'Found an incorrect toll or want a new car model?'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Check size={24} />
            </div>
            <h3 className="font-semibold text-lg text-white">
              {language === 'tr' ? 'Teşekkürler!' : 'Thank you!'}
            </h3>
            <p className="text-xs text-neutral-400 max-w-xs">
              {language === 'tr' ? 'Geri bildiriminiz için teşekkürler, inceleyip güncelleyeceğiz.' : 'Your feedback was prepared in your email client.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Category Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                {language === 'tr' ? 'Kategori' : 'Category'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCategory('toll_issue')}
                  className={`px-2.5 py-2 text-xs font-medium rounded-xl border transition-all text-center ${category === 'toll_issue' ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-white/5 border-white/5 text-neutral-400 hover:bg-white/10'}`}
                >
                  {language === 'tr' ? 'Ücret / Rota' : 'Tolls / Route'}
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('car_request')}
                  className={`px-2.5 py-2 text-xs font-medium rounded-xl border transition-all text-center ${category === 'car_request' ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-white/5 border-white/5 text-neutral-400 hover:bg-white/10'}`}
                >
                  {language === 'tr' ? 'Araç İsteği' : 'New Car'}
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('general')}
                  className={`px-2.5 py-2 text-xs font-medium rounded-xl border transition-all text-center ${category === 'general' ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-white/5 border-white/5 text-neutral-400 hover:bg-white/10'}`}
                >
                  {language === 'tr' ? 'Görüş / Öneri' : 'General'}
                </button>
              </div>
            </div>

            {/* Message Area */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
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
                className="w-full bg-white/5 border border-white/10 focus:border-red-500/50 rounded-2xl p-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-500/50 transition-all resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full mt-1 py-3 px-4 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-red-900/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send size={14} />
              <span>{language === 'tr' ? 'Geri Bildirimi Gönder' : 'Send Feedback'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
