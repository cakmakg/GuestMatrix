import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  // Generierte / Artefakt-Dateien — vom Linting ausschließen. supabase/.temp entsteht lokal
  // beim `supabase start` (gebündelte Edge-Runtime) und ist git-ignoriert; flat config liest
  // .gitignore nicht automatisch, daher hier explizit.
  { ignores: ['next-env.d.ts', '.next/**', 'node_modules/**', 'supabase/.temp/**'] },

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
