#!/usr/bin/env python3
"""
Feedback cluster `pasek-limitations`:
- #b85f5a91 "Pasek Limitations - tłumaczenie" - missing demo banner translations
- #4180b14f "Brak tłumaczenia" - demo mode popup missing translations

This script injects the `demo.banner.*` and access.blocked/modal/cta/banner.*
keys (used by the demo top banner and AccessBlockedModal) into the supported
locales that were falling back to English-only strings: de, es, ar, jp.
EN gets an explicit block too so the inline defaults stop being the source of
truth for the banner copy.
"""
import json
import os
import sys
from collections import OrderedDict

ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "locales")

# Keys used by DemoModeBanner / DemoTopbarStatus / SmartDemoBanner
DEMO_BANNER = {
    "pl": {
        "showLimitations": "Ograniczenia",
        "hideLimitations": "Ukryj",
        "aiUsageLabel": "AI",
        "used": "użyto",
        "aiUsageTooltip": "Wywołania AI dzisiaj / limit dzienny",
        "tokenUsageTooltip": "Tokeny zużyte dzisiaj / limit dzienny",
        "limitations": {
            "readOnly": "Tryb tylko do odczytu — zmiany nie zostaną zapisane",
            "sampleData": "Dane przykładowe — eksploruj na realistycznych przykładach",
            "session": "Sesja wygasa za 24h",
            "aiQuota": "Interakcje AI ograniczone ({{remaining}}/{{limit}})",
        },
    },
    # Note: EN inline defaults in the component already cover the common
    # keys; we still write them here to keep fallback chains consistent when
    # debug extraction is run against the JSON catalogs.
    "en": {
        "aiUsageLabel": "AI",
        "used": "used",
        "aiUsageTooltip": "AI calls used today / daily limit",
        "tokenUsageTooltip": "Tokens used today / daily limit",
        "mode": "Demo Mode",
        "exit": "Exit Demo",
        "exitShort": "Exit",
        "startTrial": "Start Trial",
        "restartLocale": "Reload demo in {{locale}}",
        "projects": "projects",
        "initiatives": "initiatives",
        "hints": "Hints",
        "readOnlyTitle": "Read-only mode",
        "readOnlyDesc": "Changes are not saved",
        "exploreTitle": "Explore features",
        "exploreDesc": "Browse all modules",
        "hintTitle": "Hint",
        "defaultHint": "Click on initiatives to see details",
        "help": "Help",
        "partnerProgram": "Partner Program",
        "showLimitations": "Limitations",
        "hideLimitations": "Hide",
        "limitations": {
            "readOnly": "Read-only mode — changes won't persist",
            "sampleData": "Sample data — explore with realistic examples",
            "session": "Session expires in 24h",
            "aiQuota": "AI interactions limited ({{remaining}}/{{limit}})",
        },
    },
    "de": {
        "aiUsageLabel": "KI",
        "used": "verwendet",
        "aiUsageTooltip": "Heute verwendete KI-Aufrufe / tägliches Limit",
        "tokenUsageTooltip": "Heute verwendete Tokens / tägliches Limit",
        "mode": "Demo-Modus",
        "exit": "Demo verlassen",
        "exitShort": "Schließen",
        "startTrial": "Testphase starten",
        "restartLocale": "Demo in {{locale}} neu laden",
        "projects": "Projekte",
        "initiatives": "Initiativen",
        "hints": "Hinweise",
        "readOnlyTitle": "Nur-Lese-Modus",
        "readOnlyDesc": "Änderungen werden nicht gespeichert",
        "exploreTitle": "Funktionen erkunden",
        "exploreDesc": "Alle Module durchsuchen",
        "hintTitle": "Hinweis",
        "defaultHint": "Klicken Sie auf Initiativen, um Details zu sehen",
        "help": "Hilfe",
        "partnerProgram": "Partnerprogramm",
        "showLimitations": "Einschränkungen",
        "hideLimitations": "Ausblenden",
        "limitations": {
            "readOnly": "Nur-Lese-Modus — Änderungen werden nicht gespeichert",
            "sampleData": "Beispieldaten — entdecken Sie realistische Szenarien",
            "session": "Sitzung läuft in 24 Std. ab",
            "aiQuota": "KI-Interaktionen begrenzt ({{remaining}}/{{limit}})",
        },
    },
    "es": {
        "aiUsageLabel": "IA",
        "used": "usadas",
        "aiUsageTooltip": "Llamadas de IA usadas hoy / límite diario",
        "tokenUsageTooltip": "Tokens usados hoy / límite diario",
        "mode": "Modo demo",
        "exit": "Salir del demo",
        "exitShort": "Salir",
        "startTrial": "Iniciar prueba",
        "restartLocale": "Recargar demo en {{locale}}",
        "projects": "proyectos",
        "initiatives": "iniciativas",
        "hints": "Sugerencias",
        "readOnlyTitle": "Modo solo lectura",
        "readOnlyDesc": "Los cambios no se guardan",
        "exploreTitle": "Explorar funciones",
        "exploreDesc": "Navegar por todos los módulos",
        "hintTitle": "Sugerencia",
        "defaultHint": "Haga clic en las iniciativas para ver los detalles",
        "help": "Ayuda",
        "partnerProgram": "Programa de socios",
        "showLimitations": "Limitaciones",
        "hideLimitations": "Ocultar",
        "limitations": {
            "readOnly": "Modo solo lectura — los cambios no se guardan",
            "sampleData": "Datos de muestra — explora con ejemplos realistas",
            "session": "La sesión expira en 24 h",
            "aiQuota": "Interacciones de IA limitadas ({{remaining}}/{{limit}})",
        },
    },
    "ar": {
        "aiUsageLabel": "الذكاء الاصطناعي",
        "used": "مستخدم",
        "aiUsageTooltip": "مكالمات الذكاء الاصطناعي اليوم / الحد اليومي",
        "tokenUsageTooltip": "الرموز المستخدمة اليوم / الحد اليومي",
        "mode": "الوضع التجريبي",
        "exit": "الخروج من الوضع التجريبي",
        "exitShort": "خروج",
        "startTrial": "بدء الفترة التجريبية",
        "restartLocale": "إعادة تحميل العرض التجريبي بـ {{locale}}",
        "projects": "مشاريع",
        "initiatives": "مبادرات",
        "hints": "تلميحات",
        "readOnlyTitle": "وضع القراءة فقط",
        "readOnlyDesc": "التغييرات غير محفوظة",
        "exploreTitle": "استكشف الميزات",
        "exploreDesc": "تصفح جميع الوحدات",
        "hintTitle": "تلميح",
        "defaultHint": "انقر على المبادرات لعرض التفاصيل",
        "help": "المساعدة",
        "partnerProgram": "برنامج الشركاء",
        "showLimitations": "القيود",
        "hideLimitations": "إخفاء",
        "limitations": {
            "readOnly": "وضع القراءة فقط — التغييرات لا تُحفظ",
            "sampleData": "بيانات نموذجية — استكشف مع أمثلة واقعية",
            "session": "تنتهي الجلسة خلال 24 ساعة",
            "aiQuota": "تفاعلات الذكاء الاصطناعي محدودة ({{remaining}}/{{limit}})",
        },
    },
    "jp": {
        "aiUsageLabel": "AI",
        "used": "使用",
        "aiUsageTooltip": "本日のAI呼び出し / 1日の上限",
        "tokenUsageTooltip": "本日のトークン使用量 / 1日の上限",
        "mode": "デモモード",
        "exit": "デモを終了",
        "exitShort": "終了",
        "startTrial": "トライアル開始",
        "restartLocale": "{{locale}}でデモを再読み込み",
        "projects": "プロジェクト",
        "initiatives": "イニシアチブ",
        "hints": "ヒント",
        "readOnlyTitle": "読み取り専用モード",
        "readOnlyDesc": "変更は保存されません",
        "exploreTitle": "機能を探索",
        "exploreDesc": "すべてのモジュールを閲覧",
        "hintTitle": "ヒント",
        "defaultHint": "詳細を見るにはイニシアチブをクリック",
        "help": "ヘルプ",
        "partnerProgram": "パートナープログラム",
        "showLimitations": "制限事項",
        "hideLimitations": "隠す",
        "limitations": {
            "readOnly": "読み取り専用モード — 変更は保存されません",
            "sampleData": "サンプルデータ — リアルな例で探索",
            "session": "セッションは24時間で期限切れ",
            "aiQuota": "AIインタラクション制限 ({{remaining}}/{{limit}})",
        },
    },
}

# AccessBlockedModal + TrialBanner / DemoModeBanner copy
ACCESS = {
    "de": {
        "banner": {
            "demo": "Sie sehen eine Demo-Umgebung (nur lesend)",
            "pastDue": "Zahlung fehlgeschlagen. Bitte aktualisieren Sie Ihre Zahlungsmethode.",
            "trialExpired": "Ihre Testphase ist abgelaufen. Upgrade, um fortzufahren.",
            "trialCritical": "Testphase läuft in {{days}} Tag(en) ab. Jetzt upgraden.",
            "trialWarning": "Noch {{days}} Tag(e) in Ihrer Testphase",
            "approachingLimits": "Sie nähern sich Ihren Nutzungslimits. Upgrade für unterbrechungsfreien Zugriff.",
        },
        "modal": {
            "trialExpired": "Ihre Testphase ist beendet. Ihre Daten sind sicher, aber Ihre Organisation ist jetzt im Nur-Lese-Modus. Upgrade, um vollen Zugriff wiederherzustellen.",
            "title": "Zugriff erforderlich",
            "close": "Schließen",
            "bookCall": "Termin buchen",
        },
        "cta": {
            "upgradePlan": "Plan upgraden",
            "upgradeNow": "Jetzt upgraden",
            "fixPayment": "Zahlung korrigieren",
            "addPaymentMethod": "Zahlungsmethode hinzufügen",
            "startTrial": "Kostenlose Testphase starten",
            "completeSetup": "Einrichtung abschließen",
            "goToBilling": "Zur Abrechnung",
            "contactSales": "Vertrieb kontaktieren",
        },
        "blocked": {
            "ORG_NOT_FOUND": "Organisation nicht gefunden. Bitte melden Sie sich erneut an.",
            "ORG_INACTIVE": "Ihre Organisation ist inaktiv. Bitte kontaktieren Sie den Support oder melden Sie sich erneut an.",
            "TRIAL_PROFILE_INCOMPLETE": "Organisations-Setup abschließen, um Ihre KI-Testphase zu starten.",
            "AI_TOKEN_BUDGET_EXCEEDED": "Ihr KI-Testbudget ist aufgebraucht. Fügen Sie eine Zahlungsmethode hinzu, um KI weiter zu nutzen.",
            "AI_LIMIT_REACHED": "Sie haben Ihr tägliches KI-Limit erreicht. Upgrade, um fortzufahren.",
            "TRIAL_EXPIRED": "Ihre Testphase ist abgelaufen. Upgrade, um alle Funktionen weiterzunutzen.",
            "DEMO_READ_ONLY": "Der Demo-Modus ist schreibgeschützt. Starten Sie eine kostenlose Testphase, um eigene Daten anzulegen.",
            "DEMO_TIME_EXPIRED": "Demo-Sitzung abgelaufen. Starten Sie eine kostenlose Testphase, um fortzufahren.",
            "DEMO_AI_SESSION_LIMIT_REACHED": "KI-Limit der Demo-Sitzung erreicht. Starten Sie eine kostenlose Testphase für mehr.",
            "PROJECT_LIMIT_REACHED": "Projektlimit erreicht. Upgrade für weitere Projekte.",
            "INITIATIVE_LIMIT_REACHED": "Initiativenlimit erreicht. Upgrade für weitere Initiativen.",
            "USER_LIMIT_REACHED": "Nutzerlimit erreicht. Upgrade, um weitere Teammitglieder einzuladen.",
            "STORAGE_LIMIT_REACHED": "Speicherlimit erreicht. Upgrade für mehr Speicher.",
            "SUBSCRIPTION_PAST_DUE": "Zahlung fehlgeschlagen. Bitte aktualisieren Sie Ihre Zahlungsmethode.",
            "SUBSCRIPTION_CANCELLED": "Ihr Abonnement wurde gekündigt.",
            "INSUFFICIENT_TOKENS": "Unzureichende Tokens. Zahlungsmethode hinzufügen oder upgraden.",
            "default": "Diese Aktion ist auf Ihrer aktuellen Zugriffsstufe blockiert.",
        },
        "upgrade": {"instantUnlock": "Alle Limits werden sofort nach dem Upgrade entfernt"},
    },
    "es": {
        "banner": {
            "demo": "Está viendo un entorno demo (solo lectura)",
            "pastDue": "Pago fallido. Actualice su método de pago para evitar la interrupción del servicio.",
            "trialExpired": "Su prueba ha expirado. Actualice para continuar.",
            "trialCritical": "La prueba expira en {{days}} día(s). Actualice ahora para mantener el acceso completo.",
            "trialWarning": "{{days}} día(s) restante(s) en su prueba",
            "approachingLimits": "Se acerca a los límites de uso. Considere actualizar para un acceso sin interrupciones.",
        },
        "modal": {
            "trialExpired": "Su período de prueba ha terminado. Sus datos están seguros, pero su organización está en modo solo lectura. Actualice para restaurar el acceso completo.",
            "title": "Se requiere acceso",
            "close": "Cerrar",
            "bookCall": "Reservar una llamada",
        },
        "cta": {
            "upgradePlan": "Actualizar plan",
            "upgradeNow": "Actualizar ahora",
            "fixPayment": "Corregir pago",
            "addPaymentMethod": "Añadir método de pago",
            "startTrial": "Iniciar prueba gratuita",
            "completeSetup": "Completar configuración",
            "goToBilling": "Ir a facturación",
            "contactSales": "Contactar a ventas",
        },
        "blocked": {
            "ORG_NOT_FOUND": "Organización no encontrada. Vuelva a iniciar sesión para actualizar su sesión.",
            "ORG_INACTIVE": "Su organización está inactiva. Contacte a soporte o vuelva a iniciar sesión.",
            "TRIAL_PROFILE_INCOMPLETE": "Complete la configuración de la organización para iniciar su experiencia de IA de prueba.",
            "AI_TOKEN_BUDGET_EXCEEDED": "Se ha consumido su presupuesto de IA de prueba. Añada un método de pago para continuar.",
            "AI_LIMIT_REACHED": "Ha alcanzado su límite diario de IA. Actualice para continuar.",
            "TRIAL_EXPIRED": "Su prueba ha expirado. Actualice para seguir usando todas las funciones.",
            "DEMO_READ_ONLY": "El modo demo es solo lectura. Inicie una prueba gratuita para crear sus propios datos.",
            "DEMO_TIME_EXPIRED": "La sesión demo ha expirado. Inicie una prueba gratuita para continuar.",
            "DEMO_AI_SESSION_LIMIT_REACHED": "Se alcanzó el límite de IA de la sesión demo. Inicie una prueba gratuita para más.",
            "PROJECT_LIMIT_REACHED": "Límite de proyectos alcanzado. Actualice para crear más proyectos.",
            "INITIATIVE_LIMIT_REACHED": "Límite de iniciativas alcanzado. Actualice para crear más iniciativas.",
            "USER_LIMIT_REACHED": "Límite de usuarios alcanzado. Actualice para invitar a más miembros.",
            "STORAGE_LIMIT_REACHED": "Límite de almacenamiento alcanzado. Actualice para más espacio.",
            "SUBSCRIPTION_PAST_DUE": "Pago fallido. Actualice su método de pago.",
            "SUBSCRIPTION_CANCELLED": "Su suscripción ha sido cancelada.",
            "INSUFFICIENT_TOKENS": "Tokens insuficientes. Añada un método de pago o actualice su plan.",
            "default": "Esta acción está bloqueada en su nivel de acceso actual.",
        },
        "upgrade": {"instantUnlock": "Todos los límites se eliminan instantáneamente tras la actualización"},
    },
    "ar": {
        "banner": {
            "demo": "أنت تشاهد بيئة تجريبية (للقراءة فقط)",
            "pastDue": "فشل الدفع. يرجى تحديث طريقة الدفع لتجنب انقطاع الخدمة.",
            "trialExpired": "انتهت الفترة التجريبية. قم بالترقية للمتابعة.",
            "trialCritical": "تنتهي الفترة التجريبية خلال {{days}} يوم/أيام. قم بالترقية الآن.",
            "trialWarning": "متبقي {{days}} يوم/أيام في الفترة التجريبية",
            "approachingLimits": "أنت تقترب من حدود الاستخدام. فكّر في الترقية للوصول دون انقطاع.",
        },
        "modal": {
            "trialExpired": "انتهت الفترة التجريبية. بياناتك آمنة، لكن مؤسستك الآن في وضع القراءة فقط. قم بالترقية لاستعادة الوصول الكامل.",
            "title": "الوصول مطلوب",
            "close": "إغلاق",
            "bookCall": "حجز مكالمة",
        },
        "cta": {
            "upgradePlan": "ترقية الخطة",
            "upgradeNow": "الترقية الآن",
            "fixPayment": "إصلاح الدفع",
            "addPaymentMethod": "إضافة طريقة دفع",
            "startTrial": "بدء تجربة مجانية",
            "completeSetup": "إكمال الإعداد",
            "goToBilling": "الانتقال إلى الفوترة",
            "contactSales": "التواصل مع المبيعات",
        },
        "blocked": {
            "ORG_NOT_FOUND": "المؤسسة غير موجودة. يرجى تسجيل الدخول مرة أخرى لتحديث الجلسة.",
            "ORG_INACTIVE": "مؤسستك غير نشطة. يرجى التواصل مع الدعم أو تسجيل الدخول مرة أخرى.",
            "TRIAL_PROFILE_INCOMPLETE": "أكمل إعداد المؤسسة لبدء تجربة الذكاء الاصطناعي التجريبية.",
            "AI_TOKEN_BUDGET_EXCEEDED": "تم استخدام ميزانية الذكاء الاصطناعي التجريبية. أضف طريقة دفع لمتابعة استخدام الذكاء الاصطناعي.",
            "AI_LIMIT_REACHED": "لقد وصلت إلى الحد اليومي للذكاء الاصطناعي. قم بالترقية للمتابعة.",
            "TRIAL_EXPIRED": "انتهت الفترة التجريبية. قم بالترقية لمتابعة استخدام جميع الميزات.",
            "DEMO_READ_ONLY": "الوضع التجريبي للقراءة فقط. ابدأ فترة تجريبية مجانية لإنشاء بياناتك الخاصة.",
            "DEMO_TIME_EXPIRED": "انتهت الجلسة التجريبية. ابدأ فترة تجريبية مجانية للمتابعة.",
            "DEMO_AI_SESSION_LIMIT_REACHED": "تم الوصول إلى حد جلسة الذكاء الاصطناعي التجريبية. ابدأ فترة تجريبية مجانية للمزيد.",
            "PROJECT_LIMIT_REACHED": "تم الوصول إلى حد المشاريع. قم بالترقية لإنشاء المزيد.",
            "INITIATIVE_LIMIT_REACHED": "تم الوصول إلى حد المبادرات. قم بالترقية لإنشاء المزيد.",
            "USER_LIMIT_REACHED": "تم الوصول إلى حد المستخدمين. قم بالترقية لدعوة أعضاء فريق إضافيين.",
            "STORAGE_LIMIT_REACHED": "تم الوصول إلى حد التخزين. قم بالترقية للمزيد.",
            "SUBSCRIPTION_PAST_DUE": "فشل الدفع. يرجى تحديث طريقة الدفع.",
            "SUBSCRIPTION_CANCELLED": "تم إلغاء اشتراكك.",
            "INSUFFICIENT_TOKENS": "رصيد غير كافٍ. أضف طريقة دفع أو قم بترقية خطتك.",
            "default": "هذا الإجراء محظور على مستوى الوصول الحالي.",
        },
        "upgrade": {"instantUnlock": "تُزال جميع الحدود فوراً بعد الترقية"},
    },
    "jp": {
        "banner": {
            "demo": "デモ環境を表示しています（読み取り専用）",
            "pastDue": "支払いが失敗しました。サービスの中断を避けるため支払い方法を更新してください。",
            "trialExpired": "トライアルが期限切れです。続行するにはアップグレードしてください。",
            "trialCritical": "トライアルは{{days}}日で期限切れです。今すぐアップグレードしてアクセスを維持。",
            "trialWarning": "トライアル残り{{days}}日",
            "approachingLimits": "使用制限に近づいています。途切れないアクセスのためアップグレードをご検討ください。",
        },
        "modal": {
            "trialExpired": "トライアル期間が終了しました。データは安全ですが、組織は読み取り専用モードです。アップグレードで完全なアクセスを復元してください。",
            "title": "アクセスが必要です",
            "close": "閉じる",
            "bookCall": "通話を予約",
        },
        "cta": {
            "upgradePlan": "プランをアップグレード",
            "upgradeNow": "今すぐアップグレード",
            "fixPayment": "支払いを修正",
            "addPaymentMethod": "支払い方法を追加",
            "startTrial": "無料トライアル開始",
            "completeSetup": "セットアップを完了",
            "goToBilling": "請求へ移動",
            "contactSales": "営業に連絡",
        },
        "blocked": {
            "ORG_NOT_FOUND": "組織が見つかりません。セッションを更新するために再度ログインしてください。",
            "ORG_INACTIVE": "組織が非アクティブです。サポートにお問い合わせいただくか再度ログインしてください。",
            "TRIAL_PROFILE_INCOMPLETE": "組織のセットアップを完了してトライアルAI体験を開始してください。",
            "AI_TOKEN_BUDGET_EXCEEDED": "トライアルAI予算が使用されました。AI利用を続けるには支払い方法を追加してください。",
            "AI_LIMIT_REACHED": "1日のAI呼び出し制限に達しました。続行するにはアップグレードしてください。",
            "TRIAL_EXPIRED": "トライアルが期限切れです。すべての機能を続けて使用するにはアップグレードしてください。",
            "DEMO_READ_ONLY": "デモモードは読み取り専用です。独自のデータを作成するには無料トライアルを開始してください。",
            "DEMO_TIME_EXPIRED": "デモセッションが期限切れです。続行するには無料トライアルを開始してください。",
            "DEMO_AI_SESSION_LIMIT_REACHED": "デモAIセッションの制限に達しました。さらに使用するには無料トライアルを開始してください。",
            "PROJECT_LIMIT_REACHED": "プロジェクトの上限に達しました。より多くのプロジェクトを作成するにはアップグレードしてください。",
            "INITIATIVE_LIMIT_REACHED": "イニシアチブの上限に達しました。アップグレードしてください。",
            "USER_LIMIT_REACHED": "ユーザー上限に達しました。チームメンバーを招待するにはアップグレードしてください。",
            "STORAGE_LIMIT_REACHED": "ストレージ上限に達しました。アップグレードしてください。",
            "SUBSCRIPTION_PAST_DUE": "支払いが失敗しました。支払い方法を更新してください。",
            "SUBSCRIPTION_CANCELLED": "サブスクリプションはキャンセルされました。",
            "INSUFFICIENT_TOKENS": "トークン不足。支払い方法を追加するかプランをアップグレードしてください。",
            "default": "この操作は現在のアクセスレベルでは許可されていません。",
        },
        "upgrade": {"instantUnlock": "アップグレード後、すべての制限が即座に解除されます"},
    },
}

# Existing EN strings we want to make available to translators (read-only reference).

def deep_merge(target, updates):
    """Mutating deep-merge that never overwrites existing non-dict values."""
    for key, value in updates.items():
        if (
            key in target
            and isinstance(target[key], dict)
            and isinstance(value, dict)
        ):
            deep_merge(target[key], value)
        elif key not in target:
            target[key] = value
        elif isinstance(target[key], dict) and not isinstance(value, dict):
            pass  # don't clobber structured block with scalar
        else:
            pass  # leave existing strings alone
    return target


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f, object_pairs_hook=OrderedDict)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    changed = []
    # Demo banner keys
    for locale, banner in DEMO_BANNER.items():
        path = os.path.join(ROOT, locale, "translation.json")
        if not os.path.isfile(path):
            print(f"[skip] {path} not found", file=sys.stderr)
            continue
        data = load_json(path)
        demo = data.setdefault("demo", OrderedDict())
        before = json.dumps(demo.get("banner"), ensure_ascii=False, sort_keys=True)
        deep_merge(demo.setdefault("banner", OrderedDict()), banner)
        after = json.dumps(demo.get("banner"), ensure_ascii=False, sort_keys=True)
        if before != after:
            save_json(path, data)
            changed.append((locale, "demo.banner"))
            print(f"[ok] {locale} demo.banner merged")

    # Access modal keys (only non-EN/PL)
    for locale, access in ACCESS.items():
        path = os.path.join(ROOT, locale, "translation.json")
        if not os.path.isfile(path):
            continue
        data = load_json(path)
        before = json.dumps(data.get("access"), ensure_ascii=False, sort_keys=True)
        deep_merge(data.setdefault("access", OrderedDict()), access)
        after = json.dumps(data.get("access"), ensure_ascii=False, sort_keys=True)
        if before != after:
            save_json(path, data)
            changed.append((locale, "access"))
            print(f"[ok] {locale} access merged")

    if not changed:
        print("Nothing to do.")
    else:
        print(f"\nTotal merged: {len(changed)} blocks")


if __name__ == "__main__":
    main()
