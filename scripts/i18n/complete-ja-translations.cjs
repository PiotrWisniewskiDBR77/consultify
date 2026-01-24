#!/usr/bin/env node
/**
 * Complete Japanese Translation Script
 * Translates ALL remaining [JA] placeholders
 */

const fs = require('fs');
const path = require('path');

// Complete translation map for all remaining strings
const COMPLETE_TRANSLATIONS = {
  // AI & Chat
  'AI Chat': 'AIチャット',
  'Partner Portal': 'パートナーポータル',
  'Studio': 'スタジオ',
  'Benefits Realization': '効果実現',
  'Economics': 'エコノミクス',
  'Demo Mode is ON - viewing sample data': 'デモモードON - サンプルデータを表示中',
  
  // Profile settings
  'Tell others about yourself and your expertise': 'あなた自身と専門知識について紹介してください',
  'Short Bio': '短い自己紹介',
  'A brief one-liner about yourself...': '一行で自己紹介...',
  'Displayed on your profile card': 'プロフィールカードに表示されます',
  'Tell your story, share your background, interests, and what drives you...': 'あなたのストーリー、経歴、興味、原動力を共有してください...',
  'Markdown formatting supported': 'Markdownフォーマット対応',
  'A complete profile helps your team members understand your background and expertise. It also helps AI provide more personalized assistance.': '完全なプロフィールは、チームメンバーがあなたの経歴と専門知識を理解するのに役立ちます。また、AIがよりパーソナライズされた支援を提供するのにも役立ちます。',
  'Connect your social profiles and share your online presence': 'ソーシャルプロフィールを接続してオンラインプレゼンスを共有',
  'Add a custom link to your portfolio, blog, or any other website': 'ポートフォリオ、ブログ、その他のウェブサイトへのカスタムリンクを追加',
  'Control who can see your profile and contact you': 'プロフィールの閲覧と連絡先を制御',
  'Show email address': 'メールアドレスを表示',
  'Allow others to see your email on your profile': 'プロフィールでメールを他の人に表示することを許可',
  'Show phone number': '電話番号を表示',
  'Allow others to see your phone number': '電話番号を他の人に表示することを許可',
  'Show in team directory': 'チームディレクトリに表示',
  'Appear in the organization team directory': '組織のチームディレクトリに表示される',
  'Show online status': 'オンラインステータスを表示',
  'Let others see when you are online or away': '他の人にオンライン/離席状態を表示',
  'Show last seen': '最終アクティブを表示',
  'Display when you were last active': '最後にアクティブだった時間を表示',
  'Allow direct messages from': 'ダイレクトメッセージを許可する相手',
  'Administrators can always view your basic profile information regardless of these settings. Your name and role will always be visible to team members.': '管理者はこれらの設定に関係なく、基本的なプロフィール情報を常に閲覧できます。あなたの名前と役割はチームメンバーに常に表示されます。',
  
  // Settings sections
  'SETTINGS': '設定',
  'Manage your personal information, avatar, and account settings': '個人情報、アバター、アカウント設定を管理',
  'Customize AI behavior, memory, and response style': 'AIの動作、メモリ、応答スタイルをカスタマイズ',
  'Manage how and when you receive notifications': '通知の受信方法とタイミングを管理',
  'Manage your security settings, sessions, and privacy controls': 'セキュリティ設定、セッション、プライバシー制御を管理',
  'Connect apps, manage API keys, and configure webhooks': 'アプリを接続し、APIキーを管理し、Webhookを設定',
  'Customize theme, language, accessibility, and work preferences': 'テーマ、言語、アクセシビリティ、作業設定をカスタマイズ',
  'Avatar': 'アバター',
  'Memory': 'メモリ',
  'Push': 'プッシュ',
  'Data Controls': 'データ制御',
  'Privacy': 'プライバシー',
  'Apps': 'アプリ',
  'Professional': 'プロフェッショナル',
  
  // Recovery options
  'Set up backup options to recover your account if you lose access': 'アクセスを失った場合にアカウントを回復するためのバックアップオプションを設定',
  'Enter backup email address': 'バックアップメールアドレスを入力',
  'Please use a different email address': '別のメールアドレスを使用してください',
  'Receive SMS codes for account recovery': 'アカウント回復用のSMSコードを受信',
  '+1 (555) 123-4567': '+81 (03) 1234-5678',
  'Please enter a valid phone number': '有効な電話番号を入力してください',
  'One-time use codes for emergency access': '緊急アクセス用のワンタイムコード',
  'Save these codes in a secure place': 'これらのコードを安全な場所に保存してください',
  'Failed to generate codes': 'コードの生成に失敗しました',
  'Recovery codes copied to clipboard': '回復コードをクリップボードにコピーしました',
  'Each code can only be used once. Store them securely and do not share them.': '各コードは一度しか使用できません。安全に保管し、共有しないでください。',
  'Devices that can access your account without additional verification': '追加認証なしでアカウントにアクセスできるデバイス',
  'Failed to remove device': 'デバイスの削除に失敗しました',
  
  // Notifications
  'Customize notifications for different projects and scenarios': 'プロジェクトやシナリオごとに通知をカスタマイズ',
  'Notification rules saved': '通知ルールが保存されました',
  'Bundle notifications into periodic summaries': '通知を定期的なサマリーにまとめる',
  'Frequency': '頻度',
  'Always notify when these keywords appear': 'これらのキーワードが表示されたら常に通知',
  'Always receive notifications from these people': 'これらの人からは常に通知を受信',
  'No VIP contacts configured. Messages from VIP contacts will always notify you.': 'VIP連絡先が設定されていません。VIP連絡先からのメッセージは常に通知されます。',
  
  // Keyboard shortcuts
  'Customize keyboard shortcuts to boost your productivity': 'キーボードショートカットをカスタマイズして生産性を向上',
  'Display keyboard hints next to actions': 'アクションの横にキーボードヒントを表示',
  'Shortcut Preset': 'ショートカットプリセット',
  'Press \\': '押す \\',
  
  // Quiet hours
  'Schedule times when you want to minimize notifications': '通知を最小限にする時間をスケジュール',
  'Quiet Hours are currently active': '静粛時間が現在アクティブです',
  'Pause notifications during scheduled times': 'スケジュールされた時間中は通知を一時停止',
  'Exceptions': '例外',
  'Allow certain types of notifications even during quiet hours': '静粛時間中でも特定の種類の通知を許可',
  'High-priority alerts will still come through': '高優先度のアラートは引き続き通知されます',
  'Get notified when someone mentions you': '誰かがあなたをメンションしたときに通知',
  'Private messages will still notify you': 'プライベートメッセージは引き続き通知されます',
  'Enable auto-reply': '自動返信を有効化',
  'Automatically respond to messages during quiet hours': '静粛時間中にメッセージに自動返信',
  'I\'m currently unavailable. I\'ll respond when I return.': '現在対応できません。戻り次第対応します。',
  'Nights (10pm-8am, every day)': '夜間（毎日22時〜8時）',
  'After work hours (6pm-9am, weekdays)': '業務時間外（平日18時〜9時）',
  
  // Data & Privacy
  'Control how your data is used and manage your privacy settings': 'データの使用方法を制御し、プライバシー設定を管理',
  'Data Sharing': 'データ共有',
  'Help us improve by sharing anonymous usage analytics': '匿名の使用分析を共有して改善にご協力ください',
  'Share detailed usage data': '詳細な使用データを共有',
  'Include more detailed interaction data for product improvement': '製品改善のためのより詳細なインタラクションデータを含める',
  'Allow your interactions to help train better AI models': 'インタラクションをより良いAIモデルのトレーニングに使用することを許可',
  'Product updates': '製品アップデート',
  'Receive emails about new features and improvements': '新機能と改善に関するメールを受信',
  'Marketing emails': 'マーケティングメール',
  'Receive promotional offers and marketing communications': 'プロモーションオファーとマーケティングコミュニケーションを受信',
  'Newsletter subscription': 'ニュースレター購読',
  'Choose how long we keep your data': 'データの保持期間を選択',
  'Enable PII redaction': 'PII編集を有効化',
  'Automatically redact personally identifiable information in AI interactions': 'AIインタラクションで個人を特定できる情報を自動的に編集',
  'Allow third-party integrations': 'サードパーティ統合を許可',
  'Enable connections to external services and apps': '外部サービスやアプリへの接続を有効化',
  'Download a copy of all your data. This may take some time to prepare.': 'すべてのデータのコピーをダウンロード。準備に時間がかかる場合があります。',
  'Data export requested. You will receive an email when ready.': 'データエクスポートがリクエストされました。準備ができ次第メールでお知らせします。',
  'Failed to request data export. Please try again.': 'データエクスポートのリクエストに失敗しました。もう一度お試しください。',
  'Preparing...': '準備中...',
  'Permanently delete your account and all associated data. This action cannot be undone.': 'アカウントと関連するすべてのデータを完全に削除します。この操作は取り消せません。',
  
  // AI Settings
  'Response Style': '応答スタイル',
  'Adjust how AI responds to you': 'AIの応答方法を調整',
  'More concise': 'より簡潔に',
  'More detailed': 'より詳細に',
  'More formal': 'よりフォーマルに',
  'More casual': 'よりカジュアルに',
  'Language Preference': '言語設定',
  'Preferred language for AI responses': 'AI応答の優先言語',
  'Auto-detect from input': '入力から自動検出',
  'Context Awareness': 'コンテキスト認識',
  'Allow AI to use context from your current page and recent activities': 'AIが現在のページと最近のアクティビティからコンテキストを使用することを許可',
  'Remember Conversations': '会話を記憶',
  'AI remembers previous conversations for better assistance': 'AIがより良いアシスタンスのために以前の会話を記憶',
  'Clear Memory': 'メモリをクリア',
  'Clear all AI memory and conversation history': 'すべてのAIメモリと会話履歴をクリア',
  'This will delete all stored context and preferences. AI will start fresh.': 'これによりすべての保存されたコンテキストと設定が削除されます。AIは新しく開始します。',
  'Memory cleared successfully': 'メモリが正常にクリアされました',
  'Failed to clear memory': 'メモリのクリアに失敗しました',
  
  // Theme & Appearance
  'Theme Mode': 'テーマモード',
  'Light': 'ライト',
  'Dark': 'ダーク',
  'System': 'システム',
  'Auto (follows system)': '自動（システムに従う）',
  'Accent Color': 'アクセントカラー',
  'Primary accent color for the interface': 'インターフェースのプライマリアクセントカラー',
  'Blue': 'ブルー',
  'Purple': 'パープル',
  'Green': 'グリーン',
  'Orange': 'オレンジ',
  'Red': 'レッド',
  'Pink': 'ピンク',
  'Sidebar Style': 'サイドバースタイル',
  'Expanded': '展開',
  'Collapsed': '折りたたみ',
  'Auto-collapse': '自動折りたたみ',
  'Font Scale': 'フォントスケール',
  'Adjust the overall font size': '全体のフォントサイズを調整',
  'Smaller': '小さく',
  'Larger': '大きく',
  'Reduce animations': 'アニメーションを減らす',
  'Minimize motion for accessibility': 'アクセシビリティのためにモーションを最小化',
  
  // Work preferences
  'Work Week': '勤務週',
  'Select your working days': '勤務日を選択',
  'Mon': '月',
  'Tue': '火',
  'Wed': '水',
  'Thu': '木',
  'Fri': '金',
  'Sat': '土',
  'Sun': '日',
  'Working Hours': '勤務時間',
  'Set your typical working hours': '通常の勤務時間を設定',
  'Start Time': '開始時間',
  'End Time': '終了時間',
  'Timezone': 'タイムゾーン',
  'Your local timezone for scheduling': 'スケジューリング用のローカルタイムゾーン',
  'Auto-detect': '自動検出',
  
  // Security
  'Security Overview': 'セキュリティ概要',
  'Password': 'パスワード',
  'Last changed': '最終変更',
  'Change Password': 'パスワードを変更',
  'Two-Factor Authentication': '二要素認証',
  'Not enabled': '無効',
  'Enabled': '有効',
  'Enable 2FA': '2FAを有効化',
  'Disable 2FA': '2FAを無効化',
  'Recovery Options': '回復オプション',
  'Backup email, phone, recovery codes': 'バックアップメール、電話、回復コード',
  'Configure': '設定',
  'Active Sessions': 'アクティブセッション',
  'devices': 'デバイス',
  'Manage Sessions': 'セッションを管理',
  'Login History': 'ログイン履歴',
  'View recent login activity': '最近のログインアクティビティを表示',
  'View History': '履歴を表示',
  'Trusted Devices': '信頼済みデバイス',
  'Devices that can skip 2FA': '2FAをスキップできるデバイス',
  'Manage Devices': 'デバイスを管理',
  
  // Session management
  'Current Session': '現在のセッション',
  'Other Sessions': 'その他のセッション',
  'Sign out': 'サインアウト',
  'Sign out all other sessions': '他のすべてのセッションからサインアウト',
  'This will sign you out from all devices except this one.': 'これにより、このデバイス以外のすべてのデバイスからサインアウトされます。',
  'All other sessions have been terminated.': '他のすべてのセッションが終了しました。',
  'Failed to terminate sessions': 'セッションの終了に失敗しました',
  'Last active': '最終アクティブ',
  'Current': '現在',
  
  // Integrations
  'Connected Apps': '接続済みアプリ',
  'Manage connected applications and services': '接続されたアプリケーションとサービスを管理',
  'No apps connected': '接続されたアプリはありません',
  'Connect your first app to extend functionality': '最初のアプリを接続して機能を拡張',
  'Browse Apps': 'アプリを参照',
  'Connected': '接続済み',
  'Not Connected': '未接続',
  'Connect': '接続',
  'Disconnect': '切断',
  'Last synced': '最終同期',
  'Never': 'なし',
  'Sync now': '今すぐ同期',
  'Remove connection': '接続を削除',
  'Are you sure you want to disconnect this app?': 'このアプリを切断してもよろしいですか？',
  
  // API Keys
  'API Keys': 'APIキー',
  'Manage API keys for programmatic access': 'プログラムアクセス用のAPIキーを管理',
  'Create API Key': 'APIキーを作成',
  'No API keys': 'APIキーがありません',
  'Create your first API key to access the API': '最初のAPIキーを作成してAPIにアクセス',
  'Key Name': 'キー名',
  'Name for this API key': 'このAPIキーの名前',
  'Permissions': '権限',
  'Select permissions for this key': 'このキーの権限を選択',
  'Read': '読み取り',
  'Write': '書き込み',
  'Delete': '削除',
  'Admin': '管理者',
  'Expiration': '有効期限',
  'When this key expires': 'このキーの有効期限',
  '30 days': '30日',
  '90 days': '90日',
  '1 year': '1年',
  'Never expires': '無期限',
  'Create Key': 'キーを作成',
  'API Key Created': 'APIキーが作成されました',
  'Copy this key now. You won\'t be able to see it again.': 'このキーを今すぐコピーしてください。再度表示することはできません。',
  'Copy Key': 'キーをコピー',
  'Key copied to clipboard': 'キーがクリップボードにコピーされました',
  'Done': '完了',
  'Revoke Key': 'キーを取り消し',
  'Are you sure you want to revoke this API key?': 'このAPIキーを取り消してもよろしいですか？',
  'This action cannot be undone.': 'この操作は取り消せません。',
  'Revoke': '取り消し',
  'Key revoked': 'キーが取り消されました',
  'Created': '作成日',
  'Expires': '有効期限',
  'Last used': '最終使用',
  
  // Webhooks
  'Webhooks': 'Webhook',
  'Receive real-time notifications for events': 'イベントのリアルタイム通知を受信',
  'Create Webhook': 'Webhookを作成',
  'No webhooks configured': 'Webhookが設定されていません',
  'Create your first webhook to receive event notifications': '最初のWebhookを作成してイベント通知を受信',
  'Webhook URL': 'Webhook URL',
  'The URL that will receive webhook events': 'Webhookイベントを受信するURL',
  'Events': 'イベント',
  'Select events to trigger this webhook': 'このWebhookをトリガーするイベントを選択',
  'All events': 'すべてのイベント',
  'Select events': 'イベントを選択',
  'Secret': 'シークレット',
  'Optional secret for webhook signature verification': 'Webhook署名検証用のオプションシークレット',
  'Generate': '生成',
  'Create Webhook': 'Webhookを作成',
  'Webhook created': 'Webhookが作成されました',
  'Edit Webhook': 'Webhookを編集',
  'Save Changes': '変更を保存',
  'Webhook updated': 'Webhookが更新されました',
  'Delete Webhook': 'Webhookを削除',
  'Are you sure you want to delete this webhook?': 'このWebhookを削除してもよろしいですか？',
  'Webhook deleted': 'Webhookが削除されました',
  'Test Webhook': 'Webhookをテスト',
  'Send a test event to this webhook': 'このWebhookにテストイベントを送信',
  'Test event sent': 'テストイベントが送信されました',
  'Active': 'アクティブ',
  'Inactive': '非アクティブ',
  'Deliveries': '配信',
  'successful': '成功',
  'failed': '失敗',
  
  // Assessment-related
  'Digital Readiness': 'デジタル準備状況',
  'Maturity Assessment': '成熟度評価',
  'Gap Analysis': 'ギャップ分析',
  'Target State': '目標状態',
  'Current State': '現状',
  'Improvement Areas': '改善領域',
  'Strengths': '強み',
  'Weaknesses': '弱み',
  'Opportunities': '機会',
  'Threats': '脅威',
  'Score': 'スコア',
  'Level': 'レベル',
  'Benchmark': 'ベンチマーク',
  'Industry Average': '業界平均',
  'Best in Class': 'クラス最高',
  
  // Initiative-related
  'Initiative Charter': 'イニシアチブチャーター',
  'Business Case': 'ビジネスケース',
  'Value Proposition': '価値提案',
  'Success Criteria': '成功基準',
  'Key Deliverables': '主要な成果物',
  'Resource Requirements': 'リソース要件',
  'Risk Assessment': 'リスク評価',
  'Mitigation Strategy': '軽減戦略',
  'Timeline': 'タイムライン',
  'Milestones': 'マイルストーン',
  'Dependencies': '依存関係',
  'Stakeholders': 'ステークホルダー',
  'Sponsor': 'スポンサー',
  'Owner': 'オーナー',
  'Team': 'チーム',
  
  // Roadmap
  'Roadmap View': 'ロードマップビュー',
  'Timeline View': 'タイムラインビュー',
  'Gantt View': 'ガントビュー',
  'Kanban View': 'かんばんビュー',
  'List View': 'リストビュー',
  'Calendar View': 'カレンダービュー',
  'Phase': 'フェーズ',
  'Quarter': '四半期',
  'Year': '年',
  'Today': '今日',
  'This Week': '今週',
  'This Month': '今月',
  'This Quarter': '今四半期',
  'This Year': '今年',
  
  // Common actions
  'Save': '保存',
  'Cancel': 'キャンセル',
  'Delete': '削除',
  'Edit': '編集',
  'Add': '追加',
  'Remove': '削除',
  'Create': '作成',
  'Update': '更新',
  'Submit': '送信',
  'Confirm': '確認',
  'Close': '閉じる',
  'Open': '開く',
  'View': '表示',
  'Download': 'ダウンロード',
  'Upload': 'アップロード',
  'Export': 'エクスポート',
  'Import': 'インポート',
  'Copy': 'コピー',
  'Paste': '貼り付け',
  'Select': '選択',
  'Search': '検索',
  'Filter': 'フィルター',
  'Sort': '並び替え',
  'Refresh': '更新',
  'Reset': 'リセット',
  'Clear': 'クリア',
  'Back': '戻る',
  'Next': '次へ',
  'Previous': '前へ',
  'Finish': '完了',
  'Skip': 'スキップ',
  'Continue': '続ける',
  'Start': '開始',
  'Stop': '停止',
  'Pause': '一時停止',
  'Resume': '再開',
  
  // Status
  'Active': 'アクティブ',
  'Inactive': '非アクティブ',
  'Pending': '保留中',
  'Approved': '承認済み',
  'Rejected': '却下',
  'Draft': '下書き',
  'Published': '公開済み',
  'Archived': 'アーカイブ済み',
  'Completed': '完了',
  'In Progress': '進行中',
  'Not Started': '未開始',
  'On Hold': '保留',
  'Blocked': 'ブロック中',
  'Cancelled': 'キャンセル済み',
  'Overdue': '期限超過',
  'At Risk': 'リスクあり',
  'On Track': '順調',
  
  // Time
  'Just now': 'たった今',
  'Today': '今日',
  'Yesterday': '昨日',
  'Tomorrow': '明日',
  'This week': '今週',
  'Last week': '先週',
  'Next week': '来週',
  'This month': '今月',
  'Last month': '先月',
  'Next month': '来月',
  'ago': '前',
  'from now': '後',
  'minutes': '分',
  'hours': '時間',
  'days': '日',
  'weeks': '週',
  'months': '月',
  'years': '年',
  
  // Messages
  'Success': '成功',
  'Error': 'エラー',
  'Warning': '警告',
  'Info': '情報',
  'Loading...': '読み込み中...',
  'Saving...': '保存中...',
  'Processing...': '処理中...',
  'Please wait': 'お待ちください',
  'No results found': '結果が見つかりません',
  'No data available': 'データがありません',
  'Something went wrong': '問題が発生しました',
  'Please try again': 'もう一度お試しください',
  'Operation successful': '操作が成功しました',
  'Changes saved': '変更が保存されました',
  'Item deleted': 'アイテムが削除されました',
  'Are you sure?': '本当によろしいですか？',
  'This action cannot be undone': 'この操作は取り消せません',
  
  // Misc remaining strings
  'e.g., Leaving the company, Role change...': '例：退職、役職変更...',
  'e.g., 3 months': '例：3ヶ月',
  'similarity in \\': '類似性：',
  'Wdrożono podstawowy system CRM, który porządkuje bazę klientów. Dane są jednak wprowadzane ręcznie, co nadal rodzi ryzyko niespójności. Brakuje pełnej integracji z innymi systemami w firmie.': '顧客ベースを整理する基本的なCRMシステムが実装されました。ただし、データは手動で入力されるため、不整合のリスクが残ります。社内の他のシステムとの完全な統合が不足しています。',
  'The DBR77 Lean 4.0 method (Measure-Optimize-Automate) is a proprietary Consultinity methodology combining classic Lean tools with automation and AI potential assessment.': 'DBR77 Lean 4.0メソッド（測定-最適化-自動化）は、従来のリーンツールと自動化およびAIポテンシャル評価を組み合わせたConsultinity独自の方法論です。',
};

function processFile(filePath) {
  console.log(`Processing ${path.basename(filePath)}...`);
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let translated = 0;
  
  // Replace all [JA] placeholders
  for (const [eng, jap] of Object.entries(COMPLETE_TRANSLATIONS)) {
    const pattern = `"[JA] ${eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`;
    const regex = new RegExp(pattern, 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, `"${jap}"`);
      translated += matches.length;
    }
  }
  
  // Also try without the [JA] prefix for some edge cases
  for (const [eng, jap] of Object.entries(COMPLETE_TRANSLATIONS)) {
    // Look for exact matches that still have [JA] prefix
    const exactPattern = new RegExp(`"\\[JA\\] ${eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
    if (exactPattern.test(content)) {
      content = content.replace(exactPattern, `"${jap}"`);
      translated++;
    }
  }
  
  fs.writeFileSync(filePath, content, 'utf-8');
  
  // Count remaining
  const remaining = (content.match(/\[JA\]/g) || []).length;
  
  console.log(`  ✓ Translated: ${translated}`);
  console.log(`  ⚠ Remaining: ${remaining}`);
  
  return { translated, remaining };
}

function main() {
  console.log('🇯🇵 Complete Japanese Translation');
  console.log('==================================\n');
  
  const filePath = path.join(__dirname, '../../public/locales/ja/translation.json');
  
  const result = processFile(filePath);
  
  console.log('\n==================================');
  console.log('Done!');
  
  if (result.remaining > 0) {
    console.log(`\n${result.remaining} strings still need translation.`);
  }
}

main();
