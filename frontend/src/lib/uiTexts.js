// UI texts editable from the Admin panel (settings.ui_texts)
export const UI_TEXT_DEFS = [
  { key: 'forgot_pin', label: 'Экран PIN: «Забыли код»', def: 'Забыли код? Восстановить' },
  { key: 'role_customer_subtitle', label: 'Главный экран: подпись у «Войти как заказчик»', def: 'Найти поездку' },
  { key: 'customer_auth_title', label: 'Заголовок входа заказчика', def: 'Вход для заказчика' },
  { key: 'driver_auth_title', label: 'Заголовок входа исполнителя', def: 'Вход для водителя' },
  { key: 'address_label', label: 'Подпись поля адреса', def: 'Адрес и номер дома' },
  { key: 'house_label', label: 'Подпись поля уточнения', def: 'Уточнение' },
  { key: 'house_placeholder', label: 'Placeholder поля уточнения', def: 'Подъезд, домофон, комментарий' },
  { key: 'create_order_btn', label: 'Кнопка создания заказа', def: 'Разместить заказ' },
  { key: 'searching_title', label: 'Заголовок поиска исполнителя', def: 'Ищем исполнителя' },
  { key: 'driver_found', label: 'Плашка «исполнитель найден»', def: 'Исполнитель найден' },
  { key: 'eta_prefix', label: 'Текст перед временем (мин)', def: 'Выходите через' },
  { key: 'call_driver_btn', label: 'Кнопка звонка исполнителю', def: 'Позвонить исполнителю' },
];

const DEFAULTS = Object.fromEntries(UI_TEXT_DEFS.map((d) => [d.key, d.def]));

export const getText = (settings, key) => {
  const custom = settings?.ui_texts?.[key];
  if (typeof custom === 'string' && custom.trim()) return custom;
  return DEFAULTS[key] || '';
};
