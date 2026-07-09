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
          Build something beautiful
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
          A visual canvas that ships real, production-ready code. Design, publish, done.
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
            <p className="label-doLR">Get Started</p>
          </motion.button>
          <motion.button
            className="button-mKC9"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <p className="label-ifOh">Learn More</p>
          </motion.button>
        </motion.div>
      </section>
    </main>
  );
}
