
import json
import os

new_keys = {
  "sidebar": {
    "intro": {
      "EN": "Intro",
      "PL": "Wstęp",
      "DE": "Einführung",
      "AR": "مقدمة",
      "JA": "はじめに"
    },
    "context": {
      "profile": {
        "EN": "Company Profile",
        "PL": "Profil Firmy",
        "DE": "Unternehmensprofil",
        "AR": "ملف الشركة",
        "JA": "会社概要"
      },
      "goals": {
        "EN": "Goals & Expectations",
        "PL": "Cele i Oczekiwania",
        "DE": "Ziele und Erwartungen",
        "AR": "الأهداف والتوقعات",
        "JA": "目標と期待"
      },
      "challenges": {
        "EN": "Challenge Map",
        "PL": "Mapa Wyzwań",
        "DE": "Herausforderungskarte",
        "AR": "خريطة التحديات",
        "JA": "課題マップ"
      },
      "megatrends": {
        "EN": "Megatrend Scanner",
        "PL": "Skaner Megatrendów",
        "DE": "Megatrend-Scanner",
        "AR": "ماسح الاتجاهات الكبرى",
        "JA": "メガトレンドスキャナー"
      },
      "strategy": {
        "EN": "Strategic Synthesis",
        "PL": "Synteza Strategiczna",
        "DE": "Strategische Synthese",
        "AR": "توليف استراتيجي",
        "JA": "戦略的統合"
      }
    },
    "dashboardSub": {
      "overview": {
        "EN": "Overview",
        "PL": "Przegląd",
        "DE": "Überblick",
        "AR": "نظرة عامة",
        "JA": "概要"
      },
      "snapshot": {
        "EN": "Execution Snapshot",
        "PL": "Migawka Egzekucji",
        "DE": "Ausführungsmomentaufnahme",
        "AR": "لمحة عن التنفيذ",
        "JA": "実行スナップショット"
      }
    }
  },
  "common": {
    "status": {
      "saved": {
        "EN": "Auto-saved",
        "PL": "Zapisano automatycznie",
        "DE": "Automatisch gespeichert",
        "AR": "تم الحفظ تلقائياً",
        "JA": "自動保存されました"
      },
      "saving": {
        "EN": "Saving...",
        "PL": "Zapisywanie...",
        "DE": "Speichern...",
        "AR": "جارٍ الحفظ...",
        "JA": "保存中..."
      },
      "unsaved": {
        "EN": "Unsaved changes",
        "PL": "Niezapisane zmiany",
        "DE": "Ungespeicherte Änderungen",
        "AR": "تغييرات غير محفوظة",
        "JA": "保存されていない変更"
      },
      "error": {
        "EN": "Save failed",
        "PL": "Zapis nie powiódł się",
        "DE": "Speichern fehlgeschlagen",
        "AR": "فشل الحفظ",
        "JA": "保存に失敗しました"
      }
    },
    "impersonation": {
      "banner": {
        "EN": "IMPERSONATING: {{email}}",
        "PL": "Odszywanie się pod: {{email}}",
        "DE": "IMPERSONATION: {{email}}",
        "AR": "تنتحل صفة: {{email}}",
        "JA": "なりすまし中: {{email}}"
      },
      "stop": {
        "EN": "Stop Impersonating",
        "PL": "Zatrzymaj Odszywanie",
        "DE": "Impersonation stoppen",
        "AR": "إيقاف الانتحال",
        "JA": "なりすましを停止"
      }
    },
    "underConstruction": {
      "EN": "Component Under Construction",
      "PL": "Komponent w Budowie",
      "DE": "Komponente im Aufbau",
      "AR": "المكون قيد الإنشاء",
      "JA": "コンポーネント作成中"
    }
  }
}

path = 'scripts/full_translations.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Update sidebar
if 'sidebar' not in data:
    data['sidebar'] = {}
data['sidebar'].update(new_keys['sidebar'])

# Update common
if 'common' not in data:
    data['common'] = {}
data['common'].update(new_keys['common'])

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Updated translations successfully.")
