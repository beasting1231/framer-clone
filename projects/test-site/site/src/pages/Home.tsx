import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Navbar } from "../components/Navbar";
import { blogPosts } from "../cms/data";

export default function Home() {
  return (
    <main className="home-BbrO">
      <Navbar className="navbar-U8jf" overrides={{ "logo-HQM8": {} }} />
      <section className="hero-TzwQ">
        <motion.h1
          className="heading-2dMd"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.7, delay: 0, ease: "easeOut" }}
        >
          Build something beautiful
        </motion.h1>
        <motion.p
          className="subheading--ovp"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
        >
          A visual canvas that ships real, production-ready code. Design, publish, done.
        </motion.p>
        <motion.div
          className="buttons-BU1m"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
        >
          <motion.button
            className="button--VFB"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <p className="label-LaIW">Get Started</p>
          </motion.button>
          <motion.button
            className="button-34it"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <p className="label-QP0L">Learn More</p>
          </motion.button>
        </motion.div>
      </section>
      <section className="features-NR_F">
        <h2 className="heading-brTZ">Everything you need</h2>
        <div className="feature-grid-HDcd">
          <motion.div
            className="visual-canvas-ulum"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0, ease: "easeOut" }}
            whileHover={{ y: -4 }}
          >
            <div className="icon-Hc6l" />
            <h3 className="title-f9kG">Visual canvas</h3>
            <p className="body-WLNC">
              Design directly on an infinite canvas with real layout primitives.
            </p>
          </motion.div>
          <motion.div
            className="real-code-FmQg"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0, ease: "easeOut" }}
            whileHover={{ y: -4 }}
          >
            <div className="icon-SHwA" />
            <h3 className="title-gmkf">Real code</h3>
            <p className="body-1gkx">
              Every save writes a clean React codebase you can open and read.
            </p>
          </motion.div>
          <motion.div
            className="responsive-uz_p"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0, ease: "easeOut" }}
            whileHover={{ y: -4 }}
          >
            <div className="icon-NWmy" />
            <h3 className="title-m4p6">Responsive</h3>
            <p className="body-cHvQ">
              Desktop, tablet and phone breakpoints with cascading overrides.
            </p>
          </motion.div>
        </div>
      </section>
      <footer className="footer-_7pb">
        <p className="brand-z7vd">Brand</p>
        <p className="copyright-13Wh">© 2026 Brand, Inc. All rights reserved.</p>
        <div className="footer-links-1QOn">
          <p className="twitter--Ofb">Twitter</p>
          <p className="github-o-dW">GitHub</p>
          <p className="contact-XFbr">Contact</p>
        </div>
      </footer>
      <div className="blog-posts-list-l4SN">
        {blogPosts.map((entry) => (
          <Link key={entry.slug} to={`/blog-posts/${entry.slug}`}>
            <motion.div className="card-Udsz" whileHover={{ y: -4 }}>
              <img className="cover-3SFf" src={entry.image} alt="" style={{ objectFit: "cover" }} />
              <div className="body-x8BJ">
                <h3 className="title-ZS-g">{entry.title}</h3>
                <p className="summary-kuAA">{entry.summary}</p>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </main>
  );
}
