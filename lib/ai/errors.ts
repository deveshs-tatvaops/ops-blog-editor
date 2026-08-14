import { NextResponse } from 'next/server';
import { MissingApiKeyError } from './client';

export function aiError(err: unknown) {
  if (err instanceof MissingApiKeyError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  const message = err instanceof Error ? err.message : 'AI request failed';
  return NextResponse.json({ error: message }, { status: 500 });
}
