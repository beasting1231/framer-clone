import { useParams } from "react-router-dom";
import { blogPosts } from "../cms/data";

export default function BlogPostsDetail() {
  const { slug } = useParams();
  const entry = blogPosts.find((e) => e.slug === slug);
  if (!entry) {
    return <div style={{ padding: 64, fontFamily: "Inter, sans-serif" }}>Not found</div>;
  }
  return (
    <main className="blog-posts-detail-WKrn">
      <article className="content-4IHi">
        <h1 className="title-DvT7">{entry.title}</h1>
        <img className="cover-UoM-" src={entry.image} alt="" style={{ objectFit: "cover" }} />
      </article>
    </main>
  );
}
