// Artist photo with an initial as the fallback. Plain <img> because photos are
// artist-supplied URLs on arbitrary hosts.
export function Avatar({ name, photoUrl, size = 44 }: { name: string; photoUrl?: string | null; size?: number }) {
  const style = { width: size, height: size };
  if (photoUrl) {
    return <img src={photoUrl} alt={name} style={style} className="rounded-full object-cover border border-border shrink-0" />;
  }
  return (
    <span
      style={{ ...style, fontSize: Math.round(size * 0.4) }}
      className="rounded-full bg-accent-blue-bg border border-accent-blue/20 flex items-center justify-center text-accent-blue font-semibold shrink-0"
    >
      {name.charAt(0)}
    </span>
  );
}
