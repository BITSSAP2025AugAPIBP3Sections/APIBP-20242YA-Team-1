import { motion } from "framer-motion";

const footerLinks = {
  Product: ["Features", "Pricing", "Security", "Roadmap"],
  Company: ["About", "Blog", "Careers", "Press"],
  Resources: ["Documentation", "Help Center", "Community", "Contact"],
  Legal: ["Privacy", "Terms", "Cookies", "Licenses"],
};

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container px-4 md:px-8 mx-auto py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="text-xl font-bold mb-4">vendorIQ.ai</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Automation That Pays Off
            </p>
          </div>

          {/* Links Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} vendorIQ.ai
          </p>
          <div className="flex gap-6">
            <a href="https://github.com/BITSSAP2025AugAPIBP3Sections/APIBP-20242YA-Team-1" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
