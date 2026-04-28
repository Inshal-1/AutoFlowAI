# AutoFlow

> Agent AI, który kontroluje Twój telefon z Androidem. Podaj mu cel w prostym języku — a on sam wymyśli, co wcisnąć, co wpisać i jak przesunąć palcem po ekranie.

*Przeczytaj w innych językach: [English](README.md)*

AutoFlow daje drugie życie starym urządzeniom z Androidem, zamieniając je w autonomicznych agentów AI. Dzięki analizie drzewa dostępności Androida (accessibility tree), inteligentnie obsługuje Twoje urządzenie — bez konieczności używania API.

**💡 100% Darmowe i Open Source**  
Obecna wersja AutoFlow jest w pełni samo-hostowana (self-hosted) i **w 100% darmowa na zawsze**. Wszystkie wcześniejsze ograniczenia premium, ekrany płatności i wymogi posiadania kluczy licencyjnych zostały całkowicie usunięte. Masz pełen dostęp do wszystkich funkcji, w tym do generowania nielimitowanej liczby kluczy API.

---

## ⚡ Jak to działa

AutoFlow korzysta z prostej pętli **Percepcja → Wnioskowanie → Akcja**:
1. **Percepcja:** Odczytuje ekran za pomocą wbudowanego w Androida "Drzewa Dostępności", aby znaleźć interaktywne elementy.
2. **Wnioskowanie:** Wysyła stan ekranu oraz Twój cel do modelu LLM (np. Groq, OpenAI lub lokalnie przez Ollama), aby zadecydować o kolejnym kroku.
3. **Akcja:** Wykonuje stuknięcie, przesunięcie (swipe) lub wpisanie tekstu przy wsparciu ADB, a następnie powtarza proces aż do osiągnięcia celu.

 Posiada wbudowane mechanizmy zabezpieczające, takie jak wykrywanie zacięć w pętli (stuck loop), śledzenie powtórzeń i tryb awaryjny (wykonywanie zrzutów ekranu, gdy drzewo dostępności jest puste), by zapewnić niezawodne działanie.

---

## 🚀 Szybki Start

### 1. Konfiguracja Bazy Danych
AutoFlow korzysta z PostgreSQL. Polecamy darmową bazę danych [Neon](https://neon.tech).
1. Utwórz projekt w panelu Neon.
2. W zakładce **Connection Details** wybierz **"Pooled connection"** — i skopiuj ten link.
3. Dodaj go do plików `.env` oraz `web/.env`: `DATABASE_URL=postgres://...`

> **⚠️ Wdrożenie Docker / Coolify — używaj pooled endpoint!**
> Bezpośrednie połączenie Neona (port `5432`) z wnętrza kontenerów dockerowych może zwracać błędy `ECONNREFUSED` lub `ETIMEDOUT`, ponieważ serwer bazy usypia się gdy nie jest używany (scale to zero). Przy wdrażaniu na serwer zawsze używaj **pooled connection string** (adres hosta zawiera `-pooler`, port `6543`):
> ```
> postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech:6543/neondb?sslmode=require
> ```
> Pooler jest cały czas aktywny i nie usypia.

### 2. Wybór Dostawcy LLM
Edytuj plik `.env` i wybierz model. Aby szybko wystartować za darmo, sugerujemy Groq:
```bash
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_twoj_klucz_tutaj
```
*(Możesz też użyć `ollama` jako rozwiązania w 100% lokalnego, a także `openai`, `openrouter` lub `bedrock`).*

### 3. Uruchomienie Serwera
Włącz backend oraz panel webowy (dashboard):
```bash
bun install
bun run dev
```
Wejdź na stronę `http://localhost:5173`, aby otworzyć swój lokalny panel i wygenerować darmowy klucz API.

### 4. Instalacja Aplikacji na Androida
Na swoim telefonie musisz zainstalować aplikację Companion App, aby agent mógł nim sterować.

**Opcja A: Automatyczny Build ze wsparciem GitHub Actions**
1. Otwórz zakładkę "Actions" w tym repozytorium GitHub.
2. Kliknij ostatni przebieg "Android Build".
3. Pobierz paczkę `app-debug` z sekcji "Artifacts" na samym dole.
4. Wypakuj plik APK, przenieś na telefon i zainstaluj. *(Uwaga: Jeżeli instalacja zostanie zablokowana przez usługę Play Protect, wybierz opcję "Więcej szczegółów" -> "Zainstaluj mimo to").*

**Opcja B: Kompilacja ze Źródeł**
```bash
cd android
./gradlew installDebug
```

Po instalacji, uruchom aplikację, przydziel niezbędne uprawnienia do (Dostępności oraz Zrzucania Ekranu) i wprowadź "Server URL" wskazujący na postawiony wcześniej lokalny serwer i wklej z niego nowo wygenerowany klucz API.

---

## 🎮 Tryby Pracy

W zależności od potrzeb, AutoFlow obsługuje kilka trybów:

1. **Tryb Interaktywny:** Wpisuj swoje cele z palca.
   ```bash
   bun run src/kernel.ts
   ```
2. **Workflows (JSON/AI):** Łącz długie cele z pomocą integracji modeli LLM, aby przeskakiwać automatycznie za Ciebie pomiędzy wieloma aplikacjami.
   ```bash
   bun run src/kernel.ts --workflow examples/workflows/research/weather-to-whatsapp.json
   ```
3. **Flows (YAML/No AI):** Twórz szybkie, z góry zaprogramowane sekwencje (makroekonomie) bez potrzeby wywoływania API inteligencji LLM.
   ```bash
   bun run src/kernel.ts --flow examples/flows/send-whatsapp.yaml
   ```

## 🛠️ Społeczność
W razie jakichkolwiek problemów z `DATABASE_URL` lub połączeniem `adb devices` wpadnij na Discord!
