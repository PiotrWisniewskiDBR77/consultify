/**
 * Entity Translation Middleware
 * Provides automatic translation overlay for entities based on Accept-Language header
 */

import { Request, Response, NextFunction } from 'express';

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            locale?: string;
            translations?: EntityTranslationService;
        }
    }
}

export interface TranslatedField {
    field: string;
    value: string;
    isTranslated: boolean;
    isMachineTranslated?: boolean;
}

export interface TranslationResult {
    [fieldName: string]: string;
}

const SUPPORTED_LOCALES = ['en', 'pl', 'de', 'es', 'ar', 'ja'];
const DEFAULT_LOCALE = 'en';

/**
 * Parse Accept-Language header and return best matching locale
 */
function parseAcceptLanguage(header: string | undefined): string {
    if (!header) return DEFAULT_LOCALE;

    // Parse header like "pl-PL,pl;q=0.9,en;q=0.8"
    const parts = header.split(',').map(part => {
        const [lang, q] = part.trim().split(';q=');
        return {
            locale: lang.split('-')[0].toLowerCase(),
            quality: q ? parseFloat(q) : 1.0
        };
    });

    // Sort by quality and find first supported locale
    parts.sort((a, b) => b.quality - a.quality);

    for (const part of parts) {
        if (SUPPORTED_LOCALES.includes(part.locale)) {
            return part.locale;
        }
    }

    return DEFAULT_LOCALE;
}

/**
 * Entity Translation Service - handles translation lookups and caching
 */
export class EntityTranslationService {
    private db: any;
    private locale: string;
    private cache: Map<string, TranslationResult> = new Map();

    constructor(database: any, locale: string) {
        this.db = database;
        this.locale = locale;
    }

    /**
     * Get translations for an entity
     */
    async getTranslations(
        entityType: string,
        entityId: string
    ): Promise<TranslationResult> {
        if (this.locale === 'en') {
            return {}; // No translation needed for source language
        }

        const cacheKey = `${entityType}:${entityId}:${this.locale}`;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        try {
            const rows = await this.db.all(`
        SELECT field_name, translated_value, is_machine_translated
        FROM entity_translations
        WHERE entity_type = ? AND entity_id = ? AND locale = ?
      `, [entityType, entityId, this.locale]);

            const result: TranslationResult = {};
            for (const row of rows) {
                result[row.field_name] = row.translated_value;
            }

            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.error('Translation lookup failed:', error);
            return {};
        }
    }

    /**
     * Apply translations to an entity object
     */
    async translateEntity<T extends Record<string, any>>(
        entity: T,
        entityType: string,
        fields: string[] = ['name', 'description', 'summary', 'title']
    ): Promise<T> {
        if (this.locale === 'en' || !entity.id) {
            return entity;
        }

        const translations = await this.getTranslations(entityType, entity.id);

        const translated = { ...entity };
        for (const field of fields) {
            if (translations[field] && entity[field]) {
                (translated as any)[field] = translations[field];
                (translated as any)[`_${field}_original`] = entity[field];
                (translated as any)[`_${field}_translated`] = true;
            }
        }

        return translated;
    }

    /**
     * Translate an array of entities
     */
    async translateEntities<T extends Record<string, any>>(
        entities: T[],
        entityType: string,
        fields?: string[]
    ): Promise<T[]> {
        return Promise.all(
            entities.map(entity => this.translateEntity(entity, entityType, fields))
        );
    }

    /**
     * Store a new translation
     */
    async saveTranslation(
        entityType: string,
        entityId: string,
        fieldName: string,
        translatedValue: string,
        isMachineTranslated: boolean = false
    ): Promise<void> {
        const id = crypto.randomUUID();

        await this.db.run(`
      INSERT OR REPLACE INTO entity_translations 
        (id, entity_type, entity_id, field_name, locale, translated_value, is_machine_translated, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [id, entityType, entityId, fieldName, this.locale, translatedValue, isMachineTranslated ? 1 : 0]);

        // Invalidate cache
        const cacheKey = `${entityType}:${entityId}:${this.locale}`;
        this.cache.delete(cacheKey);
    }

    /**
     * Get current locale
     */
    getLocale(): string {
        return this.locale;
    }
}

/**
 * Middleware factory - creates locale-aware middleware
 */
export function createI18nMiddleware(database: any) {
    return (req: Request, _res: Response, next: NextFunction) => {
        // Determine locale from query param, header, or user preference
        const locale =
            (req.query.locale as string) ||
            parseAcceptLanguage(req.headers['accept-language']) ||
            DEFAULT_LOCALE;

        req.locale = locale;
        req.translations = new EntityTranslationService(database, locale);

        next();
    };
}

/**
 * Response helper - translate entities in API response
 */
export function withTranslations<T extends Record<string, any>>(
    req: Request,
    entities: T | T[],
    entityType: string,
    fields?: string[]
): Promise<T | T[]> {
    if (!req.translations) {
        return Promise.resolve(entities);
    }

    if (Array.isArray(entities)) {
        return req.translations.translateEntities(entities, entityType, fields);
    }

    return req.translations.translateEntity(entities, entityType, fields);
}

export default createI18nMiddleware;
