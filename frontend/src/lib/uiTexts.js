// UI texts editable from the Admin panel (settings.ui_texts)
export const UI_TEXT_GROUPS = [
  {
    group: 'Главный экран (выбор роли)',
    items: [
      { key: 'role_select_subtitle', label: 'Подзаголовок', def: 'Выберите как вы хотите использовать сервис' },
      { key: 'role_customer_title', label: 'Кнопка заказчика', def: 'Войти как заказчик' },
      { key: 'role_customer_subtitle', label: 'Подпись у заказчика', def: 'Найти поездку' },
      { key: 'role_driver_title', label: 'Кнопка исполнителя', def: 'Войти как исполнитель' },
      { key: 'role_driver_subtitle', label: 'Подпись у исполнителя', def: 'Принимать заказы' },
    ],
  },
  {
    group: 'Вход и PIN',
    items: [
      { key: 'customer_auth_title', label: 'Заголовок входа заказчика', def: 'Вход для заказчика' },
      { key: 'customer_auth_subtitle', label: 'Подзаголовок входа заказчика', def: 'Введите номер телефона для получения кода' },
      { key: 'driver_auth_title', label: 'Заголовок входа исполнителя', def: 'Вход для водителя' },
      { key: 'driver_auth_subtitle', label: 'Подзаголовок входа исполнителя', def: 'Введите номер телефона' },
      { key: 'driver_register_title', label: 'Заголовок анкеты исполнителя', def: 'Регистрация водителя' },
      { key: 'driver_register_subtitle', label: 'Подзаголовок анкеты', def: 'Заполните данные о себе' },
      { key: 'driver_awaiting_title', label: 'Заголовок «ожидание активации»', def: 'Ожидается активация' },
      { key: 'pin_enter_title', label: 'Заголовок ввода PIN', def: 'Введите код' },
      { key: 'forgot_pin', label: 'Ссылка «Забыли код»', def: 'Забыли код? Восстановить' },
      { key: 'switch_account', label: 'Ссылка «Другой аккаунт»', def: 'Другой аккаунт' },
      { key: 'agree_terms_link', label: 'Ссылка «условия сервиса» (чекбокс)', def: 'условия сервиса' },
      { key: 'agree_privacy_link', label: 'Ссылка «согласие на обработку» (чекбокс)', def: 'согласие на обработку персональных данных' },
      { key: 'modal_terms_title', label: 'Заголовок окна условий сервиса', def: 'Условия сервиса' },
      { key: 'modal_privacy_title', label: 'Заголовок окна согласия', def: 'Согласие на обработку персональных данных' },
    ],
  },
  {
    group: 'Экран заказчика — создание заказа',
    items: [
      { key: 'where_title', label: 'Заголовок формы', def: 'Куда едем?' },
      { key: 'where_subtitle', label: 'Подзаголовок формы', def: 'Укажите адрес подачи' },
      { key: 'address_label', label: 'Подпись поля адреса', def: 'Адрес и номер дома' },
      { key: 'address_placeholder', label: 'Placeholder поля адреса', def: 'Введите адрес или нажмите на карту' },
      { key: 'map_hint', label: 'Подсказка под адресом', def: 'Или нажмите на карту для выбора точки' },
      { key: 'house_label', label: 'Подпись поля уточнения', def: 'Уточнение' },
      { key: 'house_placeholder', label: 'Placeholder поля уточнения', def: 'Подъезд, домофон, комментарий' },
      { key: 'create_order_btn', label: 'Кнопка создания заказа', def: 'Разместить заказ' },
      { key: 'stats_free', label: 'Счётчик «Свободно»', def: 'Свободно' },
      { key: 'stats_busy', label: 'Счётчик «Занято»', def: 'Занято' },
      { key: 'customer_rules_link', label: 'Ссылка «правилами для заказчика» (чекбокс)', def: 'правилами для заказчика' },
      { key: 'customer_rules_modal_title', label: 'Заголовок окна правил заказчика', def: 'Правила для заказчика' },
    ],
  },
  {
    group: 'Экран заказчика — поездка',
    items: [
      { key: 'searching_title', label: 'Заголовок поиска (… добавляется)', def: 'Ищем исполнителя' },
      { key: 'drivers_busy', label: 'Плашка «все заняты»', def: 'К сожалению, водители заняты' },
      { key: 'no_driver_error', label: 'Сообщение «не найден»', def: 'Исполнитель не найден. Попробуйте разместить заказ ещё раз.' },
      { key: 'driver_found', label: 'Плашка «найден» (! добавляется)', def: 'Исполнитель найден' },
      { key: 'eta_prefix', label: 'Текст перед временем (~N мин)', def: 'Выходите через' },
      { key: 'call_driver_btn', label: 'Кнопка звонка исполнителю', def: 'Позвонить исполнителю' },
      { key: 'report_problem_btn', label: 'Кнопка «проблема»', def: 'Сообщить о проблеме' },
      { key: 'completed_title', label: 'Заголовок завершения', def: 'Поездка завершена' },
      { key: 'completed_text', label: 'Текст завершения', def: 'Спасибо за использование сервиса!' },
    ],
  },
  {
    group: 'Экран исполнителя',
    items: [
      { key: 'driver_go_online', label: 'Кнопка «начать принимать заказы»', def: 'Начать принимать заказы' },
      { key: 'driver_go_offline', label: 'Кнопка «уйти с линии»', def: 'Уйти с линии' },
      { key: 'driver_offline_title', label: 'Заголовок «Вы не онлайн»', def: 'Вы не онлайн' },
      { key: 'driver_rules_link', label: 'Ссылка «правилами для исполнителей» (чекбокс)', def: 'правилами для исполнителей' },
      { key: 'driver_rules_modal_title', label: 'Заголовок окна правил исполнителя', def: 'Правила для исполнителя' },
      { key: 'driver_orders_title', label: 'Заголовок списка заявок', def: 'Активные заявки' },
      { key: 'driver_accept_btn', label: 'Кнопка «принять»', def: 'Принять' },
      { key: 'driver_balance_label', label: 'Подпись баланса', def: 'Баланс' },
    ],
  },
  {
    group: 'Боковое меню',
    items: [
      { key: 'menu_history', label: 'История заказов', def: 'История заказов' },
      { key: 'menu_notifications', label: 'Пункт «Уведомления»', def: 'Уведомления' },
      { key: 'menu_edit_profile', label: 'Редактировать профиль', def: 'Редактировать профиль' },
      { key: 'menu_logout', label: 'Выйти', def: 'Выйти' },
    ],
  },
];

// Flat list (backwards compatible with existing imports)
export const UI_TEXT_DEFS = UI_TEXT_GROUPS.flatMap((g) => g.items);

const DEFAULTS = Object.fromEntries(UI_TEXT_DEFS.map((d) => [d.key, d.def]));

export const getText = (settings, key) => {
  const custom = settings?.ui_texts?.[key];
  if (typeof custom === 'string' && custom.trim()) return custom;
  return DEFAULTS[key] || '';
};
