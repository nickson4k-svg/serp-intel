# VibeRadar — Дослідження та специфікація API FreeSerp

> Дата розвідки: 2026-10-02  
> Джерело: `https://freeserp.ai/api.php`, `https://freeserp.ai/docs.php`, `https://freeserp.ai/mcp`

---

## 1. Загальні відомості про API та MCP

FreeSerp надає відкритий безключовий доступ до двох індексів:
1. **FreeSerp Main (`index=sites`, за замовчуванням)** — понад 20M+ профілів головних сторінок сайтів (LLM-підсумок `ai_summary`, Domain Rating `dr`, таксономія ніш `ai_categories`, стек розробки `ai_source`, статус `went_live`). Підтримує точні `total`, фільтрацію та сортування за будь-яким полем.
2. **FreeSerp Global (`index=web`)** — повнотекстовий веб-пошук по 3.1B+ сторінках (вимагає параметр `q`, пул кандидатів до 100).

Для VibeRadar використовується виключно індекс **`sites`** (FreeSerp Main).

### Доступні інструменти (MCP Tools / REST Endpoints)
- **`freeserp_search`** / `GET /api.php` — основний пошуковий та аналітичний ендпоінт.
- **`freeserp_help`** / `GET /api.php?help=1` — документація у форматі JSON із описом параметрів, застережень та полів.
- **`freeserp_stats`** / `GET /api.php?stats=1` — агреговані живі метрики всього індексу (оновлюються кожні 30 хв).
- **`freeserp_list_endpoints`** — опис доступних полів, типів та їхньої придатності до фільтрації/сортування.
- **`freeserp_get`** — виклик довільного REST-запиту.

---

## 2. Параметри запитів (FreeSerp Main)

| Параметр | Тип | За замовчуванням | Опис |
| :--- | :--- | :--- | :--- |
| `q` | string | — | Текстовий пошук (домен, title, ai_summary). Для точного домену шукає з бустом. |
| `ai_source` | keyword | — | Сигнал стеку/білдера: `lovable`, `v0`, `bolt`, `base44`, `ai_likely`, `nextjs`, `wordpress`, `shopify`, `not_ai`. |
| `ai_categories` | keyword | — | AI-підніша (наприклад, `AI Agents & Autonomous`, `Code & Dev Tools`). |
| `ai_startups` | 0 або 1 | 0 | `1` відфільтровує сміття (казино, агрегатори, чисті магазини), залишаючи реальні AI-стартапи. |
| `ai` | 0 або 1 | 0 | `1` обмежує до будь-яких сайтів із ознаками AI (`ai_source` ∈ ai_likely, lovable, base44, v0, bolt). |
| `dr_min` / `dr_max` | integer | — | Діапазон Domain Rating (0–100). |
| `from_date` / `to_date` | YYYY-MM-DD | — | Фільтр за датою першої фіксації доступності (`went_live`). |
| `sort` | keyword | `relevance` | Поле сортування (`dr`, `went_live`, `first_seen`, `domain`, тощо). |
| `order` | asc \| desc | `desc` | Напрямок сортування. |
| `size` | integer (1–100) | 20 | Кількість результатів у відповіді. |
| `from` | integer | 0 | Зсув пагінації (до 10,000). |
| `all` | 0 або 1 | 0 | `1` включає припарковані/порожні домени (для аудиту). |
| `agent` | string | — | Ідентифікація клієнта (наприклад, `VibeRadar/1.0`). |
| `project` | string | — | Назва проєкту (наприклад, `VibeRadar`). |

---

## 3. Реальні показники білдерів (ai_source)

За результатами тестових запитів із `size=1` отримано такі фактичні дані індексу:

| Білдер (`ai_source`) | Всього сайтів (`total`) | Сайти з `dr_min=1` | Частка з DR >= 1 | `ai_startups=1` |
| :--- | :--- | :--- | :--- | :--- |
| **lovable** | 38 238 | 3 392 | **8.9%** | 296 |
| **base44** | 15 534 | 4 075 | **26.2%** | 33 |
| **v0** | 4 245 | 722 | **17.0%** | 58 |
| **bolt** | 695 | 195 | **28.1%** | 22 |

### Приклади запитів:
- `https://freeserp.ai/api.php?ai_source=lovable&size=1&agent=VibeRadar/1.0&project=VibeRadar`
  - Повертає `total: 38238`. Зразок: `expireddomains.com`, DR: 65.
- `https://freeserp.ai/api.php?ai_source=base44&size=1&agent=VibeRadar/1.0&project=VibeRadar`
  - Повертає `total: 15534`. Зразок: `base44.com`, DR: 54.
- `https://freeserp.ai/api.php?ai_source=v0&size=1&agent=VibeRadar/1.0&project=VibeRadar`
  - Повертає `total: 4245`. Зразок: `bestecasinosechtgeld.com`, DR: 48.
- `https://freeserp.ai/api.php?ai_source=bolt&size=1&agent=VibeRadar/1.0&project=VibeRadar`
  - Повертає `total: 695`. Зразок: `bolt.new`, DR: 53.

---

## 4. Ніші (ai_categories) та їхня присутність у білдерів

### Топ-ніші за кількістю сайтів у всьому індексі (з `stats=1`):
1. `Other AI` (19 016)
2. `AI Agents & Autonomous` (10 510)
3. `AI Automation & Workflows` (9 352)
4. `Code & Dev Tools` (8 283)
5. `E-commerce` (5 359)
6. `Education & Tutoring` (5 003)
7. `Data & Analytics` (4 897)
8. `Marketing & Ads` (4 196)
9. `SEO & Content` (4 185)
10. `Directory / Aggregator` (3 691)
11. `AI Infrastructure & API` (3 099)
12. `AI Chatbot & Assistant` (2 848)
13. `Productivity` (2 666)
14. `Finance & Trading` (2 229)
15. `Healthcare & Medical` (1 984)
16. `Research & Science` (1 906)
17. `AI Website Builder` (1 876)
18. `Writing & Content` (1 761)
19. `No-code / App Builder` (1 303)
20. `Image Generation` (1 210)
21. `Design & UI` (1 089)

### Фактичний розподіл ніш за білдерами:
- **Lovable**:
  1. `AI Automation & Workflows`: 122
  2. `AI Agents & Autonomous`: 97
  3. `Marketing & Ads`: 66
  4. `Code & Dev Tools`: 39
  5. `Productivity`: 31
- **v0**:
  1. `AI Agents & Autonomous`: 23
  2. `AI Automation & Workflows`: 21
  3. `Code & Dev Tools`: 15
  4. `AI Infrastructure & API`: 6
  5. `Design & UI`: 2
- **Bolt**:
  1. `Code & Dev Tools`: 13
  2. `AI Automation & Workflows`: 5
  3. `AI Agents & Autonomous`: 3
  4. `AI Website Builder`: 3
  5. `Design & UI`: 3
- **Base44**:
  1. `AI Agents & Autonomous`: 12
  2. `AI Automation & Workflows`: 11
  3. `Code & Dev Tools`: 8
  4. `AI Chatbot & Assistant`: 7
  5. `No-code / App Builder`: 5

---

## 5. Що НЕ підтвердилося / Розбіжності з очікуваннями

1. **Масштаб `ai_startups=1`**:
   - Очікувалося: `ai_startups=1` покаже основну масу білдерських сайтів.
   - Реалії: Більшість сайтів, створених на Lovable (38k+) та Base44 (15k+), **не позначаються** як `ai_startups=1`. Тільки ~296 у Lovable та ~33 у Base44 кваліфіковані саме як «продуктові AI-стартапи». Решта — це пет-проєкти, блоги, дорвеї або сайти з іншими категоріями. Тому в аналітиці білдерів потрібно показувати загальну кількість за `ai_source`, а фільтр `ai_startups=1` застосовувати усвідомлено.
2. **Чистота вибірки білдерів**:
   - Деякі домени з високим DR, позначені `ai_source=v0` або `ai_source=lovable`, є старими доменами (наприклад, казино або агрегатори дроп-доменів), які використовують згенеровані компоненти чи фронтенд. Частка сайтів з реальним DR > 0 становить від 8.9% (Lovable) до 28.1% (Bolt).
3. **Значення `went_live`**:
   - У документації підкреслено: `went_live` — це дата, коли робот вперше зафіксував доступність сайту через зонд, а не офіційний реліз чи дата реєстрації домену (`first_seen`).
4. **Сортування за замовчуванням**:
   - При виклику без `sort` за замовчуванням повертається `sort=relevance&order=desc`, де relevance обчислюється як текстова відповідність × DR. Для хронологічного списку обов'язково треба передавати `sort=went_live&order=desc`.
5. **Таймаути та 502**:
   - При високій частоті запитів сервіс може повертати 502 (upstream search exception), тому клієнт `js/api.js` обов'язково повинен мати паузу між викликами (не більше 3 запитів на секунду) та автоматичний повтор із backoff.
