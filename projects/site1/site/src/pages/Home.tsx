import { motion } from "framer-motion";

export default function Home() {
  return (
    <main className="home-0_Gu">
      <motion.nav
        className="navbar-UbiJ"
        initial={{ top: -75 }}
        animate={{ top: [-75, -75, 0, 0] }}
        transition={{
          top: {
            type: "tween",
            duration: 1.4,
            times: [0, 0.25, 0.6721428571428572, 1],
            ease: [
              [0, 0, 1, 1],
              [0, 0, 0.58, 1],
              [0, 0, 1, 1],
            ],
          },
        }}
      >
        <p className="logo-HzFo">Brand</p>
        <div className="nav-links-EPpH">
          <p className="product-3Dkx">Product</p>
          <p className="features-YOq7">Features</p>
          <p className="pricing-pouN">Pricing</p>
          <p className="about-ihhz">About</p>
        </div>
        <motion.button
          className="button-60YW"
          whileHover={{ rotate: 6 }}
          whileTap={{ scale: 0.97 }}
        >
          <p className="label-9yBP">Sign Up</p>
        </motion.button>
      </motion.nav>
      <section className="hero-qUrO">
        <motion.h1
          className="heading-9hrK"
          initial={{ top: 40, opacity: 0, filter: "blur(15px)" }}
          animate={{
            top: [40, 40, 0, 0],
            opacity: [0, 0, 1, 1],
            filter: ["blur(15px)", "blur(15px)", "blur(0px)", "blur(0px)"],
          }}
          transition={{
            top: {
              type: "tween",
              duration: 1.4,
              times: [0, 0.14285714285714285, 0.6785714285714286, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
                [0, 0, 1, 1],
              ],
            },
            opacity: {
              type: "tween",
              duration: 1.4,
              times: [0, 0.14285714285714285, 0.6821428571428572, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
                [0, 0, 1, 1],
              ],
            },
            filter: {
              type: "tween",
              duration: 1.4,
              times: [0, 0.14285714285714285, 0.6785714285714286, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
                [0, 0, 1, 1],
              ],
            },
          }}
        >
          hero title
        </motion.h1>
        <motion.p
          className="subheading-NclO"
          initial={{ top: 40, opacity: 0, filter: "blur(15px)" }}
          animate={{
            top: [40, 40, 0, 0],
            opacity: [0, 0, 1, 1],
            filter: ["blur(15px)", "blur(15px)", "blur(0px)", "blur(0px)"],
          }}
          transition={{
            top: {
              type: "tween",
              duration: 1.4,
              times: [0, 0.25, 0.7857142857142857, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
                [0, 0, 1, 1],
              ],
            },
            opacity: {
              type: "tween",
              duration: 1.4,
              times: [0, 0.25, 0.7857142857142857, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
                [0, 0, 1, 1],
              ],
            },
            filter: {
              type: "tween",
              duration: 1.4,
              times: [0, 0.25, 0.7857142857142857, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
                [0, 0, 1, 1],
              ],
            },
          }}
        >
          A visual canvas that ships real, production-ready code. Design, publish, done.
        </motion.p>
        <motion.div
          className="buttons-orlB"
          initial={{ filter: "blur(15px)", opacity: 0, top: 40 }}
          animate={{
            filter: ["blur(15px)", "blur(15px)", "blur(0px)"],
            opacity: [0, 0, 1],
            top: [40, 40, 0],
          }}
          transition={{
            filter: {
              type: "tween",
              duration: 1.4,
              times: [0, 0.35714285714285715, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
              ],
            },
            opacity: {
              type: "tween",
              duration: 1.4,
              times: [0, 0.35714285714285715, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
              ],
            },
            top: {
              type: "tween",
              duration: 1.4,
              times: [0, 0.35714285714285715, 1],
              ease: [
                [0, 0, 1, 1],
                [0, 0, 0.58, 1],
              ],
            },
          }}
        >
          <motion.button
            className="button-dMDo"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <p className="label-dOyj">Get Started</p>
          </motion.button>
          <motion.button
            className="button-pIL4"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <p className="label-1pSb">Learn More</p>
          </motion.button>
        </motion.div>
      </section>
      <section className="features-fRkH">
        <motion.h2
          className="heading-Lcoz"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, x: 0, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0, ease: "easeOut" }}
          whileHover={{ scale: 1.03 }}
        >
          Everything you need
        </motion.h2>
        <div className="feature-grid-e4Wn">
          <motion.div
            className="visual-canvas-IDYu"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0, ease: "easeOut" }}
            whileHover={{ y: -4 }}
          >
            <div className="icon-h7RN" />
            <h3 className="title-9GMo">Visual canvas</h3>
            <p className="body-6fXC">
              Design directly on an infinite canvas with real layout primitives.
            </p>
          </motion.div>
          <motion.div
            className="real-code-aSBB"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0, ease: "easeOut" }}
            whileHover={{ y: -4 }}
          >
            <div className="icon-w48n" />
            <h3 className="title-KAcd">Real code</h3>
            <p className="body-R8IR">
              Every save writes a clean React codebase you can open and read.
            </p>
          </motion.div>
          <motion.div
            className="responsive-82Gr"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0, ease: "easeOut" }}
            whileHover={{ y: -4 }}
          >
            <div className="icon-B0su" />
            <h3 className="title-8BKM">Responsive</h3>
            <p className="body-5CAK">
              Desktop, tablet and phone breakpoints with cascading overrides.
            </p>
          </motion.div>
          <motion.div
            className="responsive-copy-bY8C"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0, ease: "easeOut" }}
            whileHover={{ y: -4 }}
          >
            <div className="icon-EY5q" />
            <h3 className="title-6yco">Responsive</h3>
            <p className="body-XXwG">
              Desktop, tablet and phone breakpoints with cascading overrides.
            </p>
          </motion.div>
        </div>
      </section>
      <section className="cta-vZer">
        <h2 className="heading-ysnE">Ready to start?</h2>
        <motion.button
          className="button-K24a"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <p className="label-Q54I">Get Started Free</p>
        </motion.button>
      </section>
      <section className="pricing-KjFd">
        <h2 className="heading-5z1k">Simple pricing</h2>
        <div className="plans-Vane">
          <div className="starter-RCfW">
            <p className="plan-o89X">Starter</p>
            <p className="price-qj4L">$0</p>
            <div className="features-FLet">
              <p className="1-project-urhZ">✓ 1 project</p>
              <p className="community-support-4bpW">✓ Community support</p>
              <p className="basic-features-v_TZ">✓ Basic features</p>
            </div>
            <motion.button
              className="button-ThD_"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <p className="label-tRTA">Choose plan</p>
            </motion.button>
          </div>
          <div className="pro-E2ux">
            <p className="plan-9GQq">Pro</p>
            <p className="price-y--z">$19</p>
            <div className="features-CwYq">
              <p className="unlimited-projects--vyo">✓ Unlimited projects</p>
              <p className="priority-support-6SiK">✓ Priority support</p>
              <p className="all-features-DFKH">✓ All features</p>
              <p className="custom-domain-u9cF">✓ Custom domain</p>
            </div>
            <motion.button
              className="button-zpt6"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <p className="label-XGJj">Choose plan</p>
            </motion.button>
          </div>
          <div className="team-0Ztn">
            <p className="plan-ox7b">Team</p>
            <p className="price-0lUt">$49</p>
            <div className="features-tXay">
              <p className="everything-in-pro-oMNB">✓ Everything in Pro</p>
              <p className="5-team-seats-vkk_">✓ 5 team seats</p>
              <p className="shared-libraries-qdLB">✓ Shared libraries</p>
            </div>
            <motion.button
              className="button-NN7A"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <p className="label-ORDa">Choose plan</p>
            </motion.button>
          </div>
        </div>
      </section>
      <footer className="footer-WHkT">
        <p className="brand-lSQ8">Brand</p>
        <p className="copyright-9DGu">© 2026 Brand, Inc. All rights reserved.</p>
        <div className="footer-links-YNvv">
          <p className="twitter-FNnk">Twitter</p>
          <p className="github-U43z">GitHub</p>
          <p className="contact-XFHR">Contact</p>
        </div>
      </footer>
    </main>
  );
}
