
import json
import os

new_keys = {
  "assessment": {
    "workspace": {
      "header": {
        "EN": "DRD Assessment",
        "PL": "Ocena DRD",
        "DE": "DRD-Bewertung",
        "AR": "تقييم DRD",
        "JA": "DRDアセスメント"
      },
      "senseCheck": {
        "EN": "AI Sense Check",
        "PL": "Weryfikacja AI",
        "DE": "KI-Sinnprüfung",
        "AR": "فحص الذكاء الاصطناعي",
        "JA": "AIセンスチェック"
      },
      "analyzing": {
        "EN": "Analyzing...",
        "PL": "Analizowanie...",
        "DE": "Analysieren...",
        "AR": "تحليل...",
        "JA": "分析中..."
      },
      "logicVerified": {
        "EN": "Logic Verified",
        "PL": "Logika Zweryfikowana",
        "DE": "Logik Verifiziert",
        "AR": "تم التحقق من المنطق",
        "JA": "ロジック検証済み"
      },
      "logicWarning": {
        "EN": "Logic Warning",
        "PL": "Ostrzeżenie Logiczne",
        "DE": "Logik-Warnung",
        "AR": "تحذير منطقي",
        "JA": "ロジック警告"
      },
      "actual": {
        "EN": "Actual",
        "PL": "Obecny",
        "DE": "Aktuell",
        "AR": "الفعلي",
        "JA": "現状"
      },
      "target": {
        "EN": "Target",
        "PL": "Docelowy",
        "DE": "Ziel",
        "AR": "المستهدف",
        "JA": "目標"
      },
      "maturityLevels": {
        "EN": "Maturity Levels",
        "PL": "Poziomy Dojrzałości",
        "DE": "Reifegradstufen",
        "AR": "مستويات النضج",
        "JA": "成熟度レベル"
      },
      "transformationPathway": {
        "EN": "Transformation Pathway",
        "PL": "Ścieżka Transformacji",
        "DE": "Transformationspfad",
        "AR": "مسار التحول",
        "JA": "変革パス"
      },
      "pathwayIntro": {
        "EN": "To move from Level {{actual}} to Level {{target}}, the following key shifts are required:",
        "PL": "Aby przejść z Poziomu {{actual}} na Poziom {{target}}, wymagane są następujące kluczowe zmiany:",
        "DE": "Um von Stufe {{actual}} auf Stufe {{target}} zu gelangen, sind folgende wichtige Änderungen erforderlich:",
        "AR": "للانتقال من المستوى {{actual}} إلى المستوى {{target}}، يلزم إجراء التحولات الرئيسية التالية:",
        "JA": "レベル {{actual}} からレベル {{target}} に移行するには、以下の主要なシフトが必要です。"
      },
      "transitionPhase": {
        "EN": "Transition Phase {{phase}}",
        "PL": "Faza Przejściowa {{phase}}",
        "DE": "Übergangsphase {{phase}}",
        "AR": "مرحلة الانتقال {{phase}}",
        "JA": "移行フェーズ {{phase}}"
      },
      "impliedStep": {
        "EN": "implied step from {{from}} to {{to}}",
        "PL": "krok pośredni od {{from}} do {{to}}",
        "DE": "impliziter Schritt von {{from}} nach {{to}}",
        "AR": "خطوة ضمنية من {{from}} إلى {{to}}",
        "JA": "{{from}} から {{to}} への暗黙のステップ"
      },
      "selectLevelsHint": {
        "EN": "Select Actual and Target levels to visualize the pathway.",
        "PL": "Wybierz poziomy Obecny i Docelowy, aby zwizualizować ścieżkę.",
        "DE": "Wählen Sie Aktuell und Ziel, um den Pfad zu visualisieren.",
        "AR": "حدد المستويات الفعلية والمستهدفة لتصور المسار.",
        "JA": "現状と目標のレベルを選択してパスを視覚化してください。"
      },
      "strategicRationale": {
        "EN": "Strategic Rationale",
        "PL": "Uzasadnienie Strategiczne",
        "DE": "Strategische Begründung",
        "AR": "الأساس الاستراتيجي",
        "JA": "戦略的根拠"
      },
      "rationalePlaceholder": {
        "EN": "Why is this target critical for your business strategy?",
        "PL": "Dlaczego ten cel jest krytyczny dla strategii biznesowej?",
        "DE": "Warum ist dieses Ziel für Ihre Geschäftsstrategie entscheidend?",
        "AR": "لماذا هذا الهدف حاسم لاستراتيجية عملك؟",
        "JA": "なぜこの目標がビジネス戦略にとって重要ですか？"
      },
      "proMode": {
        "EN": "PRO Mode Active: Logic Validation Enabled",
        "PL": "Tryb PRO Aktywny: Walidacja Logiki Włączona",
        "DE": "PRO-Modus Aktiv: Logikprüfung Aktiviert",
        "AR": "الوضع الاحترافي نشط: التحقق من المنطق مفعل",
        "JA": "PROモード有効: ロジック検証が有効です"
      },
      "confirmNext": {
        "EN": "Confirm & Next",
        "PL": "Zatwierdź i Dalej",
        "DE": "Bestätigen & Weiter",
        "AR": "تأكيد والتالي",
        "JA": "確認して次へ"
      },
       "validated": {
        "EN": "Assessment Validated",
        "PL": "Ocena Zweryfikowana",
        "DE": "Bewertung Validiert",
        "AR": "تم التحقق من التقييم",
        "JA": "アセスメント検証済み"
      },
      "consultantWarning": {
        "EN": "Consultant Warning",
        "PL": "Ostrzeżenie Konsultanta",
        "DE": "Beraterwarnung",
        "AR": "تحذير استشاري",
        "JA": "コンサルタント警告"
      }
    },
    "wizard": {
      "startTitle": {
        "EN": "Start Assessment",
        "PL": "Rozpocznij Ocenę",
        "DE": "Bewertung Starten",
        "AR": "بدء التقييم",
        "JA": "アセスメント開始"
      },
      "startDesc": {
        "EN": "Answer a few questions so our algorithm can recommend your digital maturity level in this area.",
        "PL": "Odpowiedz na kilka pytań, aby nasz algorytm mógł zarekomendować Twój poziom dojrzałości cyfrowej w tym obszarze.",
        "DE": "Beantworten Sie einige Fragen, damit unser Algorithmus Ihren digitalen Reifegrad in diesem Bereich empfehlen kann.",
        "AR": "أجب على بعض الأسئلة ليتمكن خوارزميتنا من التوصية بمستوى نضجك الرقمي في هذا المجال.",
        "JA": "いくつかの質問に答えて、この分野のデジタル成熟度レベルを推奨してもらいましょう。"
      },
      "startBtn": {
        "EN": "Start",
        "PL": "Start",
        "DE": "Start",
        "AR": "بدء",
        "JA": "開始"
      },
      "questionProgress": {
        "EN": "Question {{current}} / {{total}}",
        "PL": "Pytanie {{current}} / {{total}}",
        "DE": "Frage {{current}} / {{total}}",
        "AR": "سؤال {{current}} / {{total}}",
        "JA": "質問 {{current}} / {{total}}"
      },
      "yes": {
        "EN": "Yes, fully",
        "PL": "Tak, w pełni",
        "DE": "Ja, vollständig",
        "AR": "نعم، بالكامل",
        "JA": "はい、完全に"
      },
      "partial": {
        "EN": "Partially / In Progress",
        "PL": "Częściowo / W toku",
        "DE": "Teilweise / In Bearbeitung",
        "AR": "جزئيًا / قيد التقدم",
        "JA": "部分的 / 進行中"
      },
      "no": {
        "EN": "No",
        "PL": "Nie",
        "DE": "Nein",
        "AR": "لا",
        "JA": "いいえ"
      },
      "skip": {
        "EN": "Skip (Not applicable)",
        "PL": "Pomiń (Nie dotyczy)",
        "DE": "Überspringen (Nicht zutreffend)",
        "AR": "تخطي (لا ينطبق)",
        "JA": "スキップ (該当なし)"
      },
      "recommendedLevel": {
        "EN": "Recommended Level",
        "PL": "Rekomendowany Poziom",
        "DE": "Empfohlenes Niveau",
        "AR": "المستوى الموصى به",
        "JA": "推奨レベル"
      },
      "suggestedLevelDesc": {
        "EN": "Based on your answers, we suggest this maturity level.",
        "PL": "Na podstawie Twoich odpowiedzi sugerujemy ten poziom dojrzałości.",
        "DE": "Basierend auf Ihren Antworten schlagen wir dieses Reifegradniveau vor.",
        "AR": "بناءً على إجاباتك، نقترح هذا المستوى من النضج.",
        "JA": "あなたの回答に基づき、この成熟度レベルを提案します。"
      },
      "acceptResult": {
        "EN": "Accept Result",
        "PL": "Akceptuj Wynik",
        "DE": "Ergebnis Akzeptieren",
        "AR": "قبول النتيجة",
        "JA": "結果を受け入れる"
      },
      "adjustManually": {
        "EN": "Adjust Manually",
        "PL": "Dostosuj Ręcznie",
        "DE": "Manuell Anpassen",
        "AR": "تعديل يدوياً",
        "JA": "手動で調整"
      },
      "cancel": {
        "EN": "Cancel",
        "PL": "Anuluj",
        "DE": "Abbrechen",
        "AR": "إلغاء",
        "JA": "キャンセル"
      }
    },
    # We also need to translate the AXIS CONTENT (Titles and Levels)
    "axisContent": {
      "processes": {
        "title": { "EN": "Digital Processes", "PL": "Procesy Cyfrowe", "DE": "Digitale Prozesse", "AR": "العمليات الرقمية", "JA": "デジタルプロセス" },
        "levels": {
          "1": { "EN": "Basic Data Registration", "PL": "Podstawowa Rejestracja Danych", "DE": "Grundlegende Datenerfassung", "AR": "تسجيل البيانات الأساسية", "JA": "基本データ登録" },
          "2": { "EN": "Workstation Control", "PL": "Kontrola Stanowiska Pracy", "DE": "Arbeitsplatzsteuerung", "AR": "التحكم في محطة العمل", "JA": "ワークステーション制御" },
          "3": { "EN": "Process Control", "PL": "Kontrola Procesu", "DE": "Prozesssteuerung", "AR": "التحكم في العمليات", "JA": "プロセス制御" },
          "4": { "EN": "Automation", "PL": "Automatyzacja", "DE": "Automatisierung", "AR": "الأتمتة", "JA": "自動化" },
          "5": { "EN": "MES (Manufacturing Execution Systems)", "PL": "MES (Systemy Realizacji Produkcji)", "DE": "MES (Fertigungsmanagementsysteme)", "AR": "MES (أنظمة تنفيذ التصنيع)", "JA": "MES (製造実行システム)" },
          "6": { "EN": "ERP (Enterprise Resource Planning)", "PL": "ERP (Planowanie Zasobów Przedsiębiorstwa)", "DE": "ERP (Unternehmensressourcenplanung)", "AR": "ERP (تخطيط موارد المؤسسة)", "JA": "ERP (エンタープライズリソースプランニング)" },
          "7": { "EN": "AI Support Algorithms", "PL": "Algorytmy Wspierające AI", "DE": "KI-Unterstützungsalgorithmen", "AR": "خوارزميات دعم الذكاء الاصطناعي", "JA": "AIサポートアルゴリズム" }
        }
      },
      "digitalProducts": {
         "title": { "EN": "Digital Products", "PL": "Produkty Cyfrowe", "DE": "Digitale Produkte", "AR": "المنتجات الرقمية", "JA": "デジタル製品" },
         "levels": {
             "1": { "EN": "Physical Only", "PL": "Tylko Fizyczne", "DE": "Nur Physisch", "AR": "مادي فقط", "JA": "物理のみ" },
             "2": { "EN": "Digital Extension", "PL": "Rozszerzenie Cyfrowe", "DE": "Digitale Erweiterung", "AR": "تمديد رقمي", "JA": "デジタル拡張" },
             "3": { "EN": "Connected Product", "PL": "Produkt Połączony", "DE": "Vernetztes Produkt", "AR": "منتج متصل", "JA": "接続された製品" },
             "4": { "EN": "Smart Product", "PL": "Inteligentny Produkt", "DE": "Intelligentes Produkt", "AR": "منتج ذكي", "JA": "スマート製品" },
             "5": { "EN": "Product as a Service", "PL": "Produkt jako Usługa", "DE": "Produkt als Service", "AR": "المنتج كخدمة", "JA": "サービスとしての製品" },
             "6": { "EN": "Platform", "PL": "Platforma", "DE": "Plattform", "AR": "منصة", "JA": "プラットフォーム" },
             "7": { "EN": "Ecosystem", "PL": "Ekosystem", "DE": "Ökosystem", "AR": "نظام بيئي", "JA": "エコシステム" }
         }
      },
      "businessModels": {
          "title": {"EN": "Business Models", "PL": "Modele Biznesowe", "DE": "Geschäftsmodelle", "AR": "نطاقات الأعمال", "JA": "ビジネスモデル" },
          "levels": {
              "1": { "EN": "Traditional Sales", "PL": "Tradycyjna Sprzedaż", "DE": "Traditioneller Verkauf", "AR": "المبيعات التقليدية", "JA": "伝統的な販売" },
              "2": { "EN": "E-commerce", "PL": "E-commerce", "DE": "E-Commerce", "AR": "التجارة الإلكترونية", "JA": "Eコマース" },
              "3": { "EN": "Service-based", "PL": "Oparte na Usługach", "DE": "Service-basiert", "AR": "قائم على الخدمات", "JA": "サービスベース" },
              "4": { "EN": "Subscription", "PL": "Subskrypcja", "DE": "Abonnement", "AR": "اشتراك", "JA": "サブスクリプション" },
              "5": { "EN": "Usage-based", "PL": "Oparte na Użyciu", "DE": "Nutzungsbasiert", "AR": "قائم على الاستخدام", "JA": "使用量ベース" },
              "6": { "EN": "Outcome-based", "PL": "Oparte na Wynikach", "DE": "Ergebnisorientiert", "AR": "قائم على النتائج", "JA": "成果ベース" },
              "7": { "EN": "Ecosystem orchestrator", "PL": "Orkiestrator Ekosystemu", "DE": "Ökosystem-Orchestrator", "AR": "منسق النظام البيئي", "JA": "エコシステムオーケストレーター" }
          }
      },
      "dataManagement": {
          "title": { "EN": "Data Management", "PL": "Zarządzanie Danymi", "DE": "Datenmanagement", "AR": "إدارة البيانات", "JA": "データ管理" },
          "levels": {
             "1": { "EN": "No Data", "PL": "Brak Danych", "DE": "Keine Daten", "AR": "لا توجد بيانات", "JA": "データなし" },
             "2": { "EN": "Descriptive (What happened)", "PL": "Opisowe (Co się stało)", "DE": "Deskriptiv (Was passierte)", "AR": "وصفي (ماذا حدث)", "JA": "記述的（何が起こったか）" },
             "3": { "EN": "Diagnostic (Why)", "PL": "Diagnostyczne (Dlaczego)", "DE": "Diagnostisch (Warum)", "AR": "تشخيصي (لماذا)", "JA": "診断的（なぜ）" },
             "4": { "EN": "Predictive (What will happen)", "PL": "Predykcyjne (Co się stanie)", "DE": "Prädiktiv (Was wird passieren)", "AR": "تنبؤي (ماذا سيحدث)", "JA": "予測的（何が起こるか）" },
             "5": { "EN": "Prescriptive (What to do)", "PL": "Preskryptywne (Co robić)", "DE": "Präskriptiv (Was zu tun ist)", "AR": "توجيهي (ماذا تفعل)", "JA": "処方的（何をすべきか）" },
             "6": { "EN": "Cognitive (AI)", "PL": "Kognitywne (AI)", "DE": "Kognitiv (KI)", "AR": "معرفي (AI)", "JA": "認知的 (AI)" },
             "7": { "EN": "Generative", "PL": "Generatywne", "DE": "Generativ", "AR": "توليدي", "JA": "生成的" }
          }
      },
      "culture": {
          "title": { "EN": "Culture", "PL": "Kultura", "DE": "Kultur", "AR": "ثقافة", "JA": "文化" },
          "levels": {
              "1": { "EN": "Resistant", "PL": "Opór", "DE": "Widerständig", "AR": "مقاوم", "JA": "抵抗" },
              "2": { "EN": "Aware", "PL": "Świadomość", "DE": "Bewusst", "AR": "مدرك", "JA": "認識" },
              "3": { "EN": "Curious", "PL": "Cciekawość", "DE": "Neugierig", "AR": "فضولي", "JA": "好奇心" },
              "4": { "EN": "Agile", "PL": "Zwinność", "DE": "Agil", "AR": "رشيق", "JA": "アジャイル" },
              "5": { "EN": "Data-driven", "PL": "Oparte na Danych", "DE": "Datengetrieben", "AR": "قائم على البيانات", "JA": "データ駆動" },
              "6": { "EN": "Innovator", "PL": "Innowator", "DE": "Innovator", "AR": "مبتكر", "JA": "イノベーター" },
              "7": { "EN": "Digital Native", "PL": "Cyfrowy Tubylec", "DE": "Digital Native", "AR": "رقمي أصلي", "JA": "デジタルネイティブ" }
          }
      },
      "cybersecurity": {
          "title": { "EN": "Cybersecurity", "PL": "Cyberbezpieczeństwo", "DE": "Cybersicherheit", "AR": "الأمن السيبراني", "JA": "サイバーセキュリティ" },
          "levels": {
              "1": { "EN": "None", "PL": "Brak", "DE": "Keine", "AR": "لا شيء", "JA": "なし" },
              "2": { "EN": "Basic (Firewall)", "PL": "Podstawowe (Firewall)", "DE": "Grundlegend (Firewall)", "AR": "أساسي (جدار حماية)", "JA": "基本 (ファイアウォール)" },
              "3": { "EN": "Compliance-based", "PL": "Zgodność z przepisami", "DE": "Compliance-basiert", "AR": "قائم على الامتثال", "JA": "コンプライアンスベース" },
              "4": { "EN": "Proactive", "PL": "Proaktywne", "DE": "Proaktiv", "AR": "استباقي", "JA": "プロアクティブ" },
              "5": { "EN": "Resilient", "PL": "Odporne", "DE": "Widerstandsfähig", "AR": "مرن", "JA": "レジリエント" },
              "6": { "EN": "Zero Trust", "PL": "Zero Trust", "DE": "Zero Trust", "AR": "صفر ثقة", "JA": "ゼロトラスト" },
              "7": { "EN": "Immune", "PL": "Odpornościowe", "DE": "Immun", "AR": "محصن", "JA": "免疫" }
          }
      },
      "aiMaturity": {
          "title": { "EN": "AI Maturity", "PL": "Dojrzałość AI", "DE": "KI-Reife", "AR": "نضج الذكاء الاصطناعي", "JA": "AI成熟度" },
          "levels": {
              "1": { "EN": "None", "PL": "Brak", "DE": "Keine", "AR": "لا شيء", "JA": "なし" },
              "2": { "EN": "Experiments", "PL": "Eksperymenty", "DE": "Experimente", "AR": "تجارب", "JA": "実験" },
              "3": { "EN": "Point Solutions", "PL": "Rozwiązania Punktowe", "DE": "Punktlösungen", "AR": "حلول نقطية", "JA": "ポイントソリューション" },
              "4": { "EN": "Integrated AI", "PL": "Zintegrowane AI", "DE": "Integrierte KI", "AR": "ذكاء اصطناعي مدمج", "JA": "統合AI" },
              "5": { "EN": "AI-First Strategy", "PL": "Strategia AI-First", "DE": "AI-First-Strategie", "AR": "استراتيجية الذكاء الاصطناعي أولاً", "JA": "AIファースト戦略" },
              "6": { "EN": "Autonomous Agents", "PL": "Autonomiczne Agenty", "DE": "Autonome Agenten", "AR": "وكلاء مستقلون", "JA": "自律エージェント" },
              "7": { "EN": "Superintelligence", "PL": "Superinteligencja", "DE": "Superintelligenz", "AR": "ذكاء خارق", "JA": "スーパーインテリジェンス" }
          }
      }
    }
  }
}

path = 'scripts/full_translations.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Helper for recursive update
def deep_update(source, overrides):
    for key, value in overrides.items():
        if isinstance(value, dict) and value:
            returned = deep_update(source.get(key, {}), value)
            source[key] = returned
        else:
            source[key] = overrides[key]
    return source

deep_update(data, new_keys)

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Updated translations successfully for assessment.")
