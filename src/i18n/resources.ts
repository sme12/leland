export const defaultLanguage = 'en';

export const supportedLanguages = ['en', 'ru'] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export const resources = {
  en: {
    translation: {
      app: {
        name: 'Leland',
      },
      nav: {
        home: 'Home',
        signIn: 'Sign in',
        signOut: 'Sign out',
      },
      language: {
        label: 'Language',
        en: 'English',
        ru: 'Russian',
      },
      auth: {
        signInTitle: 'Sign in to Leland',
        signInIntro: 'Use one of the provisioned Clerk accounts.',
        signingOut: 'Signing out',
      },
      home: {
        hello: 'Hello, {{name}}',
        fallbackName: 'there',
      },
    },
  },
  ru: {
    translation: {
      app: {
        name: 'Leland',
      },
      nav: {
        home: 'Главная',
        signIn: 'Войти',
        signOut: 'Выйти',
      },
      language: {
        label: 'Язык',
        en: 'Английский',
        ru: 'Русский',
      },
      auth: {
        signInTitle: 'Вход в Leland',
        signInIntro: 'Используйте один из созданных аккаунтов Clerk.',
        signingOut: 'Выходим из аккаунта',
      },
      home: {
        hello: 'Привет, {{name}}',
        fallbackName: 'друг',
      },
    },
  },
} as const;

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return supportedLanguages.includes(value as SupportedLanguage);
}

export function normalizeLanguage(
  value: string | undefined,
): SupportedLanguage {
  if (!value) {
    return defaultLanguage;
  }

  const normalizedBase = value.toLowerCase().replaceAll('_', '-').split('-')[0];

  return isSupportedLanguage(normalizedBase) ? normalizedBase : defaultLanguage;
}
