import { createInstance } from 'i18next';
import { beforeEach, describe, expect, it } from 'vitest';

import { configureI18n, languageStorageKey } from './index';
import { defaultLanguage, resources } from './resources';

function collectKeys(value: unknown, prefix = ''): Array<string> {
  if (!value || typeof value !== 'object') {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const nestedPrefix = prefix ? `${prefix}.${key}` : key;

    return collectKeys(nestedValue, nestedPrefix);
  });
}

describe('i18n', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to English when no language has been persisted', () => {
    const instance = configureI18n(createInstance(), {
      useLanguageDetector: true,
    });

    expect(instance.language).toBe(defaultLanguage);
    expect(instance.t('nav.signIn')).toBe('Sign in');
  });

  it('restores the persisted language from localStorage', () => {
    window.localStorage.setItem(languageStorageKey, 'ru');

    const instance = configureI18n(createInstance(), {
      useLanguageDetector: true,
    });

    expect(instance.language).toBe('ru');
    expect(instance.t('nav.signIn')).toBe('Войти');
  });

  it('persists language changes to localStorage', async () => {
    const instance = configureI18n(createInstance(), {
      useLanguageDetector: true,
    });

    await instance.changeLanguage('ru');

    expect(window.localStorage.getItem(languageStorageKey)).toBe('ru');
  });

  it('keeps English and Russian resource keys in sync', () => {
    const englishKeys = collectKeys(resources.en.translation).sort();
    const russianKeys = collectKeys(resources.ru.translation).sort();

    expect(russianKeys).toEqual(englishKeys);
  });
});
