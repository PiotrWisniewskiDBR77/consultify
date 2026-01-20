/**
 * Japanese Translation Patch
 *
 * This file contains comprehensive Japanese translations for missing/untranslated keys.
 * Run this script to apply the translations to the Japanese translation file.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Comprehensive Japanese translations patch
const jaTranslationsPatch: Record<string, unknown> = {
  sidebar: {
    aiChat: 'AIチャット',
    projectIntelligence: 'プロジェクトインテリジェンス',
    partnerPortal: 'パートナーポータル',
    studio: 'スタジオ',
    superAdmin: 'スーパー管理者',
    initiativeManagement: 'イニシアチブ管理',
    benefitsRealization: '効果実現',
    economics: '経済性',
    discoveryConsultant: 'ディスカバリー',
    interview: 'インタビュー',
    discoveryTools: 'ディスカバリーツール',
    strategicAnalysis: '戦略分析',
    operationalTools: '運用ツール',
    digitalTransformation: 'デジタルトランスフォーメーション',
    processAutomation: 'AIによるプロセス自動化',
    initiatives: 'イニシアチブ',
    execution: '実行',
    benefits: '効果',
    reports: 'レポート',
    portfolioRoadmap: 'イニシアチブ',
    drd: 'DRD（デジタル準備診断）',
    digitalAssessments: 'デジタル評価（SIRI、ADMA）',
    metrics: 'メトリクス＆コンバージョン',
    assessment: '評価',
    leanAssessments: 'リーン評価',
    fullStep1_cyber: 'サイバーセキュリティ',
    implementation: '実装',
    realization: '実行',
    otherAssessments: 'その他',
    assessmentDRD: 'DRD',
    assessmentSIRI: 'SIRI',
    assessmentADMA: 'ADMA',
    assessmentCMMI: 'CMMI',
    assessmentLean: 'リーン4.0',
    assessmentOther: 'その他',
    affiliateDashboard: 'エコシステムインパクト',
    collapse: '折りたたむ',
    expand: '展開',
  },

  auth: {
    verifyEmail: {
      verifying: 'メールを確認中...',
      successTitle: 'メール確認完了！',
      successMessage: 'メールの確認ありがとうございます。',
      redirecting: 'ログインページにリダイレクト中...',
      errorTitle: '確認に失敗しました',
      invalidToken: '無効な確認リンクです。',
      failedMessage: '確認に失敗しました。トークンが期限切れの可能性があります。',
    },
    backToLogin: 'ログインに戻る',
    privacyLink: 'プライバシーポリシー',
    termsLink: '利用規約',
    orRegisterWith: 'または以下で登録',
    orContinueWith: 'または以下で続行',
    tryDemo: 'デモアカウントを試す',
    accessCode: 'アクセスコード',
    accessCodePlaceholder: '招待コードを入力',
    optional: 'オプション',
    forgotPassword: 'パスワードをお忘れですか？',
    pending: {
      title: 'アクセス待ち',
      message: '組織は現在手動承認を待っています。アクセスが許可されるとメールでお知らせします。',
    },
    oauth: {
      processing: '認証処理中...',
      success: '認証成功！',
      redirecting: 'リダイレクト中...',
      failed: '認証に失敗しました',
      backToHome: 'ホームに戻る',
      googleFailed: 'Google認証に失敗しました',
      linkedinFailed: 'LinkedIn認証に失敗しました',
      tokenFailed: 'トークン生成に失敗しました。もう一度お試しください。',
    },
    invitation: {
      join: '参加',
      asRole: 'として',
      onProject: 'プロジェクト',
      project: 'プロジェクト',
      organization: '組織',
      role: '役割',
      joiningAs: '参加者として：',
      confirmPassword: 'パスワードを確認',
      acceptTerms: '同意します',
      termsOfService: '利用規約',
      and: 'および',
      decline: '辞退',
      acceptJoin: '承諾して参加',
      joining: '参加中...',
      success: 'ようこそ！',
      successMessage: 'アカウントが正常に作成されました。ログインして組織にアクセスできます。',
      invalidTitle: '無効な招待',
      validating: '招待を検証中...',
    },
    demoMode: 'デモモード',
    demoModeDescription:
      '商用目的の場合は営業チームにお問い合わせください。今すぐデモモードでプラットフォームを探索できます。',
    loginAs: 'ログインするアカウント：',
    enterDemo: 'デモモードに入る',
    contactSales: '完全アクセスのための営業へのお問い合わせ',
    back: '戻る',
    loading: '読み込み中...',
  },

  common: {
    locked: 'ロック済み',
    complete: '完了',
    first: '最初',
    previousStep: '前のステップ',
    backToDashboard: 'ダッシュボードに戻る',
    level: 'レベル',
    status: {
      saved: '自動保存済み',
      saving: '保存中...',
      unsaved: '未保存の変更',
      error: '保存に失敗しました',
      underConstruction: '構築中のコンポーネント',
    },
    impersonation: {
      banner: 'なりすまし中: {{email}}',
      stop: 'なりすましを終了',
    },
    underConstruction: '構築中のコンポーネント',
    backToHome: 'ホームに戻る',
    close: '閉じる',
    cancel: 'キャンセル',
    save: '変更を保存',
    add: '追加',
    apply: '適用',
    confirm: '確認',
    loading: '読み込み中...',
    analysis: '分析',
    statusLabel: 'ステータス：',
    notDefined: '未定義',
    notAssigned: '未割り当て',
    notSpecified: '未指定',
    high: '高',
    medium: '中',
    low: '低',
    reason: '理由',
    you: 'あなた',
    reply: '返信',
    react: 'リアクション',
  },

  settings: {
    menu: {
      workPreferences: '作業設定',
      dashboardPreferences: 'ダッシュボード',
      accessibility: 'アクセシビリティ',
      privacy: 'プライバシー',
    },
    profile: {
      manage: '個人情報と設定を管理',
      changePhoto: '写真を変更',
      company: '会社',
      saving: '保存中...',
    },
  },

  assessment: {
    workspace: {
      levelDetailsHint: '詳細を表示するにはレベルを選択',
      actual_target: '現状 + 目標',
      actual_only: '現状',
      target_only: '目標',
      dashboardHeader: '評価ダッシュボード',
      tabs: {
        summary: '評価とギャップ',
        audits: '追加監査',
      },
      generateInitiatives: 'イニシアチブを生成',
      axisProgress: '軸の進捗',
      approved: '承認済み',
      remaining: '残り',
      assessmentArea: '評価エリア',
      functionalArea: '機能エリア',
      selectArea: 'エリアを選択',
    },
    axisContent: {
      processes: {
        title: 'デジタルプロセス',
        intro: '9つの主要ビジネスプロセス領域の評価。',
        areas: {
          sales: {
            title: '営業',
            levels: {
              '1': '基本データ登録',
              '2': 'CRM導入',
              '3': 'ERP/マーケティング統合',
              '4': '営業自動化',
              '5': 'オムニチャネル統合',
              '6': 'AI駆動売上予測',
              '7': '自律型営業エージェント',
            },
          },
          marketing: {
            title: 'マーケティング',
            levels: {
              '1': '基本プロモーション',
              '2': 'デジタルプレゼンス',
              '3': 'マーケティング自動化ツール',
              '4': 'パーソナライゼーション＆セグメンテーション',
              '5': 'データ駆動キャンペーン',
              '6': '予測マーケティング（AI）',
              '7': 'リアルタイムハイパーパーソナライゼーション',
            },
          },
          technology: {
            title: 'テクノロジー（R&D）',
            levels: {
              '1': '手動設計',
              '2': 'CAD/CAMツール',
              '3': 'シミュレーションツール',
              '4': 'ラピッドプロトタイピング（3Dプリント）',
              '5': 'デジタルツイン',
              '6': 'AI駆動設計',
              '7': '自律型R&D',
            },
          },
          purchasing: {
            title: '購買',
            levels: {
              '1': 'アドホック購買',
              '2': 'デジタル発注',
              '3': '調達システム',
              '4': '自動補充',
              '5': 'サプライヤー統合',
              '6': 'AI駆動調達',
              '7': '自律型ソーシング',
            },
          },
          logistics: {
            title: '物流',
            levels: {
              '1': '手動追跡',
              '2': 'WMS導入',
              '3': '統合物流',
              '4': 'リアルタイム追跡',
              '5': '自動倉庫',
              '6': '予測サプライチェーン',
              '7': '自律型物流ネットワーク',
            },
          },
          production: {
            title: '生産',
            levels: {
              '1': '手動操作',
              '2': '機械監視',
              '3': 'プロセス制御システム',
              '4': '自動生産ライン',
              '5': 'MES導入',
              '6': '生産のデジタルツイン',
              '7': '自律型工場',
            },
          },
          quality: {
            title: '品質管理',
            levels: {
              '1': '手動検査',
              '2': 'デジタル記録',
              '3': '統計的プロセス管理',
              '4': '自動検査',
              '5': '統合品質管理',
              '6': '予測品質（AI）',
              '7': 'ゼロ欠陥自律システム',
            },
          },
          finance: {
            title: '財務',
            levels: {
              '1': 'スプレッドシート',
              '2': '会計ソフトウェア',
              '3': 'ERP財務モジュール',
              '4': '自動請求',
              '5': 'リアルタイム財務管理',
              '6': '予測財務モデリング',
              '7': '自律型財務オペレーション',
            },
          },
          hr: {
            title: '人事管理',
            levels: {
              '1': '紙ベースの記録',
              '2': 'HRISシステム',
              '3': '統合HR管理',
              '4': '自動化された採用',
              '5': '従業員体験プラットフォーム',
              '6': '予測HR分析',
              '7': 'AI駆動人材最適化',
            },
          },
        },
      },
      digitalProducts: {
        title: 'デジタル製品',
        intro: 'デジタル製品・サービスの評価。',
      },
      businessModels: {
        title: 'ビジネスモデル',
        intro: 'ビジネスモデルのデジタル成熟度評価。',
      },
      dataManagement: {
        title: 'データ管理',
        intro: 'データ管理能力の評価。',
      },
      culture: {
        title: '文化',
        intro: '組織のデジタル文化と変革準備度の評価。',
      },
      aiMaturity: {
        title: 'AI成熟度',
        intro: '人工知能の採用とビジネス統合の評価。',
        areas: {
          '7A': {
            title: 'データ＆AI基盤',
            levels: {
              '1': '断片化されたデータ、AI準備なし',
              '2': 'サイロ化された構造化データ',
              '3': '集中化されたデータ＆初期AI準備',
              '4': '完全にAI対応のデータアーキテクチャ',
              '5': '自律型データインテリジェンス',
            },
          },
          '7B': {
            title: 'AI強化プロセス',
            levels: {
              '1': '孤立したAI実験',
              '2': 'アシスト型作業自動化',
              '3': '統合されたAI意思決定支援',
              '4': '半自律型プロセス',
              '5': '完全自律型運用オーケストレーション',
            },
          },
          '7C': {
            title: '製品・サービスのAI',
            levels: {
              '1': '製品にAIコンポーネントなし',
              '2': '追加AI機能',
              '3': 'コア製品コンポーネントとしてのAI',
              '4': '完全にAI駆動の製品',
              '5': 'AIネイティブビジネスオファリング',
            },
          },
          '7D': {
            title: 'ガバナンス、セキュリティ＆倫理',
            levels: {
              '1': 'AIガバナンスなし、管理されていない使用',
              '2': '基本的なAI使用ポリシー',
              '3': '組織全体のAIガバナンスフレームワーク',
              '4': '継続的なAIリスク管理＆モニタリング',
              '5': '倫理的、透明、自律型AIガバナンス',
            },
          },
          '7E': {
            title: '能力＆AI文化',
            levels: {
              '1': '能力なし',
              '2': 'アドホック使用',
              '3': '組織的な開発',
              '4': 'AI流暢性',
              '5': 'AIネイティブスタッフ',
            },
          },
        },
      },
      cybersecurity: {
        title: 'サイバーセキュリティ',
        intro: '組織のサイバーセキュリティ態勢の評価。',
      },
    },
    card: {
      level: 'レベル',
      helperQuestions: 'ヘルパー質問',
      workingFormula: '作業式（ロジック）',
      actual: '現状',
      target: '目標',
      notApplicable: '該当なし',
      note: 'メモ',
      notePlaceholder: '観察を入力してください... AIが拡張とフォーマットを支援します。',
      accuracyHint: '正確なメモはより良い推奨の生成に役立ちます。',
      save: '保存',
      ai: 'AI',
    },
  },

  consultant: {
    panel: {
      title: 'コンサルタントパネル',
      welcome: 'お帰りなさい、{{name}}さん。クライアント組織を管理してください。',
      createInvite: '招待を作成',
      linkedOrgs: 'リンクされた組織',
      activeCount: '{{count}} アクティブ',
      loading: '読み込み中...',
      noOrgsTitle: 'リンクされた組織がありません',
      noOrgsMessage:
        'まだどの組織にもアクセスできません。開始するにはクライアントを招待してください。',
      inviteClient: 'クライアントを招待',
      openWorkspace: 'ワークスペースを開く',
      role: '役割: {{role}}',
    },
    invites: {
      backToPanel: 'パネルに戻る',
      generateInvites: '招待を生成',
      newInvitation: '新しい招待',
      inviteType: '招待タイプ',
      typeTrialOrg: '新規トライアル会社（組織）',
      typeTrialUser: '既存のトライアルユーザー',
      typeAddMe: '組織に追加',
      companyName: '会社名（オプション）',
      companyPlaceholder: '例：Acme Corp',
      targetEmail: '対象メール（オプション）',
      emailPlaceholder: 'user@example.com',
      emailHint: '汎用コードの場合は空のままにしてください。',
      generateCode: 'コードを生成',
      generating: '生成中...',
      recentInvites: '最近の招待',
      noInvites: 'まだ招待が生成されていません。',
      labelType: 'タイプ：',
      labelUses: '使用回数：',
      labelTo: '宛先：',
      labelExp: '有効期限：',
    },
  },

  legal: {
    cookies: {
      title: 'Cookieポリシー',
    },
    security: {
      title: 'セキュリティ',
    },
    contact: {
      title: 'お問い合わせ',
    },
    privacy: {
      title: 'プライバシーポリシー',
    },
    terms: {
      title: '利用規約',
    },
    lastUpdated: '最終更新',
  },

  landing: {
    trust: {
      status: {
        awaiting: 'あなたの決定を待っています',
        approved: 'あなたによって承認されました',
      },
    },
    compliance: {
      certifications: {
        title: 'グローバルコンプライアンス',
        gdpr: 'GDPR（EU）',
        ccpa: 'CCPA（カリフォルニア）',
        pdpl: 'PDPL（サウジアラビア）',
        appi: 'APPI（日本）',
        pipeda: 'PIPEDA（カナダ）',
      },
    },
    footer: {
      legal: {
        security: 'セキュリティ',
      },
      resources: {
        title: 'リソース',
        docs: 'ドキュメント',
        knowledgeBase: 'ナレッジベース',
        api: 'API',
      },
    },
  },

  fullReports: {
    labels: {
      initiatives: 'イニシアチブ',
    },
  },

  fullAssessment: {
    introMicrocopy:
      'この評価は、デジタル準備診断（DRD）モデルの6つの次元で組織を評価します。スコアは1（初心者）から7（リーダー）の範囲です。',
  },

  aiChat: {
    title: 'AIアシスタント',
    placeholder: '質問を入力...',
    send: '送信',
    clear: 'クリア',
    history: '履歴',
    newChat: '新しいチャット',
    thinking: '考え中...',
    error: 'エラーが発生しました',
    retry: '再試行',
    copy: 'コピー',
    copied: 'コピーしました',
    feedback: {
      helpful: '役に立った',
      notHelpful: '役に立たなかった',
      report: '問題を報告',
    },
    welcome: {
      title: 'こんにちは、{{name}}さん',
      subtitle: 'イニシアチブを進めましょう',
      quickActions: {
        dailyBrief: 'デイリーブリーフ',
        planWeek: '週を計画',
        createDiagram: 'ダイアグラムを作成',
      },
    },
    sidebar: {
      conversations: '会話',
      projects: 'プロジェクト',
      newProject: '新しいプロジェクト',
      searchPlaceholder: '会話を検索...',
      noConversations: 'まだ会話がありません',
      today: '今日',
      yesterday: '昨日',
      thisWeek: '今週',
      older: 'それ以前',
    },
    context: {
      addFile: 'ファイルを追加',
      addContext: 'コンテキストを追加',
      currentContext: '現在のコンテキスト',
      noContext: 'コンテキストが選択されていません',
    },
    tools: {
      title: 'ツール',
      search: '検索',
      code: 'コード',
      diagram: 'ダイアグラム',
      document: 'ドキュメント',
    },
    voice: {
      start: '音声入力を開始',
      stop: '音声入力を停止',
      listening: '聞いています...',
      processing: '処理中...',
    },
  },

  discovery: {
    title: 'ディスカバリーツール',
    description: '組織の戦略分析ツール',
    megatrends: {
      title: 'メガトレンドスキャナー',
      description: '業界に影響を与えるグローバルトレンドを分析',
    },
    swot: {
      title: 'SWOT分析',
      description: '強み、弱み、機会、脅威を特定',
    },
    canvas: {
      title: 'ビジネスモデルキャンバス',
      description: 'ビジネスモデルを視覚化して設計',
    },
    valueChain: {
      title: 'バリューチェーン分析',
      description: '価値創造プロセスを分析',
    },
    interview: {
      title: 'インタビュー',
      description: 'ステークホルダーインタビューを実施',
    },
  },

  benefits: {
    title: '効果実現',
    description: 'イニシアチブの効果を追跡・管理',
    tracking: {
      title: '効果追跡',
      realized: '実現済み',
      inProgress: '進行中',
      planned: '計画済み',
    },
    metrics: {
      title: 'メトリクス',
      roi: 'ROI',
      npv: 'NPV',
      payback: '回収期間',
    },
  },

  portfolio: {
    title: 'ポートフォリオ',
    description: 'イニシアチブポートフォリオの管理',
    views: {
      kanban: 'カンバン',
      list: 'リスト',
      timeline: 'タイムライン',
      matrix: 'マトリクス',
    },
    filters: {
      all: 'すべて',
      active: 'アクティブ',
      completed: '完了',
      onHold: '保留中',
    },
  },

  execution: {
    title: '実行',
    description: 'イニシアチブの実行を管理',
    status: {
      onTrack: '順調',
      atRisk: 'リスクあり',
      delayed: '遅延',
      completed: '完了',
    },
    metrics: {
      progress: '進捗',
      budget: '予算',
      timeline: 'タイムライン',
      quality: '品質',
    },
  },

  reports: {
    title: 'レポート',
    description: '変革レポートを生成・表示',
    types: {
      executive: 'エグゼクティブサマリー',
      detailed: '詳細レポート',
      custom: 'カスタムレポート',
    },
    export: {
      pdf: 'PDFでエクスポート',
      excel: 'Excelでエクスポート',
      powerpoint: 'PowerPointでエクスポート',
    },
  },

  admin: {
    title: '管理',
    description: 'システム管理',
    users: {
      title: 'ユーザー管理',
      add: 'ユーザーを追加',
      edit: 'ユーザーを編集',
      delete: 'ユーザーを削除',
      roles: '役割',
      permissions: '権限',
    },
    organizations: {
      title: '組織管理',
      add: '組織を追加',
      edit: '組織を編集',
      settings: '組織設定',
    },
    integrations: {
      title: '統合',
      add: '統合を追加',
      configure: '設定',
    },
    audit: {
      title: '監査ログ',
      view: 'ログを表示',
    },
  },

  onboarding: {
    title: 'オンボーディング',
    welcome: 'Consultinityへようこそ',
    steps: {
      profile: 'プロフィール設定',
      organization: '組織設定',
      team: 'チームを招待',
      assessment: '最初の評価',
    },
    skip: 'スキップ',
    next: '次へ',
    back: '戻る',
    finish: '完了',
  },

  notifications: {
    title: '通知',
    markAllRead: 'すべて既読にする',
    settings: '通知設定',
    empty: '通知はありません',
    types: {
      task: 'タスク',
      mention: 'メンション',
      update: '更新',
      reminder: 'リマインダー',
    },
  },

  help: {
    title: 'ヘルプ',
    search: 'ヘルプを検索...',
    categories: {
      gettingStarted: 'はじめに',
      features: '機能',
      faq: 'よくある質問',
      contact: 'お問い合わせ',
    },
    feedback: {
      title: 'フィードバック',
      placeholder: 'フィードバックを入力...',
      submit: '送信',
      thanks: 'フィードバックありがとうございます！',
    },
  },

  errors: {
    notFound: 'ページが見つかりません',
    unauthorized: 'アクセス権限がありません',
    serverError: 'サーバーエラーが発生しました',
    networkError: 'ネットワークエラー',
    tryAgain: '再試行',
    goBack: '戻る',
    goHome: 'ホームに戻る',
  },

  validation: {
    required: 'この項目は必須です',
    email: '有効なメールアドレスを入力してください',
    password: {
      min: 'パスワードは8文字以上である必要があります',
      match: 'パスワードが一致しません',
    },
    phone: '有効な電話番号を入力してください',
    url: '有効なURLを入力してください',
  },

  dateTime: {
    today: '今日',
    yesterday: '昨日',
    tomorrow: '明日',
    thisWeek: '今週',
    lastWeek: '先週',
    thisMonth: '今月',
    lastMonth: '先月',
    thisYear: '今年',
    lastYear: '去年',
    daysAgo: '{{count}}日前',
    hoursAgo: '{{count}}時間前',
    minutesAgo: '{{count}}分前',
    justNow: 'たった今',
  },
};

// Deep merge function
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        output[key] = deepMerge(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>
        );
      } else {
        output[key] = source[key];
      }
    } else {
      output[key] = source[key];
    }
  }

  return output;
}

// Main function to apply patch
async function applyPatch() {
  const jaFilePath = path.join(__dirname, '../../public/locales/ja/translation.json');

  console.log('📝 Reading current Japanese translations...');
  const currentJa = JSON.parse(fs.readFileSync(jaFilePath, 'utf-8'));

  console.log('🔄 Merging with translation patch...');
  const merged = deepMerge(currentJa, jaTranslationsPatch as Record<string, unknown>);

  console.log('💾 Saving updated translations...');
  fs.writeFileSync(jaFilePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');

  console.log('✅ Japanese translations updated successfully!');
}

applyPatch().catch(console.error);
