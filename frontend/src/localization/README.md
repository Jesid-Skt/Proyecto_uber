# Frontend localization

Use `useLocalization()` inside components below `DriverProvider`. It follows
`profile.language` (`Español` / `Inglés`) without a second language store.
Missing profiles and unsupported values default to Spanish. Settings persists
changes through the existing `setLanguage` action; failed saves keep the current language.

`t('Spanish source message', { parameter: value })` has typed catalog keys.
Add messages to both `es.ts` and `en.ts`; English coverage is checked by TypeScript.
Use whole sentences with named placeholders instead of concatenated fragments.
`translateText` is for known existing errors and domain display values only;
unknown server messages are preserved. Never translate API values, addresses,
names, or user input. Currency formatting always uses COP, without conversion.

Covered: Home, registration, Profile/Settings, Earnings, Login, trip requests,
pickup/active-trip navigation, payment and summary screens, trip history and
details, root/drawer titles, menu and slide accessibility text. Registration
uses the selected draft language; the remaining screens follow `profile.language`.
Shared form fields expose translated labels to accessibility services.

Arbitrary backend/native error text and OS permission dialogs are not translated;
unknown server messages and user-provided data are intentionally preserved.

Run: `node --experimental-strip-types --test src/localization/localization.test.ts`.
