interface SectionProps {
  title: string;
  children: React.ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-bold text-heading mb-3">{title}</h2>
      {children}
    </section>
  );
}
