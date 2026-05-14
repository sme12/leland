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
        customers: 'Customers',
        servicePrices: 'Service prices',
        signIn: 'Sign in',
        signOut: 'Sign out',
      },
      common: {
        back: 'Back',
        close: 'Close',
        ok: 'OK',
        undo: 'Undo',
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
      validation: {
        generic: 'Check this field.',
        idRequired: 'Missing record id.',
        customerNameRequired: 'Enter a customer name.',
        money: 'Enter a non-negative price with up to 2 decimals.',
      },
      customer: {
        title: 'Customers',
        subtitle: 'Create and maintain the client list.',
        add: 'Add customer',
        newTitle: 'New customer',
        editTitle: 'Edit customer',
        create: 'Create customer',
        save: 'Save customer',
        loading: 'Loading customers...',
        emptyActive: 'No active customers yet.',
        emptyArchived: 'No archived customers.',
        statusLabel: 'Customer status',
        status: {
          active: 'Active',
          archived: 'Archived',
        },
        fields: {
          name: 'Name',
          comment: 'Comment',
        },
        editNamed: 'Edit {{name}}',
        archiveNamed: 'Archive {{name}}',
        restoreNamed: 'Restore {{name}}',
        confirmArchive: 'Archive {{name}}?',
        confirmRestore: 'Restore {{name}}?',
        notFoundTitle: 'Customer not found',
        notFoundBody: 'This customer may have been archived or removed.',
        backToList: 'Back to customers',
        saveFailed: 'Could not save customer',
        saveFailedDescription: 'Check your connection and try again.',
      },
      service: {
        cut: 'Cut',
        color: 'Color',
        cutAndColor: 'Cut + Color',
        treatment: 'Treatment',
        other: 'Other',
        saved: 'Price saved',
        savedDescription: 'The default service price was updated.',
      },
      servicePrices: {
        title: 'Service prices',
        subtitle: 'Default charges used later by visit entry.',
        loading: 'Loading service prices...',
        setPrice: 'set price',
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
        customers: 'Клиенты',
        servicePrices: 'Цены услуг',
        signIn: 'Войти',
        signOut: 'Выйти',
      },
      common: {
        back: 'Назад',
        close: 'Закрыть',
        ok: 'ОК',
        undo: 'Отменить',
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
      validation: {
        generic: 'Проверьте поле.',
        idRequired: 'Не найден id записи.',
        customerNameRequired: 'Введите имя клиента.',
        money: 'Введите неотрицательную цену, максимум 2 знака после запятой.',
      },
      customer: {
        title: 'Клиенты',
        subtitle: 'Список клиентов для будущих визитов.',
        add: 'Добавить клиента',
        newTitle: 'Новый клиент',
        editTitle: 'Редактировать клиента',
        create: 'Создать клиента',
        save: 'Сохранить клиента',
        loading: 'Загрузка клиентов...',
        emptyActive: 'Активных клиентов пока нет.',
        emptyArchived: 'Архивных клиентов нет.',
        statusLabel: 'Статус клиентов',
        status: {
          active: 'Активные',
          archived: 'Архив',
        },
        fields: {
          name: 'Имя',
          comment: 'Комментарий',
        },
        editNamed: 'Редактировать {{name}}',
        archiveNamed: 'Архивировать {{name}}',
        restoreNamed: 'Восстановить {{name}}',
        confirmArchive: 'Архивировать {{name}}?',
        confirmRestore: 'Восстановить {{name}}?',
        notFoundTitle: 'Клиент не найден',
        notFoundBody: 'Возможно, клиент был перемещён в архив или удалён.',
        backToList: 'К списку клиентов',
        saveFailed: 'Не удалось сохранить',
        saveFailedDescription: 'Проверьте подключение и попробуйте снова.',
      },
      service: {
        cut: 'Стрижка',
        color: 'Окрашивание',
        cutAndColor: 'Стрижка и окрашивание',
        treatment: 'Уход',
        other: 'Другое',
        saved: 'Цена сохранена',
        savedDescription: 'Цена услуги по умолчанию обновлена.',
      },
      servicePrices: {
        title: 'Цены услуг',
        subtitle: 'Цены по умолчанию для будущих визитов.',
        loading: 'Загрузка цен услуг...',
        setPrice: 'указать цену',
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
