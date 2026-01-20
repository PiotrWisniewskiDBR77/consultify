-- Migration: 227_feedback_mock_seed.sql
-- Purpose: Seed demo feedback records for UI lists/filters/analytics.

INSERT OR IGNORE INTO system_feedback (
    id, user_id, user_name, type, message, rating, status, metadata, created_at
) VALUES
    ('fb-mock-1', 'user-1', 'Piotr Wisniewski', 'IDEA', 'Dodaj tryb jasny dla calego admina.', 5, 'IN_PROGRESS', '{"tags":["ux","theme"]}', datetime('now','-2 days')),
    ('fb-mock-2', 'user-2', 'Anna Nowak', 'BUG', 'Eksport danych czasem zwraca pusty plik JSON.', 3, 'NEW', '{"tags":["export","compliance"]}', datetime('now','-1 day')),
    ('fb-mock-3', 'user-3', 'Jan Kowalski', 'QUESTION', 'Czy billing obsluguje faktury proforma?', 4, 'RESOLVED', '{"tags":["billing","invoice"]}', datetime('now','-5 days')),
    ('fb-mock-4', 'user-4', 'Ewa Zielinska', 'PRAISE', 'Swietny widok Security - czy bedzie SSO z Azure?', 5, 'NEW', '{"tags":["security","sso"]}', datetime('now','-3 days'));

-- Feedback stats can be derived from table; no extra seed required.
