import { v4 as uuidv4 } from 'uuid';

export type CanonicalStatementType = 'P&L' | 'BS' | 'CF';
export type CanonicalRequiredLevel = 'required' | 'optional' | 'computed';

export interface CanonicalLineDefinition {
  id: string;
  statementType: CanonicalStatementType;
  code: string;
  labelEn: string;
  labelPl: string;
  parentId?: string | null;
  sortOrder: number;
  aggregationLevel: number;
  requiredLevel: CanonicalRequiredLevel;
  signConvention: 'positive_normal' | 'negative_normal' | 'display_absolute';
  isTotal?: boolean;
  isSubtotal?: boolean;
  isComputed?: boolean;
  formulaJson?: Record<string, unknown> | null;
  deaggregationReady?: boolean;
}

type LineInput = Omit<CanonicalLineDefinition, 'statementType'>;

function makeLines(statementType: CanonicalStatementType, lines: LineInput[]): CanonicalLineDefinition[] {
  return lines.map((line) => ({ ...line, statementType }));
}

const PL_LINES = makeLines('P&L', [
  { id: 'fsl-pl-revenue', code: 'REVENUE', labelEn: 'Revenue', labelPl: 'Przychody', sortOrder: 10, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'positive_normal', deaggregationReady: true },
  { id: 'fsl-pl-revenue-product', code: 'PRODUCT_REVENUE', labelEn: 'Product Revenue', labelPl: 'Przychody produktowe', parentId: 'fsl-pl-revenue', sortOrder: 11, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal', deaggregationReady: true },
  { id: 'fsl-pl-revenue-product-domestic', code: 'PRODUCT_REVENUE_DOMESTIC', labelEn: 'Domestic Product Revenue', labelPl: 'Przychody produktowe kraj', parentId: 'fsl-pl-revenue-product', sortOrder: 12, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-pl-revenue-product-export', code: 'PRODUCT_REVENUE_EXPORT', labelEn: 'Export Product Revenue', labelPl: 'Przychody produktowe eksport', parentId: 'fsl-pl-revenue-product', sortOrder: 13, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-pl-revenue-service', code: 'SERVICE_REVENUE', labelEn: 'Service Revenue', labelPl: 'Przychody usługowe', parentId: 'fsl-pl-revenue', sortOrder: 14, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal', deaggregationReady: true },
  { id: 'fsl-pl-revenue-service-subscription', code: 'SUBSCRIPTION_REVENUE', labelEn: 'Subscription Revenue', labelPl: 'Przychody abonamentowe', parentId: 'fsl-pl-revenue-service', sortOrder: 15, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-pl-revenue-service-projects', code: 'PROJECT_REVENUE', labelEn: 'Project Revenue', labelPl: 'Przychody projektowe', parentId: 'fsl-pl-revenue-service', sortOrder: 16, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-pl-revenue-other', code: 'OTHER_REVENUE', labelEn: 'Other Revenue', labelPl: 'Pozostałe przychody', parentId: 'fsl-pl-revenue', sortOrder: 17, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-pl-cogs', code: 'COGS', labelEn: 'Cost of Goods Sold', labelPl: 'Koszt sprzedanych towarów', sortOrder: 20, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'display_absolute', deaggregationReady: true },
  { id: 'fsl-pl-cogs-materials', code: 'MATERIALS_COGS', labelEn: 'Materials Cost', labelPl: 'Koszt materiałów', parentId: 'fsl-pl-cogs', sortOrder: 21, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute', deaggregationReady: true },
  { id: 'fsl-pl-cogs-materials-raw', code: 'RAW_MATERIALS_COGS', labelEn: 'Raw Materials Cost', labelPl: 'Koszt surowców', parentId: 'fsl-pl-cogs-materials', sortOrder: 22, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-cogs-materials-freight', code: 'INBOUND_FREIGHT_COGS', labelEn: 'Inbound Freight', labelPl: 'Transport zakupu', parentId: 'fsl-pl-cogs-materials', sortOrder: 23, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-cogs-labor', code: 'DIRECT_LABOR_COGS', labelEn: 'Direct Labor Cost', labelPl: 'Koszt robocizny bezpośredniej', parentId: 'fsl-pl-cogs', sortOrder: 24, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-cogs-labor-payroll', code: 'PRODUCTION_PAYROLL_COGS', labelEn: 'Production Payroll', labelPl: 'Płace produkcyjne', parentId: 'fsl-pl-cogs-labor', sortOrder: 25, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-cogs-labor-contractors', code: 'PRODUCTION_CONTRACTORS_COGS', labelEn: 'Production Contractors', labelPl: 'Usługi produkcyjne obce', parentId: 'fsl-pl-cogs-labor', sortOrder: 26, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-cogs-other', code: 'OTHER_DIRECT_COSTS', labelEn: 'Other Direct Costs', labelPl: 'Pozostałe koszty bezpośrednie', parentId: 'fsl-pl-cogs', sortOrder: 27, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-gross', code: 'GROSS_PROFIT', labelEn: 'Gross Profit', labelPl: 'Marża brutto', sortOrder: 30, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'positive_normal', isSubtotal: true, isComputed: true, formulaJson: { type: 'difference', inputs: ['REVENUE', 'COGS'] } },
  { id: 'fsl-pl-other-op-income', code: 'OTHER_OPERATING_INCOME', labelEn: 'Other Operating Income', labelPl: 'Pozostałe przychody operacyjne', sortOrder: 35, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-pl-opex', code: 'OPEX', labelEn: 'Operating Expenses (SG&A)', labelPl: 'Koszty operacyjne (SG&A)', sortOrder: 50, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'display_absolute', isSubtotal: true, deaggregationReady: true },
  { id: 'fsl-pl-selling', code: 'SELLING_EXPENSES', labelEn: 'Selling Expenses', labelPl: 'Koszty sprzedaży', parentId: 'fsl-pl-opex', sortOrder: 40, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute', deaggregationReady: true },
  { id: 'fsl-pl-selling-marketing', code: 'MARKETING_EXPENSES', labelEn: 'Marketing Expenses', labelPl: 'Koszty marketingu', parentId: 'fsl-pl-selling', sortOrder: 41, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-selling-logistics', code: 'LOGISTICS_EXPENSES', labelEn: 'Logistics Expenses', labelPl: 'Koszty logistyki', parentId: 'fsl-pl-selling', sortOrder: 42, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-selling-commissions', code: 'SALES_COMMISSIONS', labelEn: 'Sales Commissions', labelPl: 'Prowizje sprzedażowe', parentId: 'fsl-pl-selling', sortOrder: 43, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-gna', code: 'GENERAL_ADMIN_EXPENSES', labelEn: 'General & Administrative Expenses', labelPl: 'Koszty ogólnego zarządu', parentId: 'fsl-pl-opex', sortOrder: 45, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute', deaggregationReady: true },
  { id: 'fsl-pl-gna-payroll', code: 'GNA_PAYROLL', labelEn: 'G&A Payroll', labelPl: 'Płace administracji', parentId: 'fsl-pl-gna', sortOrder: 46, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-gna-rent', code: 'GNA_RENT', labelEn: 'Office Rent', labelPl: 'Czynsz biur', parentId: 'fsl-pl-gna', sortOrder: 47, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-gna-it', code: 'GNA_IT', labelEn: 'IT & Software', labelPl: 'IT i oprogramowanie', parentId: 'fsl-pl-gna', sortOrder: 48, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-gna-external', code: 'GNA_EXTERNAL_SERVICES', labelEn: 'External Services', labelPl: 'Usługi obce', parentId: 'fsl-pl-gna', sortOrder: 49, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-other-opex', code: 'OTHER_OPERATING_EXPENSES', labelEn: 'Other Operating Expenses', labelPl: 'Pozostałe koszty operacyjne', parentId: 'fsl-pl-opex', sortOrder: 50, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute', deaggregationReady: true },
  { id: 'fsl-pl-other-opex-impairment', code: 'IMPAIRMENT_EXPENSE', labelEn: 'Impairment Expense', labelPl: 'Odpisy aktualizujące', parentId: 'fsl-pl-other-opex', sortOrder: 51, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-other-opex-provisions', code: 'PROVISIONS_EXPENSE', labelEn: 'Provisions Expense', labelPl: 'Koszt rezerw', parentId: 'fsl-pl-other-opex', sortOrder: 52, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-ebitda', code: 'EBITDA', labelEn: 'EBITDA', labelPl: 'EBITDA', sortOrder: 60, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'positive_normal', isSubtotal: true, isComputed: true },
  { id: 'fsl-pl-depreciation', code: 'DEPRECIATION', labelEn: 'Depreciation & Amortization', labelPl: 'Amortyzacja', sortOrder: 70, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'display_absolute', deaggregationReady: true },
  { id: 'fsl-pl-depreciation-ppe', code: 'PPE_DEPRECIATION', labelEn: 'PPE Depreciation', labelPl: 'Amortyzacja środków trwałych', parentId: 'fsl-pl-depreciation', sortOrder: 71, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-depreciation-intangibles', code: 'INTANGIBLE_AMORTIZATION', labelEn: 'Intangible Amortization', labelPl: 'Amortyzacja WNiP', parentId: 'fsl-pl-depreciation', sortOrder: 72, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-ebit', code: 'EBIT', labelEn: 'EBIT / Operating Profit', labelPl: 'EBIT / Zysk operacyjny', sortOrder: 80, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'positive_normal', isSubtotal: true, isComputed: true },
  { id: 'fsl-pl-interest', code: 'INTEREST_EXPENSE', labelEn: 'Interest Expense', labelPl: 'Koszty odsetkowe', sortOrder: 90, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'display_absolute', deaggregationReady: true },
  { id: 'fsl-pl-interest-bank', code: 'BANK_INTEREST_EXPENSE', labelEn: 'Bank Interest Expense', labelPl: 'Odsetki bankowe', parentId: 'fsl-pl-interest', sortOrder: 91, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-interest-lease', code: 'LEASE_INTEREST_EXPENSE', labelEn: 'Lease Interest Expense', labelPl: 'Odsetki leasingowe', parentId: 'fsl-pl-interest', sortOrder: 92, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-other-fin', code: 'OTHER_FINANCIAL_RESULT', labelEn: 'Other Financial Result', labelPl: 'Pozostałe przychody/koszty finansowe', sortOrder: 95, aggregationLevel: 1, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-pl-ebt', code: 'EBT', labelEn: 'Earnings Before Tax', labelPl: 'Zysk przed opodatkowaniem', sortOrder: 100, aggregationLevel: 1, requiredLevel: 'optional', signConvention: 'positive_normal', isSubtotal: true, isComputed: true },
  { id: 'fsl-pl-tax', code: 'TAX_EXPENSE', labelEn: 'Income Tax Expense', labelPl: 'Podatek dochodowy', sortOrder: 110, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'display_absolute', deaggregationReady: true },
  { id: 'fsl-pl-tax-current', code: 'CURRENT_TAX_EXPENSE', labelEn: 'Current Tax Expense', labelPl: 'Podatek bieżący', parentId: 'fsl-pl-tax', sortOrder: 111, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-tax-deferred', code: 'DEFERRED_TAX_EXPENSE', labelEn: 'Deferred Tax Expense', labelPl: 'Podatek odroczony', parentId: 'fsl-pl-tax', sortOrder: 112, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-pl-net', code: 'NET_INCOME', labelEn: 'Net Income', labelPl: 'Zysk netto', sortOrder: 120, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'positive_normal', isTotal: true, isComputed: true },
]);

const BS_LINES = makeLines('BS', [
  { id: 'fsl-bs-current-assets', code: 'CURRENT_ASSETS', labelEn: 'Current Assets', labelPl: 'Aktywa obrotowe', sortOrder: 10, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'positive_normal', isSubtotal: true, isComputed: true },
  { id: 'fsl-bs-cash', code: 'CASH', labelEn: 'Cash & Cash Equivalents', labelPl: 'Środki pieniężne', parentId: 'fsl-bs-current-assets', sortOrder: 11, aggregationLevel: 2, requiredLevel: 'required', signConvention: 'positive_normal', deaggregationReady: true },
  { id: 'fsl-bs-cash-operating', code: 'OPERATING_CASH', labelEn: 'Operating Cash', labelPl: 'Gotówka operacyjna', parentId: 'fsl-bs-cash', sortOrder: 12, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-cash-restricted', code: 'RESTRICTED_CASH', labelEn: 'Restricted Cash', labelPl: 'Środki zablokowane', parentId: 'fsl-bs-cash', sortOrder: 13, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-ar', code: 'AR', labelEn: 'Accounts Receivable', labelPl: 'Należności', parentId: 'fsl-bs-current-assets', sortOrder: 20, aggregationLevel: 2, requiredLevel: 'required', signConvention: 'positive_normal', deaggregationReady: true },
  { id: 'fsl-bs-ar-trade', code: 'TRADE_RECEIVABLES', labelEn: 'Trade Receivables', labelPl: 'Należności handlowe', parentId: 'fsl-bs-ar', sortOrder: 21, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-ar-other', code: 'OTHER_RECEIVABLES', labelEn: 'Other Receivables', labelPl: 'Pozostałe należności', parentId: 'fsl-bs-ar', sortOrder: 22, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-inventory', code: 'INVENTORY', labelEn: 'Inventory', labelPl: 'Zapasy', parentId: 'fsl-bs-current-assets', sortOrder: 30, aggregationLevel: 2, requiredLevel: 'required', signConvention: 'positive_normal', deaggregationReady: true },
  { id: 'fsl-bs-inventory-raw', code: 'RAW_MATERIALS_INVENTORY', labelEn: 'Raw Materials Inventory', labelPl: 'Materiały', parentId: 'fsl-bs-inventory', sortOrder: 31, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-inventory-wip', code: 'WORK_IN_PROGRESS_INVENTORY', labelEn: 'Work in Progress', labelPl: 'Produkcja w toku', parentId: 'fsl-bs-inventory', sortOrder: 32, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-inventory-fg', code: 'FINISHED_GOODS_INVENTORY', labelEn: 'Finished Goods', labelPl: 'Wyroby gotowe', parentId: 'fsl-bs-inventory', sortOrder: 33, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-other-current-assets', code: 'OTHER_CURRENT_ASSETS', labelEn: 'Other Current Assets', labelPl: 'Pozostałe aktywa obrotowe', parentId: 'fsl-bs-current-assets', sortOrder: 35, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal', deaggregationReady: true },
  { id: 'fsl-bs-other-current-assets-vat', code: 'VAT_RECEIVABLES', labelEn: 'VAT Receivables', labelPl: 'Należności VAT', parentId: 'fsl-bs-other-current-assets', sortOrder: 36, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-other-current-assets-prepaids', code: 'PREPAID_EXPENSES', labelEn: 'Prepaid Expenses', labelPl: 'Rozliczenia międzyokresowe czynne', parentId: 'fsl-bs-other-current-assets', sortOrder: 37, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-fixed', code: 'FIXED_ASSETS', labelEn: 'Fixed Assets', labelPl: 'Aktywa trwałe', sortOrder: 60, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'positive_normal', isSubtotal: true, isComputed: true, deaggregationReady: true },
  { id: 'fsl-bs-ppe', code: 'PROPERTY_PLANT_EQUIPMENT', labelEn: 'Property, Plant & Equipment', labelPl: 'Rzeczowe aktywa trwałe', parentId: 'fsl-bs-fixed', sortOrder: 61, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal', deaggregationReady: true },
  { id: 'fsl-bs-ppe-land', code: 'PPE_LAND_BUILDINGS', labelEn: 'Land & Buildings', labelPl: 'Grunty i budynki', parentId: 'fsl-bs-ppe', sortOrder: 62, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-ppe-machinery', code: 'PPE_MACHINERY', labelEn: 'Machinery & Equipment', labelPl: 'Maszyny i urządzenia', parentId: 'fsl-bs-ppe', sortOrder: 63, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-ppe-vehicles', code: 'PPE_VEHICLES', labelEn: 'Vehicles', labelPl: 'Środki transportu', parentId: 'fsl-bs-ppe', sortOrder: 64, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-intangibles', code: 'INTANGIBLE_ASSETS', labelEn: 'Intangible Assets', labelPl: 'Wartości niematerialne', parentId: 'fsl-bs-fixed', sortOrder: 65, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal', deaggregationReady: true },
  { id: 'fsl-bs-intangibles-software', code: 'SOFTWARE_ASSETS', labelEn: 'Software Assets', labelPl: 'Oprogramowanie', parentId: 'fsl-bs-intangibles', sortOrder: 66, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-intangibles-goodwill', code: 'GOODWILL', labelEn: 'Goodwill', labelPl: 'Wartość firmy', parentId: 'fsl-bs-intangibles', sortOrder: 67, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-other-non-current-assets', code: 'OTHER_NON_CURRENT_ASSETS', labelEn: 'Other Non-current Assets', labelPl: 'Pozostałe aktywa trwałe', parentId: 'fsl-bs-fixed', sortOrder: 68, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal', deaggregationReady: true },
  { id: 'fsl-bs-other-non-current-assets-deferred-tax', code: 'DEFERRED_TAX_ASSETS', labelEn: 'Deferred Tax Assets', labelPl: 'Aktywa z tytułu podatku odroczonego', parentId: 'fsl-bs-other-non-current-assets', sortOrder: 69, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-total-assets', code: 'TOTAL_ASSETS', labelEn: 'Total Assets', labelPl: 'Aktywa ogółem', sortOrder: 70, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'positive_normal', isTotal: true, isComputed: true },
  { id: 'fsl-bs-current-liabilities', code: 'CURRENT_LIABILITIES', labelEn: 'Current Liabilities', labelPl: 'Zobowiązania krótkoterminowe', sortOrder: 90, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'display_absolute', isSubtotal: true, isComputed: true },
  { id: 'fsl-bs-ap', code: 'AP', labelEn: 'Accounts Payable', labelPl: 'Zobowiązania handlowe', parentId: 'fsl-bs-current-liabilities', sortOrder: 91, aggregationLevel: 2, requiredLevel: 'required', signConvention: 'display_absolute', deaggregationReady: true },
  { id: 'fsl-bs-ap-trade', code: 'TRADE_PAYABLES', labelEn: 'Trade Payables', labelPl: 'Zobowiązania handlowe krajowe', parentId: 'fsl-bs-ap', sortOrder: 92, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-bs-short-term-debt', code: 'SHORT_TERM_DEBT', labelEn: 'Short-term Debt', labelPl: 'Zobowiązania krótkoterminowe finansowe', parentId: 'fsl-bs-current-liabilities', sortOrder: 93, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute', deaggregationReady: true },
  { id: 'fsl-bs-short-term-debt-bank', code: 'SHORT_TERM_BANK_DEBT', labelEn: 'Short-term Bank Debt', labelPl: 'Krótkoterminowy dług bankowy', parentId: 'fsl-bs-short-term-debt', sortOrder: 94, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-bs-short-term-debt-lease', code: 'CURRENT_LEASE_LIABILITIES', labelEn: 'Current Lease Liabilities', labelPl: 'Krótkoterminowe zobowiązania leasingowe', parentId: 'fsl-bs-short-term-debt', sortOrder: 95, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-bs-other-current-liabilities', code: 'OTHER_CURRENT_LIABILITIES', labelEn: 'Other Current Liabilities', labelPl: 'Pozostałe zobowiązania krótkoterminowe', parentId: 'fsl-bs-current-liabilities', sortOrder: 96, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute', deaggregationReady: true },
  { id: 'fsl-bs-other-current-liabilities-tax', code: 'TAX_PAYABLES', labelEn: 'Tax Payables', labelPl: 'Zobowiązania podatkowe', parentId: 'fsl-bs-other-current-liabilities', sortOrder: 97, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-bs-other-current-liabilities-accruals', code: 'ACCRUED_EXPENSES', labelEn: 'Accrued Expenses', labelPl: 'Rozliczenia międzyokresowe bierne', parentId: 'fsl-bs-other-current-liabilities', sortOrder: 98, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-bs-total-liabilities', code: 'TOTAL_LIABILITIES', labelEn: 'Total Liabilities', labelPl: 'Zobowiązania ogółem', sortOrder: 110, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'display_absolute', isSubtotal: true, isComputed: true, deaggregationReady: true },
  { id: 'fsl-bs-long-term-debt', code: 'LONG_TERM_DEBT', labelEn: 'Long-term Debt', labelPl: 'Zobowiązania długoterminowe finansowe', parentId: 'fsl-bs-total-liabilities', sortOrder: 111, aggregationLevel: 2, requiredLevel: 'required', signConvention: 'display_absolute', deaggregationReady: true },
  { id: 'fsl-bs-long-term-debt-bank', code: 'LONG_TERM_BANK_DEBT', labelEn: 'Long-term Bank Debt', labelPl: 'Dług bankowy długoterminowy', parentId: 'fsl-bs-long-term-debt', sortOrder: 112, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-bs-long-term-debt-lease', code: 'NON_CURRENT_LEASE_LIABILITIES', labelEn: 'Non-current Lease Liabilities', labelPl: 'Długoterminowe zobowiązania leasingowe', parentId: 'fsl-bs-long-term-debt', sortOrder: 113, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-bs-other-non-current-liabilities', code: 'OTHER_NON_CURRENT_LIABILITIES', labelEn: 'Other Non-current Liabilities', labelPl: 'Pozostałe zobowiązania długoterminowe', parentId: 'fsl-bs-total-liabilities', sortOrder: 114, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute', deaggregationReady: true },
  { id: 'fsl-bs-other-non-current-liabilities-provisions', code: 'LONG_TERM_PROVISIONS', labelEn: 'Long-term Provisions', labelPl: 'Rezerwy długoterminowe', parentId: 'fsl-bs-other-non-current-liabilities', sortOrder: 115, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-bs-equity', code: 'TOTAL_EQUITY', labelEn: 'Total Equity', labelPl: 'Kapitał własny', sortOrder: 130, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'positive_normal', isSubtotal: true, isComputed: true, deaggregationReady: true },
  { id: 'fsl-bs-share-capital', code: 'SHARE_CAPITAL', labelEn: 'Share Capital', labelPl: 'Kapitał podstawowy', parentId: 'fsl-bs-equity', sortOrder: 131, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-share-premium', code: 'SHARE_PREMIUM', labelEn: 'Share Premium', labelPl: 'Kapitał zapasowy', parentId: 'fsl-bs-equity', sortOrder: 132, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-retained-earnings', code: 'RETAINED_EARNINGS', labelEn: 'Retained Earnings', labelPl: 'Zyski zatrzymane', parentId: 'fsl-bs-equity', sortOrder: 133, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-retained-earnings-prior', code: 'RETAINED_EARNINGS_PRIOR', labelEn: 'Retained Earnings - Prior Years', labelPl: 'Wynik lat ubiegłych', parentId: 'fsl-bs-retained-earnings', sortOrder: 134, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-retained-earnings-current', code: 'RETAINED_EARNINGS_CURRENT', labelEn: 'Current Year Result', labelPl: 'Wynik bieżącego roku', parentId: 'fsl-bs-retained-earnings', sortOrder: 135, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-bs-total-liabilities-equity', code: 'TOTAL_LIABILITIES_EQUITY', labelEn: 'Total Liabilities and Equity', labelPl: 'Pasywa ogółem', sortOrder: 140, aggregationLevel: 1, requiredLevel: 'computed', signConvention: 'positive_normal', isTotal: true, isComputed: true, formulaJson: { type: 'sum', inputs: ['TOTAL_LIABILITIES', 'TOTAL_EQUITY'] } },
  { id: 'fsl-bs-wc', code: 'WORKING_CAPITAL', labelEn: 'Working Capital', labelPl: 'Kapitał obrotowy', sortOrder: 150, aggregationLevel: 1, requiredLevel: 'optional', signConvention: 'positive_normal', isComputed: true, formulaJson: { type: 'difference', inputs: ['CURRENT_ASSETS', 'CURRENT_LIABILITIES'] } },
]);

const CF_LINES = makeLines('CF', [
  { id: 'fsl-cf-operating', code: 'OPERATING_CF', labelEn: 'Operating Cash Flow', labelPl: 'Przepływy operacyjne', sortOrder: 10, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'positive_normal', isSubtotal: true, deaggregationReady: true },
  { id: 'fsl-cf-operating-net-income', code: 'NET_INCOME_CF', labelEn: 'Net Income in Operating Cash Flow', labelPl: 'Wynik netto w CFO', parentId: 'fsl-cf-operating', sortOrder: 11, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-cf-operating-depreciation', code: 'DEPRECIATION_ADDBACK', labelEn: 'Depreciation Add-back', labelPl: 'Korekta o amortyzację', parentId: 'fsl-cf-operating', sortOrder: 12, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-cf-change-wc', code: 'CHANGE_WORKING_CAPITAL', labelEn: 'Change in Working Capital', labelPl: 'Zmiana kapitału obrotowego', parentId: 'fsl-cf-operating', sortOrder: 13, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal', deaggregationReady: true },
  { id: 'fsl-cf-change-wc-ar', code: 'CHANGE_AR', labelEn: 'Change in Receivables', labelPl: 'Zmiana należności', parentId: 'fsl-cf-change-wc', sortOrder: 14, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-cf-change-wc-inventory', code: 'CHANGE_INVENTORY', labelEn: 'Change in Inventory', labelPl: 'Zmiana zapasów', parentId: 'fsl-cf-change-wc', sortOrder: 15, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-cf-change-wc-ap', code: 'CHANGE_AP', labelEn: 'Change in Payables', labelPl: 'Zmiana zobowiązań', parentId: 'fsl-cf-change-wc', sortOrder: 16, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-cf-taxes-paid', code: 'TAXES_PAID', labelEn: 'Taxes Paid', labelPl: 'Podatek zapłacony', parentId: 'fsl-cf-operating', sortOrder: 17, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-cf-interest-paid', code: 'INTEREST_PAID', labelEn: 'Interest Paid', labelPl: 'Odsetki zapłacone', parentId: 'fsl-cf-operating', sortOrder: 18, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-cf-investing', code: 'INVESTING_CF', labelEn: 'Investing Cash Flow', labelPl: 'Przepływy inwestycyjne', sortOrder: 30, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'positive_normal', isSubtotal: true, deaggregationReady: true },
  { id: 'fsl-cf-capex', code: 'CAPEX', labelEn: 'Capital Expenditures', labelPl: 'Nakłady inwestycyjne', parentId: 'fsl-cf-investing', sortOrder: 31, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute', deaggregationReady: true },
  { id: 'fsl-cf-capex-maintenance', code: 'MAINTENANCE_CAPEX', labelEn: 'Maintenance Capex', labelPl: 'CAPEX odtworzeniowy', parentId: 'fsl-cf-capex', sortOrder: 32, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-cf-capex-growth', code: 'GROWTH_CAPEX', labelEn: 'Growth Capex', labelPl: 'CAPEX rozwojowy', parentId: 'fsl-cf-capex', sortOrder: 33, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-cf-other-investing', code: 'OTHER_INVESTING_CF', labelEn: 'Other Investing Cash Flow', labelPl: 'Pozostałe przepływy inwestycyjne', parentId: 'fsl-cf-investing', sortOrder: 34, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-cf-financing', code: 'FINANCING_CF', labelEn: 'Financing Cash Flow', labelPl: 'Przepływy finansowe', sortOrder: 50, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'positive_normal', isSubtotal: true, deaggregationReady: true },
  { id: 'fsl-cf-debt-drawdown', code: 'DEBT_DRAWDOWN', labelEn: 'Debt Drawdown', labelPl: 'Zaciągnięcie finansowania dłużnego', parentId: 'fsl-cf-financing', sortOrder: 51, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-cf-debt-drawdown-bank', code: 'BANK_DEBT_DRAWDOWN', labelEn: 'Bank Debt Drawdown', labelPl: 'Uruchomienie długu bankowego', parentId: 'fsl-cf-debt-drawdown', sortOrder: 52, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-cf-debt-drawdown-lease', code: 'LEASE_DEBT_DRAWDOWN', labelEn: 'Lease Drawdown', labelPl: 'Nowe zobowiązania leasingowe', parentId: 'fsl-cf-debt-drawdown', sortOrder: 53, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'positive_normal' },
  { id: 'fsl-cf-debt-repayment', code: 'DEBT_REPAYMENT', labelEn: 'Debt Repayment', labelPl: 'Spłata finansowania dłużnego', parentId: 'fsl-cf-financing', sortOrder: 54, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-cf-debt-repayment-bank', code: 'BANK_DEBT_REPAYMENT', labelEn: 'Bank Debt Repayment', labelPl: 'Spłata długu bankowego', parentId: 'fsl-cf-debt-repayment', sortOrder: 55, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-cf-debt-repayment-lease', code: 'LEASE_DEBT_REPAYMENT', labelEn: 'Lease Repayment', labelPl: 'Spłata leasingu', parentId: 'fsl-cf-debt-repayment', sortOrder: 56, aggregationLevel: 3, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-cf-dividends', code: 'DIVIDENDS_PAID', labelEn: 'Dividends Paid', labelPl: 'Dywidendy wypłacone', parentId: 'fsl-cf-financing', sortOrder: 57, aggregationLevel: 2, requiredLevel: 'optional', signConvention: 'display_absolute' },
  { id: 'fsl-cf-fcf', code: 'FREE_CASH_FLOW', labelEn: 'Free Cash Flow', labelPl: 'Wolne przepływy pieniężne', sortOrder: 60, aggregationLevel: 1, requiredLevel: 'optional', signConvention: 'positive_normal', isSubtotal: true, isComputed: true },
  { id: 'fsl-cf-net-change-cash', code: 'NET_CHANGE_CASH', labelEn: 'Net Change in Cash', labelPl: 'Zmiana stanu środków pieniężnych', sortOrder: 70, aggregationLevel: 1, requiredLevel: 'required', signConvention: 'positive_normal', isTotal: true, isComputed: true },
]);

const CANONICAL_LINES: CanonicalLineDefinition[] = [...PL_LINES, ...BS_LINES, ...CF_LINES];

const LINE_BY_ID = new Map(CANONICAL_LINES.map((line) => [line.id, line]));
const LINE_BY_CODE = new Map(CANONICAL_LINES.map((line) => [line.code, line]));

export function getCanonicalLineDefinitions(): CanonicalLineDefinition[] {
  return [...CANONICAL_LINES];
}

export function getCanonicalLinesByStatementType(
  statementType: CanonicalStatementType
): CanonicalLineDefinition[] {
  return CANONICAL_LINES.filter((line) => line.statementType === statementType).sort(
    (left, right) => left.sortOrder - right.sortOrder
  );
}

export function getCanonicalLineById(id: string | null | undefined): CanonicalLineDefinition | null {
  if (!id) return null;
  return LINE_BY_ID.get(id) || null;
}

export function getCanonicalLineByCode(code: string | null | undefined): CanonicalLineDefinition | null {
  const normalized = String(code || '')
    .trim()
    .toUpperCase();
  if (!normalized) return null;
  return LINE_BY_CODE.get(normalized) || null;
}

export function getRequiredCanonicalLineIds(
  statementType: CanonicalStatementType
): string[] {
  return getCanonicalLinesByStatementType(statementType)
    .filter((line) => line.requiredLevel === 'required')
    .map((line) => line.id);
}

export function getCanonicalStatementTypeOrder(statementType: string | null | undefined): number {
  const normalized = String(statementType || '').trim().toUpperCase();
  if (normalized === 'P&L') return 1;
  if (normalized === 'BS') return 2;
  if (normalized === 'CF') return 3;
  return 9;
}

export function getCanonicalStatementTypes(): CanonicalStatementType[] {
  return ['P&L', 'BS', 'CF'];
}

export function getCanonicalLineVersionTag(): string {
  return 'finance-v2-l3';
}

export function createCanonicalVersionId(): string {
  return uuidv4();
}
