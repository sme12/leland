import { createInstance } from 'i18next';
import { beforeEach, describe, expect, it } from 'vitest';

import { configureI18n, languageStorageKey } from './index';
import { defaultLanguage, normalizeLanguage, resources } from './resources';

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

  it('renders Russian material-count plural forms', async () => {
    const instance = configureI18n(createInstance(), {
      useLanguageDetector: false,
    });

    await instance.changeLanguage('ru');

    expect(instance.t('material.groupCount', { count: 1 })).toBe('1 материал');
    expect(instance.t('material.groupCount', { count: 2 })).toBe('2 материала');
    expect(instance.t('material.groupCount', { count: 5 })).toBe(
      '5 материалов',
    );
  });

  it('normalizes supported language variants', () => {
    expect(normalizeLanguage('RU')).toBe('ru');
    expect(normalizeLanguage('ru_RU')).toBe('ru');
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('fr_FR')).toBe(defaultLanguage);
  });
});
