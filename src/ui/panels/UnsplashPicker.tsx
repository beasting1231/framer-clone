import { useState, type FormEvent } from "react";
import { api, type UnsplashAsset, type UnsplashPhoto, type UnsplashResolution } from "@/api/client";

const RESOLUTIONS: Array<{ id: UnsplashResolution; label: string; maxWidth: number | null }> = [
  { id: "small", label: "Small", maxWidth: 400 },
  { id: "regular", label: "Regular", maxWidth: 1080 },
  { id: "full", label: "Full", maxWidth: null },
];

function resolutionSize(photo: UnsplashPhoto, resolution: UnsplashResolution) {
  const option = RESOLUTIONS.find((candidate) => candidate.id === resolution)!;
  if (!photo.width || !photo.height) return option.label;
  const width = option.maxWidth ? Math.min(photo.width, option.maxWidth) : photo.width;
  return `${width} × ${Math.max(1, Math.round((photo.height / photo.width) * width))}`;
}

export function UnsplashPicker({
  projectId,
  onImported,
}: {
  projectId: string;
  onImported: (asset: UnsplashAsset) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [results, setResults] = useState<UnsplashPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<UnsplashPhoto | null>(null);
  const [resolution, setResolution] = useState<UnsplashResolution>("regular");
  const [importing, setImporting] = useState(false);

  const search = async (event?: FormEvent, nextPage = 1) => {
    event?.preventDefault();
    const requestedQuery = (nextPage === 1 ? query : activeQuery).trim();
    if (!requestedQuery) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.searchUnsplash(requestedQuery, nextPage);
      setActiveQuery(requestedQuery);
      setResults((current) => (nextPage === 1 ? response.results : [...current, ...response.results]));
      setPage(nextPage);
      setTotalPages(response.totalPages);
    } catch (searchError) {
      setError(String((searchError as Error).message ?? searchError));
      if (nextPage === 1) setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const importSelected = async () => {
    if (!selected) return;
    setImporting(true);
    setError("");
    try {
      const response = await api.importUnsplash(projectId, selected.id, resolution);
      onImported(response.asset);
      setSelected(null);
    } catch (importError) {
      setError(String((importError as Error).message ?? importError));
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="panel-section-title" style={{ marginTop: 18 }}>Unsplash</div>
      <form className="unsplash-search" onSubmit={(event) => void search(event)}>
        <input
          className="prop-input"
          type="search"
          value={query}
          placeholder="Search stock images"
          aria-label="Search Unsplash"
          disabled={loading}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="btn" type="submit" disabled={loading || !query.trim()}>
          {loading && page === 1 ? "Searching…" : "Search"}
        </button>
      </form>
      {error && !selected && <div className="unsplash-error">{error}</div>}
      {!activeQuery && results.length === 0 && <div className="panel-empty">Search Unsplash for stock photography.</div>}
      {activeQuery && !loading && results.length === 0 && !error && <div className="panel-empty">No photos found.</div>}
      <div className="unsplash-grid">
        {results.map((photo) => (
          <button
            key={photo.id}
            type="button"
            className="unsplash-tile"
            title={`${photo.description || "Unsplash photo"} — ${photo.user.name}`}
            onClick={() => {
              setResolution("regular");
              setSelected(photo);
              setError("");
            }}
          >
            <img src={photo.urls.thumb || photo.urls.small} alt={photo.description} loading="lazy" />
          </button>
        ))}
      </div>
      {page < totalPages && (
        <button className="btn unsplash-load-more" type="button" disabled={loading} onClick={() => void search(undefined, page + 1)}>
          {loading ? "Loading…" : "Load more"}
        </button>
      )}

      {selected && (
        <div className="unsplash-modal-backdrop" role="presentation" onMouseDown={() => !importing && setSelected(null)}>
          <section className="unsplash-modal" role="dialog" aria-modal="true" aria-label="Add Unsplash image" onMouseDown={(event) => event.stopPropagation()}>
            <div className="unsplash-modal-preview">
              <img src={selected.urls[resolution] || selected.urls.regular} alt={selected.description} />
            </div>
            <div className="unsplash-modal-content">
              <div>
                <h3>{selected.description || "Unsplash image"}</h3>
                <p className="muted">
                  Photo by{" "}
                  <a href={selected.user.profileUrl} target="_blank" rel="noreferrer">{selected.user.name}</a>
                  {" on "}
                  <a href={selected.links.html} target="_blank" rel="noreferrer">Unsplash</a>
                </p>
              </div>
              <div className="unsplash-resolution-options">
                {RESOLUTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`unsplash-resolution ${resolution === option.id ? "active" : ""}`}
                    onClick={() => setResolution(option.id)}
                  >
                    <strong>{option.label}</strong>
                    <span>{resolutionSize(selected, option.id)}px</span>
                  </button>
                ))}
              </div>
              {error && <div className="unsplash-error">{error}</div>}
              <div className="modal-actions">
                <button className="btn" type="button" disabled={importing} onClick={() => setSelected(null)}>Cancel</button>
                <button className="btn primary" type="button" disabled={importing} onClick={() => void importSelected()}>
                  {importing ? "Adding…" : "Add to assets"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
