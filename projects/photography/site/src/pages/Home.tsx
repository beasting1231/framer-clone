import { motion } from "framer-motion";

export default function Home() {
  return (
    <main className="home-vYq4">
      <nav className="navbar-rsY5">
        <p className="logo-swaB">Brand</p>
        <div className="nav-links-6xzu">
          <p className="product-s1Ps">Product</p>
          <p className="features-hL1Z">Features</p>
          <p className="pricing-zw_J">Pricing</p>
          <p className="about-70VZ">About</p>
        </div>
        <motion.button
          className="button-dxxL"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <p className="label-tiVC">Sign Up</p>
        </motion.button>
      </nav>
      <section className="hero-2wQK">
        <motion.h1
          className="heading-6MbH"
          initial={{ top: 40, opacity: 0 }}
          animate={{ top: [40, 0, 0], opacity: [0, 1, 1] }}
          transition={{
            top: {
              type: "tween",
              duration: 1,
              times: [0, 0.7, 1],
              ease: [
                [0, 0, 0.58, 1],
                [0, 0, 1, 1],
              ],
            },
            opacity: {
              type: "tween",
              duration: 1,
              times: [0, 0.7, 1],
              ease: [
                [0, 0, 0.58, 1],
                [0, 0, 1, 1],
              ],
            },
          }}
        >
          Capture the moments that matter
        </motion.h1>
        <motion.p
          className="subheading-guKe"
          initial={{ top: 40, opacity: 0 }}
          animate={{ top: [40, 40, 0, 0], opacity: [0, 0, 1, 1] }}
          transition={{
            top: {
              type: "tween",
              duration: 1,
              times: [0, 0.15, 0.85, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
                [0, 0, 1, 1],
              ],
            },
            opacity: {
              type: "tween",
              duration: 1,
              times: [0, 0.15, 0.85, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
                [0, 0, 1, 1],
              ],
            },
          }}
        >
          Elegant photography for portraits, weddings, and stories worth preserving.
        </motion.p>
        <motion.div
          className="buttons-NkCL"
          initial={{ top: 40, opacity: 0 }}
          animate={{ top: [40, 40, 0], opacity: [0, 0, 1] }}
          transition={{
            top: {
              type: "tween",
              duration: 1,
              times: [0, 0.3, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
              ],
            },
            opacity: {
              type: "tween",
              duration: 1,
              times: [0, 0.3, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
              ],
            },
          }}
        >
          <motion.button
            className="button-Gpb2"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <p className="label-doLR">View Portfolio</p>
          </motion.button>
          <motion.button
            className="button-mKC9"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <p className="label-ifOh">Book a Session</p>
          </motion.button>
        </motion.div>
      </section>
      <section className="pricing-fr2a">
        <h2 className="heading-ObJN">Simple pricing</h2>
        <div className="plans-wsIi">
          <div className="starter-eC0y">
            <p className="plan-dnez">Starter</p>
            <p className="price-T_1-">$0</p>
            <div className="features-fqTM">
              <p className="1-project-uC0D">✓ 1 project</p>
              <p className="community-support-EqlZ">✓ Community support</p>
              <p className="basic-features-qbxE">✓ Basic features</p>
            </div>
            <motion.button
              className="button-ZmiA"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <p className="label-pg18">Choose plan</p>
            </motion.button>
          </div>
          <div className="pro-ds9Q">
            <p className="plan-n-TW">Pro</p>
            <p className="price-_s3v">$19</p>
            <div className="features-U6WM">
              <p className="unlimited-projects-VBJI">✓ Unlimited projects</p>
              <p className="priority-support-K_BW">✓ Priority support</p>
              <p className="all-features-RGbl">✓ All features</p>
              <p className="custom-domain-dlWO">✓ Custom domain</p>
            </div>
            <motion.button
              className="button-VBuf"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <p className="label-4B6e">Choose plan</p>
            </motion.button>
          </div>
          <div className="team-acTh">
            <p className="plan-VYsp">Team</p>
            <p className="price-_FRx">$49</p>
            <div className="features-fO0M">
              <p className="everything-in-pro-EM1f">✓ Everything in Pro</p>
              <p className="5-team-seats-Ybed">✓ 5 team seats</p>
              <p className="shared-libraries-YvvR">✓ Shared libraries</p>
            </div>
            <motion.button
              className="button-Fa3v"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <p className="label-dkaP">Choose plan</p>
            </motion.button>
          </div>
        </div>
      </section>
      <section className="contact-omEK">
        <div className="contact-copy-agjz">
          <h2 className="heading-OrAJ">Get in touch</h2>
          <p className="body-8Crx">Tell us about your project and we will get back to you soon.</p>
        </div>
        <form className="contact-form-w-Qe">
          <input className="name-input-MZbJ" type="text" placeholder="Name" />
          <input className="email-input-0mo1" type="email" placeholder="Email" />
          <textarea className="message-nEGr" placeholder="Message" />
          <motion.button
            className="button-WF4I"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <p className="label-KZRY">Send Message</p>
          </motion.button>
        </form>
      </section>
      <footer className="footer-PbzE">
        <p className="brand-GC_K">Brand</p>
        <p className="copyright-byaE">© 2026 Brand, Inc. All rights reserved.</p>
        <div className="footer-links-HToc">
          <p className="twitter-LjpZ">Twitter</p>
          <p className="github-Qya8">GitHub</p>
          <p className="contact-6VHh">Contact</p>
        </div>
      </footer>
    </main>
  );
}
