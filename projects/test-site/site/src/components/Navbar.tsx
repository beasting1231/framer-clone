import { motion } from "framer-motion";

export interface NavbarProps {
  className?: string;
  overrides?: Record<string, { text?: string; src?: string; visible?: boolean }>;
}

export function Navbar({ className = "", overrides = {} }: NavbarProps) {
  return (
    <nav className={`navbar-XUuh ${className}`}>
      <p className="logo-HQM8">{overrides["logo-HQM8"]?.text ?? "Brand"}</p>
      <div className="nav-links-tvhE">
        <p className="product-CCnP">{overrides["product-CCnP"]?.text ?? "Product"}</p>
        <p className="features-lDsy">{overrides["features-lDsy"]?.text ?? "Features"}</p>
        <p className="pricing-uNHa">{overrides["pricing-uNHa"]?.text ?? "Pricing"}</p>
        <p className="about-lqRq">{overrides["about-lqRq"]?.text ?? "About"}</p>
      </div>
      <motion.button
        className="button-2-wD"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        <p className="label-ZlDb">{overrides["label-ZlDb"]?.text ?? "Sign Up"}</p>
      </motion.button>
    </nav>
  );
}
