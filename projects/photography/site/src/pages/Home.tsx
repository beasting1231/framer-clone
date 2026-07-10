import { motion } from "framer-motion";
import { CustomCodeRuntime } from "../CustomCodeRuntime";

export default function Home() {
  return (
    <main className="home-vYq4">
      <motion.nav
        className="navbar-rsY5"
        initial={{ marginTop: -40, opacity: 0 }}
        whileInView={{ marginTop: [-40, 0], opacity: [0, 1] }}
        viewport={{ once: true, amount: "some", pctFromBottom: 0, margin: "0px 0px -0% 0px" }}
        transition={{
          marginTop: { type: "tween", duration: 0.65, times: [0, 1], ease: [[0, 0, 0.58, 1]] },
          opacity: { type: "tween", duration: 0.65, times: [0, 1], ease: [[0, 0, 0.58, 1]] },
        }}
      >
        <div className="navwrapper-PjU6">
          <p className="logo-swaB">Lumen</p>
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
            <p className="label-tiVC">Book A Session</p>
          </motion.button>
        </div>
        <div className="mobile-navbar-mobi">
          <p className="mobile-logo-mobi">Lumen</p>
          <CustomCodeRuntime
            className="mobile-menu-mobi"
            nodeId={"mobileNavMenu"}
            html={
              '<span class="hamburger" aria-hidden="true"><span></span><span></span><span></span></span><span class="mobile-menu"><span>Product</span><span>Features</span><span>Pricing</span><span>About</span></span>'
            }
            css={
              '[data-custom-code-node="mobileNavMenu"] { position: relative; width: 32px; height: 32px; padding: 0; overflow: visible; background: transparent; border: 0; box-shadow: none; } [data-custom-code-node="mobileNavMenu"] .hamburger { display: flex; width: 22px; height: 16px; flex-direction: column; justify-content: space-between; } [data-custom-code-node="mobileNavMenu"] .hamburger span { display: block; width: 22px; height: 2px; border-radius: 2px; background: #000000; transition: transform 220ms ease, opacity 220ms ease; } [data-custom-code-node="mobileNavMenu"] .mobile-menu { position: absolute; z-index: 1000; display: flex; visibility: hidden; opacity: 0; transform: translateY(-10px); top: 48px; right: 0; width: 200px; padding: 10px; gap: 2px; flex-direction: column; border-radius: 16px; background: #D1D1D1; color: #000000; box-shadow: 0 16px 35px rgba(0,0,0,0.18); transition: opacity 220ms ease, transform 220ms ease, visibility 220ms ease; } [data-custom-code-node="mobileNavMenu"] .mobile-menu span { display: block; padding: 11px 12px; text-align: left; border-radius: 10px; } [data-custom-code-node="mobileNavMenu"].open .mobile-menu { visibility: visible; opacity: 1; transform: translateY(0); } [data-custom-code-node="mobileNavMenu"].open .hamburger span:nth-child(1) { transform: translateY(7px) rotate(45deg); } [data-custom-code-node="mobileNavMenu"].open .hamburger span:nth-child(2) { opacity: 0; } [data-custom-code-node="mobileNavMenu"].open .hamburger span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }'
            }
            behaviors={[
              {
                id: "toggle-phone-menu",
                event: "click",
                target: ":host",
                once: false,
                actions: [
                  { type: "class", target: ":host", className: "open", operation: "toggle" },
                ],
              },
            ]}
            animated={false}
          />
        </div>
      </motion.nav>
      <section className="hero-2wQK">
        <div className="hero-wrapper-6CNN">
          <div className="imagewrapper-NeXF">
            <img
              className="image-copy-copy-X00A"
              src="/assets/akshay-madivanan-zachggmtx-w-unsplash-1.jpg"
              alt=""
              style={{ objectFit: "cover" }}
            />
            <img
              className="image-copy-copy-copy--p-5"
              src="/assets/akshay-madivanan-zachggmtx-w-unsplash-1.jpg"
              alt=""
              style={{ objectFit: "cover" }}
            />
            <img
              className="image-copy-copy-copy-copy-ezRD"
              src="/assets/akshay-madivanan-zachggmtx-w-unsplash-1.jpg"
              alt=""
              style={{ objectFit: "cover" }}
            />
            <img
              className="image-copy-copy-copy-copy-copy-hT7A"
              src="/assets/akshay-madivanan-zachggmtx-w-unsplash-1.jpg"
              alt=""
              style={{ objectFit: "cover" }}
            />
            <img
              className="image-copy-copy-copy-copy-copy-copy-6TXU"
              src="/assets/akshay-madivanan-zachggmtx-w-unsplash-1.jpg"
              alt=""
              style={{ objectFit: "cover" }}
            />
          </div>
          <motion.h1
            className="header-6MbH"
            initial={{ top: 42, filter: "blur(14px)", opacity: 0 }}
            animate={{ top: [40, 0], opacity: [0, 1] }}
            whileInView={{ top: [42, 0], filter: ["blur(14px)", "blur(0px)"], opacity: [0, 1] }}
            viewport={{ once: true, amount: "some", pctFromBottom: 10, margin: "0px 0px -10% 0px" }}
            transition={{
              top: { type: "tween", duration: 0.8, times: [0, 1], ease: [[0, 0, 0.58, 1]] },
              filter: { type: "tween", duration: 0.8, times: [0, 1], ease: [[0, 0, 0.58, 1]] },
              opacity: { type: "tween", duration: 0.8, times: [0, 1], ease: [[0, 0, 0.58, 1]] },
            }}
          >
            Lumen Studio
          </motion.h1>
        </div>
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
