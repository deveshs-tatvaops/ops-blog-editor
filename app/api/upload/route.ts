import { NextResponse } from 'next/server';
import { MediaError, storeUpload } from '@/lib/media';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file supplied' }, { status: 400 });
    }
    const stored = await storeUpload(file, { enforceAspect: form.get('enforceAspect') === '16:9' });
    return NextResponse.json(stored);
  } catch (err) {
    if (err instanceof MediaError) return NextResponse.json({ error: err.message }, { status: 400 });
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
