/**
 * Invoice Template Service
 * Handles invoice template management, customization, and PDF generation
 */

const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4
};

/**
 * Set dependencies (for testing)
 */
function setDependencies(newDeps = {}) {
    Object.assign(deps, newDeps);
}

// ==========================================
// TEMPLATE CRUD OPERATIONS
// ==========================================

/**
 * Get all templates for an organization (including system templates)
 */
function getTemplates(organizationId = null) {
    return new Promise((resolve, reject) => {
        deps.db.all(
            `SELECT * FROM invoice_templates 
             WHERE organization_id = ? OR organization_id IS NULL
             ORDER BY is_system DESC, is_default DESC, name ASC`,
            [organizationId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

/**
 * Get template by ID
 */
function getTemplateById(templateId) {
    return new Promise((resolve, reject) => {
        deps.db.get(
            'SELECT * FROM invoice_templates WHERE id = ?',
            [templateId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

/**
 * Get default template for organization
 */
function getDefaultTemplate(organizationId, templateType = 'standard') {
    return new Promise((resolve, reject) => {
        // First try organization's default
        deps.db.get(
            `SELECT * FROM invoice_templates 
             WHERE organization_id = ? AND template_type = ? AND is_default = 1`,
            [organizationId, templateType],
            (err, row) => {
                if (err) return reject(err);
                if (row) return resolve(row);
                
                // Fall back to system default
                deps.db.get(
                    `SELECT * FROM invoice_templates 
                     WHERE organization_id IS NULL AND template_type = ? AND is_default = 1`,
                    [templateType],
                    (err, systemRow) => {
                        if (err) reject(err);
                        else resolve(systemRow);
                    }
                );
            }
        );
    });
}

/**
 * Create a new template
 */
function createTemplate(organizationId, data) {
    const id = `tpl-${deps.uuidv4()}`;
    
    return new Promise((resolve, reject) => {
        deps.db.run(
            `INSERT INTO invoice_templates (
                id, organization_id, name, description, template_type, is_default, is_system,
                logo_url, header_html, footer_html, custom_css,
                show_company_info, show_customer_info, show_payment_terms, show_due_date,
                show_tax_breakdown, show_currency_conversion,
                payment_terms_days, default_currency, default_tax_rate, default_notes, default_terms,
                locale, date_format, number_format,
                primary_color, secondary_color, text_color, background_color,
                layout_type, paper_size, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                organizationId,
                data.name,
                data.description || null,
                data.template_type || 'standard',
                data.is_default ? 1 : 0,
                0, // User templates are never system templates
                data.logo_url || null,
                data.header_html || null,
                data.footer_html || null,
                data.custom_css || null,
                data.show_company_info !== false ? 1 : 0,
                data.show_customer_info !== false ? 1 : 0,
                data.show_payment_terms !== false ? 1 : 0,
                data.show_due_date !== false ? 1 : 0,
                data.show_tax_breakdown !== false ? 1 : 0,
                data.show_currency_conversion ? 1 : 0,
                data.payment_terms_days || 30,
                data.default_currency || 'USD',
                data.default_tax_rate || null,
                data.default_notes || null,
                data.default_terms || null,
                data.locale || 'en',
                data.date_format || 'YYYY-MM-DD',
                data.number_format || 'en-US',
                data.primary_color || '#8B5CF6',
                data.secondary_color || '#10B981',
                data.text_color || '#1F2937',
                data.background_color || '#FFFFFF',
                data.layout_type || 'modern',
                data.paper_size || 'A4',
                JSON.stringify(data.metadata || {})
            ],
            async function(err) {
                if (err) return reject(err);
                
                // If this is default, unset other defaults
                if (data.is_default) {
                    await unsetOtherDefaults(organizationId, data.template_type, id);
                }
                
                resolve({ id, ...data });
            }
        );
    });
}

/**
 * Update template
 */
function updateTemplate(templateId, updates) {
    return new Promise(async (resolve, reject) => {
        // Check if it's a system template
        const template = await getTemplateById(templateId);
        if (!template) {
            return reject(new Error('Template not found'));
        }
        if (template.is_system) {
            return reject(new Error('Cannot modify system templates'));
        }
        
        const fields = [];
        const values = [];
        
        const allowedFields = [
            'name', 'description', 'template_type', 'is_default',
            'logo_url', 'header_html', 'footer_html', 'custom_css',
            'show_company_info', 'show_customer_info', 'show_payment_terms',
            'show_due_date', 'show_tax_breakdown', 'show_currency_conversion',
            'payment_terms_days', 'default_currency', 'default_tax_rate',
            'default_notes', 'default_terms', 'locale', 'date_format', 'number_format',
            'primary_color', 'secondary_color', 'text_color', 'background_color',
            'layout_type', 'paper_size', 'metadata'
        ];

        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                fields.push(`${field} = ?`);
                if (field === 'metadata') {
                    values.push(JSON.stringify(updates[field]));
                } else if (['is_default', 'show_company_info', 'show_customer_info', 
                           'show_payment_terms', 'show_due_date', 'show_tax_breakdown',
                           'show_currency_conversion'].includes(field)) {
                    values.push(updates[field] ? 1 : 0);
                } else {
                    values.push(updates[field]);
                }
            }
        });

        if (fields.length === 0) return resolve(null);

        fields.push('updated_at = datetime("now")');
        values.push(templateId);

        deps.db.run(
            `UPDATE invoice_templates SET ${fields.join(', ')} WHERE id = ?`,
            values,
            async function(err) {
                if (err) return reject(err);
                
                // If setting as default, unset other defaults
                if (updates.is_default) {
                    await unsetOtherDefaults(
                        template.organization_id, 
                        updates.template_type || template.template_type, 
                        templateId
                    );
                }
                
                resolve({ id: templateId, changes: this.changes });
            }
        );
    });
}

/**
 * Delete template
 */
function deleteTemplate(templateId) {
    return new Promise(async (resolve, reject) => {
        const template = await getTemplateById(templateId);
        if (!template) {
            return reject(new Error('Template not found'));
        }
        if (template.is_system) {
            return reject(new Error('Cannot delete system templates'));
        }
        
        deps.db.run(
            'DELETE FROM invoice_templates WHERE id = ? AND is_system = 0',
            [templateId],
            function(err) {
                if (err) reject(err);
                else resolve({ deleted: this.changes > 0 });
            }
        );
    });
}

/**
 * Clone a template
 */
async function cloneTemplate(templateId, organizationId, newName) {
    const source = await getTemplateById(templateId);
    if (!source) {
        throw new Error('Source template not found');
    }
    
    const cloneData = {
        ...source,
        name: newName || `${source.name} (Copy)`,
        is_default: false
    };
    
    // Remove IDs and system flag
    delete cloneData.id;
    delete cloneData.is_system;
    delete cloneData.created_at;
    delete cloneData.updated_at;
    
    return createTemplate(organizationId, cloneData);
}

// ==========================================
// TEMPLATE RENDERING
// ==========================================

/**
 * Generate invoice HTML from template
 */
async function generateInvoiceHTML(invoiceId, templateId = null) {
    // Get invoice data
    const invoice = await getInvoiceWithDetails(invoiceId);
    if (!invoice) {
        throw new Error('Invoice not found');
    }
    
    // Get template
    const template = templateId 
        ? await getTemplateById(templateId)
        : await getDefaultTemplate(invoice.organization_id, 'standard');
    
    if (!template) {
        throw new Error('No template available');
    }
    
    // Get organization and customer data
    const organization = await getOrganization(invoice.organization_id);
    const taxSettings = await getTaxSettings(invoice.organization_id);
    
    // Build HTML
    const html = buildInvoiceHTML(invoice, template, organization, taxSettings);
    
    return {
        html,
        template: template.name,
        invoice: invoice.invoice_number
    };
}

/**
 * Build invoice HTML from template and data
 */
function buildInvoiceHTML(invoice, template, organization, taxSettings) {
    const formatCurrency = (amount, currency) => {
        return new Intl.NumberFormat(template.number_format || 'en-US', {
            style: 'currency',
            currency: currency || template.default_currency || 'USD'
        }).format(amount / 100);
    };
    
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString(template.locale || 'en');
    };
    
    // Build line items HTML
    const itemsHTML = (invoice.items || []).map(item => `
        <tr>
            <td>${item.description}</td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-right">${formatCurrency(item.unit_price, invoice.currency)}</td>
            <td class="text-right">${formatCurrency(item.amount, invoice.currency)}</td>
        </tr>
    `).join('');
    
    // Build the full HTML document
    const html = `
<!DOCTYPE html>
<html lang="${template.locale || 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoice.invoice_number}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            color: ${template.text_color || '#1F2937'};
            background: ${template.background_color || '#FFFFFF'};
            padding: 40px;
            max-width: ${template.paper_size === 'Letter' ? '8.5in' : '210mm'};
            min-height: ${template.paper_size === 'Letter' ? '11in' : '297mm'};
        }
        .header { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 40px;
            border-bottom: 3px solid ${template.primary_color || '#8B5CF6'};
            padding-bottom: 20px;
        }
        .logo { max-height: 60px; }
        .invoice-title { 
            font-size: 32px; 
            font-weight: bold; 
            color: ${template.primary_color || '#8B5CF6'};
        }
        .invoice-number { 
            font-size: 14px; 
            color: #6B7280;
            margin-top: 5px;
        }
        .details-row { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 30px;
        }
        .company-info, .customer-info {
            flex: 1;
        }
        .company-info { text-align: left; }
        .customer-info { text-align: right; }
        .info-label { 
            font-size: 12px; 
            text-transform: uppercase; 
            color: #6B7280; 
            margin-bottom: 5px;
        }
        .info-value { 
            font-size: 14px; 
            line-height: 1.5;
        }
        .items-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 30px;
        }
        .items-table th { 
            background: ${template.primary_color || '#8B5CF6'}; 
            color: white; 
            padding: 12px;
            text-align: left;
        }
        .items-table td { 
            padding: 12px; 
            border-bottom: 1px solid #E5E7EB;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .totals { 
            width: 300px; 
            margin-left: auto;
        }
        .totals-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 8px 0;
            border-bottom: 1px solid #E5E7EB;
        }
        .totals-row.total { 
            font-size: 18px; 
            font-weight: bold;
            border-bottom: none;
            border-top: 2px solid ${template.primary_color || '#8B5CF6'};
            padding-top: 12px;
            margin-top: 8px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-paid { background: #D1FAE5; color: #065F46; }
        .status-open { background: #FEF3C7; color: #92400E; }
        .status-draft { background: #E5E7EB; color: #374151; }
        .status-void { background: #FEE2E2; color: #991B1B; }
        .footer { 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #E5E7EB;
            font-size: 12px;
            color: #6B7280;
        }
        .payment-info {
            background: #F3F4F6;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
        }
        ${template.custom_css || ''}
    </style>
</head>
<body>
    ${template.header_html || ''}
    
    <div class="header">
        <div>
            ${template.logo_url ? `<img src="${template.logo_url}" alt="Logo" class="logo">` : ''}
            ${template.show_company_info ? `
            <div class="info-value" style="margin-top: 10px;">
                <strong>${organization?.name || 'Company Name'}</strong><br>
                ${taxSettings?.billing_address_line1 || ''}<br>
                ${taxSettings?.billing_city || ''} ${taxSettings?.billing_postal_code || ''}<br>
                ${taxSettings?.billing_country || ''}
            </div>
            ` : ''}
        </div>
        <div style="text-align: right;">
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-number">${invoice.invoice_number}</div>
            <span class="status-badge status-${invoice.status}">${invoice.status}</span>
        </div>
    </div>
    
    <div class="details-row">
        <div class="customer-info" style="text-align: left;">
            ${template.show_customer_info ? `
            <div class="info-label">Bill To</div>
            <div class="info-value">
                ${taxSettings?.billing_name || 'Customer'}<br>
                ${taxSettings?.billing_email || ''}<br>
                ${taxSettings?.tax_id ? `VAT: ${taxSettings.tax_id}` : ''}
            </div>
            ` : ''}
        </div>
        <div style="text-align: right;">
            <div style="margin-bottom: 10px;">
                <span class="info-label">Invoice Date</span><br>
                <span class="info-value">${formatDate(invoice.invoice_date)}</span>
            </div>
            ${template.show_due_date ? `
            <div>
                <span class="info-label">Due Date</span><br>
                <span class="info-value">${formatDate(invoice.due_date)}</span>
            </div>
            ` : ''}
        </div>
    </div>
    
    <table class="items-table">
        <thead>
            <tr>
                <th>Description</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Amount</th>
            </tr>
        </thead>
        <tbody>
            ${itemsHTML}
        </tbody>
    </table>
    
    <div class="totals">
        <div class="totals-row">
            <span>Subtotal</span>
            <span>${formatCurrency(invoice.subtotal, invoice.currency)}</span>
        </div>
        ${template.show_tax_breakdown && invoice.tax_amount > 0 ? `
        <div class="totals-row">
            <span>Tax (${invoice.tax_rate || 0}%)</span>
            <span>${formatCurrency(invoice.tax_amount, invoice.currency)}</span>
        </div>
        ` : ''}
        ${invoice.discount_amount > 0 ? `
        <div class="totals-row">
            <span>Discount</span>
            <span>-${formatCurrency(invoice.discount_amount, invoice.currency)}</span>
        </div>
        ` : ''}
        <div class="totals-row total">
            <span>Total</span>
            <span>${formatCurrency(invoice.total, invoice.currency)}</span>
        </div>
        ${invoice.amount_paid > 0 && invoice.amount_paid < invoice.total ? `
        <div class="totals-row">
            <span>Paid</span>
            <span>-${formatCurrency(invoice.amount_paid, invoice.currency)}</span>
        </div>
        <div class="totals-row total">
            <span>Amount Due</span>
            <span>${formatCurrency(invoice.amount_due, invoice.currency)}</span>
        </div>
        ` : ''}
    </div>
    
    ${template.show_payment_terms ? `
    <div class="payment-info">
        <strong>Payment Terms:</strong> Net ${template.payment_terms_days || 30} days<br>
        ${invoice.payment_instructions || template.default_terms || ''}
    </div>
    ` : ''}
    
    ${invoice.notes || template.default_notes ? `
    <div class="footer">
        <strong>Notes:</strong><br>
        ${invoice.notes || template.default_notes}
    </div>
    ` : ''}
    
    ${template.footer_html || ''}
</body>
</html>`;
    
    return html;
}

// ==========================================
// PREVIEW GENERATION
// ==========================================

/**
 * Generate template preview with sample data
 */
async function generatePreview(templateId) {
    const template = await getTemplateById(templateId);
    if (!template) {
        throw new Error('Template not found');
    }
    
    // Sample invoice data for preview
    const sampleInvoice = {
        invoice_number: 'INV-2026-000001',
        status: 'open',
        invoice_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        currency: template.default_currency || 'USD',
        subtotal: 199900,
        tax_rate: template.default_tax_rate || 0,
        tax_amount: template.default_tax_rate ? Math.round(199900 * (template.default_tax_rate / 100)) : 0,
        discount_amount: 0,
        total: 199900 + (template.default_tax_rate ? Math.round(199900 * (template.default_tax_rate / 100)) : 0),
        amount_paid: 0,
        amount_due: 199900 + (template.default_tax_rate ? Math.round(199900 * (template.default_tax_rate / 100)) : 0),
        notes: template.default_notes,
        payment_instructions: template.default_terms,
        items: [
            { description: 'Professional Plan - Monthly Subscription', quantity: 1, unit_price: 9900, amount: 9900 },
            { description: 'Additional Seats (5)', quantity: 5, unit_price: 2000, amount: 10000 },
            { description: 'AI Token Package - 1M tokens', quantity: 1, unit_price: 180000, amount: 180000 }
        ]
    };
    
    const sampleOrganization = {
        name: 'Consultify Inc.'
    };
    
    const sampleTaxSettings = {
        billing_name: 'Acme Corporation',
        billing_email: 'billing@acme.example.com',
        billing_address_line1: '123 Business Ave',
        billing_city: 'New York',
        billing_postal_code: '10001',
        billing_country: 'United States',
        tax_id: 'US123456789'
    };
    
    const html = buildInvoiceHTML(sampleInvoice, template, sampleOrganization, sampleTaxSettings);
    
    return {
        html,
        template: template.name,
        isPreview: true
    };
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function unsetOtherDefaults(organizationId, templateType, excludeId) {
    return new Promise((resolve, reject) => {
        deps.db.run(
            `UPDATE invoice_templates 
             SET is_default = 0, updated_at = datetime('now')
             WHERE organization_id = ? AND template_type = ? AND id != ? AND is_default = 1`,
            [organizationId, templateType, excludeId],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

function getInvoiceWithDetails(invoiceId) {
    return new Promise((resolve, reject) => {
        deps.db.get(
            'SELECT * FROM invoices WHERE id = ?',
            [invoiceId],
            (err, invoice) => {
                if (err) return reject(err);
                if (!invoice) return resolve(null);
                
                deps.db.all(
                    'SELECT * FROM invoice_items WHERE invoice_id = ?',
                    [invoiceId],
                    (err, items) => {
                        if (err) return reject(err);
                        invoice.items = items || [];
                        resolve(invoice);
                    }
                );
            }
        );
    });
}

function getOrganization(orgId) {
    return new Promise((resolve, reject) => {
        deps.db.get('SELECT * FROM organizations WHERE id = ?', [orgId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function getTaxSettings(orgId) {
    return new Promise((resolve, reject) => {
        deps.db.get('SELECT * FROM billing_tax_settings WHERE organization_id = ?', [orgId], (err, row) => {
            if (err) reject(err);
            else resolve(row || {});
        });
    });
}

module.exports = {
    setDependencies,
    // CRUD
    getTemplates,
    getTemplateById,
    getDefaultTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    cloneTemplate,
    // Rendering
    generateInvoiceHTML,
    generatePreview,
    buildInvoiceHTML
};

