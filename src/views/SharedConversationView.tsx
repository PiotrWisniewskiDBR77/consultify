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
    <div className="min-h-screen bg-c-bg">
      <header className="border-b border-c-border bg-c-surface/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-2">
          <MessageSquare size={18} className="text-c-accent" />
          <span className="text-sm font-semibold text-c-text">Consultify</span>
          <span className="text-xs text-c-text-muted">· shared conversation</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {status === 'loading' && (
          <div className="py-20 text-center text-sm text-c-text-muted">Loading…</div>
        )}

        {status === 'notfound' && (
          <div className="py-20 text-center">
            <div className="text-lg font-semibold text-c-text">
              This link is no longer available
            </div>
            <p className="mt-2 text-sm text-c-text-muted">
              The shared conversation may have been removed or the link has expired.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="py-20 text-center text-sm text-c-danger">
            Something went wrong loading this conversation.
          </div>
        )}

        {status === 'password' && (
          <div className="mx-auto max-w-sm py-16 text-center">
            <Lock size={28} className="mx-auto text-c-text-muted" />
            <div className="mt-3 text-base font-semibold text-c-text">
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
                className="flex-1 rounded-xl border border-c-border bg-c-surface px-3 py-2 text-sm outline-none focus:border-c-focus-solid"
              />
              <button
                onClick={() => void load(password)}
                className="rounded-xl bg-c-accent hover:opacity-90 text-white px-4 py-2 text-sm font-semibold"
              >
                View
              </button>
            </div>
          </div>
        )}

        {status === 'ok' && data && (
          <>
            <h1 className="text-2xl font-semibold text-c-text">
              {data.title || 'Conversation'}
            </h1>
            {data.description && (
              <p className="mt-1 text-sm text-c-text-muted">{data.description}</p>
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
                    <div className="max-w-[85%] rounded-2xl bg-c-accent-soft text-c-text border border-c-border px-4 py-2.5 text-sm">
                      {m.content}
                    </div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-c-text-secondary">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || ''}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <footer className="mt-16 border-t border-c-border pt-6 text-center text-xs text-c-text-muted">
              Shared with Consultify — read-only view.
            </footer>
          </>
        )}
      </main>
    </div>
  );
};

export default SharedConversationView;
