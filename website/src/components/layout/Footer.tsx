import Link from "next/link";
import { properties } from "@/lib/data/mock";

const property = properties[0];

const navLinks = [
  { href: "/properties", label: "The Houses" },
  { href: "/restaurants", label: "Restaurants" },
  { href: "/housemakers", label: "The Housemakers" },
  { href: "/events", label: "Events" },
  { href: "/contact", label: "Contact" },
];

const socialLinks = [
  { href: "https://instagram.com/goodroomhouse", label: "Instagram" },
  { href: "https://twitter.com/goodroomhouse", label: "Twitter" },
];

export default function Footer() {
  return (
    <footer className="border-t border-accent-gold/20 bg-background-dark">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="font-display text-lg tracking-[0.2em] text-text-inverse/80"
            >
              GOOD ROOM HOUSE
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-text-inverse/50 max-w-xs">
              A boutique, experience-first, design-forward micro resort &
              community-led hospitality brand.
            </p>

            <div className="mt-6 space-y-3">
              <a
                href={property.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm leading-relaxed text-text-inverse/40 hover:text-accent-gold transition-colors duration-300"
              >
                {property.address}
              </a>
              <a
                href={`tel:${property.phone.replace(/\s/g, "")}`}
                className="block text-sm text-text-inverse/40 hover:text-accent-gold transition-colors duration-300"
              >
                {property.phone}
              </a>
            </div>

            {property.coordinates && (
              <div className="mt-6 w-full max-w-xs aspect-[4/3] border border-accent-gold/10 overflow-hidden">
                <iframe
                  src={`https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d3000!2d${property.coordinates.lng}!3d${property.coordinates.lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sin!4v1`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`${property.name} location`}
                />
              </div>
            )}
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-accent-gold/70 font-body font-medium mb-4">
              Explore
            </h4>
            <ul className="space-y-3">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-inverse/50 hover:text-accent-gold transition-colors duration-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Social & Legal */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-accent-gold/70 font-body font-medium mb-4">
              Connect
            </h4>
            <ul className="space-y-3">
              {socialLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-text-inverse/50 hover:text-accent-gold transition-colors duration-300"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <a
                href="mailto:hello@goodroomhouse.com"
                className="text-sm text-accent-gold/70 hover:text-accent-gold transition-colors duration-300"
              >
                hello@goodroomhouse.com
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-inverse/30">
            &copy; {new Date().getFullYear()} Good Room House. All rights
            reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="text-xs text-text-inverse/30 hover:text-text-inverse/50 transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-xs text-text-inverse/30 hover:text-text-inverse/50 transition-colors"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
