import type { NextRequest } from 'next/server'

import { handleRouteError, ValidationError } from '@/lib/auth/errors'
import { requireAnyAuth } from '@/lib/auth/session'
import { deleteSubmission } from '@/lib/submissions/delete-submission'
import { submissionIdParam } from '@/lib/validation/schemas'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
): Promise<Response> {
  try {
    const rawParams = await params
    const parsedParams = submissionIdParam.safeParse(rawParams)
    if (!parsedParams.success) throw new ValidationError('Invalid submission ID.')

    // Session vorausgesetzt (401, wenn keine); die Ownership-Prüfung erfolgt in der DB (RPCs).
    await requireAnyAuth()
    await deleteSubmission(parsedParams.data.submissionId)

    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
