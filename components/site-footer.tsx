import type { ReactNode } from "react";

export type FooterLink = { name: string; href: string; external?: boolean };
export type FooterSection = { title: string; links: FooterLink[] };
export type FooterSocial = { label: string; href: string; icon: ReactNode };
type Image = { src: string; alt: string; width: number; height: number };

type Props = {
  /** Who the site belongs to: emblem plus two lines of name, styled like the header. */
  brand: { href: string; logo: Image; line1: string; line2: string };
  /** Who built the site, shown small in the bottom-right corner. */
  credit: { label: string; logo: Image };
  description: string;
  sections: FooterSection[];
  socialLinks: FooterSocial[];
  copyright: string;
};

// External links open in a new tab, so say so for screen readers too.
function FooterAnchor({ link }: { link: FooterLink }) {
  if (!link.external) return <a href={link.href}>{link.name}</a>;
  return (
    <a href={link.href} target="_blank" rel="noopener noreferrer">
      {link.name}
      <span className="sr-only"> (buka di tab baru)</span>
    </a>
  );
}

export function SiteFooter({ brand, credit, description, sections, socialLinks, copyright }: Props) {
  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <div className="site-footer-brand">
          <a className="brand" href={brand.href}>
            <img src={brand.logo.src} alt={brand.logo.alt} width={brand.logo.width} height={brand.logo.height} />
            <span>
              {brand.line1}
              <br />
              <strong>{brand.line2}</strong>
            </span>
          </a>
          <p>{description}</p>
          <ul className="site-footer-social">
            {socialLinks.map((social) => (
              <li key={social.href}>
                <a href={social.href} target="_blank" rel="noopener noreferrer" aria-label={`${social.label} (buka di tab baru)`}>
                  {social.icon}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <nav className="site-footer-columns" aria-label="Tautan footer">
          {sections.map((section) => (
            <div key={section.title}>
              <h3>{section.title}</h3>
              <ul>
                {section.links.map((link) => (
                  <li key={link.href}>
                    <FooterAnchor link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="site-footer-bottom">
        <p>{copyright}</p>
        <div className="site-footer-credit">
          <span>{credit.label}</span>
          <img className="site-footer-logo" src={credit.logo.src} alt={credit.logo.alt} width={credit.logo.width} height={credit.logo.height} loading="lazy" />
        </div>
      </div>
    </footer>
  );
}
