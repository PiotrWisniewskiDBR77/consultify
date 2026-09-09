SELECT 'ie_governance_policies (*,PRODUCT,DEFAULT)' AS kontrola, count(*) AS wierszy, count(*) FILTER (WHERE status='ACTIVE') AS aktywne FROM ie_governance_policies WHERE organization_id='*' AND scope_type='PRODUCT' AND scope_id='DEFAULT'
UNION ALL SELECT 'document_studio_templates __system__', count(*), NULL FROM document_studio_templates WHERE organization_id='__system__'
UNION ALL SELECT 'v8_output_artifacts __system__', count(*), NULL FROM v8_output_artifacts WHERE organization_id='__system__'
UNION ALL SELECT 'v8_artifact_origin_links __system__', count(*), NULL FROM v8_artifact_origin_links WHERE organization_id='__system__'
UNION ALL SELECT 'security_policies __global__', count(*), NULL FROM security_policies WHERE organization_id='__global__'
UNION ALL SELECT 'knowledge_doc_versions pusta org', count(*), NULL FROM knowledge_doc_versions WHERE organization_id IS NULL OR organization_id='';
