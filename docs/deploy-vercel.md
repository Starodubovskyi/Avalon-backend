# Деплой бэкенда на Vercel

Бэкенд (NestJS) разворачивается на Vercel как **одна Vercel Function** (zero-config для NestJS, Fluid compute). База — **Neon Postgres** через `DATABASE_URL`, документы — в **S3-совместимом бакете** (Cloudflare R2 или AWS S3).

Особенности serverless, которые уже учтены в коде:

- файловая система только для чтения (кроме `/tmp`), поэтому загрузка документов на локальный диск на Vercel отключена: `POST /documents` отвечает `503 { errors: { file: 'documentsStorageNotConfigured' } }`, пока не настроен `DOCUMENTS_DRIVER=s3`;
- долгоживущие сокеты невозможны, поэтому **AIS на Vercel всегда выключен**: в логе `AIS disabled on serverless`, `/ais/status` отдаёт `enabled: false`;
- пул соединений с БД по умолчанию маленький (5 на инстанс); при необходимости меняется через `DATABASE_MAX_CONNECTIONS`;
- i18n не следит за файлами вне `NODE_ENV=development`.

---

## 1. Настройки проекта Vercel

| Параметр | Значение |
|---|---|
| Framework Preset | **NestJS** |
| Root Directory | `.` (корень этого репозитория — бэкенд) |
| Node.js Version | **22.x** |
| Install Command | по умолчанию (`npm install`), lock-файл — `package-lock.json` |
| Build Command | по умолчанию (`npm run build`) |
| Fluid compute | включён (по умолчанию для новых проектов) |

Регион функции лучше выбрать рядом с регионом Neon (например, Frankfurt `fra1` для Neon `eu-central-1`).

---

## 2. Переменные окружения

Задаются в **Vercel → Project → Settings → Environment Variables** (Production и, при необходимости, Preview). Секреты **никогда не коммитим** — ни в `.env`, ни в `env-example-relational`.

### Приложение

| Переменная | Что указать |
|---|---|
| `NODE_ENV` | `production` (Vercel и так ставит это значение в runtime) |
| `APP_NAME` | `Avalon API` |
| `API_PREFIX` | `api` |
| `APP_FALLBACK_LANGUAGE` | `en` |
| `APP_HEADER_LANGUAGE` | `x-custom-lang` |
| `FRONTEND_DOMAIN` | URL фронтенда, например `https://avalon.example.com`. Он всегда разрешён в CORS и используется в ссылках из писем |
| `BACKEND_DOMAIN` | URL этого бэкенда, например `https://avalon-api.vercel.app` |
| `CORS_ORIGINS` | дополнительные origin'ы фронта через запятую. `*` заменяет фрагмент одной части домена, например `https://avalon-frontend-*.vercel.app` для preview-деплоев. Пусто — разрешён только `FRONTEND_DOMAIN` |

Запросы без заголовка `Origin` (curl, сервер-сервер) разрешены всегда. Авторизация работает только через Bearer-токен, cookies не используются (`credentials: false`).

### База данных (Neon)

| Переменная | Что указать |
|---|---|
| `DATABASE_URL` | строка подключения из Neon Console → Connect. Для приложения берите **pooled**-вариант (хост с `-pooler`) с `?sslmode=require`. Других `DATABASE_*` для хоста, порта, имени и пользователя не нужно |
| `DATABASE_SSL_ENABLED` | `true` |
| `DATABASE_REJECT_UNAUTHORIZED` | `true` (у Neon публичный валидный сертификат) |
| `DATABASE_SYNCHRONIZE` | `false` (схема меняется только миграциями) |
| `DATABASE_MAX_CONNECTIONS` | не задавать (на Vercel по умолчанию 5) или указать своё число |

### Авторизация

Каждый секрет генерируется **отдельно** командой

```bash
openssl rand -hex 32
```

и вставляется только в Vercel. Не коммитьте секреты и не используйте значения из примеров.

| Переменная | Что указать |
|---|---|
| `AUTH_JWT_SECRET` | сгенерированный секрет |
| `AUTH_JWT_TOKEN_EXPIRES_IN` | `15m` |
| `AUTH_REFRESH_SECRET` | сгенерированный секрет |
| `AUTH_REFRESH_TOKEN_EXPIRES_IN` | `3650d` |
| `AUTH_FORGOT_SECRET` | сгенерированный секрет |
| `AUTH_FORGOT_TOKEN_EXPIRES_IN` | `30m` |
| `AUTH_CONFIRM_EMAIL_SECRET` | сгенерированный секрет |
| `AUTH_CONFIRM_EMAIL_TOKEN_EXPIRES_IN` | `1d` |

### Почта (обязательна по валидации конфигурации)

| Переменная | Что указать |
|---|---|
| `MAIL_HOST`, `MAIL_PORT` | SMTP-провайдер (Resend, Postmark, SES и т. п.) |
| `MAIL_USER`, `MAIL_PASSWORD` | учётные данные SMTP |
| `MAIL_DEFAULT_EMAIL` | адрес отправителя, например `noreply@avalon.example.com` |
| `MAIL_DEFAULT_NAME` | `Avalon` |
| `MAIL_IGNORE_TLS` / `MAIL_SECURE` / `MAIL_REQUIRE_TLS` | по документации провайдера (обычно `false` / `true` / `false` для порта 465) |

Письмо при регистрации отправляется в фоне. Если SMTP недоступен, регистрация всё равно проходит, а ошибка пишется в лог.

### Документы (S3 / Cloudflare R2)

| Переменная | Что указать |
|---|---|
| `DOCUMENTS_DRIVER` | `s3` |
| `DOCUMENTS_S3_BUCKET` | имя приватного бакета (публичный доступ не нужен — файлы отдаются через API с проверкой роли) |
| `DOCUMENTS_S3_ENDPOINT` | для R2: `https://<account-id>.r2.cloudflarestorage.com`; для AWS S3 — пусто |
| `DOCUMENTS_S3_REGION` | для R2: `auto`; для AWS — регион бакета (`eu-central-1`) |
| `DOCUMENTS_S3_ACCESS_KEY_ID` / `DOCUMENTS_S3_SECRET_ACCESS_KEY` | ключи R2 API Token (Object Read & Write только на этот бакет) или IAM-пользователя AWS |
| `DOCUMENTS_MAX_FILE_SIZE` | `20971520` (20 МБ). Учтите лимит тела запроса Vercel Functions (~4,5 МБ): файлы крупнее этого лимита на Vercel не пройдут |

Если `DOCUMENTS_DRIVER=s3`, но заданы не все ключи, приложение всё равно стартует, а загрузка отвечает `503 documentsStorageNotConfigured`. Список документов и скачивание уже существующих продолжают работать.

### Файлы (фото точек карты, модуль boilerplate)

| Переменная | Что указать |
|---|---|
| `FILE_DRIVER` | обязательна. `local` позволяет приложению стартовать, но загрузка фото на Vercel работать не будет (диск только для чтения). Драйверы `s3` / `s3-presigned` в boilerplate работают **только с AWS S3** (без настройки endpoint) и требуют `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `AWS_S3_REGION`, `AWS_DEFAULT_S3_BUCKET` |

### Остальное

| Переменная | Что указать |
|---|---|
| `AISSTREAM_API_KEY` | на Vercel не нужен: AIS там выключен в любом случае |
| `FACEBOOK_*`, `GOOGLE_*`, `APPLE_APP_AUDIENCE` | не используются, можно не задавать |

---

## 3. Миграции на Neon (один раз и при каждом релизе с новыми миграциями)

Миграции **не запускаются** при деплое: их прогоняют вручную с рабочей машины или из CI. Для DDL берите **direct**-строку подключения Neon (без `-pooler`).

Миграции создают всю схему и справочники: роли `1 Admin`, `2 User`, `3 Staff` и статусы `1 Active`, `2 Inactive`. Пользователи миграциями **не создаются**.

```bash
npm ci
npm run build

# bash
DATABASE_URL='postgresql://…@ep-…eu-central-1.aws.neon.tech/neondb?sslmode=require' \
DATABASE_SSL_ENABLED=true DATABASE_REJECT_UNAUTHORIZED=true \
npm run migration:run:prod
```

```powershell
# PowerShell
$env:DATABASE_URL='postgresql://…@ep-…eu-central-1.aws.neon.tech/neondb?sslmode=require'
$env:DATABASE_SSL_ENABLED='true'; $env:DATABASE_REJECT_UNAUTHORIZED='true'
npm run migration:run:prod
```

- `migration:run:prod` запускает скомпилированные миграции из `dist/` (`node ./node_modules/typeorm/cli.js -d dist/database/data-source.js migration:run`).
- Скрипт подхватывает и локальный `.env`, но переменные из окружения командной строки имеют приоритет, а `DATABASE_URL` важнее `DATABASE_HOST` и остальных. Перед запуском проверьте по логу, к какому хосту идёт подключение.
- Повторный запуск безопасен: TypeORM выполняет только новые миграции и при отсутствии новых пишет `No migrations are pending`.
- Seed-скрипты (`npm run seed:run:relational`) на продакшене **не запускаем**.

---

## 4. Первый администратор

1. Зарегистрируйтесь на сайте обычным способом. Новый пользователь получает роль `User` (наблюдатель).
2. В Neon Console → SQL Editor выполните:

   ```sql
   UPDATE "user" SET "roleId" = 1, "statusId" = 1 WHERE email = 'you@example.com';
   ```

   `statusId = 1` (Active) нужен, если письмо с подтверждением не дошло.
3. Выйдите и войдите заново: роль хранится в access-токене и обновится при новом входе (или через ~15 минут при refresh).
4. Остальных сотрудников администратор назначает на странице «Команда» (роль `Staff`).

---

## 5. AIS (позиции судов)

AIS — это постоянное WebSocket-подключение к AISStream.io. На Vercel оно невозможно, поэтому там позиции вводятся вручную (или показываются оценочно).

Чтобы включить AIS, нужен **хост без serverless-ограничений** (Railway, Fly.io, Render, VPS), где запускается этот же бэкенд:

- `npm run build && npm run start:prod`, без переменной `VERCEL`;
- с теми же `DATABASE_URL` и `AUTH_*` и с `AISSTREAM_API_KEY`;
- только **один** такой инстанс: AISStream ограничивает число соединений на ключ.

Он будет обновлять позиции в общей базе, а веб-трафик останется на Vercel.

---

## 6. Проверка после первого деплоя

1. `GET https://<backend>/` (home) и `https://<backend>/docs` (Swagger) открываются.
2. В логах функции нет ошибок старта. Отдельно проверьте, что найдена папка переводов (`dist/i18n`): строки вида `i18n path … cannot be found` означают, что файлы не попали в бандл функции.
3. Вход админом → `GET /api/v1/vessels` → 200.
4. Загрузка и скачивание документа (при `DOCUMENTS_DRIVER=s3`).
5. Preflight с фронта проходит; с чужого origin заголовка `Access-Control-Allow-Origin` нет.
6. Шаблоны писем читаются из `src/mail/mail-templates`. Если письмо не уходит из-за отсутствующего шаблона, в логе будет warn, а регистрация всё равно проходит.
