import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

function readHashSlug() {
    const match = window.location.hash.match(/^#\/jsr\/([a-z0-9-]+)/i);
    return match ? match[1] : "";
}

function App() {
    const [catalogStatus, setCatalogStatus] = useState("loading");
    const [catalog, setCatalog] = useState([]);
    const [query, setQuery] = useState("");
    const [activeSlug, setActiveSlug] = useState(readHashSlug());
    const [detailState, setDetailState] = useState({ status: "idle", data: null, error: "" });
    const deferredQuery = useDeferredValue(query);

    useEffect(() => {
        let mounted = true;

        fetch("./data/catalog.json")
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Daftar JSR gagal dimuat.");
                }

                return response.json();
            })
            .then((data) => {
                if (!mounted) {
                    return;
                }

                setCatalog(data);
                setCatalogStatus("success");
            })
            .catch(() => {
                if (!mounted) {
                    return;
                }

                setCatalogStatus("error");
            });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const onHashChange = () => {
            startTransition(() => {
                setActiveSlug(readHashSlug());
            });
        };

        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    useEffect(() => {
        if (!activeSlug) {
            setDetailState({ status: "idle", data: null, error: "" });
            return undefined;
        }

        const controller = new AbortController();

        setDetailState({ status: "loading", data: null, error: "" });

        fetch(`./data/jsr/${activeSlug}.json`, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Catatan JSR tidak ditemukan.");
                }

                return response.json();
            })
            .then((data) => {
                setDetailState({ status: "success", data, error: "" });
            })
            .catch((error) => {
                if (error.name === "AbortError") {
                    return;
                }

                setDetailState({ status: "error", data: null, error: error.message });
            });

        return () => controller.abort();
    }, [activeSlug]);

    const filteredCatalog = useMemo(() => {
        const normalizedQuery = deferredQuery.trim().toLowerCase();

        if (!normalizedQuery) {
            return catalog;
        }

        return catalog.filter((item) => {
            const haystack = [item.title, item.focus, item.tagline, ...(item.tags ?? [])]
                .join(" ")
                .toLowerCase();

            return haystack.includes(normalizedQuery);
        });
    }, [catalog, deferredQuery]);

    function openNote(slug) {
        window.location.hash = `#/jsr/${slug}`;
    }

    function closePanel() {
        const url = new URL(window.location.href);
        url.hash = "";
        window.history.pushState({}, "", url);
        setActiveSlug("");
    }

    return (
        <div className="app-shell">
            <main className="page-frame">
                <section className="hero-panel">
                    <div>
                        <span className="eyebrow">Koleksi Catatan Kesehatan</span>
                        <h1>Jurus Sehat Rasulullah</h1>
                        <p>
                            Konsepnya sama seperti aplikasi dzikir, tetapi fokus ke kumpulan catatan bahan kesehatan,
                            resep minuman herbal, dan manfaat yang bisa berpengaruh ke kebugaran harian.
                        </p>
                    </div>

                    <div className="hero-stats">
                        <article>
                            <strong>{catalog.length}</strong>
                            <span>Total catatan JSR</span>
                        </article>
                        <article>
                            <strong>{activeSlug ? "1" : "0"}</strong>
                            <span>Catatan sedang dibuka</span>
                        </article>
                    </div>
                </section>

                <section className="content-grid">
                    <div className="catalog-panel">
                        <div className="section-head">
                            <div>
                                <span className="eyebrow">Halaman Utama</span>
                                <h2>Daftar catatan JSR</h2>
                            </div>
                            <label className="search-box" htmlFor="search-jsr">
                                <span>Cari catatan</span>
                                <input
                                    id="search-jsr"
                                    type="search"
                                    placeholder="kunyit, imun, pencernaan..."
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                />
                            </label>
                        </div>

                        {catalogStatus === "loading" ? <div className="empty-state">Memuat daftar JSR...</div> : null}
                        {catalogStatus === "error" ? (
                            <div className="empty-state">Data katalog gagal dimuat. Periksa file JSON di folder public/data.</div>
                        ) : null}

                        {catalogStatus === "success" ? (
                            filteredCatalog.length ? (
                                <div className="catalog-grid">
                                    {filteredCatalog.map((item) => (
                                        <article key={item.slug} className="note-card">
                                            <div className="note-card__top">
                                                <span className="chip">{item.focus}</span>
                                            </div>
                                            <h3>{item.title}</h3>
                                            <p>{item.tagline}</p>
                                            <div className="tag-row">
                                                {item.tags.map((tag) => (
                                                    <span key={tag} className="tag-row__item">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                            <button className="card-action" onClick={() => openNote(item.slug)}>
                                                Buka catatan
                                            </button>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">Tidak ada catatan yang cocok dengan pencarian Anda.</div>
                            )
                        ) : null}
                    </div>

                    <aside className="detail-panel">
                        {!activeSlug ? (
                            <div className="detail-placeholder">
                                <span className="eyebrow">AJAX Panel</span>
                                <h2>Pilih salah satu catatan JSR</h2>
                                <p>
                                    Detail catatan akan dimuat dari JSON secara asynchronous. Klik salah satu kartu pada daftar
                                    untuk melihat bahan, cara membuat, dan manfaatnya.
                                </p>
                            </div>
                        ) : null}

                        {detailState.status === "loading" ? (
                            <div className="detail-loading">
                                <div className="loading-line loading-line--title" />
                                <div className="loading-line" />
                                <div className="loading-line" />
                                <div className="loading-card" />
                                <div className="loading-card" />
                            </div>
                        ) : null}

                        {detailState.status === "error" ? (
                            <div className="detail-placeholder">
                                <span className="eyebrow">Gagal Memuat</span>
                                <h2>{detailState.error}</h2>
                                <button className="card-action" onClick={closePanel}>
                                    Kembali ke daftar
                                </button>
                            </div>
                        ) : null}

                        {detailState.status === "success" ? (
                            <article className="detail-content">
                                <div className="detail-head">
                                    <h2>{detailState.data.title}</h2>
                                    <button className="close-button" onClick={closePanel} aria-label="Tutup panel">
                                        Tutup
                                    </button>
                                </div>

                                <p className="detail-description">{detailState.data.description}</p>

                                <section className="detail-section">
                                    <h3>Bahan</h3>
                                    <ol>
                                        {detailState.data.bahan.map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ol>
                                </section>

                                <section className="detail-section">
                                    <h3>Cara membuat :</h3>
                                    <ol>
                                        {detailState.data.caraMembuat.map((step) => (
                                            <li key={step}>{step}</li>
                                        ))}
                                    </ol>
                                </section>

                                <section className="detail-section">
                                    <h3>Manfaatnya :</h3>
                                    <ol>
                                        {detailState.data.manfaat.map((benefit) => (
                                            <li key={benefit}>{benefit}</li>
                                        ))}
                                    </ol>
                                </section>
                            </article>
                        ) : null}
                    </aside>
                </section>
            </main>
        </div>
    );
}

export default App;
