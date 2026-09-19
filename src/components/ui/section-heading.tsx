import Link from "next/link";

export function SectionHeading({ kicker, title, description, href }: { kicker?: string; title: string; description?: string; href?: string }) {
  return (
    <div className="section-heading">
      <div>{kicker && <span className="eyebrow">{kicker}</span>}<h2>{title}</h2>{description && <p>{description}</p>}</div>
      {href && <Link href={href}>عرض الكل ←</Link>}
    </div>
  );
}
