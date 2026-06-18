/**
 * SharedConversationView (F4)
 *
 * Public, read-only viewer for a shared conversation (route /share/:token).
 * No auth required — fetches the backend's public GET /api/share/:token.
 */
import { Lock, MessageSquare } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import { Api } from '../services/api';

interface ShareMessage {
  id: string;
  role: string;
  content: string;
  timestamp?: string;
}
interface ShareData {
  title?: string;
  description?: string;
  messages: ShareMessage[];
  settings?: { showTimestamps?: boolean };
}

export const SharedConversationView: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'password' | 'error'>(
    'loading'
  );
  const [password, setPassword] = useState('');

  // Chat P0-2 — password is submitted via POST unlock endpoint (sets an
  // HttpOnly cookie), then the GET reads it. No password in the URL.
  const load = useCallback(
    async (pw?: string) => {
      setStatus('loading');
      try {
        if (pw) {
          try {
            await Api.unlockPublicShare(token, pw);
          } catch (unlockErr: any) {
            const msg = String(unlockErr?.message || '').toLowerCase();
            if (msg.includes('too many')) {
              setStatus('error');
              return;
            }
            // Likely an incorrect password — fall through to the password
            // screen so the user can retry.
            setStatus('password');
            return;
          }
        }
        const res: any = await Api.getPublicShare(token);
        setData(res);
        setStatus('ok');
      } catch (err: any) {
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('password')) setStatus('password');
        else if (msg.includes('not found') || msg.includes('expired')) setStatus('notfound');
        else setStatus('error');
      }
    },
    [token]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950">
      <header className="border-b border-slate-200 dark:border-navy-800 bg-white/80 dark:bg-navy-900/60 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-2">
          <MessageSquare size={18} className="text-primary-600" />
          <span className="text-sm font-semibold text-navy-900 dark:text-white">Consultify</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">· shared conversation</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {status === 'loading' && (
          <div className="py-20 text-center text-sm text-slate-500">Loading…</div>
        )}

        {status === 'notfound' && (
          <div className="py-20 text-center">
            <div className="text-lg font-semibold text-navy-900 dark:text-white">
              This link is no longer available
            </div>
            <p className="mt-2 text-sm text-slate-500">
              The shared conversation may have been removed or the link has expired.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="py-20 text-center text-sm text-rose-600">
            Something went wrong loading this conversation.
          </div>
        )}

        {status === 'password' && (
          <div className="mx-auto max-w-sm py-16 text-center">
            <Lock size={28} className="mx-auto text-slate-400" />
            <div className="mt-3 text-base font-semibold text-navy-900 dark:text-white">
              Password protected
            </div>
            <div className="mt-4 flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void load(password);
                }}
                placeholder="Enter password"
                className="flex-1 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
              <button
                onClick={() => void load(password)}
                className="rounded-xl bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] px-4 py-2 text-sm font-semibold"
              >
                View
              </button>
            </div>
          </div>
        )}

        {status === 'ok' && data && (
          <>
            <h1 className="text-2xl font-semibold text-navy-900 dark:text-white">
              {data.title || 'Conversation'}
            </h1>
            {data.description && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{data.description}</p>
            )}
            <div className="mt-8 space-y-8">
              {data.messages?.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'
                  }
                >
                  {m.role === 'user' ? (
                    <div className="max-w-[85%] rounded-2xl bg-primary-50 text-primary-900 border border-primary-100 px-4 py-2.5 text-sm dark:bg-primary-900/25 dark:text-primary-50 dark:border-primary-800/40">
                      {m.content}
                    </div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-200">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || ''}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <footer className="mt-16 border-t border-slate-200 dark:border-navy-800 pt-6 text-center text-xs text-slate-400">
              Shared with Consultify — read-only view.
            </footer>
          </>
        )}
      </main>
    </div>
  );
};

export default SharedConversationView;
