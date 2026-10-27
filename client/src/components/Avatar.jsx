export default function Avatar({ name = '?', hue = 260, size = 'md', title }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join('');
  const cls = size === 'sm' ? 'avatar avatar--sm' : size === 'lg' ? 'avatar avatar--lg' : 'avatar';
  return (
    <span
      className={cls}
      title={title || name}
      style={{ background: `linear-gradient(145deg, hsl(${hue} 72% 62%), hsl(${(hue + 30) % 360} 65% 48%))` }}
    >
      {initials}
    </span>
  );
}
