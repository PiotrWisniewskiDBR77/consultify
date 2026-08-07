-- Promote the three curated DBR77 workbook templates to their intended
-- lifecycle state. They were inserted by migrations 784/785 after the older
-- one-time "featured -> approved" promotion in 721, so existing databases
-- retained the column default (`draft`) despite these being system catalogue
-- templates. Exact name+category pairs keep this repair narrowly scoped.

UPDATE tp_base_templates
   SET status = 'approved',
       visibility = 'system',
       approval_history = COALESCE(approval_history, '[]'::jsonb) ||
         jsonb_build_array(jsonb_build_object(
           'event', 'approved_curated_system_template',
           'at', NOW(),
           'actor', 'migration:946_approve_dbr77_workbook_templates',
           'previous_status', status
         ))
 WHERE created_by IS NULL
   AND (name, category) IN (
     ('Rejestr ryzyk', 'risk'),
     ('Dashboard KPI', 'kpi'),
     ('Rejestr inicjatyw', 'initiative')
   )
   AND (status <> 'approved' OR visibility IS DISTINCT FROM 'system');
