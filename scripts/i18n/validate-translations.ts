#!/usr/bin/env npx ts-node
/**
 * Translation Validation & Auto-Fix Script
 *
 * This script compares the English (source) translation files with target locales
 * and identifies missing, untranslated, or problematic translations.
 *
 * Usage:
 *   npx ts-node scripts/i18n/validate-translations.ts --check          # Check only
 *   npx ts-node scripts/i18n/validate-translations.ts --fix            # Fix missing translations
 *   npx ts-node scripts/i18n/validate-translations.ts --report         # Generate detailed report
 *   npx ts-node scripts/i18n/validate-translations.ts --locale=ja      # Check specific locale
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  sourceLocale: 'en',
  targetLocales: ['pl', 'de', 'es', 'ar', 'ja'],
  localesDir: path.resolve(__dirname, '../../public/locales'),
  // Keys that should NOT be translated (keep as-is)
  skipTranslation: [
    /^[A-Z0-9_]+$/, // ALL_CAPS constants
    /^https?:\/\//, // URLs
    /^[a-z]+:\/\//, // URIs
    /^\d+$/, // Pure numbers
    /^{{.*}}$/, // Template variables only
    /^[A-Z]{2,5}$/, // Acronyms like API, SSO, ROI
  ],
  // Technical terms that should stay in English
  technicalTerms: [
    'API',
    'SSO',
    'ROI',
    'KPI',
    'OKR',
    'CEO',
    'CTO',
    'CFO',
    'COO',
    'ERP',
    'CRM',
    'MES',
    'WMS',
    'IoT',
    'AI',
    'ML',
    'DRD',
    'SIRI',
    'ADMA',
    'CMMI',
    'GDPR',
    'SOC2',
    'ISO',
    'PDPL',
    'APPI',
    'PIPEDA',
    'CCPA',
    'OAuth',
    'JWT',
    'AES',
    'SHA',
    'RSA',
    'SSL',
    'TLS',
    'HTTP',
    'HTTPS',
    'JSON',
    'XML',
    'CSV',
    'PDF',
    'URL',
    'URI',
    'UUID',
    'ID',
    'Consultinity',
    'DBR77',
  ],
  // Glossary for consistent translations
  glossary: {
    ja: {
      Dashboard: 'ダッシュボード',
      Assessment: '評価',
      Initiative: 'イニシアチブ',
      Initiatives: 'イニシアチブ',
      Roadmap: 'ロードマップ',
      Implementation: '実装',
      Execution: '実行',
      Settings: '設定',
      Profile: 'プロフィール',
      Organization: '組織',
      Project: 'プロジェクト',
      User: 'ユーザー',
      Admin: '管理者',
      Save: '保存',
      Cancel: 'キャンセル',
      Delete: '削除',
      Edit: '編集',
      Add: '追加',
      Remove: '削除',
      Close: '閉じる',
      Open: '開く',
      View: '表示',
      Download: 'ダウンロード',
      Upload: 'アップロード',
      Export: 'エクスポート',
      Import: 'インポート',
      Search: '検索',
      Filter: 'フィルター',
      Sort: '並び替え',
      Loading: '読み込み中',
      Error: 'エラー',
      Warning: '警告',
      Success: '成功',
      Info: '情報',
      Confirm: '確認',
      Submit: '送信',
      Back: '戻る',
      Next: '次へ',
      Previous: '前へ',
      Continue: '続行',
      Yes: 'はい',
      No: 'いいえ',
      Status: 'ステータス',
      Progress: '進捗',
      Complete: '完了',
      Completed: '完了済み',
      Pending: '保留中',
      'In Progress': '進行中',
      Blocked: 'ブロック中',
      Draft: '下書き',
      Active: 'アクティブ',
      Inactive: '非アクティブ',
      Enabled: '有効',
      Disabled: '無効',
      Required: '必須',
      Optional: 'オプション',
      Select: '選択',
      Choose: '選択',
      Enter: '入力',
      Type: '入力',
      Name: '名前',
      Description: '説明',
      Title: 'タイトル',
      Date: '日付',
      Time: '時間',
      Email: 'メール',
      Password: 'パスワード',
      Username: 'ユーザー名',
      Login: 'ログイン',
      Logout: 'ログアウト',
      'Sign in': 'サインイン',
      'Sign out': 'サインアウト',
      'Sign up': 'サインアップ',
      Register: '登録',
      Notifications: '通知',
      Messages: 'メッセージ',
      Help: 'ヘルプ',
      Support: 'サポート',
      Contact: 'お問い合わせ',
      About: '概要',
      Privacy: 'プライバシー',
      Terms: '利用規約',
      Security: 'セキュリティ',
      Maturity: '成熟度',
      Level: 'レベル',
      Score: 'スコア',
      Target: '目標',
      Actual: '現状',
      Gap: 'ギャップ',
      Priority: '優先度',
      High: '高',
      Medium: '中',
      Low: '低',
      Complexity: '複雑さ',
      Cost: 'コスト',
      Benefit: '効果',
      Total: '合計',
      Average: '平均',
      Minimum: '最小',
      Maximum: '最大',
      Owner: '所有者',
      Assigned: '担当者',
      'Due Date': '期限',
      'Start Date': '開始日',
      'End Date': '終了日',
      Created: '作成日',
      Updated: '更新日',
      Actions: 'アクション',
      Options: 'オプション',
      More: 'もっと見る',
      Less: '閉じる',
      Show: '表示',
      Hide: '非表示',
      Expand: '展開',
      Collapse: '折りたたむ',
      All: 'すべて',
      None: 'なし',
      Other: 'その他',
      Custom: 'カスタム',
      Default: 'デフォルト',
      Overview: '概要',
      Details: '詳細',
      Summary: 'サマリー',
      Report: 'レポート',
      Reports: 'レポート',
      Analytics: '分析',
      Metrics: 'メトリクス',
      Performance: 'パフォーマンス',
      Quality: '品質',
      Process: 'プロセス',
      Processes: 'プロセス',
      Data: 'データ',
      Culture: '文化',
      Strategy: '戦略',
      Business: 'ビジネス',
      Digital: 'デジタル',
      Transformation: '変革',
      Innovation: 'イノベーション',
      Automation: '自動化',
      Integration: '統合',
      Governance: 'ガバナンス',
      Compliance: 'コンプライアンス',
      Risk: 'リスク',
      Management: '管理',
      Planning: '計画',
      Monitoring: '監視',
      Control: '制御',
      Optimization: '最適化',
      Improvement: '改善',
      Development: '開発',
      Training: 'トレーニング',
      Skills: 'スキル',
      Competence: '能力',
      Knowledge: '知識',
      Experience: '経験',
      Team: 'チーム',
      Member: 'メンバー',
      Members: 'メンバー',
      Role: '役割',
      Roles: '役割',
      Permission: '権限',
      Permissions: '権限',
      Access: 'アクセス',
      Workspace: 'ワークスペース',
      Workspaces: 'ワークスペース',
      Portfolio: 'ポートフォリオ',
      Product: '製品',
      Products: '製品',
      Service: 'サービス',
      Services: 'サービス',
      Customer: '顧客',
      Customers: '顧客',
      Client: 'クライアント',
      Clients: 'クライアント',
      Partner: 'パートナー',
      Partners: 'パートナー',
      Vendor: 'ベンダー',
      Supplier: 'サプライヤー',
      Industry: '業界',
      Sector: 'セクター',
      Market: '市場',
      Region: '地域',
      Country: '国',
      Language: '言語',
      Currency: '通貨',
      Timezone: 'タイムゾーン',
      Format: 'フォーマット',
      Theme: 'テーマ',
      Light: 'ライト',
      Dark: 'ダーク',
      System: 'システム',
      Appearance: '外観',
      Preferences: '設定',
      Configuration: '設定',
      Account: 'アカウント',
      Billing: '請求',
      Plan: 'プラン',
      Subscription: 'サブスクリプション',
      Trial: 'トライアル',
      Free: '無料',
      Premium: 'プレミアム',
      Enterprise: 'エンタープライズ',
      Feature: '機能',
      Features: '機能',
      Limit: '制限',
      Limits: '制限',
      Usage: '使用量',
      Quota: 'クォータ',
      Resources: 'リソース',
      Documentation: 'ドキュメント',
      Guide: 'ガイド',
      Tutorial: 'チュートリアル',
      FAQ: 'FAQ',
      Feedback: 'フィードバック',
      Review: 'レビュー',
      Rating: '評価',
      Comment: 'コメント',
      Comments: 'コメント',
      Note: 'メモ',
      Notes: 'メモ',
      Attachment: '添付ファイル',
      Attachments: '添付ファイル',
      File: 'ファイル',
      Files: 'ファイル',
      Folder: 'フォルダ',
      Folders: 'フォルダ',
      Document: 'ドキュメント',
      Documents: 'ドキュメント',
      Image: '画像',
      Images: '画像',
      Video: 'ビデオ',
      Videos: 'ビデオ',
      Audio: 'オーディオ',
      Link: 'リンク',
      Links: 'リンク',
      Share: '共有',
      Sharing: '共有',
      Shared: '共有済み',
      Private: 'プライベート',
      Public: 'パブリック',
      Internal: '内部',
      External: '外部',
      Invite: '招待',
      Invitation: '招待',
      Accept: '承諾',
      Decline: '拒否',
      Reject: '却下',
      Approve: '承認',
      Approved: '承認済み',
      Rejected: '却下済み',
      Reviewing: 'レビュー中',
      Reviewed: 'レビュー済み',
      Verified: '検証済み',
      Unverified: '未検証',
      Valid: '有効',
      Invalid: '無効',
      Expired: '期限切れ',
      Archived: 'アーカイブ済み',
      Deleted: '削除済み',
      Restored: '復元済み',
      Version: 'バージョン',
      Versions: 'バージョン',
      History: '履歴',
      Changelog: '変更履歴',
      Update: '更新',
      Updates: '更新',
      Upgrade: 'アップグレード',
      Downgrade: 'ダウングレード',
      Install: 'インストール',
      Uninstall: 'アンインストール',
      Enable: '有効化',
      Disable: '無効化',
      Activate: '有効化',
      Deactivate: '無効化',
      Start: '開始',
      Stop: '停止',
      Pause: '一時停止',
      Resume: '再開',
      Restart: '再起動',
      Refresh: '更新',
      Reload: '再読み込み',
      Reset: 'リセット',
      Clear: 'クリア',
      Sync: '同期',
      Syncing: '同期中',
      Synced: '同期済み',
      Connect: '接続',
      Disconnect: '切断',
      Connected: '接続済み',
      Disconnected: '切断済み',
      Online: 'オンライン',
      Offline: 'オフライン',
      Available: '利用可能',
      Unavailable: '利用不可',
      Busy: '対応中',
      Away: '離席中',
      'Do not disturb': '取り込み中',
      Sales: '営業',
      Marketing: 'マーケティング',
      Technology: 'テクノロジー',
      'R&D': 'R&D',
      Purchasing: '購買',
      Logistics: '物流',
      Production: '生産',
      Finance: '財務',
      'Human Resources': '人事',
      HR: '人事',
      Legal: '法務',
      IT: 'IT',
      Operations: 'オペレーション',
      'Supply Chain': 'サプライチェーン',
      Manufacturing: '製造',
      Warehouse: '倉庫',
      Inventory: '在庫',
      Shipping: '出荷',
      Delivery: '配送',
      Order: '注文',
      Orders: '注文',
      Invoice: '請求書',
      Invoices: '請求書',
      Payment: '支払い',
      Payments: '支払い',
      Transaction: '取引',
      Transactions: '取引',
      Budget: '予算',
      Forecast: '予測',
      Analysis: '分析',
      Audit: '監査',
      Regulation: '規制',
      Standard: '基準',
      Standards: '基準',
      Certification: '認証',
      Certificate: '証明書',
      License: 'ライセンス',
      Contract: '契約',
      Agreement: '契約',
      Policy: 'ポリシー',
      Policies: 'ポリシー',
      Procedure: '手順',
      Procedures: '手順',
      Workflow: 'ワークフロー',
      Workflows: 'ワークフロー',
      Automated: '自動化',
      Manual: '手動',
      Hybrid: 'ハイブリッド',
      Cloud: 'クラウド',
      'On-premise': 'オンプレミス',
      SaaS: 'SaaS',
      PaaS: 'PaaS',
      IaaS: 'IaaS',
      Scalability: 'スケーラビリティ',
      Reliability: '信頼性',
      Availability: '可用性',
      Maintainability: '保守性',
      Usability: 'ユーザビリティ',
      Accessibility: 'アクセシビリティ',
      Responsiveness: 'レスポンシブ性',
      Efficiency: '効率性',
      Effectiveness: '有効性',
      Productivity: '生産性',
      Profitability: '収益性',
      Sustainability: '持続可能性',
      Flexibility: '柔軟性',
      Agility: 'アジリティ',
      Resilience: 'レジリエンス',
      Adaptability: '適応性',
      Competitiveness: '競争力',
      Excellence: '卓越性',
      'Best Practice': 'ベストプラクティス',
      'Best Practices': 'ベストプラクティス',
      Benchmark: 'ベンチマーク',
      Benchmarking: 'ベンチマーキング',
      Baseline: 'ベースライン',
      Milestone: 'マイルストーン',
      Milestones: 'マイルストーン',
      Deliverable: '成果物',
      Deliverables: '成果物',
      Outcome: '成果',
      Outcomes: '成果',
      Output: 'アウトプット',
      Outputs: 'アウトプット',
      Input: 'インプット',
      Inputs: 'インプット',
      Resource: 'リソース',
      Constraint: '制約',
      Constraints: '制約',
      Assumption: '前提',
      Assumptions: '前提',
      Dependency: '依存関係',
      Dependencies: '依存関係',
      Blocker: 'ブロッカー',
      Blockers: 'ブロッカー',
      Issue: '課題',
      Issues: '課題',
      Problem: '問題',
      Problems: '問題',
      Challenge: '課題',
      Challenges: '課題',
      Opportunity: '機会',
      Opportunities: '機会',
      Threat: '脅威',
      Threats: '脅威',
      Strength: '強み',
      Strengths: '強み',
      Weakness: '弱み',
      Weaknesses: '弱み',
      Gaps: 'ギャップ',
      Recommendation: '推奨',
      Recommendations: '推奨',
      Suggestion: '提案',
      Suggestions: '提案',
      Advice: 'アドバイス',
      Guidance: 'ガイダンス',
      Instruction: '指示',
      Instructions: '指示',
      Step: 'ステップ',
      Steps: 'ステップ',
      Phase: 'フェーズ',
      Phases: 'フェーズ',
      Stage: 'ステージ',
      Stages: 'ステージ',
      Wave: 'ウェーブ',
      Waves: 'ウェーブ',
      Quarter: '四半期',
      Quarters: '四半期',
      Month: '月',
      Months: 'ヶ月',
      Week: '週',
      Weeks: '週間',
      Day: '日',
      Days: '日間',
      Hour: '時間',
      Hours: '時間',
      Minute: '分',
      Minutes: '分',
      Second: '秒',
      Seconds: '秒',
      Year: '年',
      Years: '年間',
      Payback: '回収期間',
      'Payback Period': '回収期間',
    },
  },
};

interface TranslationIssue {
  path: string;
  type: 'missing' | 'untranslated' | 'empty' | 'placeholder_mismatch';
  sourceValue?: string;
  targetValue?: string;
  suggestion?: string;
}

interface ValidationResult {
  locale: string;
  file: string;
  totalKeys: number;
  missingKeys: number;
  untranslatedKeys: number;
  emptyKeys: number;
  placeholderMismatches: number;
  issues: TranslationIssue[];
}

// Helper functions
function flattenObject(obj: any, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const key in obj) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], newKey));
    } else if (typeof obj[key] === 'string') {
      result[newKey] = obj[key];
    } else if (Array.isArray(obj[key])) {
      obj[key].forEach((item: any, index: number) => {
        if (typeof item === 'string') {
          result[`${newKey}[${index}]`] = item;
        } else if (typeof item === 'object') {
          Object.assign(result, flattenObject(item, `${newKey}[${index}]`));
        }
      });
    }
  }

  return result;
}

function setNestedValue(obj: any, path: string, value: string): void {
  const keys = path
    .split(/\.(?![^[]*])/)
    .map((k) => {
      const match = k.match(/^(.+?)\[(\d+)\]$/);
      if (match) {
        return [match[1], parseInt(match[2])];
      }
      return k;
    })
    .flat();

  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const nextKey = keys[i + 1];

    if (current[k] === undefined || current[k] === null) {
      current[k] = typeof nextKey === 'number' ? [] : {};
    } else if (typeof current[k] === 'string') {
      current[k] = { _value: current[k] };
    }
    current = current[k];
  }

  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;
}

function unflattenObject(flat: Record<string, string>): any {
  const result: any = {};

  const sortedKeys = Object.keys(flat).sort((a, b) => {
    const depthA = (a.match(/\./g) || []).length;
    const depthB = (b.match(/\./g) || []).length;
    return depthA - depthB;
  });

  for (const key of sortedKeys) {
    setNestedValue(result, key, flat[key]);
  }

  return result;
}

function shouldSkipTranslation(value: string): boolean {
  for (const pattern of CONFIG.skipTranslation) {
    if (pattern.test(value)) {
      return true;
    }
  }

  if (CONFIG.technicalTerms.includes(value)) {
    return true;
  }

  return false;
}

function extractPlaceholders(text: string): string[] {
  const matches = text.match(/{{[^}]+}}/g) || [];
  return matches.sort();
}

function isLikelyUntranslated(sourceValue: string, targetValue: string, locale: string): boolean {
  if (sourceValue === targetValue) {
    if (shouldSkipTranslation(sourceValue)) {
      return false;
    }

    const englishPatterns = [
      /\b(the|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|must|shall|can)\b/i,
      /\b(this|that|these|those|what|which|who|whom|whose|where|when|why|how)\b/i,
      /\b(and|or|but|if|then|else|for|with|without|from|to|in|on|at|by|of|about)\b/i,
      /\b(your|you|we|our|they|their|it|its|he|she|him|her|his)\b/i,
      /\b(click|select|enter|type|view|show|hide|enable|disable|create|update|delete)\b/i,
      /\b(please|thank|welcome|sorry|error|warning|success|info|loading)\b/i,
    ];

    for (const pattern of englishPatterns) {
      if (pattern.test(sourceValue)) {
        return true;
      }
    }

    const words = sourceValue.split(/\s+/).filter((w) => w.length > 0);
    // Check if string is ASCII only (no non-ASCII characters)
    if (words.length >= 3 && !/[^\u0020-\u007E]/.test(sourceValue)) {
      return true;
    }
  }

  return false;
}

function translateWithGlossary(text: string, locale: string): string | null {
  const glossary = CONFIG.glossary[locale as keyof typeof CONFIG.glossary];
  if (!glossary) return null;

  if (glossary[text as keyof typeof glossary]) {
    return glossary[text as keyof typeof glossary];
  }

  const words = text.split(/\s+/);
  if (words.length <= 3) {
    const translated = words.map((word) => {
      const clean = word.replace(/[.,!?:;]/g, '');
      const punct = word.replace(clean, '');
      const trans = glossary[clean as keyof typeof glossary];
      return trans ? trans + punct : word;
    });

    if (translated.some((t, i) => t !== words[i])) {
      return translated.join(' ');
    }
  }

  return null;
}

function loadTranslationFile(locale: string, filename: string): any | null {
  const filePath = path.join(CONFIG.localesDir, locale, filename);

  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
  }

  return null;
}

function saveTranslationFile(locale: string, filename: string, data: any): void {
  const filePath = path.join(CONFIG.localesDir, locale, filename);
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function validateTranslations(locale: string, filename: string): ValidationResult {
  const sourceData = loadTranslationFile(CONFIG.sourceLocale, filename);
  const targetData = loadTranslationFile(locale, filename);

  const result: ValidationResult = {
    locale,
    file: filename,
    totalKeys: 0,
    missingKeys: 0,
    untranslatedKeys: 0,
    emptyKeys: 0,
    placeholderMismatches: 0,
    issues: [],
  };

  if (!sourceData) {
    console.error(`Source file not found: ${CONFIG.sourceLocale}/${filename}`);
    return result;
  }

  const sourceFlat = flattenObject(sourceData);
  const targetFlat = targetData ? flattenObject(targetData) : {};

  result.totalKeys = Object.keys(sourceFlat).length;

  for (const key in sourceFlat) {
    const sourceValue = sourceFlat[key];
    const targetValue = targetFlat[key];

    if (targetValue === undefined) {
      result.missingKeys++;
      const suggestion = translateWithGlossary(sourceValue, locale);
      result.issues.push({
        path: key,
        type: 'missing',
        sourceValue,
        suggestion: suggestion || undefined,
      });
      continue;
    }

    if (targetValue === '') {
      result.emptyKeys++;
      result.issues.push({
        path: key,
        type: 'empty',
        sourceValue,
        targetValue,
      });
      continue;
    }

    if (isLikelyUntranslated(sourceValue, targetValue, locale)) {
      result.untranslatedKeys++;
      const suggestion = translateWithGlossary(sourceValue, locale);
      result.issues.push({
        path: key,
        type: 'untranslated',
        sourceValue,
        targetValue,
        suggestion: suggestion || undefined,
      });
      continue;
    }

    const sourcePlaceholders = extractPlaceholders(sourceValue);
    const targetPlaceholders = extractPlaceholders(targetValue);

    if (JSON.stringify(sourcePlaceholders) !== JSON.stringify(targetPlaceholders)) {
      result.placeholderMismatches++;
      result.issues.push({
        path: key,
        type: 'placeholder_mismatch',
        sourceValue,
        targetValue,
      });
    }
  }

  return result;
}

function deepSet(obj: any, path: string, value: string): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];

    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const arrayKey = arrayMatch[1];
      const arrayIndex = parseInt(arrayMatch[2]);

      if (!current[arrayKey]) {
        current[arrayKey] = [];
      }
      if (!current[arrayKey][arrayIndex]) {
        current[arrayKey][arrayIndex] = {};
      }
      current = current[arrayKey][arrayIndex];
    } else {
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
  }

  const lastPart = parts[parts.length - 1];
  const lastArrayMatch = lastPart.match(/^(.+)\[(\d+)\]$/);

  if (lastArrayMatch) {
    const arrayKey = lastArrayMatch[1];
    const arrayIndex = parseInt(lastArrayMatch[2]);
    if (!current[arrayKey]) {
      current[arrayKey] = [];
    }
    current[arrayKey][arrayIndex] = value;
  } else {
    current[lastPart] = value;
  }
}

function fixTranslations(locale: string, filename: string, issues: TranslationIssue[]): number {
  const targetData = loadTranslationFile(locale, filename) || {};
  let fixedCount = 0;

  for (const issue of issues) {
    if (issue.suggestion) {
      deepSet(targetData, issue.path, issue.suggestion);
      fixedCount++;
    } else if (issue.type === 'missing' && issue.sourceValue) {
      deepSet(targetData, issue.path, `[TODO:${locale.toUpperCase()}] ${issue.sourceValue}`);
      fixedCount++;
    }
  }

  if (fixedCount > 0) {
    saveTranslationFile(locale, filename, targetData);
  }

  return fixedCount;
}

function generateReport(results: ValidationResult[]): string {
  let report = '# Translation Validation Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  report += '## Summary\n\n';
  report +=
    '| Locale | File | Total | Missing | Untranslated | Empty | Placeholders | Coverage |\n';
  report +=
    '|--------|------|-------|---------|--------------|-------|--------------|----------|\n';

  for (const result of results) {
    const issues = result.missingKeys + result.untranslatedKeys + result.emptyKeys;
    const coverage = (((result.totalKeys - issues) / result.totalKeys) * 100).toFixed(1);
    report += `| ${result.locale} | ${result.file} | ${result.totalKeys} | ${result.missingKeys} | ${result.untranslatedKeys} | ${result.emptyKeys} | ${result.placeholderMismatches} | ${coverage}% |\n`;
  }

  report += '\n## Detailed Issues\n\n';

  for (const result of results) {
    if (result.issues.length === 0) continue;

    report += `### ${result.locale}/${result.file}\n\n`;

    const byType: Record<string, TranslationIssue[]> = {};
    for (const issue of result.issues) {
      if (!byType[issue.type]) byType[issue.type] = [];
      byType[issue.type].push(issue);
    }

    for (const type in byType) {
      report += `#### ${type.replace('_', ' ').toUpperCase()} (${byType[type].length})\n\n`;

      const shown = byType[type].slice(0, 20);
      for (const issue of shown) {
        report += `- \`${issue.path}\`\n`;
        if (issue.sourceValue) {
          report += `  - EN: "${issue.sourceValue.substring(0, 100)}${issue.sourceValue.length > 100 ? '...' : ''}"\n`;
        }
        if (issue.targetValue) {
          report += `  - ${result.locale.toUpperCase()}: "${issue.targetValue.substring(0, 100)}${issue.targetValue.length > 100 ? '...' : ''}"\n`;
        }
        if (issue.suggestion) {
          report += `  - Suggestion: "${issue.suggestion}"\n`;
        }
      }

      if (byType[type].length > 20) {
        report += `\n... and ${byType[type].length - 20} more\n`;
      }

      report += '\n';
    }
  }

  return report;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes('--check');
  const isFix = args.includes('--fix');
  const isReport = args.includes('--report');
  const localeArg = args.find((a) => a.startsWith('--locale='));
  const targetLocale = localeArg ? localeArg.split('=')[1] : null;

  const locales = targetLocale ? [targetLocale] : CONFIG.targetLocales;
  const files = ['translation.json'];

  console.log('🔍 Translation Validation Script\n');
  console.log(`Source locale: ${CONFIG.sourceLocale}`);
  console.log(`Target locales: ${locales.join(', ')}`);
  console.log(`Files: ${files.join(', ')}\n`);

  const allResults: ValidationResult[] = [];

  for (const locale of locales) {
    console.log(`\n📝 Checking ${locale}...`);

    for (const file of files) {
      const result = validateTranslations(locale, file);
      allResults.push(result);

      const issues = result.missingKeys + result.untranslatedKeys + result.emptyKeys;
      const coverage = (((result.totalKeys - issues) / result.totalKeys) * 100).toFixed(1);

      console.log(`   ${file}: ${coverage}% coverage`);
      console.log(`   - Missing: ${result.missingKeys}`);
      console.log(`   - Untranslated: ${result.untranslatedKeys}`);
      console.log(`   - Empty: ${result.emptyKeys}`);
      console.log(`   - Placeholder issues: ${result.placeholderMismatches}`);

      if (isFix && result.issues.length > 0) {
        const fixed = fixTranslations(locale, file, result.issues);
        console.log(`   ✅ Fixed ${fixed} issues with glossary`);
      }
    }
  }

  if (isReport) {
    const report = generateReport(allResults);
    const reportPath = path.join(__dirname, 'translation-report.md');
    fs.writeFileSync(reportPath, report);
    console.log(`\n📊 Report saved to: ${reportPath}`);
  }

  const totalIssues = allResults.reduce(
    (sum, r) => sum + r.missingKeys + r.untranslatedKeys + r.emptyKeys + r.placeholderMismatches,
    0
  );

  if (isCheck && totalIssues > 0) {
    console.log(`\n❌ Found ${totalIssues} translation issues`);
    process.exit(1);
  } else if (totalIssues === 0) {
    console.log('\n✅ All translations are complete!');
  } else {
    console.log(`\n⚠️  Found ${totalIssues} translation issues`);
  }
}

main().catch(console.error);
