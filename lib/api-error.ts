import { NextResponse } from 'next/server';
import { PublishGateError } from './posts';

/** Maps repository errors onto API responses; the gate returns 422 with its blockers. */
export function errorResponse(err: unknown) {
  if (err instanceof PublishGateError) {
    return NextResponse.json(
      { error: 'Publish gate not satisfied', blocking: err.blocking },
      { status: 422 }
    );
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  return NextResponse.json({ error: message }, { status: 400 });
}
