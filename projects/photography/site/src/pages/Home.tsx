import { motion } from "framer-motion";

export default function Home() {
  return (
    <main className="home-vYq4">
      <motion.nav
        className="navbar-rsY5"
        initial={{ top: -40, opacity: 0 }}
        whileInView={{ top: [-40, 0], opacity: [0, 1] }}
        viewport={{ once: true, amount: "some", pctFromBottom: 0, margin: "0px 0px -0% 0px" }}
        transition={{
          top: { type: "tween", duration: 0.65, times: [0, 1], ease: [[0, 0, 0.58, 1]] },
          opacity: { type: "tween", duration: 0.65, times: [0, 1], ease: [[0, 0, 0.58, 1]] },
        }}
      >
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
      </motion.nav>
      <section className="hero-2wQK">
        <motion.h1
          className="heading-6MbH"
          initial={{ top: 42, filter: "blur(14px)", opacity: 0 }}
          animate={{ top: [40, 0, 0], opacity: [0, 1, 1] }}
          whileInView={{
            top: [42, 0, 0],
            filter: ["blur(14px)", "blur(0px)", "blur(0px)"],
            opacity: [0, 1, 1],
          }}
          viewport={{ once: true, amount: "some", pctFromBottom: 10, margin: "0px 0px -10% 0px" }}
          transition={{
            top: {
              type: "tween",
              duration: 1.04,
              times: [0, 0.7692307692307693, 1],
              ease: [
                [0, 0, 0.58, 1],
                [0, 0, 1, 1],
              ],
            },
            filter: {
              type: "tween",
              duration: 1.04,
              times: [0, 0.7692307692307693, 1],
              ease: [
                [0, 0, 0.58, 1],
                [0, 0, 1, 1],
              ],
            },
            opacity: {
              type: "tween",
              duration: 1.04,
              times: [0, 0.7692307692307693, 1],
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
          initial={{ top: 42, filter: "blur(14px)", opacity: 0 }}
          animate={{ top: [40, 40, 0, 0], opacity: [0, 0, 1, 1] }}
          whileInView={{
            top: [42, 42, 0, 0],
            filter: ["blur(14px)", "blur(14px)", "blur(0px)", "blur(0px)"],
            opacity: [0, 0, 1, 1],
          }}
          viewport={{ once: true, amount: "some", pctFromBottom: 10, margin: "0px 0px -10% 0px" }}
          transition={{
            top: {
              type: "tween",
              duration: 1.04,
              times: [0, 0.11538461538461539, 0.8846153846153846, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
                [0, 0, 1, 1],
              ],
            },
            filter: {
              type: "tween",
              duration: 1.04,
              times: [0, 0.11538461538461539, 0.8846153846153846, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
                [0, 0, 1, 1],
              ],
            },
            opacity: {
              type: "tween",
              duration: 1.04,
              times: [0, 0.11538461538461539, 0.8846153846153846, 1],
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
          initial={{ top: 42, filter: "blur(14px)", opacity: 0 }}
          animate={{ top: [40, 40, 0, 0], opacity: [0, 0, 1, 1] }}
          whileInView={{
            top: [42, 42, 0],
            filter: ["blur(14px)", "blur(14px)", "blur(0px)"],
            opacity: [0, 0, 1],
          }}
          viewport={{ once: true, amount: "some", pctFromBottom: 10, margin: "0px 0px -10% 0px" }}
          transition={{
            top: {
              type: "tween",
              duration: 1.04,
              times: [0, 0.23076923076923078, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
              ],
            },
            filter: {
              type: "tween",
              duration: 1.04,
              times: [0, 0.23076923076923078, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
              ],
            },
            opacity: {
              type: "tween",
              duration: 1.04,
              times: [0, 0.23076923076923078, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
              ],
            },
          }}
        >
          <motion.button
            className="button-mKC9"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <p className="label-ifOh">Book a Session</p>
          </motion.button>
        </motion.div>
        <motion.button
          className="button-Gpb2"
          data-custom-code-node="Gpb2c6EJ7n"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          initial={{ top: 40, opacity: 0 }}
          animate={{ top: [40, 40, 0], opacity: [0, 0, 1] }}
          transition={{
            top: {
              type: "tween",
              duration: 1.15,
              times: [0, 0.391304347826087, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
              ],
            },
            opacity: {
              type: "tween",
              duration: 1.15,
              times: [0, 0.391304347826087, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
              ],
            },
          }}
        >
          <style
            dangerouslySetInnerHTML={{
              __html:
                '[data-custom-code-node="Gpb2c6EJ7n"] { position: relative; overflow: hidden; } [data-custom-code-node="Gpb2c6EJ7n"] .shimmer-label { position: relative; z-index: 1; } [data-custom-code-node="Gpb2c6EJ7n"]::before { content: ""; position: absolute; top: 0; bottom: 0; left: -75%; width: 50%; background: linear-gradient(120deg, transparent, rgba(255,255,255,0.45), transparent); transform: skewX(-20deg); pointer-events: none; transition: none; } [data-custom-code-node="Gpb2c6EJ7n"]:hover::before { left: 125%; transition: left 700ms ease-out; }',
            }}
          />
          <div
            dangerouslySetInnerHTML={{
              __html: '<span class="shimmer-label">View Portfolio</span>',
            }}
          />
        </motion.button>
      </section>
      <motion.section
        className="pricing-fr2a"
        initial={{ top: 42, filter: "blur(14px)", opacity: 0 }}
        whileInView={{ top: [42, 0], filter: ["blur(14px)", "blur(0px)"], opacity: [0, 1] }}
        viewport={{ once: true, amount: "some", pctFromBottom: 20, margin: "0px 0px -20% 0px" }}
        transition={{
          top: { type: "tween", duration: 0.8, times: [0, 1], ease: [[0, 0, 0.58, 1]] },
          filter: { type: "tween", duration: 0.8, times: [0, 1], ease: [[0, 0, 0.58, 1]] },
          opacity: { type: "tween", duration: 0.8, times: [0, 1], ease: [[0, 0, 0.58, 1]] },
        }}
      >
        <h2 className="heading-ObJN">Simple pricing</h2>
        <div className="plans-wsIi">
          <motion.div
            className="starter-eC0y"
            initial={{ top: 42, filter: "blur(14px)", opacity: 0 }}
            whileInView={{
              top: [42, 0, 0],
              filter: ["blur(14px)", "blur(0px)", "blur(0px)"],
              opacity: [0, 1, 1],
            }}
            viewport={{ once: true, amount: "some", pctFromBottom: 20, margin: "0px 0px -20% 0px" }}
            transition={{
              top: {
                type: "tween",
                duration: 0.94,
                times: [0, 0.7446808510638298, 1],
                ease: [
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
              filter: {
                type: "tween",
                duration: 0.94,
                times: [0, 0.7446808510638298, 1],
                ease: [
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
              opacity: {
                type: "tween",
                duration: 0.94,
                times: [0, 0.7446808510638298, 1],
                ease: [
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
            }}
          >
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
          </motion.div>
          <motion.div
            className="pro-ds9Q"
            initial={{ top: 42, filter: "blur(14px)", opacity: 0 }}
            whileInView={{
              top: [42, 42, 0, 0],
              filter: ["blur(14px)", "blur(14px)", "blur(0px)", "blur(0px)"],
              opacity: [0, 0, 1, 1],
            }}
            viewport={{ once: true, amount: "some", pctFromBottom: 20, margin: "0px 0px -20% 0px" }}
            transition={{
              top: {
                type: "tween",
                duration: 0.94,
                times: [0, 0.1276595744680851, 0.8723404255319149, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
              filter: {
                type: "tween",
                duration: 0.94,
                times: [0, 0.1276595744680851, 0.8723404255319149, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
              opacity: {
                type: "tween",
                duration: 0.94,
                times: [0, 0.1276595744680851, 0.8723404255319149, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
            }}
          >
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
          </motion.div>
          <motion.div
            className="team-acTh"
            initial={{ top: 42, filter: "blur(14px)", opacity: 0 }}
            whileInView={{
              top: [42, 42, 0],
              filter: ["blur(14px)", "blur(14px)", "blur(0px)"],
              opacity: [0, 0, 1],
            }}
            viewport={{ once: true, amount: "some", pctFromBottom: 20, margin: "0px 0px -20% 0px" }}
            transition={{
              top: {
                type: "tween",
                duration: 0.94,
                times: [0, 0.2553191489361702, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                ],
              },
              filter: {
                type: "tween",
                duration: 0.94,
                times: [0, 0.2553191489361702, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                ],
              },
              opacity: {
                type: "tween",
                duration: 0.94,
                times: [0, 0.2553191489361702, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                ],
              },
            }}
          >
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
          </motion.div>
        </div>
      </motion.section>
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
