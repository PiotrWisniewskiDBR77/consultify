import type Stripe from 'stripe';
import type { Stripe as StripeTypes } from 'stripe';

import logger from '../../utils/Logger.js';
import { templateExists as emailTemplateExists } from '../email/emailTemplateRenderer.js';
import { BillingEventService } from './BillingEventService.js';
import { BillingQueryService } from './BillingQueryService.js';
import { assertSandboxAllowed } from './billingSandboxGuard.js';
import type {
  BillingPlan,
  BillingServiceDependencies,
  CreatePlanData,
  CreateUserPlanData,
  DiscountValidationResult,
  Invoice,
  OrganizationBilling,
  PaymentMethod,
  SeatCost,
  SetupIntent,
  UpdateBillingAlertsData,
  UpdatePlanData,
  UpdateTaxSettingsData,
  UpdateUserPlanData,
  UpsertBillingData,
} from './types.js';

type DepsAccessor = () => BillingServiceDependencies;

export class BillingCommandService {
  constructor(
    private readonly getDeps: DepsAccessor,
    private readonly queryService: BillingQueryService,
    private readonly eventService: BillingEventService
  ) {}

  private deps() {
    return this.getDeps();
  }

  private normalizeDateInput(
    value: Date | string | null | undefined
  ): Date | string | null | undefined {
    if (value == null) return value;
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }

  async createPlan(planData: CreatePlanData): Promise<BillingPlan> {
    const deps = this.deps();
    const id = `plan-${deps.uuidv4()}`;
    const featuresJson = JSON.stringify(planData.features || {});

    await (deps.db.run(
      `INSERT INTO subscription_plans (id, name, price_monthly, token_limit, storage_limit_gb, token_overage_rate, storage_overage_rate, stripe_price_id, features, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        planData.name,
        planData.price_monthly,
        planData.token_limit || null,
        planData.storage_limit_gb || null,
        planData.token_overage_rate || null,
        planData.storage_overage_rate || null,
        planData.stripe_price_id || null,
        featuresJson,
      ]
    ) as Promise<any>);

    return { id, ...planData, features: planData.features || {}, is_active: 1 };
  }

  async updatePlan(
    planId: string,
    updates: UpdatePlanData
  ): Promise<{ id: string; changes: number } | null> {
    const deps = this.deps();
    const allowedFields: Array<keyof UpdatePlanData> = [
      'name',
      'price_monthly',
      'token_limit',
      'storage_limit_gb',
      'token_overage_rate',
      'storage_overage_rate',
      'stripe_price_id',
      'features',
      'is_active',
    ];
    const fields: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        let value = updates[field];
        if (field === 'features' && typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(planId);
    const result: any = await (deps.db.run(
      `UPDATE subscription_plans SET ${fields.join(', ')} WHERE id = ?`,
      values
    ) as Promise<any>);

    return { id: planId, changes: result.changes || 0 };
  }

  async deletePlan(planId: string): Promise<{ id: string; changes: number } | null> {
    return this.updatePlan(planId, { is_active: 0 });
  }

  async createUserPlan(planData: CreateUserPlanData): Promise<void> {
    const deps = this.deps();
    const id = `license-${deps.uuidv4()}`;
    const featuresJson = JSON.stringify(planData.features || {});

    await (deps.db.run(
      `INSERT INTO user_license_plans (id, name, price_monthly, features, is_active)
             VALUES (?, ?, ?, ?, 1)`,
      [id, planData.name, planData.price_monthly, featuresJson]
    ) as Promise<any>);
  }

  async updateUserPlan(
    planId: string,
    updates: UpdateUserPlanData
  ): Promise<{ id: string; changes: number } | null> {
    const deps = this.deps();
    const allowedFields: Array<keyof UpdateUserPlanData> = [
      'name',
      'price_monthly',
      'features',
      'is_active',
    ];
    const fields: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        let value = updates[field];
        if (field === 'features' && typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(planId);
    const result: any = await (deps.db.run(
      `UPDATE user_license_plans SET ${fields.join(', ')} WHERE id = ?`,
      values
    ) as Promise<any>);

    return { id: planId, changes: result.changes || 0 };
  }

  async deleteUserPlan(planId: string): Promise<{ id: string; changes: number } | null> {
    return this.updateUserPlan(planId, { is_active: 0 });
  }

  async upsertOrgBilling(
    orgId: string,
    billingData: UpsertBillingData
  ): Promise<OrganizationBilling> {
    assertSandboxAllowed(orgId, 'billing.upsertOrgBilling');
    const deps = this.deps();
    const id = `billing-${deps.uuidv4()}`;
    const normalizedCurrentPeriodStart = this.normalizeDateInput(billingData.current_period_start);
    const normalizedCurrentPeriodEnd = this.normalizeDateInput(billingData.current_period_end);
    const normalizedRenewalAt = this.normalizeDateInput(billingData.renewal_at);
    const normalizedGraceUntil = this.normalizeDateInput(billingData.grace_until);
    const normalizedAccessExpiresAt = this.normalizeDateInput(billingData.access_expires_at);

    await (deps.db.run(
      `INSERT INTO organization_billing (
             id, organization_id, subscription_plan_id, billing_rail, contract_status, contract_type,
             renewal_at, grace_until, access_expires_at, external_invoice_ref, notes,
             managed_by_user_id, is_manual_override, stripe_customer_id, stripe_subscription_id,
             billing_email, status, current_period_start, current_period_end
           )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(organization_id) DO UPDATE SET
             subscription_plan_id = excluded.subscription_plan_id,
             billing_rail = COALESCE(excluded.billing_rail, organization_billing.billing_rail),
             contract_status = COALESCE(excluded.contract_status, organization_billing.contract_status),
             contract_type = COALESCE(excluded.contract_type, organization_billing.contract_type),
             renewal_at = COALESCE(excluded.renewal_at, organization_billing.renewal_at),
             grace_until = COALESCE(excluded.grace_until, organization_billing.grace_until),
             access_expires_at = COALESCE(excluded.access_expires_at, organization_billing.access_expires_at),
             external_invoice_ref = COALESCE(excluded.external_invoice_ref, organization_billing.external_invoice_ref),
             notes = COALESCE(excluded.notes, organization_billing.notes),
             managed_by_user_id = COALESCE(excluded.managed_by_user_id, organization_billing.managed_by_user_id),
             is_manual_override = COALESCE(excluded.is_manual_override, organization_billing.is_manual_override),
             stripe_customer_id = COALESCE(excluded.stripe_customer_id, organization_billing.stripe_customer_id),
             stripe_subscription_id = COALESCE(excluded.stripe_subscription_id, organization_billing.stripe_subscription_id),
             billing_email = COALESCE(excluded.billing_email, organization_billing.billing_email),
             status = COALESCE(excluded.status, organization_billing.status),
             current_period_start = COALESCE(excluded.current_period_start, organization_billing.current_period_start),
             current_period_end = COALESCE(excluded.current_period_end, organization_billing.current_period_end),
             updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        orgId,
        billingData.subscription_plan_id ?? null,
        billingData.billing_rail ?? null,
        billingData.contract_status ?? null,
        billingData.contract_type ?? null,
        normalizedRenewalAt ?? null,
        normalizedGraceUntil ?? null,
        normalizedAccessExpiresAt ?? null,
        billingData.external_invoice_ref ?? null,
        billingData.notes ?? null,
        billingData.managed_by_user_id ?? null,
        billingData.is_manual_override == null
          ? null
          : Number(Boolean(billingData.is_manual_override)),
        billingData.stripe_customer_id ?? null,
        billingData.stripe_subscription_id ?? null,
        billingData.billing_email ?? null,
        billingData.status || 'active',
        normalizedCurrentPeriodStart ?? null,
        normalizedCurrentPeriodEnd ?? null,
      ]
    ) as Promise<any>);

    const result = {
      id,
      organization_id: orgId,
      status: billingData.status || 'active',
      ...billingData,
    };

    this.eventService.emitEvent('billing.org.updated', result);
    return result as OrganizationBilling;
  }

  async getOrCreateStripeCustomer(
    orgId: string,
    email: string,
    orgName: string
  ): Promise<StripeTypes.Customer | { id: string; email: string }> {
    const deps = this.deps();
    const billing = await this.queryService.getOrganizationBilling(orgId);

    if (!deps.stripe) {
      return { id: `mock_cus_${orgId}`, email };
    }

    if (billing?.stripe_customer_id) {
      return (await deps.stripe.customers.retrieve(
        billing.stripe_customer_id
      )) as StripeTypes.Customer;
    }

    // GAP-INVOICE-002: Get tax settings to include VAT ID
    const taxSettings = await this.queryService.getTaxSettings(orgId);

    // Build customer create params with VAT if available
    const customerParams: StripeTypes.CustomerCreateParams = {
      email,
      name: taxSettings?.billing_name || orgName,
      metadata: { organization_id: orgId },
    };

    // Add address if available
    if (taxSettings?.billing_address_line1) {
      customerParams.address = {
        line1: taxSettings.billing_address_line1,
        line2: taxSettings.billing_address_line2 || undefined,
        city: taxSettings.billing_city || undefined,
        state: taxSettings.billing_state || undefined,
        postal_code: taxSettings.billing_postal_code || undefined,
        country: taxSettings.billing_country || undefined,
      };
    }

    // Add VAT ID if available
    if (taxSettings?.tax_id && taxSettings?.tax_id_type) {
      customerParams.tax_id_data = [
        {
          type: this.mapTaxIdType(taxSettings.tax_id_type),
          value: taxSettings.tax_id,
        },
      ];
    }

    // Set tax exempt status
    if (taxSettings?.tax_exempt) {
      customerParams.tax_exempt = 'exempt';
    }

    const customer = await deps.stripe.customers.create(customerParams);

    await this.upsertOrgBilling(orgId, { stripe_customer_id: customer.id });
    return customer;
  }

  /**
   * Map internal tax ID type to Stripe tax ID type
   * GAP-INVOICE-002
   */
  private mapTaxIdType(taxIdType: string): StripeTypes.CustomerCreateParams.TaxIdDatum['type'] {
    const mapping: Record<string, StripeTypes.CustomerCreateParams.TaxIdDatum['type']> = {
      VAT: 'eu_vat',
      eu_vat: 'eu_vat',
      US_EIN: 'us_ein',
      us_ein: 'us_ein',
      GB_VAT: 'gb_vat',
      gb_vat: 'gb_vat',
      AU_ABN: 'au_abn',
      au_abn: 'au_abn',
      NZ_GST: 'nz_gst',
      nz_gst: 'nz_gst',
    };
    return mapping[taxIdType] || 'eu_vat';
  }

  /**
   * Update Stripe customer with new tax settings
   * GAP-INVOICE-002
   */
  async syncTaxSettingsToStripe(orgId: string): Promise<void> {
    const deps = this.deps();
    if (!deps.stripe) return;

    const billing = await this.queryService.getOrganizationBilling(orgId);
    if (!billing?.stripe_customer_id) return;

    const taxSettings = await this.queryService.getTaxSettings(orgId);

    // Update customer address
    const updateParams: StripeTypes.CustomerUpdateParams = {};

    if (taxSettings?.billing_name) {
      updateParams.name = taxSettings.billing_name;
    }

    if (taxSettings?.billing_address_line1) {
      updateParams.address = {
        line1: taxSettings.billing_address_line1,
        line2: taxSettings.billing_address_line2 || undefined,
        city: taxSettings.billing_city || undefined,
        state: taxSettings.billing_state || undefined,
        postal_code: taxSettings.billing_postal_code || undefined,
        country: taxSettings.billing_country || undefined,
      };
    }

    updateParams.tax_exempt = taxSettings?.tax_exempt ? 'exempt' : 'none';

    await deps.stripe.customers.update(billing.stripe_customer_id, updateParams);

    // Handle tax ID separately (need to delete old and add new)
    if (taxSettings?.tax_id && taxSettings?.tax_id_type) {
      try {
        // Get existing tax IDs
        const existingTaxIds = await deps.stripe.customers.listTaxIds(billing.stripe_customer_id);

        // Delete existing tax IDs
        for (const taxId of existingTaxIds.data) {
          await deps.stripe.customers.deleteTaxId(billing.stripe_customer_id, taxId.id);
        }

        // Add new tax ID
        await deps.stripe.customers.createTaxId(billing.stripe_customer_id, {
          type: this.mapTaxIdType(taxSettings.tax_id_type),
          value: taxSettings.tax_id,
        });
      } catch (err) {
        logger.warn('[BillingCommandService] Error syncing tax ID to Stripe:', err);
      }
    }
  }

  /**
   * Get active partner discount for organization
   * GAP-PARTNER-002: Integration with organization_discounts table
   */
  async getPartnerDiscount(
    orgId: string
  ): Promise<{ discountPercent: number; couponId?: string } | null> {
    const deps = this.deps();
    try {
      const discount = await deps.db.get<{
        discount_type: string;
        discount_value: number;
        partner_org_id: string;
        end_date: string;
      }>(
        `SELECT discount_type, discount_value, partner_org_id, end_date 
                 FROM organization_discounts 
                 WHERE organization_id = ? 
                   AND status = 'ACTIVE' 
                   AND (end_date IS NULL OR end_date > datetime('now'))
                 ORDER BY created_at DESC 
                 LIMIT 1`,
        [orgId]
      );

      if (discount && discount.discount_type === 'PERCENTAGE' && discount.discount_value > 0) {
        return { discountPercent: discount.discount_value };
      }
      return null;
    } catch (err) {
      logger.error('[BillingCommandService] Error fetching partner discount:', err);
      return null;
    }
  }

  async createSubscription(
    orgId: string,
    planId: string,
    paymentMethodId: string,
    email: string,
    orgName: string
  ): Promise<StripeTypes.Subscription | { id: string; status: string; plan: BillingPlan }> {
    const deps = this.deps();
    const plan = await this.queryService.getPlanById(planId);
    if (!plan) {
      throw new Error('Invalid plan');
    }

    const billing = await this.queryService.getOrganizationBilling(orgId);
    if (billing?.billing_rail === 'manual_invoice' && billing?.is_manual_override) {
      throw new Error('Organization is managed manually. Update the contract from admin billing.');
    }

    if (!deps.stripe) {
      // B8 fix: never silently activate a paid subscription without a payment processor
      // in production — that marks an org as "active" without any charge. The mock path
      // is only acceptable in non-production (dev/demo) environments.
      const isProd = process.env.NODE_ENV === 'production';
      const allowMock = !isProd || process.env.ALLOW_MOCK_BILLING === 'true';
      if (!allowMock) {
        throw new Error(
          'Billing is not configured (Stripe unavailable). Cannot activate a subscription. ' +
            'Configure STRIPE_SECRET_KEY or use manual invoice billing from admin.'
        );
      }
      await this.upsertOrgBilling(orgId, {
        subscription_plan_id: planId,
        billing_rail: 'stripe_subscription',
        stripe_subscription_id: `mock_sub_${orgId}`,
        status: 'active',
        contract_status: undefined,
        is_manual_override: false,
      });
      return { id: `mock_sub_${orgId}`, status: 'active', plan };
    }

    const customer = (await this.getOrCreateStripeCustomer(
      orgId,
      email,
      orgName
    )) as StripeTypes.Customer;
    await deps.stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
    await deps.stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // GAP-PARTNER-002: Check for partner discount and apply to subscription
    const partnerDiscount = await this.getPartnerDiscount(orgId);
    let couponId: string | undefined;

    if (partnerDiscount && deps.stripe) {
      try {
        // Create a coupon in Stripe for the partner discount
        const coupon = await deps.stripe.coupons.create({
          percent_off: partnerDiscount.discountPercent,
          duration: 'repeating',
          duration_in_months: 12, // Default 12 months partner discount
          name: `Partner Discount - ${partnerDiscount.discountPercent}%`,
          metadata: { organization_id: orgId, type: 'partner_referral' },
        });
        couponId = coupon.id;
        logger.info(
          `[BillingCommandService] Created partner discount coupon ${couponId} for org ${orgId}: ${partnerDiscount.discountPercent}%`
        );
      } catch (couponErr) {
        logger.error('[BillingCommandService] Error creating partner discount coupon:', couponErr);
        // Continue without discount - don't fail the subscription
      }
    }

    const subscriptionParams: StripeTypes.SubscriptionCreateParams = {
      customer: customer.id,
      items: [{ price: plan.stripe_price_id || '' }],
      expand: ['latest_invoice.payment_intent'],
      // Apply partner discount coupon if available
      ...(couponId && { discounts: [{ coupon: couponId }] }),
    };

    const subscription = await deps.stripe.subscriptions.create(subscriptionParams);

    await this.upsertOrgBilling(orgId, {
      subscription_plan_id: planId,
      billing_rail: 'stripe_subscription',
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      contract_status: undefined,
      is_manual_override: false,
      current_period_start: (subscription as any).current_period_start
        ? new Date((subscription as any).current_period_start * 1000)
        : undefined,
      current_period_end: (subscription as any).current_period_end
        ? new Date((subscription as any).current_period_end * 1000)
        : undefined,
    });

    this.eventService.emitEvent('billing.subscription.created', {
      orgId,
      subscriptionId: subscription.id,
    });
    return subscription;
  }

  async cancelSubscription(
    orgId: string
  ): Promise<StripeTypes.Subscription | { status: string; accessUntil?: string }> {
    const deps = this.deps();
    const billing = await this.queryService.getOrganizationBilling(orgId);
    if (billing?.billing_rail === 'manual_invoice' && billing?.is_manual_override) {
      const accessUntil = billing.access_expires_at
        ? new Date(billing.access_expires_at).toISOString()
        : billing.current_period_end
          ? new Date(billing.current_period_end).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await this.upsertOrgBilling(orgId, {
        status: 'canceling',
        contract_status: 'renewal_due',
        access_expires_at: accessUntil,
      });
      return { status: 'canceling', accessUntil };
    }
    if (!billing?.stripe_subscription_id) {
      throw new Error('No active subscription');
    }

    if (!deps.stripe) {
      // For mock mode, set access until end of current period
      const accessUntil = billing.current_period_end
        ? new Date(billing.current_period_end).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await this.upsertOrgBilling(orgId, {
        billing_rail: 'stripe_subscription',
        status: 'canceling',
        access_expires_at: accessUntil,
      });

      // GAP-BILLING-003: Send cancellation email with grace period info
      await this.sendCancellationEmail(orgId, new Date(accessUntil));

      return { status: 'canceling', accessUntil };
    }

    // GAP-BILLING-003: Use cancel_at_period_end for grace period
    const subscription = await deps.stripe.subscriptions.update(billing.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    const periodEnd = (subscription as any).current_period_end;
    const accessUntil = periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined;

    await this.upsertOrgBilling(orgId, {
      billing_rail: 'stripe_subscription',
      status: 'canceling',
      access_expires_at: accessUntil,
    });
    this.eventService.emitEvent('billing.subscription.canceling', {
      orgId,
      subscriptionId: subscription.id,
    });

    // GAP-BILLING-003: Send cancellation email with grace period info
    if (accessUntil) {
      await this.sendCancellationEmail(orgId, new Date(accessUntil));
    }

    return subscription;
  }

  /**
   * Get grace period status for organization
   * GAP-BILLING-003
   */
  async getGracePeriodStatus(orgId: string): Promise<{
    isInGracePeriod: boolean;
    accessUntil: string | null;
    daysRemaining: number | null;
  }> {
    const deps = this.deps();
    const billing = await this.queryService.getOrganizationBilling(orgId);

    if (!billing || billing.status !== 'canceling') {
      return { isInGracePeriod: false, accessUntil: null, daysRemaining: null };
    }

    let accessUntil: Date | null = null;

    if (deps.stripe && billing.stripe_subscription_id) {
      try {
        const subscription = (await deps.stripe.subscriptions.retrieve(
          billing.stripe_subscription_id
        )) as any;
        if (subscription.cancel_at_period_end && subscription.current_period_end) {
          accessUntil = new Date(subscription.current_period_end * 1000);
        }
      } catch (err) {
        logger.warn('[BillingCommandService] Error fetching subscription:', err);
      }
    } else if (billing.access_expires_at || billing.current_period_end) {
      accessUntil = new Date((billing.access_expires_at || billing.current_period_end) as string);
    }

    if (!accessUntil) {
      return { isInGracePeriod: false, accessUntil: null, daysRemaining: null };
    }

    const now = new Date();
    const daysRemaining = Math.max(
      0,
      Math.ceil((accessUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    return {
      isInGracePeriod: true,
      accessUntil: accessUntil.toISOString(),
      daysRemaining,
    };
  }

  /**
   * Reactivate subscription during grace period
   * GAP-BILLING-003
   */
  async reactivateSubscription(orgId: string): Promise<{ success: boolean; error?: string }> {
    const deps = this.deps();
    const billing = await this.queryService.getOrganizationBilling(orgId);

    if (!billing || billing.status !== 'canceling') {
      return { success: false, error: 'No subscription in cancellation period' };
    }

    if (!deps.stripe || !billing.stripe_subscription_id) {
      await this.upsertOrgBilling(orgId, {
        status: 'active',
        contract_status:
          billing.billing_rail === 'manual_invoice'
            ? 'active'
            : (billing.contract_status ?? undefined),
        access_expires_at: undefined,
      });
      return { success: true };
    }

    try {
      await deps.stripe.subscriptions.update(billing.stripe_subscription_id, {
        cancel_at_period_end: false,
      });

      await this.upsertOrgBilling(orgId, {
        status: 'active',
        access_expires_at: null,
      });
      this.eventService.emitEvent('billing.subscription.reactivated', { orgId });

      return { success: true };
    } catch (err: any) {
      logger.error('[BillingCommandService] Error reactivating subscription:', err);
      return { success: false, error: err?.message || 'Failed to reactivate subscription' };
    }
  }

  /**
   * Send cancellation email with grace period info
   * GAP-BILLING-003
   */
  private async sendCancellationEmail(orgId: string, accessUntil: Date): Promise<void> {
    const deps = this.deps();
    try {
      const admins = await deps.db.all<{ email: string; first_name: string }>(
        `SELECT email, first_name FROM users WHERE organization_id = ? AND role IN ('ADMIN', 'SUPERADMIN')`,
        [orgId]
      );

      const org = await deps.db.get<{ name: string }>(
        `SELECT name FROM organizations WHERE id = ?`,
        [orgId]
      );

      if (!admins || admins.length === 0) return;

      const EmailService = (await import('../emailService.js')).default;
      const daysRemaining = Math.ceil((accessUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const accessUntilDate = accessUntil.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Prefer the branded billing/subscription_canceled.hbs template (Task
      // #84). When present, emailService renders the .hbs from `template`+`data`.
      // When absent, we still pass the inline generateCancellationEmailHtml()
      // as the fallback so the send is never blocked or degraded.
      const hasTemplate = emailTemplateExists('billing/subscription_canceled');

      for (const admin of admins) {
        await EmailService.send({
          to: admin.email,
          subject: 'Your Consultify subscription has been canceled',
          ...(hasTemplate
            ? { template: 'subscription_canceled' as const }
            : {
                html: this.generateCancellationEmailHtml({
                  firstName: admin.first_name,
                  orgName: org?.name || 'Your organization',
                  accessUntil: accessUntilDate,
                  daysRemaining,
                }),
              }),
          data: {
            recipientName: admin.first_name,
            firstName: admin.first_name,
            orgName: org?.name || 'Your organization',
            cancellationDate: new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            accessUntilDate,
            accessUntil: accessUntilDate,
            daysRemaining,
          },
        });
      }

      logger.info(`[BillingCommandService] Cancellation email sent for org ${orgId}`);
    } catch (err) {
      logger.warn('[BillingCommandService] Failed to send cancellation email:', err);
    }
  }

  /**
   * Generate cancellation email HTML
   */
  private generateCancellationEmailHtml(data: {
    firstName: string;
    orgName: string;
    accessUntil: string;
    daysRemaining: number;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6b7280; padding: 20px; border-radius: 8px 8px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 20px; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .access-box { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
        .access-date { font-size: 24px; font-weight: bold; color: #92400e; }
        .days-remaining { color: #b45309; margin-top: 5px; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Subscription Canceled</h1>
        </div>
        <div class="content">
            <p>Hi ${data.firstName},</p>
            
            <p>We're sorry to see you go. Your subscription for <strong>${data.orgName}</strong> has been canceled.</p>
            
            <div class="access-box">
                <p style="margin: 0 0 10px 0;">You'll continue to have full access until:</p>
                <div class="access-date">${data.accessUntil}</div>
                <div class="days-remaining">(${data.daysRemaining} days remaining)</div>
            </div>
            
            <p><strong>What happens next?</strong></p>
            <ul>
                <li>You have full access to all features until ${data.accessUntil}</li>
                <li>After this date, your account will be downgraded to the free plan</li>
                <li>Your data will be preserved - you won't lose anything</li>
                <li>You can reactivate your subscription at any time before ${data.accessUntil}</li>
            </ul>
            
            <p><strong>Changed your mind?</strong></p>
            <p>
                <a href="${process.env.FRONTEND_URL || 'https://app.consultify.com'}/settings/billing" 
                   style="display: inline-block; background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                    Reactivate Subscription
                </a>
            </p>
            
            <p>We'd love to know why you decided to cancel. Your feedback helps us improve.</p>
            
            <p>Best regards,<br>The Consultify Team</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} Consultify. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;
  }

  async changePlan(
    orgId: string,
    newPlanId: string
  ): Promise<{ status: string; plan: BillingPlan }> {
    const deps = this.deps();
    const billing = await this.queryService.getOrganizationBilling(orgId);
    const oldPlan = billing?.plan_name || 'Free';
    const newPlan = await this.queryService.getPlanById(newPlanId);

    if (!newPlan) {
      throw new Error('Invalid plan');
    }

    if (billing?.billing_rail === 'manual_invoice' && billing?.is_manual_override) {
      await this.upsertOrgBilling(orgId, {
        subscription_plan_id: newPlanId,
        status: 'active',
      });
      await this.sendPlanChangeEmail(orgId, oldPlan, newPlan);
      return { status: 'updated', plan: newPlan };
    }

    if (!deps.stripe || !billing?.stripe_subscription_id) {
      await this.upsertOrgBilling(orgId, {
        subscription_plan_id: newPlanId,
        billing_rail: 'stripe_subscription',
      });
      // GAP-BILLING-001: Send plan change email
      await this.sendPlanChangeEmail(orgId, oldPlan, newPlan);
      return { status: 'updated', plan: newPlan };
    }

    const subscription = await deps.stripe.subscriptions.retrieve(billing.stripe_subscription_id);

    await deps.stripe.subscriptions.update(billing.stripe_subscription_id, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPlan.stripe_price_id || '',
        },
      ],
      proration_behavior: 'create_prorations',
    });

    await this.upsertOrgBilling(orgId, { subscription_plan_id: newPlanId });
    this.eventService.emitEvent('billing.plan.changed', { orgId, planId: newPlanId });

    // GAP-BILLING-001: Send plan change email
    await this.sendPlanChangeEmail(orgId, oldPlan, newPlan);

    return { status: 'updated', plan: newPlan };
  }

  /**
   * Send plan change notification email
   * GAP-BILLING-001
   */
  private async sendPlanChangeEmail(
    orgId: string,
    oldPlan: string,
    newPlan: BillingPlan
  ): Promise<void> {
    const deps = this.deps();
    try {
      // Get admin users for org
      const admins = await deps.db.all<{ email: string; first_name: string }>(
        `SELECT email, first_name FROM users WHERE organization_id = ? AND role IN ('ADMIN', 'SUPERADMIN')`,
        [orgId]
      );

      const org = await deps.db.get<{ name: string }>(
        `SELECT name FROM organizations WHERE id = ?`,
        [orgId]
      );

      if (!admins || admins.length === 0) return;

      const EmailService = (await import('../emailService.js')).default;
      const isUpgrade = (newPlan.price_monthly || 0) > 0 && oldPlan === 'Free';
      const isDowngrade = oldPlan !== 'Free' && (newPlan.price_monthly || 0) === 0;

      for (const admin of admins) {
        await EmailService.send({
          to: admin.email,
          subject: `Your subscription plan has been ${isUpgrade ? 'upgraded' : isDowngrade ? 'downgraded' : 'changed'}`,
          html: this.generatePlanChangeEmailHtml({
            firstName: admin.first_name,
            orgName: org?.name || 'Your organization',
            oldPlan,
            newPlan: newPlan.name,
            newPrice: newPlan.price_monthly || 0,
            isUpgrade,
            isDowngrade,
          }),
        });
      }

      logger.info(`[BillingCommandService] Plan change email sent for org ${orgId}`);
    } catch (err) {
      logger.warn('[BillingCommandService] Failed to send plan change email:', err);
    }
  }

  /**
   * Generate plan change email HTML
   */
  private generatePlanChangeEmailHtml(data: {
    firstName: string;
    orgName: string;
    oldPlan: string;
    newPlan: string;
    newPrice: number;
    isUpgrade: boolean;
    isDowngrade: boolean;
  }): string {
    const actionText = data.isUpgrade ? 'upgraded' : data.isDowngrade ? 'downgraded' : 'changed';
    const emoji = data.isUpgrade ? '🚀' : data.isDowngrade ? '📉' : '🔄';
    const color = data.isUpgrade ? '#10b981' : data.isDowngrade ? '#f59e0b' : '#3b82f6';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${color}; padding: 20px; border-radius: 8px 8px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 20px; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .plan-box { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .plan-arrow { text-align: center; padding: 10px; font-size: 24px; }
        .plan-name { font-size: 18px; font-weight: bold; color: #1f2937; }
        .plan-price { font-size: 14px; color: #6b7280; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${emoji} Your Plan Has Been ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}</h1>
        </div>
        <div class="content">
            <p>Hi ${data.firstName},</p>
            
            <p>This email confirms that your subscription for <strong>${data.orgName}</strong> has been ${actionText}.</p>
            
            <div style="display: flex; align-items: center; justify-content: center; gap: 20px;">
                <div class="plan-box" style="flex: 1; text-align: center;">
                    <div class="plan-name">${data.oldPlan}</div>
                    <div class="plan-price">Previous plan</div>
                </div>
                <div class="plan-arrow">→</div>
                <div class="plan-box" style="flex: 1; text-align: center; border: 2px solid ${color};">
                    <div class="plan-name">${data.newPlan}</div>
                    <div class="plan-price">${data.newPrice > 0 ? `€${data.newPrice}/month` : 'Free'}</div>
                </div>
            </div>
            
            ${
              data.isUpgrade
                ? `
            <p>🎉 Welcome to ${data.newPlan}! You now have access to additional features and increased limits.</p>
            `
                : data.isDowngrade
                  ? `
            <p>Your plan has been downgraded. Some features may no longer be available. You can upgrade again at any time.</p>
            `
                  : `
            <p>Your plan change has been processed successfully.</p>
            `
            }
            
            <p>
                <a href="${process.env.FRONTEND_URL || 'https://app.consultify.com'}/settings/billing" 
                   style="display: inline-block; background: ${color}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                    View Billing Details
                </a>
            </p>
            
            <p>If you have any questions, please contact our support team.</p>
            
            <p>Best regards,<br>The Consultify Team</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} Consultify. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;
  }

  async recordInvoice(orgId: string, stripeInvoice: StripeTypes.Invoice): Promise<{ id: string }> {
    const deps = this.deps();
    const id = `inv-${deps.uuidv4()}`;

    await (deps.db.run(
      `INSERT OR REPLACE INTO invoices (id, organization_id, source, stripe_invoice_id, amount_due, amount_paid, currency, status, period_start, period_end, pdf_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        'stripe',
        stripeInvoice.id,
        stripeInvoice.amount_due ? stripeInvoice.amount_due / 100 : 0,
        stripeInvoice.amount_paid ? stripeInvoice.amount_paid / 100 : 0,
        stripeInvoice.currency,
        stripeInvoice.status,
        stripeInvoice.period_start ? new Date(stripeInvoice.period_start * 1000) : null,
        stripeInvoice.period_end ? new Date(stripeInvoice.period_end * 1000) : null,
        stripeInvoice.invoice_pdf || null,
      ]
    ) as Promise<any>);

    this.eventService.emitEvent('billing.invoice.recorded', { invoiceId: id, orgId });
    return { id };
  }

  async recordManualInvoice(
    orgId: string,
    input: {
      invoiceNumber?: string | null;
      amountDue: number;
      amountPaid?: number;
      currency?: string;
      status?: string;
      dueDate?: Date | string | null;
      periodStart?: Date | string | null;
      periodEnd?: Date | string | null;
      externalInvoiceRef?: string | null;
      lineItems?: unknown[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<{ id: string }> {
    const deps = this.deps();
    const id = `inv-${deps.uuidv4()}`;
    await (deps.db.run(
      `INSERT INTO invoices (
         id, organization_id, source, stripe_invoice_id, invoice_number, amount_due, amount_paid,
         currency, status, due_date, period_start, period_end, line_items, metadata
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        'manual',
        null,
        input.invoiceNumber || null,
        input.amountDue,
        input.amountPaid || 0,
        input.currency || 'usd',
        input.status || 'open',
        this.normalizeDateInput(input.dueDate) || null,
        this.normalizeDateInput(input.periodStart) || null,
        this.normalizeDateInput(input.periodEnd) || null,
        JSON.stringify(input.lineItems || []),
        JSON.stringify({
          ...(input.metadata || {}),
          externalInvoiceRef: input.externalInvoiceRef || null,
        }),
      ]
    ) as Promise<any>);
    this.eventService.emitEvent('billing.invoice.recorded', {
      invoiceId: id,
      orgId,
      source: 'manual',
    });
    return { id };
  }

  async addPaymentMethod(orgId: string, stripePaymentMethodId: string): Promise<PaymentMethod> {
    const deps = this.deps();
    const id = `pm-${deps.uuidv4()}`;

    let pmDetails: {
      type: string;
      brand: string;
      last4: string;
      exp_month: number | null;
      exp_year: number | null;
      holder_name: string | null;
    } = {
      type: 'card',
      brand: 'unknown',
      last4: '****',
      exp_month: null,
      exp_year: null,
      holder_name: null,
    };

    if (deps.stripe) {
      try {
        const pm = await deps.stripe.paymentMethods.retrieve(stripePaymentMethodId);
        pmDetails = {
          type: pm.type,
          brand: (pm.card?.brand as string) || 'unknown',
          last4: pm.card?.last4 || '****',
          exp_month: pm.card?.exp_month || null,
          exp_year: pm.card?.exp_year || null,
          holder_name: pm.billing_details?.name || null,
        };

        const billing = await this.queryService.getOrganizationBilling(orgId);
        if (billing?.stripe_customer_id) {
          await (deps.stripe.paymentMethods.attach(stripePaymentMethodId, {
            customer: billing.stripe_customer_id,
          }) as Promise<any>);
        }
      } catch (error: unknown) {
        logger.warn('Could not retrieve Stripe payment method details:', error);
      }
    }

    const existingMethods = await this.queryService.getPaymentMethods(orgId);
    const isDefault = existingMethods.length === 0 ? 1 : 0;

    await (deps.db.run(
      `INSERT INTO payment_methods (id, organization_id, stripe_payment_method_id, type, brand, last4, exp_month, exp_year, holder_name, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        stripePaymentMethodId,
        pmDetails.type,
        pmDetails.brand,
        pmDetails.last4,
        pmDetails.exp_month,
        pmDetails.exp_year,
        pmDetails.holder_name,
        isDefault,
      ]
    ) as Promise<any>);

    const paymentMethod: PaymentMethod = {
      id,
      organization_id: orgId,
      stripe_payment_method_id: stripePaymentMethodId,
      ...pmDetails,
      is_default: isDefault,
    };

    this.eventService.emitEvent('billing.payment_method.added', { orgId, paymentMethodId: id });
    return paymentMethod;
  }

  async removePaymentMethod(paymentMethodId: string, orgId: string): Promise<{ deleted: boolean }> {
    const deps = this.deps();
    const pm = await this.queryService.getPaymentMethod(paymentMethodId);
    if (!pm || pm.organization_id !== orgId) {
      throw new Error('Payment method not found');
    }

    if (deps.stripe && pm.stripe_payment_method_id) {
      try {
        await deps.stripe.paymentMethods.detach(pm.stripe_payment_method_id);
      } catch (error: unknown) {
        logger.warn('Could not detach payment method from Stripe:', error);
      }
    }

    const result: any = await (deps.db.run(
      'DELETE FROM payment_methods WHERE id = ? AND organization_id = ?',
      [paymentMethodId, orgId]
    ) as Promise<any>);

    return { deleted: result.changes > 0 };
  }

  async setDefaultPaymentMethod(
    paymentMethodId: string,
    orgId: string
  ): Promise<{ id: string; is_default: boolean }> {
    const deps = this.deps();
    const pm = await this.queryService.getPaymentMethod(paymentMethodId);
    if (!pm || pm.organization_id !== orgId) {
      throw new Error('Payment method not found');
    }

    if (deps.stripe && pm.stripe_payment_method_id) {
      try {
        const billing = await this.queryService.getOrganizationBilling(orgId);
        if (billing?.stripe_customer_id) {
          await deps.stripe.customers.update(billing.stripe_customer_id, {
            invoice_settings: { default_payment_method: pm.stripe_payment_method_id },
          });
        }
      } catch (error: unknown) {
        logger.warn('Could not update Stripe default payment method:', error);
      }
    }

    await deps.db.run('UPDATE payment_methods SET is_default = 0 WHERE organization_id = ?', [
      orgId,
    ]);

    await deps.db.run(
      'UPDATE payment_methods SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [paymentMethodId]
    );

    this.eventService.emitEvent('billing.payment_method.defaulted', { orgId, paymentMethodId });
    return { id: paymentMethodId, is_default: true };
  }

  async createSetupIntent(orgId: string, email: string, orgName: string): Promise<SetupIntent> {
    const deps = this.deps();
    if (!deps.stripe) {
      // B8 fix: mock setup intents are dev/demo-only — never hand a fake client secret
      // to a production checkout flow (it would silently fail card collection).
      const isProd = process.env.NODE_ENV === 'production';
      const allowMock = !isProd || process.env.ALLOW_MOCK_BILLING === 'true';
      if (!allowMock) {
        throw new Error(
          'Billing is not configured (Stripe unavailable). Cannot create setup intent.'
        );
      }
      return {
        clientSecret: `mock_secret_${deps.uuidv4()}`,
        id: `mock_seti_${deps.uuidv4()}`,
      };
    }

    const customer = (await this.getOrCreateStripeCustomer(
      orgId,
      email,
      orgName
    )) as StripeTypes.Customer;
    const setupIntent = await deps.stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      metadata: { organization_id: orgId },
    });

    return {
      clientSecret: setupIntent.client_secret || '',
      id: setupIntent.id,
    };
  }

  async updateBillingAlerts(
    orgId: string,
    alertSettings: UpdateBillingAlertsData
  ): Promise<Record<string, unknown>> {
    const deps = this.deps();
    const id = `alert-${deps.uuidv4()}`;

    await (deps.db.run(
      `INSERT INTO billing_alerts (id, organization_id, token_threshold_80, token_threshold_90, token_threshold_100,
             storage_threshold_80, storage_threshold_90, storage_threshold_100, auto_upgrade_enabled, auto_upgrade_plan_id,
             cost_cap_monthly, email_notifications)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(organization_id) DO UPDATE SET
             token_threshold_80 = excluded.token_threshold_80,
             token_threshold_90 = excluded.token_threshold_90,
             token_threshold_100 = excluded.token_threshold_100,
             storage_threshold_80 = excluded.storage_threshold_80,
             storage_threshold_90 = excluded.storage_threshold_90,
             storage_threshold_100 = excluded.storage_threshold_100,
             auto_upgrade_enabled = excluded.auto_upgrade_enabled,
             auto_upgrade_plan_id = excluded.auto_upgrade_plan_id,
             cost_cap_monthly = excluded.cost_cap_monthly,
             email_notifications = excluded.email_notifications,
             updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        orgId,
        alertSettings.token_threshold_80 ?? 1,
        alertSettings.token_threshold_90 ?? 1,
        alertSettings.token_threshold_100 ?? 1,
        alertSettings.storage_threshold_80 ?? 1,
        alertSettings.storage_threshold_90 ?? 1,
        alertSettings.storage_threshold_100 ?? 1,
        alertSettings.auto_upgrade_enabled ?? 0,
        alertSettings.auto_upgrade_plan_id ?? null,
        alertSettings.cost_cap_monthly ?? null,
        alertSettings.email_notifications ?? 1,
      ]
    ) as Promise<any>);

    this.eventService.emitEvent('billing.alerts.updated', { orgId, alertSettings });
    return { id, organization_id: orgId, ...alertSettings };
  }

  async updateTaxSettings(
    orgId: string,
    taxSettings: UpdateTaxSettingsData
  ): Promise<Record<string, unknown>> {
    const deps = this.deps();
    const id = `tax-${deps.uuidv4()}`;

    await (deps.db.run(
      `INSERT INTO billing_tax_settings (id, organization_id, tax_id, tax_id_type, tax_exempt,
             billing_name, billing_email, billing_address_line1, billing_address_line2,
             billing_city, billing_state, billing_postal_code, billing_country,
             invoice_prefix, po_number)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(organization_id) DO UPDATE SET
             tax_id = excluded.tax_id,
             tax_id_type = excluded.tax_id_type,
             tax_exempt = excluded.tax_exempt,
             billing_name = excluded.billing_name,
             billing_email = excluded.billing_email,
             billing_address_line1 = excluded.billing_address_line1,
             billing_address_line2 = excluded.billing_address_line2,
             billing_city = excluded.billing_city,
             billing_state = excluded.billing_state,
             billing_postal_code = excluded.billing_postal_code,
             billing_country = excluded.billing_country,
             invoice_prefix = excluded.invoice_prefix,
             po_number = excluded.po_number,
             updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        orgId,
        taxSettings.tax_id ?? null,
        taxSettings.tax_id_type ?? null,
        taxSettings.tax_exempt ?? 0,
        taxSettings.billing_name ?? null,
        taxSettings.billing_email ?? null,
        taxSettings.billing_address_line1 ?? null,
        taxSettings.billing_address_line2 ?? null,
        taxSettings.billing_city ?? null,
        taxSettings.billing_state ?? null,
        taxSettings.billing_postal_code ?? null,
        taxSettings.billing_country ?? null,
        taxSettings.invoice_prefix ?? null,
        taxSettings.po_number ?? null,
      ]
    ) as Promise<any>);

    this.eventService.emitEvent('billing.tax.updated', { orgId, taxSettings });

    // GAP-INVOICE-002: Sync tax settings to Stripe customer
    try {
      await this.syncTaxSettingsToStripe(orgId);
    } catch (err) {
      logger.warn('[BillingCommandService] Error syncing tax settings to Stripe:', err);
      // Don't fail the update if Stripe sync fails
    }

    return { id, organization_id: orgId, ...taxSettings };
  }

  async validateDiscountCode(code: string, planId: string): Promise<DiscountValidationResult> {
    const deps = this.deps();
    const row = await (deps.db.get<{
      id: string;
      code: string;
      discount_type: string;
      discount_value: number;
      currency: string;
      applicable_plans?: string | null;
      valid_from?: string | null;
      valid_until?: string | null;
      max_uses?: number | null;
      current_uses: number;
      is_active: number;
    }>(
      `SELECT * FROM discount_codes 
             WHERE code = ? AND is_active = 1 
             AND (valid_from IS NULL OR valid_from <= datetime('now'))
             AND (valid_until IS NULL OR valid_until >= datetime('now'))
             AND (max_uses IS NULL OR current_uses < max_uses)`,
      [code.toUpperCase()]
    ) as Promise<any>);

    if (!row) {
      return { valid: false, error: 'Invalid or expired discount code' };
    }

    if (row.applicable_plans) {
      const applicablePlans = JSON.parse(row.applicable_plans) as string[];
      if (!applicablePlans.includes(planId)) {
        return { valid: false, error: 'This code is not valid for the selected plan' };
      }
    }

    return {
      valid: true,
      discount: {
        id: row.id,
        code: row.code,
        type: row.discount_type,
        value: row.discount_value,
        currency: row.currency,
      },
    };
  }

  async incrementDiscountCodeUsage(codeId: string): Promise<{ updated: boolean }> {
    const deps = this.deps();
    const result: any = await (deps.db.run(
      'UPDATE discount_codes SET current_uses = current_uses + 1 WHERE id = ?',
      [codeId]
    ) as Promise<any>);

    return { updated: result.changes > 0 };
  }

  async calculateSeatCost(orgId: string, quantity: number): Promise<SeatCost> {
    return this.queryService.getSeatPricing(orgId).then((row) => {
      const seatPrice = row.seat_price_monthly || 0;
      const totalCost = seatPrice * quantity;
      return { unitPrice: seatPrice, totalCost, quantity };
    });
  }

  async processSeatPurchase(
    orgId: string,
    quantity: number,
    paymentMethodId: string
  ): Promise<{
    success: boolean;
    quantity: number;
    unitPrice: number;
    totalCost: number;
    paymentMethodId: string;
    simulated?: boolean;
  }> {
    const cost = await this.calculateSeatCost(orgId, quantity);
    const deps = this.deps();

    // B8 fix: this previously always returned success WITHOUT charging anything.
    // If Stripe is configured, actually create a one-off invoice item + invoice
    // so the seats are really billed. Without Stripe, mark the result as simulated
    // and refuse silently-successful "purchases" in production.
    if (deps.stripe) {
      try {
        const customer = (await this.getOrCreateStripeCustomer(
          orgId,
          '',
          ''
        )) as StripeTypes.Customer;
        const amountCents = Math.round(cost.totalCost * 100);
        if (amountCents > 0) {
          await deps.stripe.invoiceItems.create({
            customer: customer.id,
            amount: amountCents,
            currency: 'eur',
            description: `${quantity} additional seat(s)`,
            metadata: { organization_id: orgId, seat_quantity: String(quantity) },
          });
          const invoice = await deps.stripe.invoices.create({
            customer: customer.id,
            collection_method: 'charge_automatically',
            default_payment_method: paymentMethodId,
            metadata: { organization_id: orgId, kind: 'seat_purchase' },
          });
          if (invoice.id && deps.stripe.invoices.finalizeInvoice) {
            await deps.stripe.invoices.finalizeInvoice(invoice.id);
          }
        }
        this.eventService.emitEvent('billing.seats.purchased', {
          orgId,
          quantity,
          totalCost: cost.totalCost,
        });
        return {
          success: true,
          quantity,
          unitPrice: cost.unitPrice,
          totalCost: cost.totalCost,
          paymentMethodId,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Seat purchase failed: ${msg}`);
      }
    }

    const isProd = process.env.NODE_ENV === 'production';
    const allowMock = !isProd || process.env.ALLOW_MOCK_BILLING === 'true';
    if (!allowMock) {
      throw new Error(
        'Billing is not configured (Stripe unavailable). Cannot process seat purchase.'
      );
    }
    return {
      success: true,
      quantity,
      unitPrice: cost.unitPrice,
      totalCost: cost.totalCost,
      paymentMethodId,
      simulated: true,
    };
  }
}
