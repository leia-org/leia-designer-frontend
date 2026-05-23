interface PersonaAvatarProps {
  name?: string;
  src?: string;
  className?: string;
}

export function PersonaAvatar({
  name = "Persona",
  src,
  className = "h-12 w-12 rounded-lg",
}: PersonaAvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (src) {
    return (
      <img
        src={src}
        alt={`${name} avatar`}
        className={`${className} flex-none object-cover border border-gray-200 bg-gray-100`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`${className} flex-none border border-gray-200 bg-gray-100 flex items-center justify-center text-gray-500 font-semibold`}
      aria-label={`${name} avatar placeholder`}
      role="img"
    >
      {initials || "P"}
    </div>
  );
}
