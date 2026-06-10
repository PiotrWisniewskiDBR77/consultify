/**
 * AddCardModal — honest billing state (Module 08 / decision D8).
 *
 * Live Stripe self-serve payments are DEFERRED. Billing is currently handled
 * MANUALLY (invoices + admin plan/limit assignment). This modal therefore does
 * NOT collect raw card data and NEVER submits a fake payment method.
 *
 * Behaviour by flag (`isBillingSelfServeEnabled`, default OFF):
 *   - OFF: show an honest "billing is handled manually / contact us" panel.
 *   - ON:  attempt a real Stripe SetupIntent (`/billing/setup-intent`, which
 *          only succeeds when `STRIPE_SECRET_KEY` is configured server-side).
 *          Until Stripe Elements (`@stripe/react-stripe-js`) is wired, we still
 *          do not collect a card here — we surface the readiness state instead.
 *          There is no fake-success path under any flag combination.
 */

import { Building2, CreditCard, Loader2, Mail, Shield } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Modal } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { isBillingSelfServeEnabled } from '../../utils/billingSelfServeFlag';

interface AddCardModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type SetupIntentState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; clientSecret: string; id: string }
  | { status: 'unavailable' };

const BILLING_CONTACT_EMAIL = 'billing@consultify.app';

export const AddCardModal: React.FC<AddCardModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const selfServeEnabled = isBillingSelfServeEnabled();
  const [intent, setIntent] = useState<SetupIntentState>({
    status: selfServeEnabled ? 'loading' : 'idle',
  });

  // Only probe Stripe when self-serve is explicitly enabled. We never fall
  // back to a mock payment method — if the SetupIntent cannot be created
  // (e.g. no STRIPE_SECRET_KEY) we surface the honest "unavailable" state.
  useEffect(() => {
    if (!selfServeEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await Api.createSetupIntent();
        if (cancelled) return;
        if (result?.clientSecret && result?.id) {
          setIntent({ status: 'ready', clientSecret: result.clientSecret, id: result.id });
        } else {
          setIntent({ status: 'unavailable' });
        }
      } catch {
        if (!cancelled) setIntent({ status: 'unavailable' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selfServeEnabled]);

  const renderManualBody = () => (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-navy-700 dark:bg-white/5">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-crimson-50 text-crimson-600 dark:bg-crimson-500/10 dark:text-crimson-400">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-slate-900 dark:text-white">
            {t('billing.addCard.manual.title', 'Billing is handled manually')}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t(
              'billing.addCard.manual.body',
              'Self-serve card payments are not enabled for your account yet. Your plan and invoices are managed directly with our team — no card is required here.'
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Mail className="h-4 w-4 flex-shrink-0" />
        <span>
          {t('billing.addCard.manual.contactPrefix', 'Questions about billing? Contact')}{' '}
          <a
            href={`mailto:${BILLING_CONTACT_EMAIL}`}
            className="font-medium text-crimson-600 underline-offset-2 hover:underline dark:text-crimson-400"
          >
            {BILLING_CONTACT_EMAIL}
          </a>
        </span>
      </div>
    </div>
  );

  const renderProbingBody = () => {
    if (intent.status === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-slate-500 dark:text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-crimson-600 dark:text-crimson-400" />
          <p className="text-sm">
            {t('billing.addCard.checking', 'Checking payment configuration…')}
          </p>
        </div>
      );
    }

    if (intent.status === 'ready') {
      // Stripe is configured server-side, but client-side Stripe Elements is
      // not wired yet. We deliberately do NOT collect a card here to avoid a
      // fake/insecure flow. Owner action: install @stripe/react-stripe-js and
      // mount <PaymentElement> with this clientSecret.
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t(
                'billing.addCard.elementsPending',
                'Secure card entry is being finalised. Stripe is connected, but the in-app card form is not available yet — please contact us to complete setup.'
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Mail className="h-4 w-4 flex-shrink-0" />
            <a
              href={`mailto:${BILLING_CONTACT_EMAIL}`}
              className="font-medium text-crimson-600 underline-offset-2 hover:underline dark:text-crimson-400"
            >
              {BILLING_CONTACT_EMAIL}
            </a>
          </div>
        </div>
      );
    }

    // 'unavailable' — Stripe not configured server-side.
    return renderManualBody();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={t('billing.addCard.title', 'Payment Method')}
      description={t('billing.addCard.subtitle', 'How billing works for your account')}
      footer={
        <div className="flex justify-end">
          <Button variant="brand" onClick={onClose} data-testid="add-card-close">
            {t('common.close', 'Close')}
          </Button>
        </div>
      }
    >
      <div className="flex items-center gap-2 pb-4 text-sm text-slate-500 dark:text-slate-400">
        <CreditCard className="h-4 w-4 text-crimson-600 dark:text-crimson-400" />
        <span>{t('billing.addCard.secureNote', 'Payments are processed securely.')}</span>
      </div>
      {selfServeEnabled ? renderProbingBody() : renderManualBody()}
    </Modal>
  );
};

export default AddCardModal;
