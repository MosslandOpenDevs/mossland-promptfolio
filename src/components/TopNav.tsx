"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface TopNavProps {
  navItems: Array<{
    href: string;
    label: string;
  }>;
}

export default function TopNav({ navItems }: TopNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="pf-nav" aria-label="Primary">
      {navItems.map((item) => {
        const active = isActive(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={`${active ? "Current page: " : "Go to "}${item.label}`}
            aria-current={active ? "page" : undefined}
            className={active ? "pf-nav-item pf-nav-item--active" : "pf-nav-item"}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
