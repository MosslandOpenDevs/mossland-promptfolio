import next from 'eslint-config-next/core-web-vitals';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  { ignores: ['.next/**', 'dist/**', 'node_modules/**', 'next-env.d.ts'] },
  ...next,
  {
    // Pre-existing patterns that predate the Next 16 / react-hooks v6 upgrade.
    // Surfaced as warnings to revisit (see docs/ROADMAP.md "Future"), not blockers:
    //  - the app intentionally uses full-page <a> navigation (zine aesthetic)
    //  - purity/set-state-in-effect are perf hints on already-shipped client logic
    rules: {
      '@next/next/no-html-link-for-pages': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default config;
