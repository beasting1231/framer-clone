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
            <div className="image-hover-1-hero">
              <motion.img
                className="image-copy-copy-X00A"
                src="/assets/akshay-madivanan-zachggmtx-w-unsplash-1.jpg"
                alt=""
                style={{ objectFit: "cover" }}
                initial={{ top: 48, opacity: 0, filter: "blur(14px)" }}
                animate={{
                  top: [48, 48, 0],
                  opacity: [0, 0, 1],
                  filter: ["blur(14px)", "blur(14px)", "blur(0px)"],
                }}
                transition={{
                  top: {
                    type: "tween",
                    duration: 1.25,
                    times: [0, 0.16, 1],
                    ease: [
                      [0, 0, 1, 1],
                      [0.42, 0, 0.58, 1],
                    ],
                  },
                  opacity: {
                    type: "tween",
                    duration: 1.25,
                    times: [0, 0.16, 1],
                    ease: [
                      [0, 0, 1, 1],
                      [0, 0, 0.58, 1],
                    ],
                  },
                  filter: {
                    type: "tween",
                    duration: 1.25,
                    times: [0, 0.16, 1],
                    ease: [
                      [0, 0, 1, 1],
                      [0, 0, 0.58, 1],
                    ],
                  },
                }}
              />
            </div>
            <div className="image-hover-2-hero">
              <motion.img
                className="image-copy-copy-copy--p-5"
                src="/assets/unsplash-_4swbzh5fp8-gray-mercedes-benz-coupe-on-black-asphalt-road-duri.jpg"
                alt=""
                style={{ objectFit: "cover" }}
                initial={{ top: 48, opacity: 0, filter: "blur(14px)" }}
                animate={{
                  top: [48, 48, 0, 0],
                  opacity: [0, 0, 1, 1],
                  filter: ["blur(14px)", "blur(14px)", "blur(0px)", "blur(0px)"],
                }}
                transition={{
                  top: {
                    type: "tween",
                    duration: 1.25,
                    times: [0, 0.08, 0.92, 1],
                    ease: [
                      [0, 0, 1, 1],
                      [0.42, 0, 0.58, 1],
                      [0, 0, 1, 1],
                    ],
                  },
                  opacity: {
                    type: "tween",
                    duration: 1.25,
                    times: [0, 0.08, 0.92, 1],
                    ease: [
                      [0, 0, 1, 1],
                      [0, 0, 0.58, 1],
                      [0, 0, 1, 1],
                    ],
                  },
                  filter: {
                    type: "tween",
                    duration: 1.25,
                    times: [0, 0.08, 0.92, 1],
                    ease: [
                      [0, 0, 1, 1],
                      [0, 0, 0.58, 1],
                      [0, 0, 1, 1],
                    ],
                  },
                }}
              />
            </div>
            <div className="image-hover-3-hero">
              <motion.img
                className="image-copy-copy-copy-copy-ezRD"
                src="/assets/unsplash-5oygrn_r9y4-silhouette-photo-of-man-holding-camera.jpg"
                alt=""
                style={{ objectFit: "cover" }}
                initial={{ top: 48, opacity: 0, filter: "blur(14px)" }}
                animate={{
                  top: [48, 0, 0],
                  opacity: [0, 1, 1],
                  filter: ["blur(14px)", "blur(0px)", "blur(0px)"],
                }}
                transition={{
                  top: {
                    type: "tween",
                    duration: 1.25,
                    times: [0, 0.84, 1],
                    ease: [
                      [0.42, 0, 0.58, 1],
                      [0, 0, 1, 1],
                    ],
                  },
                  opacity: {
                    type: "tween",
                    duration: 1.25,
                    times: [0, 0.84, 1],
                    ease: [
                      [0, 0, 0.58, 1],
                      [0, 0, 1, 1],
                    ],
                  },
                  filter: {
                    type: "tween",
                    duration: 1.25,
                    times: [0, 0.84, 1],
                    ease: [
                      [0, 0, 0.58, 1],
                      [0, 0, 1, 1],
                    ],
                  },
                }}
              />
            </div>
            <div className="image-hover-4-hero">
              <motion.img
                className="image-copy-copy-copy-copy-copy-hT7A"
                src="/assets/unsplash-d3kympveqsw-woman-in-black-spaghetti-strap-top.jpg"
                alt=""
                style={{ objectFit: "cover" }}
                initial={{ top: 48, opacity: 0, filter: "blur(14px)" }}
                animate={{
                  top: [48, 48, 0, 0],
                  opacity: [0, 0, 1, 1],
                  filter: ["blur(14px)", "blur(14px)", "blur(0px)", "blur(0px)"],
                }}
                transition={{
                  top: {
                    type: "tween",
                    duration: 1.25,
                    times: [0, 0.08, 0.92, 1],
                    ease: [
                      [0, 0, 1, 1],
                      [0.42, 0, 0.58, 1],
                      [0, 0, 1, 1],
                    ],
                  },
                  opacity: {
                    type: "tween",
                    duration: 1.25,
                    times: [0, 0.08, 0.92, 1],
                    ease: [
                      [0, 0, 1, 1],
                      [0, 0, 0.58, 1],
                      [0, 0, 1, 1],
                    ],
                  },
                  filter: {
                    type: "tween",
                    duration: 1.25,
                    times: [0, 0.08, 0.92, 1],
                    ease: [
                      [0, 0, 1, 1],
                      [0, 0, 0.58, 1],
                      [0, 0, 1, 1],
                    ],
                  },
                }}
              />
            </div>
            <div className="image-hover-5-hero">
              <motion.img
                className="image-copy-copy-copy-copy-copy-copy-6TXU"
                src="/assets/akshay-madivanan-zachggmtx-w-unsplash-1.jpg"
                alt=""
                style={{ objectFit: "cover" }}
                initial={{ top: 48, opacity: 0, filter: "blur(14px)" }}
                animate={{
                  top: [48, 48, 0],
                  opacity: [0, 0, 1],
                  filter: ["blur(14px)", "blur(14px)", "blur(0px)"],
                }}
                transition={{
                  top: {
                    type: "tween",
                    duration: 1.25,
                    times: [0, 0.16, 1],
                    ease: [
                      [0, 0, 1, 1],
                      [0.42, 0, 0.58, 1],
                    ],
                  },
                  opacity: {
                    type: "tween",
                    duration: 1.25,
                    times: [0, 0.16, 1],
                    ease: [
                      [0, 0, 1, 1],
                      [0, 0, 0.58, 1],
                    ],
                  },
                  filter: {
                    type: "tween",
                    duration: 1.25,
                    times: [0, 0.16, 1],
                    ease: [
                      [0, 0, 1, 1],
                      [0, 0, 0.58, 1],
                    ],
                  },
                }}
              />
            </div>
          </div>
          <CustomCodeRuntime
            className="header-6MbH"
            nodeId={"6MbH9sCCKR"}
            html={
              '<h1 class="blur-title" aria-label="Lumen Studio"><span class="letter l1" aria-hidden="true">L</span><span class="letter l2" aria-hidden="true">u</span><span class="letter l3" aria-hidden="true">m</span><span class="letter l4" aria-hidden="true">e</span><span class="letter l5" aria-hidden="true">n</span><span class="space" aria-hidden="true"> </span><span class="letter l6" aria-hidden="true">S</span><span class="letter l7" aria-hidden="true">t</span><span class="letter l8" aria-hidden="true">u</span><span class="letter l9" aria-hidden="true">d</span><span class="letter l10" aria-hidden="true">i</span><span class="letter l11" aria-hidden="true">o</span></h1>'
            }
            css={
              '[data-custom-code-node="6MbH9sCCKR"] { display:block; } [data-custom-code-node="6MbH9sCCKR"] .blur-title { margin:0; padding:0; font:inherit; color:inherit; line-height:inherit; letter-spacing:inherit; text-align:inherit; text-transform:inherit; text-decoration:inherit; white-space:pre-wrap; } [data-custom-code-node="6MbH9sCCKR"] .letter { display:inline-block; opacity:0; filter:blur(14px); transform:translateY(.36em); will-change:opacity,filter,transform; } [data-custom-code-node="6MbH9sCCKR"] .space { white-space:pre; }'
            }
            behaviors={[
              {
                id: "reveal-title-letters",
                event: "mount",
                target: ":host",
                once: true,
                actions: [
                  {
                    type: "animate",
                    target: ".l1",
                    keyframes: [
                      { opacity: 0, filter: "blur(14px)", transform: "translateY(.36em)" },
                      { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
                    ],
                    duration: 900,
                    delay: 450,
                    easing: "cubic-bezier(.22,1,.36,1)",
                    iterations: 1,
                    direction: "normal",
                    fill: "both",
                    retrigger: "restart",
                  },
                  {
                    type: "animate",
                    target: ".l2",
                    keyframes: [
                      { opacity: 0, filter: "blur(14px)", transform: "translateY(.36em)" },
                      { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
                    ],
                    duration: 900,
                    delay: 495,
                    easing: "cubic-bezier(.22,1,.36,1)",
                    iterations: 1,
                    direction: "normal",
                    fill: "both",
                    retrigger: "restart",
                  },
                  {
                    type: "animate",
                    target: ".l3",
                    keyframes: [
                      { opacity: 0, filter: "blur(14px)", transform: "translateY(.36em)" },
                      { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
                    ],
                    duration: 900,
                    delay: 540,
                    easing: "cubic-bezier(.22,1,.36,1)",
                    iterations: 1,
                    direction: "normal",
                    fill: "both",
                    retrigger: "restart",
                  },
                  {
                    type: "animate",
                    target: ".l4",
                    keyframes: [
                      { opacity: 0, filter: "blur(14px)", transform: "translateY(.36em)" },
                      { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
                    ],
                    duration: 900,
                    delay: 585,
                    easing: "cubic-bezier(.22,1,.36,1)",
                    iterations: 1,
                    direction: "normal",
                    fill: "both",
                    retrigger: "restart",
                  },
                  {
                    type: "animate",
                    target: ".l5",
                    keyframes: [
                      { opacity: 0, filter: "blur(14px)", transform: "translateY(.36em)" },
                      { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
                    ],
                    duration: 900,
                    delay: 630,
                    easing: "cubic-bezier(.22,1,.36,1)",
                    iterations: 1,
                    direction: "normal",
                    fill: "both",
                    retrigger: "restart",
                  },
                  {
                    type: "animate",
                    target: ".l6",
                    keyframes: [
                      { opacity: 0, filter: "blur(14px)", transform: "translateY(.36em)" },
                      { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
                    ],
                    duration: 900,
                    delay: 675,
                    easing: "cubic-bezier(.22,1,.36,1)",
                    iterations: 1,
                    direction: "normal",
                    fill: "both",
                    retrigger: "restart",
                  },
                  {
                    type: "animate",
                    target: ".l7",
                    keyframes: [
                      { opacity: 0, filter: "blur(14px)", transform: "translateY(.36em)" },
                      { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
                    ],
                    duration: 900,
                    delay: 720,
                    easing: "cubic-bezier(.22,1,.36,1)",
                    iterations: 1,
                    direction: "normal",
                    fill: "both",
                    retrigger: "restart",
                  },
                  {
                    type: "animate",
                    target: ".l8",
                    keyframes: [
                      { opacity: 0, filter: "blur(14px)", transform: "translateY(.36em)" },
                      { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
                    ],
                    duration: 900,
                    delay: 765,
                    easing: "cubic-bezier(.22,1,.36,1)",
                    iterations: 1,
                    direction: "normal",
                    fill: "both",
                    retrigger: "restart",
                  },
                  {
                    type: "animate",
                    target: ".l9",
                    keyframes: [
                      { opacity: 0, filter: "blur(14px)", transform: "translateY(.36em)" },
                      { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
                    ],
                    duration: 900,
                    delay: 810,
                    easing: "cubic-bezier(.22,1,.36,1)",
                    iterations: 1,
                    direction: "normal",
                    fill: "both",
                    retrigger: "restart",
                  },
                  {
                    type: "animate",
                    target: ".l10",
                    keyframes: [
                      { opacity: 0, filter: "blur(14px)", transform: "translateY(.36em)" },
                      { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
                    ],
                    duration: 900,
                    delay: 855,
                    easing: "cubic-bezier(.22,1,.36,1)",
                    iterations: 1,
                    direction: "normal",
                    fill: "both",
                    retrigger: "restart",
                  },
                  {
                    type: "animate",
                    target: ".l11",
                    keyframes: [
                      { opacity: 0, filter: "blur(14px)", transform: "translateY(.36em)" },
                      { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
                    ],
                    duration: 900,
                    delay: 900,
                    easing: "cubic-bezier(.22,1,.36,1)",
                    iterations: 1,
                    direction: "normal",
                    fill: "both",
                    retrigger: "restart",
                  },
                ],
              },
            ]}
            animated={true}
            initial={{ top: 40, opacity: 0 }}
            animate={{ top: [40, 0, 0], opacity: [0, 1, 1] }}
            transition={{
              top: {
                type: "tween",
                duration: 1.459,
                times: [0, 0.47978067169294036, 1],
                ease: [
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
              opacity: {
                type: "tween",
                duration: 1.459,
                times: [0, 0.47978067169294036, 1],
                ease: [
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
            }}
          />
          <motion.article
            className="testimonial-card-test"
            initial={{ opacity: 0, filter: "blur(13px)", marginLeft: -45 }}
            animate={{
              opacity: [0, 0, 1, 1],
              filter: ["blur(13px)", "blur(13px)", "blur(0px)", "blur(0px)"],
              marginLeft: [-45, -45, 0, 0],
            }}
            transition={{
              opacity: {
                type: "tween",
                duration: 1.459,
                times: [0, 0.4516792323509253, 0.9314599040438657, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
              filter: {
                type: "tween",
                duration: 1.459,
                times: [0, 0.4516792323509253, 0.9314599040438657, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
              marginLeft: {
                type: "tween",
                duration: 1.459,
                times: [0, 0.4516792323509253, 0.9314599040438657, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0.42, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
            }}
          >
            <p className="quote-test">
              “The pictures turned out beautiful, with a natural style my friends keep
              complimenting.”
            </p>
            <div className="customer-and-rating-test">
              <div className="customer-test">
                <img
                  className="customer-portrait-test"
                  src="/assets/unsplash-d3kympveqsw-woman-in-black-spaghetti-strap-top.jpg"
                  alt="Portrait of Mary Jane"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Mary Jane</p>
              </div>
              <p className="rating-test">★ ★ ★ ★ ★</p>
            </div>
          </motion.article>
          <motion.article
            className="testimonial-card-copy-Q0z9"
            initial={{ marginLeft: 45, filter: "blur(13px)", opacity: 0 }}
            animate={{
              marginLeft: [45, 45, 0],
              filter: ["blur(13px)", "blur(13px)", "blur(0px)"],
              opacity: [0, 0, 1],
            }}
            transition={{
              marginLeft: {
                type: "tween",
                duration: 1.459,
                times: [0, 0.5202193283070596, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0.42, 0, 0.58, 1],
                ],
              },
              filter: {
                type: "tween",
                duration: 1.459,
                times: [0, 0.5202193283070596, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                ],
              },
              opacity: {
                type: "tween",
                duration: 1.459,
                times: [0, 0.5202193283070596, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                ],
              },
            }}
          >
            <p className="quote-Jl0f">
              “The pictures turned out beautiful, with a natural style my friends keep
              complimenting.”
            </p>
            <div className="customer-and-rating-DvYU">
              <div className="customer-sJgw">
                <img
                  className="customer-portrait-_qEA"
                  src="/assets/unsplash-d3kympveqsw-woman-in-black-spaghetti-strap-top.jpg"
                  alt="Portrait of Mary Jane"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-k42P">Mary Jane</p>
              </div>
              <p className="rating-CH1D">★ ★ ★ ★ ★</p>
            </div>
          </motion.article>
        </div>
      </section>
      <CustomCodeRuntime
        className="statistics-stat"
        nodeId={"statsSection01"}
        html={
          '<section class="stats" aria-label="Studio statistics"><div class="stat stat-250"><div class="value" aria-hidden="true"><span class="count"></span><span>+</span></div><span class="sr-only">250 plus</span><p>Projects worked on</p></div><div class="stat stat-98"><div class="value" aria-hidden="true"><span class="count"></span><span>%</span></div><span class="sr-only">98 percent</span><p>Client satisfaction rate</p></div><div class="stat stat-10"><div class="value" aria-hidden="true"><span class="count"></span><span>+</span></div><span class="sr-only">10 plus</span><p>Years of experience</p></div></section>'
        }
        css={
          '@property --count { syntax: \'<integer>\'; initial-value: 0; inherits: false; } [data-custom-code-node="statsSection01"] { display:block; container-type:inline-size; } [data-custom-code-node="statsSection01"] .stats { position:relative; display:flex; justify-content:space-between; align-items:center; max-width:1440px; margin:0 auto; padding:clamp(48px,6vw,88px) clamp(12px,6vw,96px); text-align:center; } [data-custom-code-node="statsSection01"] .stat { min-width:0; opacity:0; filter:blur(14px); transform:translateY(72px); } [data-custom-code-node="statsSection01"] .stat-250, [data-custom-code-node="statsSection01"] .stat-10 { flex:none; width:clamp(33.333%,calc(50% + 810px - 100cqw),50%); } [data-custom-code-node="statsSection01"] .stat-98 { position:absolute; left:33.333%; width:33.333%; max-width:clamp(0px,calc(100cqw - 810px),33.333%); max-height:clamp(0px,calc(100cqw - 810px),200px); overflow:hidden; } [data-custom-code-node="statsSection01"] .value { display:flex; justify-content:center; align-items:baseline; font-family:\'Helvetica Neue\',sans-serif; font-size:clamp(34px,6vw,92px); font-weight:600; line-height:.86; letter-spacing:-.065em; background:linear-gradient(110deg,#b8c9ff 0%,#dc8df1 38%,#f0a3aa 68%,#55d4d1 100%); -webkit-background-clip:text; background-clip:text; color:transparent; } [data-custom-code-node="statsSection01"] .count { --count:0; counter-reset:number var(--count); transition:--count 2000ms cubic-bezier(.22,.61,.36,1); } [data-custom-code-node="statsSection01"] .count::after { content:counter(number); } [data-custom-code-node="statsSection01"] .stat-250 .count.run { --count:250; transition-delay:350ms; } [data-custom-code-node="statsSection01"] .stat-98 .count.run { --count:98; transition-delay:510ms; } [data-custom-code-node="statsSection01"] .stat-10 .count.run { --count:10; transition-delay:670ms; } [data-custom-code-node="statsSection01"] p { margin:12px 0 0; color:#666; font-family:\'Helvetica Neue\',sans-serif; font-size:clamp(11px,1vw,17px); font-weight:400; line-height:1.3; letter-spacing:-.015em; } [data-custom-code-node="statsSection01"] .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }'
        }
        behaviors={[
          {
            id: "start-stats-count",
            event: "mount",
            target: ":host",
            once: true,
            actions: [
              { type: "class", target: ".count", className: "run", operation: "add" },
              {
                type: "animate",
                target: ".stat-250",
                keyframes: [
                  { opacity: 0, filter: "blur(14px)", transform: "translateY(72px)" },
                  { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" },
                ],
                duration: 800,
                delay: 350,
                easing: "cubic-bezier(.16,1,.3,1)",
                iterations: 1,
                direction: "normal",
                fill: "both",
                retrigger: "restart",
              },
              {
                type: "animate",
                target: ".stat-98",
                keyframes: [
                  { opacity: 0, filter: "blur(14px)", transform: "translateY(72px)" },
                  { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" },
                ],
                duration: 800,
                delay: 510,
                easing: "cubic-bezier(.16,1,.3,1)",
                iterations: 1,
                direction: "normal",
                fill: "both",
                retrigger: "restart",
              },
              {
                type: "animate",
                target: ".stat-10",
                keyframes: [
                  { opacity: 0, filter: "blur(14px)", transform: "translateY(72px)" },
                  { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" },
                ],
                duration: 800,
                delay: 670,
                easing: "cubic-bezier(.16,1,.3,1)",
                iterations: 1,
                direction: "normal",
                fill: "both",
                retrigger: "restart",
              },
            ],
          },
        ]}
        animated={false}
      />
      <section className="my-work-work">
        <h2 className="my-work-title-work">my work</h2>
        <div className="work-grid-work">
          <motion.article
            className="food-and-products-work"
            initial={{ top: 56, opacity: 0, filter: "blur(14px)" }}
            whileInView={{
              top: [56, 0, 0],
              opacity: [0, 1, 1],
              filter: ["blur(14px)", "blur(0px)", "blur(0px)"],
            }}
            viewport={{ once: true, amount: "some", pctFromBottom: 15, margin: "0px 0px -15% 0px" }}
            transition={{
              top: {
                type: "tween",
                duration: 1.06,
                times: [0, 0.660377358490566, 1],
                ease: [
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
              opacity: {
                type: "tween",
                duration: 1.06,
                times: [0, 0.660377358490566, 1],
                ease: [
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
              filter: {
                type: "tween",
                duration: 1.06,
                times: [0, 0.660377358490566, 1],
                ease: [
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
            }}
          >
            <motion.div className="food-and-products-media-work" whileHover={{ scale: 1.045 }}>
              <img
                className="work-image-1-work"
                src="/assets/unsplash-jg-6armiapm-man-on-top-of-mountain-taking-pictures.jpg"
                alt="Photographer overlooking a mountain landscape"
                style={{ objectFit: "cover" }}
              />
              <motion.div
                className="food-and-products-overlay-work"
                whileHover={{ scale: 0.957, opacity: 1 }}
              >
                <h3 className="food-and-products-label-work">food and products</h3>
              </motion.div>
            </motion.div>
          </motion.article>
          <motion.article
            className="weddings-work"
            initial={{ top: 56, opacity: 0, filter: "blur(14px)" }}
            whileInView={{
              top: [56, 56, 0, 0],
              opacity: [0, 0, 1, 1],
              filter: ["blur(14px)", "blur(14px)", "blur(0px)", "blur(0px)"],
            }}
            viewport={{ once: true, amount: "some", pctFromBottom: 15, margin: "0px 0px -15% 0px" }}
            transition={{
              top: {
                type: "tween",
                duration: 1.06,
                times: [0, 0.11320754716981132, 0.7735849056603774, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
              opacity: {
                type: "tween",
                duration: 1.06,
                times: [0, 0.11320754716981132, 0.7735849056603774, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
              filter: {
                type: "tween",
                duration: 1.06,
                times: [0, 0.11320754716981132, 0.7735849056603774, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
            }}
          >
            <motion.div className="weddings-media-work" whileHover={{ scale: 1.045 }}>
              <img
                className="work-image-2-work"
                src="/assets/unsplash-d3kympveqsw-woman-in-black-spaghetti-strap-top.jpg"
                alt="Editorial portrait of a woman"
                style={{ objectFit: "cover" }}
              />
              <motion.div
                className="weddings-overlay-work"
                whileHover={{ scale: 0.957, opacity: 1 }}
              >
                <h3 className="weddings-label-work">weddings</h3>
              </motion.div>
            </motion.div>
          </motion.article>
          <motion.article
            className="real-estate-work"
            initial={{ top: 56, opacity: 0, filter: "blur(14px)" }}
            whileInView={{
              top: [56, 56, 0, 0],
              opacity: [0, 0, 1, 1],
              filter: ["blur(14px)", "blur(14px)", "blur(0px)", "blur(0px)"],
            }}
            viewport={{ once: true, amount: "some", pctFromBottom: 15, margin: "0px 0px -15% 0px" }}
            transition={{
              top: {
                type: "tween",
                duration: 1.06,
                times: [0, 0.22641509433962265, 0.8867924528301887, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
              opacity: {
                type: "tween",
                duration: 1.06,
                times: [0, 0.22641509433962265, 0.8867924528301887, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
              filter: {
                type: "tween",
                duration: 1.06,
                times: [0, 0.22641509433962265, 0.8867924528301887, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                  [0, 0, 1, 1],
                ],
              },
            }}
          >
            <motion.div className="real-estate-media-work" whileHover={{ scale: 1.045 }}>
              <img
                className="work-image-3-work"
                src="/assets/unsplash-_4swbzh5fp8-gray-mercedes-benz-coupe-on-black-asphalt-road-duri.jpg"
                alt="Gray coupe photographed on a dark road"
                style={{ objectFit: "cover" }}
              />
              <motion.div
                className="real-estate-overlay-work"
                whileHover={{ scale: 0.957, opacity: 1 }}
              >
                <h3 className="real-estate-label-work">real estate</h3>
              </motion.div>
            </motion.div>
          </motion.article>
          <motion.article
            className="fashion-work"
            initial={{ top: 56, opacity: 0, filter: "blur(14px)" }}
            whileInView={{
              top: [56, 56, 0],
              opacity: [0, 0, 1],
              filter: ["blur(14px)", "blur(14px)", "blur(0px)"],
            }}
            viewport={{ once: true, amount: "some", pctFromBottom: 15, margin: "0px 0px -15% 0px" }}
            transition={{
              top: {
                type: "tween",
                duration: 1.06,
                times: [0, 0.33962264150943394, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                ],
              },
              opacity: {
                type: "tween",
                duration: 1.06,
                times: [0, 0.33962264150943394, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                ],
              },
              filter: {
                type: "tween",
                duration: 1.06,
                times: [0, 0.33962264150943394, 1],
                ease: [
                  [0, 0, 1, 1],
                  [0, 0, 0.58, 1],
                ],
              },
            }}
          >
            <motion.div className="fashion-media-work" whileHover={{ scale: 1.045 }}>
              <img
                className="work-image-4-work"
                src="/assets/unsplash-5oygrn_r9y4-silhouette-photo-of-man-holding-camera.jpg"
                alt="Silhouette of a photographer holding a camera"
                style={{ objectFit: "cover" }}
              />
              <motion.div
                className="fashion-overlay-work"
                whileHover={{ scale: 0.957, opacity: 1 }}
              >
                <h3 className="fashion-label-work">fashion</h3>
              </motion.div>
            </motion.div>
          </motion.article>
        </div>
      </section>
      <section className="testimonials-marquee-test">
        <h2 className="testimonials-title-test">What people say about us</h2>
        <div className="testimonials-rows-test">
          <motion.div
            className="testimonials-top-row-test"
            initial={{ left: -1488 }}
            animate={{ left: [-1488, 0] }}
            transition={{
              left: {
                type: "tween",
                duration: 45,
                times: [0, 1],
                ease: [[0, 0, 1, 1]],
                repeat: null,
                repeatType: "loop",
              },
            }}
          >
            <article className="jane-bliss-testimonial-test">
              <p className="quote-test">
                “The way you captured our day is beyond words. Every photo is a treasure.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="jane-bliss-portrait-test"
                  src="/assets/unsplash-d3kympveqsw-woman-in-black-spaghetti-strap-top.jpg"
                  alt="Portrait of Jane Bliss"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Jane Bliss</p>
                <p className="rating-test">★★★★★</p>
              </div>
            </article>
            <article className="lukas-meyer-testimonial-test">
              <p className="quote-test">
                “The whole session was fun and effortless. Every final shot was full of energy and
                character.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="lukas-meyer-portrait-test"
                  src="/assets/unsplash-jg-6armiapm-man-on-top-of-mountain-taking-pictures.jpg"
                  alt="Portrait of Lukas Meyer"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Lukas Meyer</p>
                <p className="rating-test">★★★</p>
              </div>
            </article>
            <article className="emma-laurent-testimonial-test">
              <p className="quote-test">
                “I arrived nervous, but it quickly became such a relaxed experience. The photos feel
                completely like me.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="emma-laurent-portrait-test"
                  src="/assets/akshay-madivanan-zachggmtx-w-unsplash-1.jpg"
                  alt="Portrait of Emma Laurent"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Emma Laurent</p>
                <p className="rating-test">★★★★★</p>
              </div>
            </article>
            <article className="noah-bennett-testimonial-test">
              <p className="quote-test">
                “Every frame feels honest and beautifully considered. We could not be happier with
                the result.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="noah-bennett-portrait-test"
                  src="/assets/unsplash-5oygrn_r9y4-silhouette-photo-of-man-holding-camera.jpg"
                  alt="Portrait of Noah Bennett"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Noah Bennett</p>
                <p className="rating-test">★★★★</p>
              </div>
            </article>
            <article className="jane-bliss-testimonial-test">
              <p className="quote-test">
                “The way you captured our day is beyond words. Every photo is a treasure.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="jane-bliss-portrait-test"
                  src="/assets/unsplash-d3kympveqsw-woman-in-black-spaghetti-strap-top.jpg"
                  alt="Portrait of Jane Bliss"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Jane Bliss</p>
                <p className="rating-test">★★★★★</p>
              </div>
            </article>
            <article className="lukas-meyer-testimonial-test">
              <p className="quote-test">
                “The whole session was fun and effortless. Every final shot was full of energy and
                character.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="lukas-meyer-portrait-test"
                  src="/assets/unsplash-jg-6armiapm-man-on-top-of-mountain-taking-pictures.jpg"
                  alt="Portrait of Lukas Meyer"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Lukas Meyer</p>
                <p className="rating-test">★★★</p>
              </div>
            </article>
            <article className="emma-laurent-testimonial-test">
              <p className="quote-test">
                “I arrived nervous, but it quickly became such a relaxed experience. The photos feel
                completely like me.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="emma-laurent-portrait-test"
                  src="/assets/akshay-madivanan-zachggmtx-w-unsplash-1.jpg"
                  alt="Portrait of Emma Laurent"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Emma Laurent</p>
                <p className="rating-test">★★★★★</p>
              </div>
            </article>
            <article className="noah-bennett-testimonial-test">
              <p className="quote-test">
                “Every frame feels honest and beautifully considered. We could not be happier with
                the result.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="noah-bennett-portrait-test"
                  src="/assets/unsplash-5oygrn_r9y4-silhouette-photo-of-man-holding-camera.jpg"
                  alt="Portrait of Noah Bennett"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Noah Bennett</p>
                <p className="rating-test">★★★★</p>
              </div>
            </article>
          </motion.div>
          <motion.div
            className="testimonials-bottom-row-test"
            initial={{ left: 0 }}
            animate={{ left: [0, -1488] }}
            transition={{
              left: {
                type: "tween",
                duration: 45,
                times: [0, 1],
                ease: [[0, 0, 1, 1]],
                repeat: null,
                repeatType: "loop",
              },
            }}
          >
            <article className="emma-laurent-testimonial-test">
              <p className="quote-test">
                “I arrived nervous, but it quickly became such a relaxed experience. The photos feel
                completely like me.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="emma-laurent-portrait-test"
                  src="/assets/akshay-madivanan-zachggmtx-w-unsplash-1.jpg"
                  alt="Portrait of Emma Laurent"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Emma Laurent</p>
                <p className="rating-test">★★★★★</p>
              </div>
            </article>
            <article className="jane-bliss-testimonial-test">
              <p className="quote-test">
                “The way you captured our day is beyond words. Every photo is a treasure.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="jane-bliss-portrait-test"
                  src="/assets/unsplash-d3kympveqsw-woman-in-black-spaghetti-strap-top.jpg"
                  alt="Portrait of Jane Bliss"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Jane Bliss</p>
                <p className="rating-test">★★★★★</p>
              </div>
            </article>
            <article className="noah-bennett-testimonial-test">
              <p className="quote-test">
                “Every frame feels honest and beautifully considered. We could not be happier with
                the result.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="noah-bennett-portrait-test"
                  src="/assets/unsplash-5oygrn_r9y4-silhouette-photo-of-man-holding-camera.jpg"
                  alt="Portrait of Noah Bennett"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Noah Bennett</p>
                <p className="rating-test">★★★★</p>
              </div>
            </article>
            <article className="lukas-meyer-testimonial-test">
              <p className="quote-test">
                “The whole session was fun and effortless. Every final shot was full of energy and
                character.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="lukas-meyer-portrait-test"
                  src="/assets/unsplash-jg-6armiapm-man-on-top-of-mountain-taking-pictures.jpg"
                  alt="Portrait of Lukas Meyer"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Lukas Meyer</p>
                <p className="rating-test">★★★</p>
              </div>
            </article>
            <article className="emma-laurent-testimonial-test">
              <p className="quote-test">
                “I arrived nervous, but it quickly became such a relaxed experience. The photos feel
                completely like me.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="emma-laurent-portrait-test"
                  src="/assets/akshay-madivanan-zachggmtx-w-unsplash-1.jpg"
                  alt="Portrait of Emma Laurent"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Emma Laurent</p>
                <p className="rating-test">★★★★★</p>
              </div>
            </article>
            <article className="jane-bliss-testimonial-test">
              <p className="quote-test">
                “The way you captured our day is beyond words. Every photo is a treasure.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="jane-bliss-portrait-test"
                  src="/assets/unsplash-d3kympveqsw-woman-in-black-spaghetti-strap-top.jpg"
                  alt="Portrait of Jane Bliss"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Jane Bliss</p>
                <p className="rating-test">★★★★★</p>
              </div>
            </article>
            <article className="noah-bennett-testimonial-test">
              <p className="quote-test">
                “Every frame feels honest and beautifully considered. We could not be happier with
                the result.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="noah-bennett-portrait-test"
                  src="/assets/unsplash-5oygrn_r9y4-silhouette-photo-of-man-holding-camera.jpg"
                  alt="Portrait of Noah Bennett"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Noah Bennett</p>
                <p className="rating-test">★★★★</p>
              </div>
            </article>
            <article className="lukas-meyer-testimonial-test">
              <p className="quote-test">
                “The whole session was fun and effortless. Every final shot was full of energy and
                character.”
              </p>
              <div className="customer-and-rating-test">
                <img
                  className="lukas-meyer-portrait-test"
                  src="/assets/unsplash-jg-6armiapm-man-on-top-of-mountain-taking-pictures.jpg"
                  alt="Portrait of Lukas Meyer"
                  style={{ objectFit: "cover" }}
                />
                <p className="customer-name-test">Lukas Meyer</p>
                <p className="rating-test">★★★</p>
              </div>
            </article>
          </motion.div>
          <div className="left-fade-test" />
          <div className="right-fade-test" />
        </div>
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
