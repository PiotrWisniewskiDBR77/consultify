-- The workbook editor's lightweight formula evaluator renders the seeded
-- empty-row percentage expression as #DIV/0. Keep a safe absolute variance
-- formula and an explicit decision/action field; percentage formatting remains
-- available to authors for populated metrics.

UPDATE tp_base_templates
SET description = 'Executive KPI control workbook with accountable targets, actuals, safe formula-driven variance, trend, owner, evidence date and decision action.',
    schema_snapshot = $${
      "title":"Executive KPI Control",
      "description":"Decision-ready KPI control with safe formula-driven variance and ownership.",
      "sheets":[{
        "name":"KPI Control",
        "purpose":"Compare target and actual performance and identify intervention needs.",
        "columns":[
          {"key":"A","header":"Metric","width":30,"type":"text"},
          {"key":"B","header":"Target","width":14,"type":"number","numberFormat":"#,##0.00"},
          {"key":"C","header":"Actual","width":14,"type":"number","numberFormat":"#,##0.00"},
          {"key":"D","header":"Variance","width":14,"type":"number","numberFormat":"#,##0.00"},
          {"key":"E","header":"Trend","width":16,"type":"text","validation":{"type":"list","values":["Improving","Stable","Deteriorating"],"allowBlank":true}},
          {"key":"F","header":"Owner","width":22,"type":"text"},
          {"key":"G","header":"Evidence date","width":16,"type":"date"},
          {"key":"H","header":"Decision / action","width":32,"type":"text"}
        ],
        "rows":[{"cells":{"D":{"formula":"C2-B2"}}}],
        "freezeRow":1,
        "autoFilter":true,
        "showGridLines":false,
        "tabColor":"1F4E78",
        "headerStyle":{"bold":true,"fontColor":"FFFFFF","bgColor":"1F4E78","alignment":"center","wrapText":true},
        "alternateRowColor":"EAF0F6",
        "conditionalFormatting":[{"ref":"D2:D500","rules":[{"type":"colorScale","colors":["F8696B","FFEB84","63BE7B"]}]}]
      }]
    }$$::jsonb
WHERE id = 'f5da6891-de3e-431d-8bc8-10e97b01609a';
