import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  // Von Next.js automatisch generierte Dateien — vom Linting ausschließen
  { ignores: ['next-env.d.ts', '.next/**', 'node_modules/**'] },

  ...compat.extends(
    'next/core-web-vitals',
    'next/typescript',
    'prettier', // prettier muss zuletzt stehen — deaktiviert konfliktauslösende Regeln
  ),
  {
    rules: {
      // 'any' verboten (CLAUDE.md-Regel) — zusätzliche Absicherung neben TypeScript strict
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // console.log unterdrücken; für dauerhafte Logs ist der Projekt-Logger zu verwenden
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]

export default eslintConfig
