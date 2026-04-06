type Props = {
  status: "OPEN" | "CLOSED";
  className?: string;
};

export function StatusDot({ status, className = "" }: Props) {
  if (status === "OPEN") {
    return (
      <span className={`relative inline-flex h-2.5 w-2.5 ${className}`} title="Open">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 ${className}`}
      title="Closed"
    />
  );
}
