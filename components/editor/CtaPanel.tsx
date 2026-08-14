'use client';

import type { Service } from '@/lib/types';
import type { EditorForm } from './state';
import { Field, Panel } from './ui';

export function CtaPanel({
  form,
  set,
  services,
}: {
  form: EditorForm;
  set: <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => void;
  services: Service[];
}) {
  const value = form.cta_service_id === 'auto' ? 'auto' : form.cta_service_id ?? '';

  function pick(next: string) {
    if (next === 'auto') {
      set('cta_service_id', 'auto');
      // Auto-detect resolves at save time from the content; keep the current link editable.
      return;
    }
    const id = next ? Number(next) : null;
    set('cta_service_id', id);
    if (!form.ctaLinkTouched) {
      const svc = services.find((s) => s.id === (id ?? form.primary_service_id));
      set('cta_link_url', svc?.cta_default_url ?? '');
    }
  }

  return (
    <Panel title="Call to action">
      <Field label="Service" hint="Defaults to the primary service.">
        <select className="input" value={value} onChange={(e) => pick(e.target.value)}>
          <option value="">Same as primary service</option>
          <option value="auto">Auto-detect from content</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="CTA link URL">
        <input
          className="input"
          value={form.cta_link_url}
          onChange={(e) => {
            set('cta_link_url', e.target.value);
            set('ctaLinkTouched', true);
          }}
          placeholder="/services/interior#enquire"
        />
      </Field>

      <Field
        label="CTA button label"
        hint="Controls the button at the end of the post and the sticky CTA."
      >
        <input
          className="input"
          value={form.cta_button_label}
          onChange={(e) => set('cta_button_label', e.target.value)}
          placeholder="Enquire Now"
        />
      </Field>
    </Panel>
  );
}
