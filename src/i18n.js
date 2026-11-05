// The words the app shows, in English, Spanish and Russian.
// The app uses the language chosen with the flag button on this phone. Without one, it uses
// the phone's language. If the app does not have that language, it uses English.

export const STRINGS = {
  en: {
    about: "aima shows your household's money summary from a Google Sheet you have access to.",
    signIn: 'Login with Google',
    checking: 'Checking your access…',
    noAccess: "You don't have access to this document. Ask its owner to share it with you.",
    notPicked:
      'To see your data, select the aima sheet when Google shows it. If it is not there, ask its owner to share it with you.',
    signInFailed: 'Sign-in did not finish. Please try again.',
    permissionMissing:
      'aima needs permission to open the sheet you pick. Please sign in again and allow it.',
    expired: 'Your sign-in has expired. Please sign in again.',
    error: 'Something went wrong. Please try again.',
    notConfigured: 'This app is not set up yet.',
    signedOut: 'You have signed out.',
    signOut: 'Log out',
    back: 'Back',
    add: 'Add a movement',
    newMovement: 'New movement',
    source: 'Source',
    date: 'Date',
    category: 'Category',
    concept: 'Concept',
    amount: 'Amount',
    cancel: 'Cancel',
    listsFailed: 'The lists could not be loaded.',
    save: 'Save',
    required: 'Required',
    notSaved: 'The movement was not saved. Please try again.',
    delete: 'Delete',
    no: 'No',
    yes: 'Yes',
    close: 'Close',
    sheetChanged: 'The sheet was changed, so nothing was deleted.',
    notDeleted: 'Nothing was deleted. Please try again.',
    edit: 'Edit',
    showLeftOut: 'Show the movements the goal leaves out',
    editMovement: 'Edit movement',
    amountCut: 'This amount had more than two decimals. Only the first two are kept.',
    sheetChangedNotSaved: 'The sheet was changed, so nothing was saved.',
    aboutPage: 'About',
    terms: 'Terms',
    privacy: 'Privacy',
    goal: 'Goal',
    total: 'Total',
    bank: 'Bank',
    cards: 'Cards',
    provisioned: 'Provisioned',
    cash: 'Cash',
    language: 'Language',
  },
  es: {
    about:
      'aima muestra el resumen del dinero de tu hogar a partir de una hoja de Google a la que tienes acceso.',
    signIn: 'Iniciar sesión con Google',
    checking: 'Comprobando tu acceso…',
    noAccess: 'No tienes acceso a este documento. Pide a su propietario que lo comparta contigo.',
    notPicked:
      'Para ver tus datos, selecciona la hoja de aima cuando Google te la muestre. Si no aparece, pide a su propietario que la comparta contigo.',
    signInFailed: 'No se completó el inicio de sesión. Inténtalo de nuevo.',
    permissionMissing:
      'aima necesita permiso para abrir la hoja que elijas. Vuelve a iniciar sesión y permítelo.',
    expired: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
    error: 'Algo salió mal. Inténtalo de nuevo.',
    notConfigured: 'Esta aplicación aún no está configurada.',
    signedOut: 'Has cerrado sesión.',
    signOut: 'Cerrar sesión',
    back: 'Volver',
    add: 'Añadir un movimiento',
    newMovement: 'Nuevo movimiento',
    source: 'Origen',
    date: 'Fecha',
    category: 'Categoría',
    concept: 'Concepto',
    amount: 'Importe',
    cancel: 'Cancelar',
    listsFailed: 'No se pudieron cargar las listas.',
    save: 'Guardar',
    required: 'Obligatorio',
    notSaved: 'No se guardó el movimiento. Inténtalo de nuevo.',
    delete: 'Eliminar',
    no: 'No',
    yes: 'Sí',
    close: 'Cerrar',
    sheetChanged: 'La hoja ha cambiado, así que no se ha eliminado nada.',
    notDeleted: 'No se ha eliminado nada. Inténtalo de nuevo.',
    edit: 'Editar',
    showLeftOut: 'Mostrar los movimientos que el objetivo deja fuera',
    editMovement: 'Editar movimiento',
    amountCut: 'Este importe tenía más de dos decimales. Solo se guardan los dos primeros.',
    sheetChangedNotSaved: 'La hoja ha cambiado, así que no se ha guardado nada.',
    aboutPage: 'Acerca de',
    terms: 'Términos',
    privacy: 'Privacidad',
    goal: 'Objetivo',
    total: 'Total',
    bank: 'Banco',
    cards: 'Tarjetas',
    provisioned: 'Provisionado',
    cash: 'Efectivo',
    language: 'Idioma',
  },
  ru: {
    about:
      'aima показывает сводку финансов вашей семьи из Google Таблицы, к которой у вас есть доступ.',
    signIn: 'Войти через Google',
    checking: 'Проверяем ваш доступ…',
    noAccess: 'У вас нет доступа к этому документу. Попросите владельца открыть вам доступ.',
    notPicked:
      'Чтобы увидеть свои данные, выберите таблицу aima, когда Google её покажет. Если её там нет, попросите владельца открыть вам доступ.',
    signInFailed: 'Вход не завершён. Попробуйте ещё раз.',
    permissionMissing:
      'Приложению aima нужно разрешение открыть таблицу, которую вы выберете. Войдите снова и разрешите доступ.',
    expired: 'Срок входа истёк. Пожалуйста, войдите снова.',
    error: 'Что-то пошло не так. Попробуйте ещё раз.',
    notConfigured: 'Это приложение ещё не настроено.',
    signedOut: 'Вы вышли из аккаунта.',
    signOut: 'Выйти',
    back: 'Назад',
    add: 'Добавить операцию',
    newMovement: 'Новая операция',
    source: 'Источник',
    date: 'Дата',
    category: 'Категория',
    concept: 'Описание',
    amount: 'Сумма',
    cancel: 'Отмена',
    listsFailed: 'Не удалось загрузить списки.',
    save: 'Сохранить',
    required: 'Обязательно',
    notSaved: 'Операция не сохранена. Попробуйте ещё раз.',
    delete: 'Удалить',
    no: 'Нет',
    yes: 'Да',
    close: 'Закрыть',
    sheetChanged: 'Таблица изменилась, поэтому ничего не удалено.',
    notDeleted: 'Ничего не удалено. Попробуйте ещё раз.',
    edit: 'Изменить',
    showLeftOut: 'Показать операции, которые цель не учитывает',
    editMovement: 'Изменить операцию',
    amountCut: 'В этой сумме больше двух знаков после запятой. Сохраняются только первые два.',
    sheetChangedNotSaved: 'Таблица изменилась, поэтому ничего не сохранено.',
    aboutPage: 'О приложении',
    terms: 'Условия',
    privacy: 'Конфиденциальность',
    goal: 'Цель',
    total: 'Итого',
    bank: 'Банк',
    cards: 'Карты',
    provisioned: 'Резерв',
    cash: 'Наличные',
    language: 'Язык',
  },
};

const FALLBACK = 'en';

// Takes the phone's languages in order of preference (for example ["es-MX", "en"])
// and returns the first one the app has: "en", "es" or "ru".
export function pickLanguage(preferred = []) {
  for (const code of preferred ?? []) {
    const base = String(code ?? '')
      .toLowerCase()
      .split('-')[0];
    if (Object.hasOwn(STRINGS, base)) return base;
  }
  return FALLBACK;
}

// Returns the phone's languages in order of preference. Some browsers give an empty list,
// so then we use the phone's main language.
export function browserLanguages(navigator) {
  if (navigator.languages?.length) return [...navigator.languages];
  return navigator.language ? [navigator.language] : [];
}

// Returns a function that gives the text for a message key, for example t("signOut").
export function createTranslator(language) {
  const strings = STRINGS[language] ?? STRINGS[FALLBACK];
  return (key) => strings[key] ?? STRINGS[FALLBACK][key] ?? key;
}

// The question before deleting movements, for one or more of them, in each language. Russian
// has three forms of the word, chosen by Intl.PluralRules ("one", "few" and "many").
const DELETE_QUESTIONS = {
  en: { one: 'Delete this movement?', other: (count) => `Delete ${count} movements?` },
  es: { one: '¿Eliminar este movimiento?', other: (count) => `¿Eliminar ${count} movimientos?` },
  ru: {
    one: 'Удалить эту операцию?',
    oneOfMany: (count) => `Удалить ${count} операцию?`,
    few: (count) => `Удалить ${count} операции?`,
    many: (count) => `Удалить ${count} операций?`,
  },
};

// Returns a function that asks if count movements should be deleted, for example
// 1 → "Delete this movement?" and 3 → "Delete 3 movements?".
export function createDeleteQuestion(language) {
  const known = Object.hasOwn(DELETE_QUESTIONS, language) ? language : FALLBACK;
  const questions = DELETE_QUESTIONS[known];
  const rules = new Intl.PluralRules(known);
  return (count) => {
    if (count === 1) return questions.one;
    const form = rules.select(count);
    // 21, 31, ... use the "one" form of the word in Russian, but with the number.
    const write = (form === 'one' ? questions.oneOfMany : questions[form]) ?? questions.other;
    return write(count);
  };
}

// Returns a function that writes an amount of euros the way the language does, for example
// 1234.5 → "€1,234.50" in English and "1.234,50 €" in Spanish. "always" adds the thousands
// mark also to 4-digit amounts, which Spanish would otherwise leave out.
export function createMoneyFormatter(language) {
  const format = new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'EUR',
    useGrouping: 'always',
  });
  return (amount) => format.format(amount);
}

// Returns a function that writes an amount being typed, given in cents, with the marks of the
// language and no euro sign, for example 123456 → "1,234.56" in English and "1.234,56" in
// Spanish. Like the money above, it always shows two decimals and the thousands mark.
export function createAmountFormatter(language) {
  const format = new Intl.NumberFormat(language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: 'always',
  });
  return (cents) => format.format(cents / 100);
}

// Returns a function that names a month in the language, starting with a capital letter,
// for example (2026, 10) → "October" in English and "Octubre" in Spanish. month is 1 to 12.
export function createMonthNamer(language) {
  const format = new Intl.DateTimeFormat(language, {
    month: 'long',
    timeZone: 'UTC',
  });
  return (year, month) => {
    const name = format.format(Date.UTC(year, month - 1, 1));
    return name.charAt(0).toLocaleUpperCase(language) + name.slice(1);
  };
}

// Returns a function that writes a date with its day of the week, starting with a capital
// letter, for example (2026, 10, 20) → "Tuesday, October 20" in English and
// "Martes, 20 de octubre" in Spanish. month is 1 to 12.
export function createDayNamer(language) {
  const format = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  return (year, month, day) => {
    const name = format.format(Date.UTC(year, month - 1, day));
    return name.charAt(0).toLocaleUpperCase(language) + name.slice(1);
  };
}
