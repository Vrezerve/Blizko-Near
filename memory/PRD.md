# PRD — Такси "Рядом" (WebToApp)

## Описание
Сервис такси/райдшеринга с ролями Заказчик, Водитель, Администратор.

## Стек
React + TailwindCSS + Shadcn, FastAPI, MongoDB, JWT + PIN + OTP, WebSockets, Yandex Maps + Geocoder, SMS.ru

## Реализовано

### Карты (Яндекс)
- [x] Реальная карта Яндекс на всех экранах (пассажир, водитель, админка)
- [x] Геокодинг: клик по карте → определение адреса
- [x] Подсказки адресов при вводе (Yandex Geocoder API)
- [x] Кастомный пин точки подачи (настраивается в админке)
- [x] Мобильный скролл: карта не блокирует свайп, активируется по тапу
- [x] Чистый UI: убраны все элементы управления Яндекса

### Заказы
- [x] Водитель выбирает ETA при принятии (1/2/3/5 мин, настраивается в админке)
- [x] Пассажир видит ETA водителя
- [x] Кнопка "Отменить" скрывается когда водитель принял заказ
- [x] Локация водителя видна на карте пассажира

### Авторизация
- [x] PIN без SMS: если пользователь уже задал PIN → сразу экран PIN (без отправки SMS)
- [x] SMS.ru реальная отправка
- [x] Тестовый режим (код 1234)

### Админ-панель
- [x] Настройки ETA опций для водителя
- [x] Настройка кастомного пина карты
- [x] Системные логи
- [x] Модули с ZIP
- [x] Загрузка фона карты + позиционирование (background-size/position)
- [x] CRUD кнопок Fab-бара (роль, SVG, заголовок, HTML контент)

### Fab-бар (нижнее меню) — Feb 2026
- [x] Бар на главных экранах клиента и водителя (после авторизации)
- [x] Первая фиксированная иконка: «Вызвать» (клиент) / «Заявки» (водитель)
- [x] До 3 настраиваемых админом кнопок на роль (макс. 4 в баре)
- [x] SVG-иконка: вставка кода ИЛИ загрузка файла
- [x] Модалка при нажатии с HTML-контентом и заголовком
- [x] Роли: customer/driver/both
- [x] Лимит 3 активных на роль (enforce на create/update)

### Устойчивость UI
- [x] ErrorBoundary вокруг YandexMap и глобально в App
- [x] YandexMap ждёт ymaps.ready() перед инициализацией

## Бэклог
### P1
- [ ] Проблемные заказы (отчёт о проблеме, не списывает баланс)
- [ ] Система рейтинга водителей и распределение заказов по рейтингу
- [ ] OneSignal push
- [ ] SMTP email

### P2
- [ ] Предоплатный баланс водителей
- [ ] Интеграция Google Maps / 2GIS
- [ ] Рефакторинг server.py (2100+ строк → routes/)
- [ ] Рефакторинг AdminPanel.js (2600+ строк → разделить по табам)

### Design quirks (низкий приоритет)
- [ ] Map background (teal grid) "просвечивает" на экранах авторизации — заменить на нейтральный фон
- [ ] Водительский auth-экран без чекбоксов согласия (legal review)

## Изменения — June 2026 (iteration 17)
- [x] Верхний бар (TopBar.jsx): белый, прижат к верху — бургер | аватар+имя (ellipsis) | статус онлайн/не в сети (customer + driver)
- [x] Fab-bar: убрана первая фикс. кнопка, иконки сверху, подписи снизу
- [x] PWA: динамический манифест GET /api/manifest.json, InstallPrompt баннер (каждый визит если не установлено), иконки 192/512 + короткое имя + текст — из админки (upload-pwa-icon)
- [x] Отключение карты: тумблер map_enabled в админке; вместо карты — фоновое изображение (map_bg_size/position/repeat)
- [x] Регистрация по звонку sms.ru callcheck: /api/auth/callcheck/start|status, тумблер call_verify_enabled (только новые пассажиры), rate limit (per phone + 5/час на устройство), тексты и таймеры из админки
- [x] Фикс media queries .app-container/.bottom-sheet (единый брейкпоинт 768px, 28rem)
- [x] Push-баннер сдвинут ниже TopBar (top: 68px)
- Тесты: /app/test_reports/iteration_17.json — 100% backend (10/10) + 100% frontend

## Багфиксы — July 2026 (iteration 22)
- [x] Backend callcheck/start больше НЕ падает silently на method:'sms' при отказе sms.ru — теперь 400 с русским сообщением («Не удалось запустить подтверждение по звонку. Проверьте, что номер...») или 502 при сетевой ошибке. Причина исходного бага: user вводил +7 (345) 345-34-53 (не мобильный) → sms.ru rejected → фронт fallback'ил на SMS-код, который никуда не отправлялся
- [x] Frontend CustomerAuth + DriverAuth: валидация `/^\+79\d{9}$/` (RU mobile) перед запросом; при ошибке от callcheck НЕТ fallback на SMS — показывается сообщение backend'а
- [x] DriverAuth REORDER: phone → call-verify → user фаиксируется (создаётся с name=None) → step='register' → форма ФИО/авто/номер → POST /api/auth/complete-driver-profile с bearer token → step='awaiting'
- [x] Backend новый endpoint POST /api/auth/complete-driver-profile — driver-only, обновляет name/car_model/car_number/profile_completed=true, шлёт email админу
- [x] DriverAuth useEffect user-redirect: не редиректит на /driver если !user.name или is_activated===false (даёт заполнить профиль / дождаться активации)
- Тесты: /app/test_reports/iteration_22.json — 100% backend (8/8) + 100% frontend

## Багфиксы — July 2026 (iteration 21)
- [x] Слайдер на главной прижат к верху, без border-radius верхних углов, полная ширина контейнера — на всех разрешениях
- Тесты: /app/test_reports/iteration_20.json — 100% frontend

## Feature — July 2026 (iteration 20)
- [x] Backend callcheck разрешено для role=driver (снят фильтр role!=customer), driver_data (name/car/car_number) сохраняется в callcheck_requests и применяется при create user
- [x] Backend endpoints /api/settings/auth-slides: upload (multipart, до 5МБ, PNG/JPG/WebP/GIF), list, delete (с re-order), reorder. Slides хранятся в settings.auth_slides
- [x] Backend GET /api/settings/public теперь возвращает auth_slides, auth_slides_autoplay, auth_slides_interval, show_fuel_stations
- [x] Backend SettingsUpdate model — новые поля auth_slides, auth_slides_autoplay, auth_slides_interval, show_fuel_stations
- [x] Frontend RoleSelect (/): swipe-слайдер (touch + mouse drag) с автопрокруткой (настраиваемый interval), dots-индикаторы
- [x] Frontend AdminPanel > Настройки: секция «Слайдер на экране входа» (upload + delete + autoplay toggle + interval), секция «Заправки на карте» (toggle)
- [x] Frontend YandexMap: prop showFuelStations — при true запрашивает OSM Overpass API amenity=fuel в bbox видимой области (debounced 800ms, кэш 3 мин по bbox, cap 200 nodes), оранжевые АЗС-placemark'и
- [x] Frontend CSS: .bottom-sheet.with-fabbar padding-bottom 85→110px, .fab-bar bottom 8→14px — гэп между «Вызвать машину» и fab-баром ≥30px
- Тесты: iter 20 testing agent был прерван на планировании — но backend endpoints протестированы вручную (curl OK) + smoke screenshots подтвердили работоспособность на десктопе и мобиле


- [x] Регистрация и «Забыл PIN» — окно подтверждения по звонку SMS.ru теперь показывается корректно (backend: убран блок existing_user; фронт PinScreen: forgot-flow сначала пробует callcheck/start с purpose=pin_reset и показывает call-verify экран)
- [x] Backend callcheck/status: при purpose='pin_reset' — очищает pin_hash и has_pin=false, выдаёт новый токен → редирект на /auth/pin-setup
- [x] `.app-container` max-width на десктопе: 28rem → 48rem (bottom-sheet тоже 48rem)
- [x] Админка: `.admin-container` max-width 80rem → 96rem, паддинги адаптивны
- [x] Админка: мобильная адаптация — admin-topbar (бургер + название таба + logout), sidebar-drawer <1024px с бэкдропом, таблицы обёрнуты в admin-table-wrap с overflow-x
- [x] DELETE /api/admin/users/{user_id} — полное удаление пассажира/водителя с каскадом (заказы клиента + notifications + verification_codes + callcheck_requests; для водителя driver_id обнуляется в его заказах)
- [x] UI: кнопка «Удалить» в модалке редактирования пользователя + модалка подтверждения (delete-user-modal с cancel/confirm testids)
- [x] Защита: нельзя удалить admin (403), 404 при несуществующем пользователе
- Тесты: /app/test_reports/iteration_19.json — 100% frontend (5/5) + 90% backend (9/10, 1 skip — не баг)

## Багфиксы — June 2026 (iteration 18)
- [x] Восстановлен вызов callcheck/start в CustomerAuth (регистрация показывала SMS-экран вместо звонка)
- [x] Новый экран звонка по ТЗ: «Подтверждение номера телефона», номер, 4 блока цифр (подставляются при подтверждении), таймер «Осталось времени», кнопка «Позвонить» (tel:, Android/iOS), «Отмена»
- [x] test_mode шорткат: POST /auth/callcheck/status {test_confirm:true} — подтверждение без звонка (аналог кода 1234)
- [x] Повторный полл после confirmed пере-выдаёт токен (не «истекло»)
- [x] ПК-вёрстка = планшет (28rem, push-banner max-width 26rem)
- [x] Русификация ~33 сообщений об ошибках бэкенда (Invalid code → «Неверный код» и т.д.)
- Тесты: /app/test_reports/iteration_18.json — 100% backend (10/10) + 100% frontend
