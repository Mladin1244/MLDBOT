const SUPPORTED_LANGUAGES = ['ro', 'en'];
const DEFAULT_LANGUAGE = 'en';

function normalizeLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
}

function getPreferredLanguage(db, user) {
  const language = db.getUser(user.id, user.username).language;
  return language === null ? null : normalizeLanguage(language);
}

function savePreferredLanguage(db, user, language) {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new Error('Limba trebuie să fie „ro” sau „en”.');
  }
  db.setLanguage(user.id, user.username, language);
  return language;
}

module.exports = {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getPreferredLanguage,
  normalizeLanguage,
  savePreferredLanguage
};
