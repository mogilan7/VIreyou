# Правила миграций базы данных

## 1. Безопасность и Row Level Security (RLS)
По умолчанию в Supabase / PostgreSQL схема `public` выдаёт публичные права (`ALL`) ролям `anon` и `authenticated`.

**Обязательное правило:**
Каждая новая таблица, создаваемая в схеме `public`, должна создаваться с включённым Row Level Security и полным отзывом прав у ролей `anon` и `authenticated`, если только к ней явно не требуется доступ напрямую из браузера:

```sql
-- 1. Создание таблицы
CREATE TABLE "ExampleTable" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
);

-- 2. Обязательное включение RLS
ALTER TABLE "ExampleTable" ENABLE ROW LEVEL SECURITY;

-- 3. Обязательный отзыв прав у публичных ролей PostgREST
REVOKE ALL ON TABLE "ExampleTable" FROM anon, authenticated;
```

Если таблица предназначена для чтения/записи из браузера (клиентский Supabase SDK):
- Создаются строгие политики RLS (`CREATE POLICY ...`) с обязательной проверкой `auth.uid() = user_id`.
- Разрешаются только минимально необходимые операции (`GRANT SELECT ...`, `GRANT INSERT ...`).

