#!/usr/bin/env npx ts-node
/**
 * Translation Validation & Auto-Fix Script
 *
 * This script compares the English (source) translation files with target locales
 * and identifies missing, untranslated, or problematic translations.
 *
 * Validates all namespaces: translation, assessment-module, discovery
 *
 * Usage:
 *   npx ts-node scripts/i18n/validate-translations.ts --check          # Check only
 *   npx ts-node scripts/i18n/validate-translations.ts --fix            # Fix missing translations
 *   npx ts-node scripts/i18n/validate-translations.ts --report         # Generate detailed report
 *   npx ts-node scripts/i18n/validate-translations.ts --locale=ja      # Check specific locale
 *   npx ts-node scripts/i18n/validate-translations.ts --namespace=translation  # Check specific namespace
 *   npx ts-node scripts/i18n/validate-translations.ts --all            # Check all namespaces (default)
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
    pl: {
      Dashboard: 'Dashboard',
      Assessment: 'Ocena',
      Initiative: 'Inicjatywa',
      Initiatives: 'Inicjatywy',
      Roadmap: 'Roadmapa',
      Implementation: 'Implementacja',
      Execution: 'Wykonanie',
      Settings: 'Ustawienia',
      Profile: 'Profil',
      Organization: 'Organizacja',
      Project: 'Projekt',
      User: 'Użytkownik',
      Admin: 'Administrator',
      Save: 'Zapisz',
      Cancel: 'Anuluj',
      Delete: 'Usuń',
      Edit: 'Edytuj',
      Add: 'Dodaj',
      Remove: 'Usuń',
      Close: 'Zamknij',
      Open: 'Otwórz',
      View: 'Widok',
      Download: 'Pobierz',
      Upload: 'Prześlij',
      Export: 'Eksportuj',
      Import: 'Importuj',
      Search: 'Szukaj',
      Filter: 'Filtruj',
      Sort: 'Sortuj',
      Loading: 'Ładowanie',
      Error: 'Błąd',
      Warning: 'Ostrzeżenie',
      Success: 'Sukces',
      Info: 'Informacja',
      Confirm: 'Potwierdź',
      Submit: 'Wyślij',
      Back: 'Wstecz',
      Next: 'Dalej',
      Previous: 'Poprzedni',
      Continue: 'Kontynuuj',
      Yes: 'Tak',
      No: 'Nie',
      Status: 'Status',
      Progress: 'Postęp',
      Complete: 'Ukończone',
      Completed: 'Ukończone',
      Pending: 'Oczekujące',
      'In Progress': 'W trakcie',
      Active: 'Aktywne',
      Required: 'Wymagane',
      Optional: 'Opcjonalne',
      Select: 'Wybierz',
      Name: 'Nazwa',
      Description: 'Opis',
      Title: 'Tytuł',
      Date: 'Data',
      Email: 'Email',
      Password: 'Hasło',
      Login: 'Zaloguj',
      Logout: 'Wyloguj',
      Help: 'Pomoc',
      Overview: 'Przegląd',
      Details: 'Szczegóły',
      Summary: 'Podsumowanie',
      Report: 'Raport',
      Reports: 'Raporty',
      Analytics: 'Analityka',
      Team: 'Zespół',
      Members: 'Członkowie',
      Role: 'Rola',
      Permissions: 'Uprawnienia',
      All: 'Wszystkie',
      None: 'Brak',
      Other: 'Inne',
      Custom: 'Własne',
      Default: 'Domyślne',
    },
    de: {
      Dashboard: 'Dashboard',
      Assessment: 'Bewertung',
      Initiative: 'Initiative',
      Initiatives: 'Initiativen',
      Roadmap: 'Roadmap',
      Implementation: 'Implementierung',
      Execution: 'Ausführung',
      Settings: 'Einstellungen',
      Profile: 'Profil',
      Organization: 'Organisation',
      Project: 'Projekt',
      User: 'Benutzer',
      Admin: 'Administrator',
      Save: 'Speichern',
      Cancel: 'Abbrechen',
      Delete: 'Löschen',
      Edit: 'Bearbeiten',
      Add: 'Hinzufügen',
      Remove: 'Entfernen',
      Close: 'Schließen',
      Open: 'Öffnen',
      View: 'Ansicht',
      Download: 'Herunterladen',
      Upload: 'Hochladen',
      Export: 'Exportieren',
      Import: 'Importieren',
      Search: 'Suchen',
      Filter: 'Filtern',
      Sort: 'Sortieren',
      Loading: 'Wird geladen',
      Error: 'Fehler',
      Warning: 'Warnung',
      Success: 'Erfolg',
      Info: 'Information',
      Confirm: 'Bestätigen',
      Submit: 'Absenden',
      Back: 'Zurück',
      Next: 'Weiter',
      Previous: 'Vorherige',
      Continue: 'Fortsetzen',
      Yes: 'Ja',
      No: 'Nein',
      Status: 'Status',
      Progress: 'Fortschritt',
      Complete: 'Abgeschlossen',
      Completed: 'Abgeschlossen',
      Pending: 'Ausstehend',
      'In Progress': 'In Bearbeitung',
      Active: 'Aktiv',
      Required: 'Erforderlich',
      Optional: 'Optional',
      Select: 'Auswählen',
      Name: 'Name',
      Description: 'Beschreibung',
      Title: 'Titel',
      Date: 'Datum',
      Email: 'E-Mail',
      Password: 'Passwort',
      Login: 'Anmelden',
      Logout: 'Abmelden',
      Help: 'Hilfe',
      Overview: 'Übersicht',
      Details: 'Details',
      Summary: 'Zusammenfassung',
      Report: 'Bericht',
      Reports: 'Berichte',
      Analytics: 'Analytik',
      Team: 'Team',
      Members: 'Mitglieder',
      Role: 'Rolle',
      Permissions: 'Berechtigungen',
      All: 'Alle',
      None: 'Keine',
      Other: 'Andere',
      Custom: 'Benutzerdefiniert',
      Default: 'Standard',
    },
    es: {
      Dashboard: 'Panel',
      Assessment: 'Evaluación',
      Initiative: 'Iniciativa',
      Initiatives: 'Iniciativas',
      Roadmap: 'Hoja de ruta',
      Implementation: 'Implementación',
      Execution: 'Ejecución',
      Settings: 'Configuración',
      Profile: 'Perfil',
      Organization: 'Organización',
      Project: 'Proyecto',
      User: 'Usuario',
      Admin: 'Administrador',
      Save: 'Guardar',
      Cancel: 'Cancelar',
      Delete: 'Eliminar',
      Edit: 'Editar',
      Add: 'Añadir',
      Remove: 'Eliminar',
      Close: 'Cerrar',
      Open: 'Abrir',
      View: 'Ver',
      Download: 'Descargar',
      Upload: 'Subir',
      Export: 'Exportar',
      Import: 'Importar',
      Search: 'Buscar',
      Filter: 'Filtrar',
      Sort: 'Ordenar',
      Loading: 'Cargando',
      Error: 'Error',
      Warning: 'Advertencia',
      Success: 'Éxito',
      Info: 'Información',
      Confirm: 'Confirmar',
      Submit: 'Enviar',
      Back: 'Volver',
      Next: 'Siguiente',
      Previous: 'Anterior',
      Continue: 'Continuar',
      Yes: 'Sí',
      No: 'No',
      Status: 'Estado',
      Progress: 'Progreso',
      Complete: 'Completado',
      Completed: 'Completado',
      Pending: 'Pendiente',
      'In Progress': 'En progreso',
      Active: 'Activo',
      Required: 'Obligatorio',
      Optional: 'Opcional',
      Select: 'Seleccionar',
      Name: 'Nombre',
      Description: 'Descripción',
      Title: 'Título',
      Date: 'Fecha',
      Email: 'Correo',
      Password: 'Contraseña',
      Login: 'Iniciar sesión',
      Logout: 'Cerrar sesión',
      Help: 'Ayuda',
      Overview: 'Resumen',
      Details: 'Detalles',
      Summary: 'Resumen',
      Report: 'Informe',
      Reports: 'Informes',
      Analytics: 'Analítica',
      Team: 'Equipo',
      Members: 'Miembros',
      Role: 'Rol',
      Permissions: 'Permisos',
      All: 'Todos',
      None: 'Ninguno',
      Other: 'Otro',
      Custom: 'Personalizado',
      Default: 'Predeterminado',
    },
    ar: {
      Dashboard: 'لوحة القيادة',
      Assessment: 'تقييم',
      Initiative: 'مبادرة',
      Initiatives: 'المبادرات',
      Roadmap: 'خارطة الطريق',
      Implementation: 'التنفيذ',
      Execution: 'التنفيذ',
      Settings: 'الإعدادات',
      Profile: 'الملف الشخصي',
      Organization: 'المنظمة',
      Project: 'مشروع',
      User: 'مستخدم',
      Admin: 'مدير',
      Save: 'حفظ',
      Cancel: 'إلغاء',
      Delete: 'حذف',
      Edit: 'تحرير',
      Add: 'إضافة',
      Remove: 'إزالة',
      Close: 'إغلاق',
      Open: 'فتح',
      View: 'عرض',
      Download: 'تحميل',
      Upload: 'رفع',
      Export: 'تصدير',
      Import: 'استيراد',
      Search: 'بحث',
      Filter: 'تصفية',
      Sort: 'ترتيب',
      Loading: 'جارٍ التحميل',
      Error: 'خطأ',
      Warning: 'تحذير',
      Success: 'نجاح',
      Info: 'معلومات',
      Confirm: 'تأكيد',
      Submit: 'إرسال',
      Back: 'رجوع',
      Next: 'التالي',
      Previous: 'السابق',
      Continue: 'متابعة',
      Yes: 'نعم',
      No: 'لا',
      Status: 'الحالة',
      Progress: 'التقدم',
      Complete: 'مكتمل',
      Completed: 'مكتمل',
      Pending: 'معلق',
      'In Progress': 'قيد التنفيذ',
      Active: 'نشط',
      Required: 'مطلوب',
      Optional: 'اختياري',
      Select: 'اختر',
      Name: 'الاسم',
      Description: 'الوصف',
      Title: 'العنوان',
      Date: 'التاريخ',
      Email: 'البريد الإلكتروني',
      Password: 'كلمة المرور',
      Login: 'تسجيل الدخول',
      Logout: 'تسجيل الخروج',
      Help: 'مساعدة',
      Overview: 'نظرة عامة',
      Details: 'تفاصيل',
      Summary: 'ملخص',
      Report: 'تقرير',
      Reports: 'تقارير',
      Analytics: 'تحليلات',
      Team: 'فريق',
      Members: 'الأعضاء',
      Role: 'دور',
      Permissions: 'الصلاحيات',
      All: 'الكل',
      None: 'لا شيء',
      Other: 'أخرى',
      Custom: 'مخصص',
      Default: 'افتراضي',
    },
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
  type:
    | 'missing'
    | 'untranslated'
    | 'empty'
    | 'placeholder_mismatch'
    | 'type_mismatch'
    | 'invalid_json'
    | 'extra_key';
  sourceValue?: string;
  targetValue?: string;
  suggestion?: string;
  details?: string;
}

interface ValidationResult {
  locale: string;
  file: string;
  totalKeys: number;
  missingKeys: number;
  untranslatedKeys: number;
  emptyKeys: number;
  placeholderMismatches: number;
  typeMismatches: number;
  extraKeys: number;
  issues: TranslationIssue[];
}

// All translation namespaces
const ALL_NAMESPACES = ['translation.json', 'assessment-module.json', 'discovery.json'];

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

// Check type consistency between source and target values
function checkTypeConsistency(sourceObj: any, targetObj: any, prefix = ''): TranslationIssue[] {
  const issues: TranslationIssue[] = [];

  for (const key in sourceObj) {
    const path = prefix ? `${prefix}.${key}` : key;
    const sourceVal = sourceObj[key];
    const targetVal = targetObj?.[key];

    if (targetVal === undefined) continue; // Handled by missing keys check

    const sourceType = Array.isArray(sourceVal) ? 'array' : typeof sourceVal;
    const targetType = Array.isArray(targetVal) ? 'array' : typeof targetVal;

    if (sourceType !== targetType) {
      issues.push({
        path,
        type: 'type_mismatch',
        details: `Expected ${sourceType}, got ${targetType}`,
        sourceValue: JSON.stringify(sourceVal).substring(0, 50),
        targetValue: JSON.stringify(targetVal).substring(0, 50),
      });
    } else if (sourceType === 'object' && !Array.isArray(sourceVal)) {
      issues.push(...checkTypeConsistency(sourceVal, targetVal, path));
    } else if (sourceType === 'array') {
      if (sourceVal.length !== targetVal.length) {
        issues.push({
          path,
          type: 'type_mismatch',
          details: `Array length mismatch: source has ${sourceVal.length}, target has ${targetVal.length}`,
        });
      }
    }
  }

  return issues;
}

// Find extra keys in target that don't exist in source
function findExtraKeys(sourceObj: any, targetObj: any, prefix = ''): TranslationIssue[] {
  const issues: TranslationIssue[] = [];

  for (const key in targetObj) {
    const path = prefix ? `${prefix}.${key}` : key;
    const sourceVal = sourceObj?.[key];
    const targetVal = targetObj[key];

    if (sourceVal === undefined) {
      issues.push({
        path,
        type: 'extra_key',
        targetValue:
          typeof targetVal === 'string' ? targetVal : JSON.stringify(targetVal).substring(0, 50),
        details: 'Key exists in target but not in source (may be orphaned)',
      });
    } else if (typeof targetVal === 'object' && !Array.isArray(targetVal)) {
      issues.push(...findExtraKeys(sourceVal, targetVal, path));
    }
  }

  return issues;
}

// Validate JSON structure
function validateJsonStructure(locale: string, filename: string): TranslationIssue[] {
  const filePath = path.join(CONFIG.localesDir, locale, filename);
  const issues: TranslationIssue[] = [];

  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      JSON.parse(content);

      // Check for BOM or other encoding issues
      if (content.charCodeAt(0) === 0xfeff) {
        issues.push({
          path: filename,
          type: 'invalid_json',
          details: 'File contains BOM (Byte Order Mark) - should be removed',
        });
      }

      // Check for trailing commas (common JSON error)
      if (/,\s*[}\]]/.test(content)) {
        issues.push({
          path: filename,
          type: 'invalid_json',
          details: 'File may contain trailing commas',
        });
      }
    }
  } catch (error: any) {
    issues.push({
      path: filename,
      type: 'invalid_json',
      details: `JSON parse error: ${error.message}`,
    });
  }

  return issues;
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
    typeMismatches: 0,
    extraKeys: 0,
    issues: [],
  };

  // First validate JSON structure
  const jsonIssues = validateJsonStructure(locale, filename);
  if (jsonIssues.length > 0) {
    result.issues.push(...jsonIssues);
  }

  if (!sourceData) {
    console.error(`Source file not found: ${CONFIG.sourceLocale}/${filename}`);
    return result;
  }

  // Check type consistency
  if (targetData) {
    const typeIssues = checkTypeConsistency(sourceData, targetData);
    result.typeMismatches = typeIssues.length;
    result.issues.push(...typeIssues);

    // Check for extra keys
    const extraKeyIssues = findExtraKeys(sourceData, targetData);
    result.extraKeys = extraKeyIssues.length;
    result.issues.push(...extraKeyIssues);
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

  // Overall statistics
  const totalKeys = results.reduce((sum, r) => sum + r.totalKeys, 0);
  const totalMissing = results.reduce((sum, r) => sum + r.missingKeys, 0);
  const totalUntranslated = results.reduce((sum, r) => sum + r.untranslatedKeys, 0);
  const totalEmpty = results.reduce((sum, r) => sum + r.emptyKeys, 0);
  const totalPlaceholder = results.reduce((sum, r) => sum + r.placeholderMismatches, 0);
  const totalTypeMismatch = results.reduce((sum, r) => sum + r.typeMismatches, 0);
  const totalExtra = results.reduce((sum, r) => sum + r.extraKeys, 0);

  report += '## Overall Statistics\n\n';
  report += `- **Total Keys Checked**: ${totalKeys}\n`;
  report += `- **Missing Keys**: ${totalMissing}\n`;
  report += `- **Untranslated Keys**: ${totalUntranslated}\n`;
  report += `- **Empty Values**: ${totalEmpty}\n`;
  report += `- **Placeholder Mismatches**: ${totalPlaceholder}\n`;
  report += `- **Type Mismatches**: ${totalTypeMismatch}\n`;
  report += `- **Extra/Orphaned Keys**: ${totalExtra}\n\n`;

  report += '## Summary by File\n\n';
  report +=
    '| Locale | File | Total | Missing | Untranslated | Empty | Placeholders | Types | Extra | Coverage |\n';
  report +=
    '|--------|------|-------|---------|--------------|-------|--------------|-------|-------|----------|\n';

  for (const result of results) {
    const issues = result.missingKeys + result.untranslatedKeys + result.emptyKeys;
    const coverage =
      result.totalKeys > 0
        ? (((result.totalKeys - issues) / result.totalKeys) * 100).toFixed(1)
        : '0.0';
    report += `| ${result.locale} | ${result.file} | ${result.totalKeys} | ${result.missingKeys} | ${result.untranslatedKeys} | ${result.emptyKeys} | ${result.placeholderMismatches} | ${result.typeMismatches} | ${result.extraKeys} | ${coverage}% |\n`;
  }

  // Summary by locale
  report += '\n## Coverage by Locale\n\n';
  const localeStats: Record<string, { total: number; issues: number }> = {};
  for (const result of results) {
    if (!localeStats[result.locale]) {
      localeStats[result.locale] = { total: 0, issues: 0 };
    }
    localeStats[result.locale].total += result.totalKeys;
    localeStats[result.locale].issues +=
      result.missingKeys + result.untranslatedKeys + result.emptyKeys;
  }

  report += '| Locale | Coverage | Issues |\n';
  report += '|--------|----------|--------|\n';
  for (const [locale, stats] of Object.entries(localeStats)) {
    const coverage = (((stats.total - stats.issues) / stats.total) * 100).toFixed(1);
    report += `| ${locale.toUpperCase()} | ${coverage}% | ${stats.issues} |\n`;
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

    // Priority order for issue types
    const typeOrder = [
      'missing',
      'untranslated',
      'empty',
      'placeholder_mismatch',
      'type_mismatch',
      'extra_key',
      'invalid_json',
    ];

    for (const type of typeOrder) {
      if (!byType[type] || byType[type].length === 0) continue;

      report += `#### ${type.replace(/_/g, ' ').toUpperCase()} (${byType[type].length})\n\n`;

      const shown = byType[type].slice(0, 30);
      for (const issue of shown) {
        report += `- \`${issue.path}\`\n`;
        if (issue.details) {
          report += `  - Details: ${issue.details}\n`;
        }
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

      if (byType[type].length > 30) {
        report += `\n... and ${byType[type].length - 30} more\n`;
      }

      report += '\n';
    }
  }

  // Recommendations
  report += '## Recommendations\n\n';
  if (totalMissing > 0) {
    report += `1. **Add ${totalMissing} missing keys** - Run with \`--fix\` to auto-add placeholders\n`;
  }
  if (totalUntranslated > 0) {
    report += `2. **Translate ${totalUntranslated} untranslated strings** - These appear to be English text in non-English locales\n`;
  }
  if (totalPlaceholder > 0) {
    report += `3. **Fix ${totalPlaceholder} placeholder mismatches** - Ensure {{variables}} match between source and target\n`;
  }
  if (totalTypeMismatch > 0) {
    report += `4. **Fix ${totalTypeMismatch} type mismatches** - Ensure arrays/objects match structure\n`;
  }
  if (totalExtra > 0) {
    report += `5. **Review ${totalExtra} extra keys** - These may be orphaned translations no longer needed\n`;
  }

  return report;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes('--check');
  const isFix = args.includes('--fix');
  const isReport = args.includes('--report');
  const isAll = args.includes('--all');
  const localeArg = args.find((a) => a.startsWith('--locale='));
  const namespaceArg = args.find((a) => a.startsWith('--namespace='));
  const targetLocale = localeArg ? localeArg.split('=')[1] : null;
  const targetNamespace = namespaceArg ? namespaceArg.split('=')[1] + '.json' : null;

  const locales = targetLocale ? [targetLocale] : CONFIG.targetLocales;

  // Determine which files to check
  let files: string[];
  if (targetNamespace) {
    files = [targetNamespace];
  } else if (isAll || args.length === 0) {
    files = ALL_NAMESPACES;
  } else {
    files = ['translation.json']; // Default to main translation file
  }

  console.log('🔍 Translation Validation Script (Extended)\n');
  console.log(`Source locale: ${CONFIG.sourceLocale}`);
  console.log(`Target locales: ${locales.join(', ')}`);
  console.log(`Namespaces: ${files.join(', ')}\n`);

  const allResults: ValidationResult[] = [];
  let grandTotalKeys = 0;
  let grandTotalIssues = 0;

  for (const locale of locales) {
    console.log(`\n📝 Checking ${locale}...`);

    for (const file of files) {
      const result = validateTranslations(locale, file);
      allResults.push(result);

      const issues = result.missingKeys + result.untranslatedKeys + result.emptyKeys;
      const coverage =
        result.totalKeys > 0
          ? (((result.totalKeys - issues) / result.totalKeys) * 100).toFixed(1)
          : '0.0';

      grandTotalKeys += result.totalKeys;
      grandTotalIssues += issues + result.placeholderMismatches + result.typeMismatches;

      console.log(`   📄 ${file}: ${coverage}% coverage (${result.totalKeys} keys)`);
      if (result.missingKeys > 0) console.log(`      ❌ Missing: ${result.missingKeys}`);
      if (result.untranslatedKeys > 0)
        console.log(`      ⚠️  Untranslated: ${result.untranslatedKeys}`);
      if (result.emptyKeys > 0) console.log(`      🔸 Empty: ${result.emptyKeys}`);
      if (result.placeholderMismatches > 0)
        console.log(`      🔀 Placeholder issues: ${result.placeholderMismatches}`);
      if (result.typeMismatches > 0)
        console.log(`      🔧 Type mismatches: ${result.typeMismatches}`);
      if (result.extraKeys > 0) console.log(`      📌 Extra/orphaned keys: ${result.extraKeys}`);

      if (isFix && result.issues.length > 0) {
        const fixed = fixTranslations(locale, file, result.issues);
        console.log(`      ✅ Fixed ${fixed} issues with glossary`);
      }
    }
  }

  // Summary by locale
  console.log('\n📊 Summary by Locale:\n');
  const localeStats: Record<string, { total: number; issues: number }> = {};
  for (const result of allResults) {
    if (!localeStats[result.locale]) {
      localeStats[result.locale] = { total: 0, issues: 0 };
    }
    localeStats[result.locale].total += result.totalKeys;
    localeStats[result.locale].issues +=
      result.missingKeys + result.untranslatedKeys + result.emptyKeys;
  }

  for (const [locale, stats] of Object.entries(localeStats)) {
    const coverage = (((stats.total - stats.issues) / stats.total) * 100).toFixed(1);
    const bar =
      '█'.repeat(Math.floor(parseFloat(coverage) / 5)) +
      '░'.repeat(20 - Math.floor(parseFloat(coverage) / 5));
    console.log(`   ${locale.toUpperCase()}: ${bar} ${coverage}% (${stats.issues} issues)`);
  }

  if (isReport) {
    const report = generateReport(allResults);
    const reportPath = path.join(__dirname, 'translation-report.md');
    fs.writeFileSync(reportPath, report);
    console.log(`\n📋 Report saved to: ${reportPath}`);
  }

  const totalIssues = allResults.reduce(
    (sum, r) =>
      sum +
      r.missingKeys +
      r.untranslatedKeys +
      r.emptyKeys +
      r.placeholderMismatches +
      r.typeMismatches,
    0
  );

  console.log(`\n${'─'.repeat(50)}`);
  if (isCheck && totalIssues > 0) {
    console.log(`❌ Found ${totalIssues} translation issues across ${allResults.length} file(s)`);
    process.exit(1);
  } else if (totalIssues === 0) {
    console.log('✅ All translations are complete!');
  } else {
    console.log(`⚠️  Found ${totalIssues} translation issues across ${allResults.length} file(s)`);
    console.log('   Run with --fix to auto-fix using glossary');
    console.log('   Run with --report to generate detailed report');
  }
}

main().catch(console.error);
