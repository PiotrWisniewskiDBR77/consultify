-- Migration: 227_feedback_mock_seed.sql
-- Purpose: Seed demo feedback records for UI lists/filters/analytics.

INSERT INTO system_feedback (
    id, user_id, user_email, user_name, type, message, rating, status, metadata, created_at
) VALUES
    ('fb-mock-1', 'user-1', 'piotr@example.com', 'Piotr Wiśniewski', 'IDEA', 'Dodaj tryb jasny dla całego admina.', 5, 'IN_PROGRESS', '{"tags":["ux","theme"]}', CURRENT_TIMESTAMP - INTERVAL '2 days'),
    ('fb-mock-2', 'user-2', 'anna@example.com', 'Anna Nowak', 'BUG', 'Eksport danych czasem zwraca pusty plik JSON.', 3, 'NEW', '{"tags":["export","compliance"]}', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    ('fb-mock-3', 'user-3', 'jan@example.com', 'Jan Kowalski', 'QUESTION', 'Czy billing obsługuje faktury proforma?', 4, 'RESOLVED', '{"tags":["billing","invoice"]}', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    ('fb-mock-4', 'user-4', 'ewa@example.com', 'Ewa Zielińska', 'PRAISE', 'Świetny widok Security – czy będzie SSO z Azure?', 5, 'NEW', '{"tags":["security","sso"]}', CURRENT_TIMESTAMP - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

-- Feedback stats can be derived from table; no extra seed required.
