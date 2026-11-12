import type { ReactNode } from "react";

export type FooterLink = { name: string; href: string; external?: boolean };
export type FooterSection = { title: string; links: FooterLink[] };
export type FooterSocial = { label: string; href: string; icon: ReactNode };

type Props = {
  logo: { src: string; alt: string; width: number; height: number };
  /** Short credit shown above the logo, e.g. who built the site. */
  credit?: string;
  description: string;
  sections: FooterSection[];
  socialLinks: FooterSocial[];
  copyright: string;
  topHref?: string;
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

export function SiteFooter({ logo, credit, description, sections, socialLinks, copyright, topHref = "#beranda" }: Props) {
  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <div className="site-footer-brand">
          <div className="site-footer-credit">
            {credit && <span>{credit}</span>}
            <img className="site-footer-logo" src={logo.src} alt={logo.alt} width={logo.width} height={logo.height} loading="lazy" />
          </div>
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
        <a href={topHref}>Kembali ke atas ↑</a>
      </div>
    </footer>
  );
}
