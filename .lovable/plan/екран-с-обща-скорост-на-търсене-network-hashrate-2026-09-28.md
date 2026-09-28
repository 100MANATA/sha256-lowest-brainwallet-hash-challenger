# Екран с обща скорост на търсене (network hashrate)

## Цел
Нова секция на началната страница, която показва сумарната скорост на хеширане на всички активни търсачи в момента — като „глобална мощност на мрежата".

## Как ще работи
1. **Heartbeat от всеки търсач** — докато търсенето върви, браузърът изпраща на всеки 15 секунди малък сигнал към сървъра: име, текуща скорост (H/s), engine (CPU/GPU) и случаен session ID (генерира се локално, пази се в localStorage — без вход, без лични данни).
2. **Сървърна агрегация** — нова функция `getNetworkStats` сумира скоростите само на сигналите от последните 60 секунди (т.е. реално активните в момента) и връща: обща скорост, брой активни търсачи, CPU vs GPU разпределение.
3. **Нов панел „Network hashrate"** на началната страница (между „Current world record" и търсачката):
   - Обща скорост на мрежата (напр. „4.2 MH/s")
   - Активни търсачи в момента
   - CPU / GPU дял
   - „Вашият дял: X%" спрямо текущата ви скорост
   - Обновява се автоматично на всеки 15 секунди.
4. **Почистване** — стари сигнали (>10 мин) се трият, за да не трупа таблицата.

## Технически детайли
- Нова таблица `public.heartbeats`: `session_id text`, `username text`, `hash_rate double`, `engine text`, `updated_at timestamptz`; GRANT за anon/authenticated INSERT+UPDATE (само собствения session_id чрез upsert), RLS: SELECT за всички, INSERT/UPDATE без ограничение по потребител (session_id е случаен и несекретен), без DELETE за клиенти.
- `src/lib/network.functions.ts`: `reportHeartbeat` (zod валидация, upsert по session_id, rate-limit 1 запис/10s на сесия) и `getNetworkStats` (SELECT редове с updated_at > now() - 60s, сумиране в JS).
- `src/hooks/useMiner.ts`: при running статус — интервал 15s, който вика `reportHeartbeat` с текущия hashRate; спира при pause/stop.
- `src/components/NetworkPanel.tsx`: нов компонент, `useQuery` с refetchInterval 15s.
- `src/routes/index.tsx`: монтиране на панела след секцията „Current world record".
- Миграция: CREATE TABLE + GRANT + RLS политики + индекс по updated_at.

## Проверка
- Typecheck + build.
- Playwright: стартирано търсене изпраща heartbeat; панелът показва ненулева обща скорост и брой активни търсачи.
