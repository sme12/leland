import i18n, { createInstance } from 'i18next';
import type { i18n as I18nInstance } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import { defaultLanguage, resources, supportedLanguages } from './resources';

export const languageStorageKey = 'i18nextLng';

type ConfigureI18nOptions = {
  useLanguageDetector?: boolean;
};

export function configureI18n(
  instance: I18nInstance = createInstance(),
  options: ConfigureI18nOptions = {},
) {
  const shouldUseDetector =
    options.useLanguageDetector ?? typeof window !== 'undefined';

  if (instance.isInitialized) {
    return instance;
  }

  if (shouldUseDetector) {
    instance.use(LanguageDetector);
  }

  instance.use(initReactI18next);

  void instance.init({
    resources,
    fallbackLng: defaultLanguage,
    supportedLngs: supportedLanguages,
    lng: shouldUseDetector ? undefined : defaultLanguage,
    detection: {
      caches: ['localStorage'],
      lookupLocalStorage: languageStorageKey,
      order: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
    initAsync: false,
    returnNull: false,
  });

  return instance;
}

export const appI18n = configureI18n(i18n);
