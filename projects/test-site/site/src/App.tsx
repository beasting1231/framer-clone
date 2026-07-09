import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import BlogPostsDetail from "./pages/BlogPostsDetail";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/blog-posts/:slug" element={<BlogPostsDetail />} />
      </Routes>
    </BrowserRouter>
  );
}
