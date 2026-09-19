/**
 * Returns the visible text that the English-language smoke may inspect.
 *
 * The function is intentionally self-contained so Playwright can serialize it
 * directly with `page.evaluate(collectLanguageSmokeText)`. Personal data is
 * removed by semantic field metadata when present and by the matching table
 * column when an older screen has not added that metadata yet.
 */
export function collectLanguageSmokeText() {
  const body = document.body;
  if (!body) return '';

  const personalFieldNames = new Set([
    'assigneeName',
    'createdBy',
    'email',
    'firstName',
    'fullName',
    'lastName',
    'ownerName',
    'respondentName',
    'reviewerName',
  ]);
  const personalColumnLabels = new Set([
    'assignee',
    'assigned to',
    'email',
    'name',
    'owner',
    'respondent',
    'reviewer',
  ]);
  const excludedValues = new Set();
  const addValue = (element) => {
    const value = String(element?.innerText || element?.textContent || '').trim();
    if (value.length >= 2) excludedValues.add(value);
  };

  for (const element of body.querySelectorAll('[data-language-source="user-content"]')) {
    addValue(element);
  }
  for (const element of body.querySelectorAll('[data-language-field]')) {
    if (personalFieldNames.has(element.getAttribute('data-language-field') || '')) addValue(element);
  }

  for (const table of body.querySelectorAll('table')) {
    const headers = Array.from(table.querySelectorAll('thead th'));
    headers.forEach((header, index) => {
      const field = header.getAttribute('data-language-field');
      const label = String(header.innerText || header.textContent || '').trim().toLowerCase();
      if (!personalFieldNames.has(field || '') && !personalColumnLabels.has(label)) return;
      for (const row of table.querySelectorAll('tbody tr')) {
        const cell = row.querySelectorAll('td')[index];
        if (cell) addValue(cell);
      }
    });
  }

  let text = String(body.innerText || body.textContent || '');
  for (const value of [...excludedValues].sort((a, b) => b.length - a.length)) {
    text = text.split(value).join(' ');
  }
  return text;
}

export function countPolishDiacritics(text) {
  return (String(text).match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length;
}
