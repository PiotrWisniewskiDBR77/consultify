import toast from 'react-hot-toast';

export async function copyPlainText(text: string, lang: 'pl' | 'en' = 'en'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(lang === 'pl' ? 'Skopiowano' : 'Copied');
  } catch {
    toast.error(lang === 'pl' ? 'Nie udało się skopiować' : 'Copy failed');
  }
}

interface CopyableItem {
  title: string;
  status?: string;
  description?: string;
  aiSummary?: string;
}

export async function copyAsMarkdown(item: CopyableItem, lang: 'pl' | 'en' = 'en'): Promise<void> {
  const parts: string[] = [`## ${item.title}`];
  if (item.status) parts.push(`**Status**: ${item.status}`);
  if (item.description) parts.push('', item.description);
  if (item.aiSummary) parts.push('', `> **AI Summary**: ${item.aiSummary}`);
  await copyPlainText(parts.join('\n'), lang);
}

export async function copyForSlack(item: CopyableItem, lang: 'pl' | 'en' = 'en'): Promise<void> {
  const parts: string[] = [`*${item.title}*`];
  if (item.status) parts.push(`Status: \`${item.status}\``);
  if (item.description) parts.push(`> ${item.description.slice(0, 300)}${item.description.length > 300 ? '…' : ''}`);
  if (item.aiSummary) parts.push(`_AI: ${item.aiSummary}_`);
  await copyPlainText(parts.join('\n'), lang);
}
