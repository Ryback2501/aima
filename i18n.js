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
    startsWithEquals: "Can't start with =",
    notSaved: 'The movement was not saved. Please try again.',
    delete: 'Delete',
    no: 'No',
    yes: 'Yes',
    close: 'Close',
    sheetChanged: 'The sheet was changed, so nothing was deleted.',
    notDeleted: 'Nothing was deleted. Please try again.',
    // What a screen reader reads while a movement is saved or deleted, and after it.
    busySaving: 'Saving…',
    busyDeleting: 'Deleting…',
    busySaved: 'Saved',
    busyDeleted: 'Deleted',
    busyNotSaved: 'Not saved',
    busyNotDeleted: 'Not deleted',
    edit: 'Edit',
    showLeftOut: 'Show the movements the goal leaves out',
    editMovement: 'Edit movement',
    amountCut: 'This amount had more than two decimals. Only the first two are kept.',
    sheetChangedNotSaved: 'The sheet was changed, so nothing was saved.',
    aboutPage: 'About',
    terms: 'Terms',
    privacy: 'Privacy',
    goalTitle: 'Goal 4K',
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
    startsWithEquals: 'No puede empezar por =',
    notSaved: 'No se guardó el movimiento. Inténtalo de nuevo.',
    delete: 'Eliminar',
    no: 'No',
    yes: 'Sí',
    close: 'Cerrar',
    sheetChanged: 'La hoja ha cambiado, así que no se ha eliminado nada.',
    notDeleted: 'No se ha eliminado nada. Inténtalo de nuevo.',
    busySaving: 'Guardando…',
    busyDeleting: 'Eliminando…',
    busySaved: 'Guardado',
    busyDeleted: 'Eliminado',
    busyNotSaved: 'No guardado',
    busyNotDeleted: 'No eliminado',
    edit: 'Editar',
    showLeftOut: 'Mostrar los movimientos que el objetivo deja fuera',
    editMovement: 'Editar movimiento',
    amountCut: 'Este importe tenía más de dos decimales. Solo se guardan los dos primeros.',
    sheetChangedNotSaved: 'La hoja ha cambiado, así que no se ha guardado nada.',
    aboutPage: 'Acerca de',
    terms: 'Términos',
    privacy: 'Privacidad',
    goalTitle: 'Objetivo 4K',
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
    startsWithEquals: 'Не может начинаться с =',
    notSaved: 'Операция не сохранена. Попробуйте ещё раз.',
    delete: 'Удалить',
    no: 'Нет',
    yes: 'Да',
    close: 'Закрыть',
    sheetChanged: 'Таблица изменилась, поэтому ничего не удалено.',
    notDeleted: 'Ничего не удалено. Попробуйте ещё раз.',
    busySaving: 'Сохранение…',
    busyDeleting: 'Удаление…',
    busySaved: 'Сохранено',
    busyDeleted: 'Удалено',
    busyNotSaved: 'Не сохранено',
    busyNotDeleted: 'Не удалено',
    edit: 'Изменить',
    showLeftOut: 'Показать операции, которые цель не учитывает',
    editMovement: 'Изменить операцию',
    amountCut: 'В этой сумме больше двух знаков после запятой. Сохраняются только первые два.',
    sheetChangedNotSaved: 'Таблица изменилась, поэтому ничего не сохранено.',
    aboutPage: 'О приложении',
    terms: 'Условия',
    privacy: 'Конфиденциальность',
    goalTitle: 'Цель 4K',
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

// The lines of the message when the App sheet has a mistake (issue #122), in each language.
// Each line says where (the sheet, the table, the row, the column or the cell) and what.
const MISTAKE_LINES = {
  en: {
    noAppSheet: ({ sheet }) => `The document has no sheet called ${sheet}.`,
    firstColumnEmpty: ({ sheet, table, row }) =>
      `${sheet}, ${table}, row ${row}: the first column is empty.`,
    tableTwice: ({ sheet, table, column }) =>
      `${sheet}, ${table}, column ${column}: the table is there twice.`,
    notInTable: ({ sheet, cell }) => `${sheet}, ${cell}: this cell is not in any table.`,
    tableMissing: ({ sheet, table }) => `${sheet}, ${table}: the table is missing.`,
    iconMissing: ({ sheet, table, row }) => `${sheet}, ${table}, row ${row}: the icon is missing.`,
    unknownIcon: ({ sheet, table, row, icon }) =>
      `${sheet}, ${table}, row ${row}: there is no icon called "${icon}".`,
    colorMissing: ({ sheet, table, row }) =>
      `${sheet}, ${table}, row ${row}: the color is missing.`,
    badColor: ({ sheet, table, row, color }) =>
      `${sheet}, ${table}, row ${row}: "${color}" is not a color like #2f6fd6.`,
    categoryTwice: ({ sheet, table, row, category, has }) =>
      `${sheet}, ${table}, row ${row}: the category ${category}${has ? ` with "${has}"` : ''} is there twice.`,
    sourceTwice: ({ sheet, table, row, source }) =>
      `${sheet}, ${table}, row ${row}: the source ${source} is there twice.`,
    badSourceIcon: ({ sheet, table, row, icon }) =>
      `${sheet}, ${table}, row ${row}: "${icon}" is not a source icon. Write bank, card or cash, or leave it empty.`,
    unknownPartner: ({ sheet, table, row, partner }) =>
      `${sheet}, ${table}, row ${row}: the source "${partner}" in Paired with is not in the table.`,
    pairedWithItself: ({ sheet, table, row, source }) =>
      `${sheet}, ${table}, row ${row}: ${source} cannot be paired with itself.`,
    partnerTwice: ({ sheet, table, row, partner }) =>
      `${sheet}, ${table}, row ${row}: ${partner} is in Paired with twice.`,
    pairedBothWays: ({ sheet, table, row, first, second }) =>
      `${sheet}, ${table}, row ${row}: ${first} and ${second} are paired with each other.`,
    pairedChain: ({ sheet, table, row, source, above }) =>
      `${sheet}, ${table}, row ${row}: ${source} goes below ${above}, so it cannot be paired with another source.`,
    settingMissing: ({ sheet, table, setting }) =>
      `${sheet}, ${table}: the row ${setting} is missing.`,
    settingTwice: ({ sheet, table, row, setting }) =>
      `${sheet}, ${table}, row ${row}: ${setting} is there twice.`,
    unknownSetting: ({ sheet, table, row, setting }) =>
      `${sheet}, ${table}, row ${row}: there is no setting called "${setting}". Use From, To or Limit.`,
    notADate: ({ sheet, table, row, setting }) =>
      `${sheet}, ${table}, row ${row}: ${setting} is not a date.`,
    fromAfterTo: ({ sheet, table, row }) => `${sheet}, ${table}, row ${row}: From is after To.`,
    badLimit: ({ sheet, table, row }) =>
      `${sheet}, ${table}, row ${row}: the limit must be a number above 0.`,
    unknownName: ({ sheet, table, row, name }) =>
      `${sheet}, ${table}, row ${row}: there is no row called "${name}" in this table.`,
    badFirstRow: ({ sheet, table, row }) =>
      `${sheet}, ${table}, row ${row}: First movement row must be a whole number of 1 or more.`,
    emptyCell: ({ sheet, table, row, setting }) =>
      `${sheet}, ${table}, row ${row}: the cell of ${setting} is empty.`,
    noSuchCell: ({ sheet, table, row, cell }) =>
      `${sheet}, ${table}, row ${row}: the document has no cell ${cell}.`,
    noSuchSheet: ({ sheet, table, row, name }) =>
      `${sheet}, ${table}, row ${row}: the document has no sheet called ${name}.`,
  },
  es: {
    noAppSheet: ({ sheet }) => `El documento no tiene ninguna hoja llamada ${sheet}.`,
    firstColumnEmpty: ({ sheet, table, row }) =>
      `${sheet}, ${table}, fila ${row}: la primera columna está vacía.`,
    tableTwice: ({ sheet, table, column }) =>
      `${sheet}, ${table}, columna ${column}: la tabla está dos veces.`,
    notInTable: ({ sheet, cell }) => `${sheet}, ${cell}: esta celda no está en ninguna tabla.`,
    tableMissing: ({ sheet, table }) => `${sheet}, ${table}: falta la tabla.`,
    iconMissing: ({ sheet, table, row }) => `${sheet}, ${table}, fila ${row}: falta el icono.`,
    unknownIcon: ({ sheet, table, row, icon }) =>
      `${sheet}, ${table}, fila ${row}: no hay ningún icono llamado "${icon}".`,
    colorMissing: ({ sheet, table, row }) => `${sheet}, ${table}, fila ${row}: falta el color.`,
    badColor: ({ sheet, table, row, color }) =>
      `${sheet}, ${table}, fila ${row}: "${color}" no es un color como #2f6fd6.`,
    categoryTwice: ({ sheet, table, row, category, has }) =>
      `${sheet}, ${table}, fila ${row}: la categoría ${category}${has ? ` con "${has}"` : ''} está dos veces.`,
    sourceTwice: ({ sheet, table, row, source }) =>
      `${sheet}, ${table}, fila ${row}: el origen ${source} está dos veces.`,
    badSourceIcon: ({ sheet, table, row, icon }) =>
      `${sheet}, ${table}, fila ${row}: "${icon}" no es un icono de origen. Escribe bank, card o cash, o déjalo vacío.`,
    unknownPartner: ({ sheet, table, row, partner }) =>
      `${sheet}, ${table}, fila ${row}: el origen "${partner}" de Paired with no está en la tabla.`,
    pairedWithItself: ({ sheet, table, row, source }) =>
      `${sheet}, ${table}, fila ${row}: ${source} no puede ir emparejado consigo mismo.`,
    partnerTwice: ({ sheet, table, row, partner }) =>
      `${sheet}, ${table}, fila ${row}: ${partner} está dos veces en Paired with.`,
    pairedBothWays: ({ sheet, table, row, first, second }) =>
      `${sheet}, ${table}, fila ${row}: ${first} y ${second} están emparejados entre sí.`,
    pairedChain: ({ sheet, table, row, source, above }) =>
      `${sheet}, ${table}, fila ${row}: ${source} va debajo de ${above}, así que no puede ir emparejado con otro origen.`,
    settingMissing: ({ sheet, table, setting }) => `${sheet}, ${table}: falta la fila ${setting}.`,
    settingTwice: ({ sheet, table, row, setting }) =>
      `${sheet}, ${table}, fila ${row}: ${setting} está dos veces.`,
    unknownSetting: ({ sheet, table, row, setting }) =>
      `${sheet}, ${table}, fila ${row}: no hay ningún ajuste llamado "${setting}". Usa From, To o Limit.`,
    notADate: ({ sheet, table, row, setting }) =>
      `${sheet}, ${table}, fila ${row}: ${setting} no es una fecha.`,
    fromAfterTo: ({ sheet, table, row }) =>
      `${sheet}, ${table}, fila ${row}: From es posterior a To.`,
    badLimit: ({ sheet, table, row }) =>
      `${sheet}, ${table}, fila ${row}: el límite debe ser un número mayor que 0.`,
    unknownName: ({ sheet, table, row, name }) =>
      `${sheet}, ${table}, fila ${row}: no hay ninguna fila llamada "${name}" en esta tabla.`,
    badFirstRow: ({ sheet, table, row }) =>
      `${sheet}, ${table}, fila ${row}: First movement row debe ser un número entero de 1 o más.`,
    emptyCell: ({ sheet, table, row, setting }) =>
      `${sheet}, ${table}, fila ${row}: la celda de ${setting} está vacía.`,
    noSuchCell: ({ sheet, table, row, cell }) =>
      `${sheet}, ${table}, fila ${row}: el documento no tiene ninguna celda ${cell}.`,
    noSuchSheet: ({ sheet, table, row, name }) =>
      `${sheet}, ${table}, fila ${row}: el documento no tiene ninguna hoja llamada ${name}.`,
  },
  ru: {
    noAppSheet: ({ sheet }) => `В документе нет листа с названием ${sheet}.`,
    firstColumnEmpty: ({ sheet, table, row }) =>
      `${sheet}, ${table}, строка ${row}: первый столбец пуст.`,
    tableTwice: ({ sheet, table, column }) =>
      `${sheet}, ${table}, столбец ${column}: таблица указана дважды.`,
    notInTable: ({ sheet, cell }) => `${sheet}, ${cell}: эта ячейка не входит ни в одну таблицу.`,
    tableMissing: ({ sheet, table }) => `${sheet}, ${table}: таблица отсутствует.`,
    iconMissing: ({ sheet, table, row }) => `${sheet}, ${table}, строка ${row}: не указан значок.`,
    unknownIcon: ({ sheet, table, row, icon }) =>
      `${sheet}, ${table}, строка ${row}: нет значка с названием "${icon}".`,
    colorMissing: ({ sheet, table, row }) => `${sheet}, ${table}, строка ${row}: не указан цвет.`,
    badColor: ({ sheet, table, row, color }) =>
      `${sheet}, ${table}, строка ${row}: "${color}" — это не цвет вида #2f6fd6.`,
    categoryTwice: ({ sheet, table, row, category, has }) =>
      `${sheet}, ${table}, строка ${row}: категория ${category}${has ? ` с "${has}"` : ''} указана дважды.`,
    sourceTwice: ({ sheet, table, row, source }) =>
      `${sheet}, ${table}, строка ${row}: источник ${source} указан дважды.`,
    badSourceIcon: ({ sheet, table, row, icon }) =>
      `${sheet}, ${table}, строка ${row}: "${icon}" — это не значок источника. Укажите bank, card или cash или оставьте пустым.`,
    unknownPartner: ({ sheet, table, row, partner }) =>
      `${sheet}, ${table}, строка ${row}: источника "${partner}" из Paired with нет в таблице.`,
    pairedWithItself: ({ sheet, table, row, source }) =>
      `${sheet}, ${table}, строка ${row}: ${source} нельзя связать с самим собой.`,
    partnerTwice: ({ sheet, table, row, partner }) =>
      `${sheet}, ${table}, строка ${row}: ${partner} указан в Paired with дважды.`,
    pairedBothWays: ({ sheet, table, row, first, second }) =>
      `${sheet}, ${table}, строка ${row}: ${first} и ${second} связаны друг с другом.`,
    pairedChain: ({ sheet, table, row, source, above }) =>
      `${sheet}, ${table}, строка ${row}: ${source} идёт под ${above}, поэтому его нельзя связать с другим источником.`,
    settingMissing: ({ sheet, table, setting }) => `${sheet}, ${table}: нет строки ${setting}.`,
    settingTwice: ({ sheet, table, row, setting }) =>
      `${sheet}, ${table}, строка ${row}: ${setting} указан дважды.`,
    unknownSetting: ({ sheet, table, row, setting }) =>
      `${sheet}, ${table}, строка ${row}: нет настройки с названием "${setting}". Используйте From, To или Limit.`,
    notADate: ({ sheet, table, row, setting }) =>
      `${sheet}, ${table}, строка ${row}: ${setting} — это не дата.`,
    fromAfterTo: ({ sheet, table, row }) =>
      `${sheet}, ${table}, строка ${row}: From позже, чем To.`,
    badLimit: ({ sheet, table, row }) =>
      `${sheet}, ${table}, строка ${row}: лимит должен быть числом больше 0.`,
    unknownName: ({ sheet, table, row, name }) =>
      `${sheet}, ${table}, строка ${row}: в этой таблице нет строки с названием "${name}".`,
    badFirstRow: ({ sheet, table, row }) =>
      `${sheet}, ${table}, строка ${row}: First movement row должен быть целым числом от 1 и больше.`,
    emptyCell: ({ sheet, table, row, setting }) =>
      `${sheet}, ${table}, строка ${row}: ячейка для ${setting} пустая.`,
    noSuchCell: ({ sheet, table, row, cell }) =>
      `${sheet}, ${table}, строка ${row}: в документе нет ячейки ${cell}.`,
    noSuchSheet: ({ sheet, table, row, name }) =>
      `${sheet}, ${table}, строка ${row}: в документе нет листа с названием ${name}.`,
  },
};

// Returns a function that writes one mistake of the App sheet (see app-sheet.js) as a line in
// the language.
export function createMistakeWriter(language) {
  const lines = MISTAKE_LINES[Object.hasOwn(MISTAKE_LINES, language) ? language : FALLBACK];
  return (mistake) => lines[mistake.kind](mistake);
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
