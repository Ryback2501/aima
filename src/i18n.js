// The words the app shows, in English, Spanish and Russian.
// The app uses the phone's language. If the app does not have that language, it uses English.

export const STRINGS = {
  en: {
    signIn: 'Sign in with Google',
    checking: 'Checking your access…',
    noAccess: "You don't have access to this document. Ask its owner to share it with you.",
    signInFailed: 'Sign-in did not finish. Please try again.',
    expired: 'Your sign-in has expired. Please sign in again.',
    error: 'Something went wrong. Please try again.',
    notConfigured: 'This app is not set up yet.',
    signedOut: 'You have signed out.',
    signedInAs: 'Signed in as {email}',
    signOut: 'Sign out',
    empty: 'There is no briefing yet.',
  },
  es: {
    signIn: 'Iniciar sesión con Google',
    checking: 'Comprobando tu acceso…',
    noAccess: 'No tienes acceso a este documento. Pide a su propietario que lo comparta contigo.',
    signInFailed: 'No se completó el inicio de sesión. Inténtalo de nuevo.',
    expired: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
    error: 'Algo salió mal. Inténtalo de nuevo.',
    notConfigured: 'Esta aplicación aún no está configurada.',
    signedOut: 'Has cerrado sesión.',
    signedInAs: 'Sesión iniciada como {email}',
    signOut: 'Cerrar sesión',
    empty: 'Todavía no hay ningún resumen.',
  },
  ru: {
    signIn: 'Войти через Google',
    checking: 'Проверяем ваш доступ…',
    noAccess: 'У вас нет доступа к этому документу. Попросите владельца открыть вам доступ.',
    signInFailed: 'Вход не завершён. Попробуйте ещё раз.',
    expired: 'Срок входа истёк. Пожалуйста, войдите снова.',
    error: 'Что-то пошло не так. Попробуйте ещё раз.',
    notConfigured: 'Это приложение ещё не настроено.',
    signedOut: 'Вы вышли из аккаунта.',
    signedInAs: 'Вы вошли как {email}',
    signOut: 'Выйти',
    empty: 'Сводки пока нет.',
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
    if (base in STRINGS) return base;
  }
  return FALLBACK;
}

// Returns a function that gives the text for a message key, for example t("signOut").
// Values like {email} are filled in from the second argument.
export function createTranslator(language) {
  const strings = STRINGS[language] ?? STRINGS[FALLBACK];
  return (key, values = {}) => {
    const text = strings[key] ?? STRINGS[FALLBACK][key] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
  };
}
