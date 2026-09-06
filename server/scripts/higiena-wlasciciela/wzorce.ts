export const WZORCE_SMIECI = [
  { id: 'staging-bug', label: 'zaczyna się od [STAGING] BUG:', re: /^\[STAGING\] BUG:/i },
  { id: 'test', label: 'zaczyna się od test', re: /^test/i },
  { id: 'probe', label: 'zaczyna się od probe', re: /^probe/i },
  { id: 'kosmos', label: 'zaczyna się od kosmos', re: /^kosmos/i },
  { id: 'new-idea', label: 'zaczyna się od New Idea', re: /^New Idea/i },
  { id: 'f1-26', label: 'zaczyna się od F1-26 from assessment', re: /^F1-26 from assessment/i },
  { id: 'asdf', label: 'zaczyna się od asdf', re: /^asdf/i },
  { id: 'xxx', label: 'zaczyna się od xxx', re: /^xxx/i },
  { id: 'digits', label: 'tytuł zawiera tylko cyfry', re: /^\d+$/ },
  { id: 'short', label: 'tytuł krótszy niż 3 znaki', re: /^.{0,2}$/s },
] as const;

export function dopasujWzorzec(title: string) { return WZORCE_SMIECI.find(x => x.re.test(title.trim())); }
