export function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
