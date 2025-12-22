# 🔑 Gdzie ustawić OPENAI_API_KEY?

## 📍 Opcja 1: Plik `.env` (REKOMENDOWANE dla lokalnego rozwoju)

**Najłatwiejsza i najbezpieczniejsza metoda dla lokalnego użycia.**

### Krok 1: Otwórz lub stwórz plik `.env` w głównym katalogu projektu

```bash
# W katalogu /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify
nano .env
# lub
code .env
# lub
vim .env
```

### Krok 2: Dodaj linię z kluczem API

```bash
OPENAI_API_KEY=sk-twoj-klucz-api-tutaj
```

**Przykład:**
```bash
OPENAI_API_KEY=sk-proj-abc123xyz789...
```

### Krok 3: Zapisz plik

Plik `.env` jest już w `.gitignore`, więc **nie zostanie zacommitowany** do repozytorium (bezpieczne!).

---

## 📍 Opcja 2: Zmienna środowiskowa systemowa (dla bieżącej sesji)

**Działa tylko w bieżącym terminalu/sesji.**

### W terminalu:

```bash
export OPENAI_API_KEY='sk-twoj-klucz-api-tutaj'
```

### Sprawdź czy działa:

```bash
echo $OPENAI_API_KEY
```

**Uwaga:** Ta metoda działa tylko w bieżącym terminalu. Po zamknięciu terminala trzeba ustawić ponownie.

---

## 📍 Opcja 3: Zmienna środowiskowa trwała (dla całego systemu)

### macOS/Linux:

Dodaj do pliku `~/.zshrc` (lub `~/.bashrc`):

```bash
echo 'export OPENAI_API_KEY="sk-twoj-klucz-api-tutaj"' >> ~/.zshrc
source ~/.zshrc
```

---

## 📍 Opcja 4: GitHub Actions (dla automatycznego workflow)

**Dla automatycznego uruchamiania w GitHub Actions:**

### Krok 1: Przejdź do repozytorium na GitHub
### Krok 2: Settings → Secrets and variables → Actions
### Krok 3: Kliknij "New repository secret"
### Krok 4: 
- **Name:** `OPENAI_API_KEY`
- **Secret:** `sk-twoj-klucz-api-tutaj`
### Krok 5: Kliknij "Add secret"

**Gotowe!** Workflow będzie automatycznie używał tego klucza.

---

## 🔍 Jak sprawdzić czy klucz jest ustawiony?

### Sprawdź plik .env:
```bash
grep OPENAI_API_KEY .env
```

### Sprawdź zmienną środowiskową:
```bash
echo $OPENAI_API_KEY
```

### Test skryptu:
```bash
node scripts/test-auto-fix-demo.js
```

---

## 🎯 Którą opcję wybrać?

| Opcja | Kiedy użyć | Zalety | Wady |
|-------|-----------|--------|------|
| **.env** | Lokalny rozwój | ✅ Bezpieczne, trwałe, łatwe | Wymaga pliku |
| **export** | Szybki test | ✅ Szybkie | Tylko w bieżącej sesji |
| **~/.zshrc** | Systemowe | ✅ Działa wszędzie | Wpływa na cały system |
| **GitHub Secrets** | CI/CD | ✅ Automatyczne | Tylko dla GitHub Actions |

## 💡 REKOMENDACJA:

**Dla lokalnego rozwoju:** Użyj pliku `.env` (Opcja 1)
**Dla GitHub Actions:** Użyj GitHub Secrets (Opcja 4)

---

## 🔗 Gdzie uzyskać klucz API?

1. Przejdź na: https://platform.openai.com/api-keys
2. Zaloguj się (lub zarejestruj)
3. Kliknij "Create new secret key"
4. Skopiuj klucz (zaczyna się od `sk-`)

**⚠️ WAŻNE:** Klucz pokazuje się tylko raz! Zapisz go bezpiecznie.

---

## ✅ Szybki start:

```bash
# 1. Dodaj klucz do .env
echo 'OPENAI_API_KEY=sk-twoj-klucz-api' >> .env

# 2. Sprawdź
cat .env | grep OPENAI_API_KEY

# 3. Uruchom skrypt
./scripts/setup-auto-fix.sh
```

---

## 🛡️ Bezpieczeństwo:

- ✅ Plik `.env` jest w `.gitignore` - **nie zostanie zacommitowany**
- ✅ Nigdy nie commituj kluczy API do repozytorium
- ✅ Używaj różnych kluczy dla różnych środowisk (dev/prod)
- ✅ Regularnie rotuj klucze API


