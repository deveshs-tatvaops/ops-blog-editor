'use client';

import { useEffect, useState } from 'react';

export function CtaBlock({ label, href, service }: { label: string; href: string; service: string }) {
  return (
    <section className="mt-12 overflow-hidden rounded-2xl bg-indigo950 px-6 py-10 text-white sm:px-10">
      <p className="eyebrow !text-brand-300">Ready when you are</p>
      <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">
        Get a verified {service.toLowerCase()} partner on your project
      </h2>
      <p className="mt-3 max-w-xl text-white/70">
        Verified partners, transparent pricing and milestone-linked payments — talk to the TatvaOps team
        and get a written estimate.
      </p>
      <a href={href} className="btn-primary mt-6">
        {label}
      </a>
    </section>
  );
}

/** Sticky bar that appears once the reader is into the article, on desktop and mobile. */
export function StickyCta({ label, href, title }: { label: string; href: string; title: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white/95 backdrop-blur transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3">
        <p className="hidden truncate font-display text-sm font-semibold sm:block">{title}</p>
        <a href={href} className="btn-primary w-full sm:w-auto">
          {label}
        </a>
      </div>
    </div>
  );
}
