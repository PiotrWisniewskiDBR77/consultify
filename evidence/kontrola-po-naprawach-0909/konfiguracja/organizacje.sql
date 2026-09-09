SELECT name, count(*) n, min(created_at)::date od, max(created_at)::date do FROM organizations GROUP BY 1 ORDER BY 2 DESC;
