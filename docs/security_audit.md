# Raport z Audytu Bezpieczeństwa (Codebase Security Audit)

## Podsumowanie audytu
Przeprowadzono analizę potencjalnych podatności i "backdoorów" (tylnych furtek) w kodzie źródłowym projektu `AutoFlow`, zarówno po stronie weba (SvelteKit), jak i serwera (Bun/Hono). 

Analiza nie wykazała złośliwego kodu typu RCE (Remote Code Execution) ukrytego w kodzie agenta, ani logice aplikacji. Niemniej jednak, zidentyfikowano dwa obszary, które funkcjonują jako obejścia zabezpieczeń (bypassy) i przy błędnej konfiguracji mogą stwarzać ryzyko.

## Znalezione punkty uwag (Findings)

### 1. Wewnętrzny Backdoor Autoryzacyjny (`x-internal-secret`)
W pliku `server/src/middleware/auth.ts` znajduje się mechanizm omijania weryfikacji sesji (tokenów). 
Kod pozwala na pełną autoryzację do API serwera jako dowolny użytkownik, jeśli we wczesnym wierszu nagłówka żądania podane zostaną:
- `x-internal-user-id`: identyfikator dowolnego użytkownika
- `x-internal-secret`: zgadzający się z wartością zmiennej środowiskowej `INTERNAL_SECRET`.

**Zagrożenie:** Jest to mechanizm przeznaczony do uwierzytelniania w architekturze wewnętrznej (server-to-server). Jeżeli wartość `INTERNAL_SECRET` jest słaba, prosta do odgadnięcia lub wycieknie do osób trzecich, atakujący może przejąć kontrolę nad dowolnym kontem poprzez nagłówki zapytania.
**Rekomendacja:** Upewnij się, że w pliku `.env` generowany jest bardzo silny, losowy ciąg znaków (np. 64 znaki alfanumeryczne) dla `INTERNAL_SECRET`.

### 2. Ominięcie sprawdzania licencji (License Bypass)
W pliku `server/src/routes/license.ts` weryfikacja licencji jest obecnie wyłączona dla wielu operacji (prawdopodobnie jest to efekt manualnego wyłączenia modułu płatności, o co proszono we wcześniejszych konwersacjach).
- Metoda `POST /license/activate` natychmiastowo zwraca `{ success: true, plan: "ltd" }` beż faktycznej weryfikacji.
- Metoda `GET /license/status` zawsze zwraca `activated: true`.

**Znaczenie:** Jeśli intencją było całkowite i stałe udostępnienie funkcji bez opłat – kod jest poprawny. W obecnym stanie każdy instalujący lub uruchamiający kod samoczynnie włącza plan "ltd".

### 3. Autoryzacja WebSocketów
WebSockety (w `server/src/index.ts`) podczas wznawiana połączenia HTTP do WS (`server.upgrade`) nie weryfikują autoryzacji (ustawiają `authenticated: false`). Cała weryfikacja przeniesiona jest w głąb plików `ws/device.ts` i `ws/dashboard.ts`, gdzie na pierwszy przesyłany pakiet wysyłany jest komunikat `auth`.

**Wniosek:** Implementacja wewnętrzna jest zrealizowana poprawnie. Tokeny (`token`) i klucze API (`apiKey`) są hashowane oraz sprawdzane w bazie (`better-auth`). Brak typowego "backdoora". Trzeba jednak dbać o to, by we wszystkich nowych typach komunikatów (np. `case "coś_nowego":`) dbać o warunek `!ws.data.authenticated` umieszczony na początku – obecny kod posiada go w odpowiednim miejscu.

### 4. Wykonywanie kodu przez LLM (Proces Agenta)
Sprawdzono funkcje odpowiedzialne za komunikację z LLM i sterowania urządzeniem na Androidzie w folderze `server/src/agent/*`. Nie ma tam ukrytych połączeń do zewnętrznych, ukrytych serwerów ani wywołań wbudowanych funkcji ewaluacji skryptów JS (`eval`, `Bun.spawn`, `exec`), co sugeruje brak podatności na wykonywanie dowolnego kodu przemycanego przez potencjalnego atakującego do komend Agenta na backendzie.

---
**Weryfikacja ukończona.** Kod (zarówno `web` jak i `server`) nie zawiera oczywistych, podszytych furtek do systemu, poza wbudowanym kluczem wewnątrzsystemowym `INTERNAL_SECRET`.
