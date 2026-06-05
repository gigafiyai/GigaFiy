interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
      <div>
        <h1 className="text-lg font-semibold text-text font-display tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-text-light mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
