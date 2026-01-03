/**
 * Invoice Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Invoice generation and management with PDF support.
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const invoiceServiceJS = require('../../services/invoiceService.js');

// Re-export all functions
export const generateInvoiceNumber = invoiceServiceJS.generateInvoiceNumber;
export const createInvoice = invoiceServiceJS.createInvoice;
export const updateInvoice = invoiceServiceJS.updateInvoice;
export const getInvoice = invoiceServiceJS.getInvoice;
export const listInvoices = invoiceServiceJS.listInvoices;
export const markInvoicePaid = invoiceServiceJS.markInvoicePaid;
export const markInvoiceOverdue = invoiceServiceJS.markInvoiceOverdue;
export const voidInvoice = invoiceServiceJS.voidInvoice;
export const generateInvoicePDF = invoiceServiceJS.generateInvoicePDF;
export const sendInvoiceEmail = invoiceServiceJS.sendInvoiceEmail;

// Default export for backward compatibility
const invoiceService = invoiceServiceJS.default || invoiceServiceJS;

export default invoiceService;

